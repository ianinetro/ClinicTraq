from __future__ import annotations

import asyncio
import logging
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from worker import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ── X12 835 EDI mini-parser ───────────────────────────────────────────────────

def _parse_835(edi_text: str) -> List[Dict[str, Any]]:
    """
    Parse an X12 835 EDI file into a list of claim payment dicts.
    Returns list of {patient_name, patient_control_number, billed, paid, dos, service_lines[]}
    """
    claims = []
    current_claim: Optional[Dict[str, Any]] = None
    current_lines: List[Dict[str, Any]] = []

    element_sep = edi_text[3] if len(edi_text) > 3 else "*"
    segment_sep = "~"

    segments = [s.strip() for s in edi_text.split(segment_sep) if s.strip()]

    for seg in segments:
        parts = seg.split(element_sep)
        seg_id = parts[0]

        if seg_id == "CLP":
            # Claim-level payment data
            # CLP*PCN*status*billed*paid**claim_type*payer_claim_num
            if current_claim is not None:
                current_claim["service_lines"] = current_lines
                claims.append(current_claim)
            current_lines = []
            current_claim = {
                "patient_control_number": parts[1] if len(parts) > 1 else None,
                "billed_amount": _to_float(parts[3]) if len(parts) > 3 else None,
                "paid_amount": _to_float(parts[4]) if len(parts) > 4 else None,
                "payer_claim_control_number": parts[7] if len(parts) > 7 else None,
                "patient_name": None,
                "dos": None,
                "service_lines": [],
            }

        elif seg_id == "NM1" and current_claim is not None:
            # NM1*QC = patient name in 835
            if len(parts) > 1 and parts[1] == "QC":
                last = parts[3] if len(parts) > 3 else ""
                first = parts[4] if len(parts) > 4 else ""
                current_claim["patient_name"] = f"{first} {last}".strip()

        elif seg_id == "SVC" and current_claim is not None:
            # SVC*CPT code*billed*paid
            cpt = None
            if len(parts) > 1:
                # Format: SVC*HC:99213:25*100.00*80.00*...*units
                svc_parts = parts[1].split(":")
                cpt = svc_parts[1] if len(svc_parts) > 1 else svc_parts[0]
            line = {
                "cpt_code": cpt,
                "billed_amount": _to_float(parts[2]) if len(parts) > 2 else None,
                "paid_amount": _to_float(parts[3]) if len(parts) > 3 else None,
                "units": int(parts[5]) if len(parts) > 5 and parts[5] else 1,
                "adjustment_reason_code": None,
                "adjustment_amount": None,
            }
            current_lines.append(line)

        elif seg_id == "DTM" and current_claim is not None:
            # DTM*472 = service date
            if len(parts) > 2 and parts[1] == "472":
                try:
                    current_claim["dos"] = datetime.strptime(parts[2], "%Y%m%d").date()
                except ValueError:
                    pass

        elif seg_id == "CAS" and current_lines:
            # CAS*CO*45*20.00 = adjustment reason
            if len(parts) > 3:
                current_lines[-1]["adjustment_reason_code"] = f"{parts[1]}-{parts[2]}"
                current_lines[-1]["adjustment_amount"] = _to_float(parts[3])

    if current_claim is not None:
        current_claim["service_lines"] = current_lines
        claims.append(current_claim)

    return claims


def _to_float(s: str) -> Optional[float]:
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


# ── Match scoring ─────────────────────────────────────────────────────────────

def _compute_match_confidence(
    era_pcn: Optional[str],
    era_patient_name: Optional[str],
    era_dos: Optional[Any],
    era_billed: Optional[float],
    era_cpt_codes: List[str],
    claim_id: str,
    claim_pcn: str,
    claim_patient_name: Optional[str],
    claim_dos: Optional[Any],
    claim_charge: Optional[float],
    claim_cpt_codes: List[str],
) -> float:
    """
    Score ERA payment against a claim. Returns 0.0 – 1.0.
    Scoring breakdown:
      PCN exact match    → 0.40
      Patient name fuzzy → 0.25
      Date of service    → 0.20
      Billed amount      → 0.10
      CPT codes overlap  → 0.05
    """
    score = 0.0

    # PCN match (strongest signal)
    if era_pcn and claim_pcn and era_pcn.strip() == claim_pcn.strip():
        score += 0.40

    # Patient name fuzzy (simple normalized token match)
    if era_patient_name and claim_patient_name:
        era_tokens = set(era_patient_name.lower().split())
        claim_tokens = set(claim_patient_name.lower().split())
        overlap = len(era_tokens & claim_tokens)
        total = max(len(era_tokens | claim_tokens), 1)
        score += 0.25 * (overlap / total)

    # DOS match
    if era_dos and claim_dos and str(era_dos) == str(claim_dos):
        score += 0.20

    # Billed amount within $1
    if era_billed is not None and claim_charge is not None:
        if abs(era_billed - float(claim_charge)) <= 1.0:
            score += 0.10

    # CPT code overlap
    if era_cpt_codes and claim_cpt_codes:
        era_set = set(era_cpt_codes)
        claim_set = set(claim_cpt_codes)
        overlap = len(era_set & claim_set)
        total = max(len(era_set | claim_set), 1)
        score += 0.05 * (overlap / total)

    return min(round(score, 3), 1.0)


# ── Celery tasks ──────────────────────────────────────────────────────────────

@celery_app.task(name="workers.era_importer.import_era", bind=True, max_retries=3)
def import_era(self, era_file_id: str, tenant_id: str):
    try:
        _run_async(_async_import_era(era_file_id, tenant_id))
    except Exception as exc:
        logger.exception("import_era failed for %s: %s", era_file_id, exc)
        raise self.retry(exc=exc, countdown=120)


async def _async_import_era(era_file_id: str, tenant_id: str):
    from database import AsyncSessionLocal
    from domains.payments.models import ERAFile, ERAPayment, ERAServiceLine
    from domains.claims.models import Claim, ClaimLine
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    era_uuid = uuid.UUID(era_file_id)
    tenant_uuid = uuid.UUID(tenant_id)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(ERAFile).where(ERAFile.id == era_uuid))
        era_file = result.scalar_one_or_none()
        if not era_file:
            logger.error("ERAFile %s not found", era_file_id)
            return

        era_file.status = "processing"
        await db.flush()

        try:
            parsed_claims = _parse_835(era_file.raw_content or "")

            # Load open claims for fuzzy matching
            claims_result = await db.execute(
                select(Claim)
                .where(Claim.tenant_id == tenant_uuid, Claim.status.in_(["submitted", "accepted"]))
                .options(selectinload(Claim.lines))
                .limit(10000)
            )
            open_claims = claims_result.scalars().all()

            for pc in parsed_claims:
                era_cpt_codes = [sl.get("cpt_code") for sl in pc.get("service_lines", []) if sl.get("cpt_code")]

                # Find best matching claim
                best_claim = None
                best_confidence = 0.0

                for claim in open_claims:
                    claim_cpt_codes = [l.cpt_code for l in claim.lines]
                    patient_name = None
                    # Would load patient name in production; skip for perf here
                    confidence = _compute_match_confidence(
                        era_pcn=pc.get("patient_control_number"),
                        era_patient_name=pc.get("patient_name"),
                        era_dos=pc.get("dos"),
                        era_billed=pc.get("billed_amount"),
                        era_cpt_codes=era_cpt_codes,
                        claim_id=str(claim.id),
                        claim_pcn=str(claim.id),  # PCN == claim ID
                        claim_patient_name=patient_name,
                        claim_dos=claim.date_of_service,
                        claim_charge=float(claim.total_charge),
                        claim_cpt_codes=claim_cpt_codes,
                    )
                    if confidence > best_confidence:
                        best_confidence = confidence
                        best_claim = claim

                match_status = "unmatched"
                if best_confidence >= 0.80:
                    match_status = "matched"
                elif best_confidence >= 0.50:
                    match_status = "matched"  # low confidence match — still match for review

                era_payment = ERAPayment(
                    tenant_id=tenant_uuid,
                    era_file_id=era_uuid,
                    claim_id=best_claim.id if best_claim else None,
                    patient_control_number=pc.get("patient_control_number"),
                    payer_claim_control_number=pc.get("payer_claim_control_number"),
                    billed_amount=pc.get("billed_amount"),
                    paid_amount=pc.get("paid_amount"),
                    patient_name=pc.get("patient_name"),
                    dos=pc.get("dos"),
                    match_confidence=best_confidence,
                    match_status=match_status,
                )
                db.add(era_payment)
                await db.flush()

                for sl in pc.get("service_lines", []):
                    era_sl = ERAServiceLine(
                        tenant_id=tenant_uuid,
                        era_payment_id=era_payment.id,
                        cpt_code=sl.get("cpt_code"),
                        billed_amount=sl.get("billed_amount"),
                        paid_amount=sl.get("paid_amount"),
                        units=sl.get("units"),
                        adjustment_reason_code=sl.get("adjustment_reason_code"),
                        adjustment_amount=sl.get("adjustment_amount"),
                    )
                    db.add(era_sl)

            era_file.status = "imported"
            await db.commit()
            logger.info("ERA %s imported: %d claims processed", era_file_id, len(parsed_claims))

        except Exception as exc:
            era_file.status = "error"
            era_file.error_message = str(exc)
            await db.commit()
            raise
