from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from domains.claims.models import Claim, ClaimLine, ClaimStatusEvent, ClaimSubmission, ClaimValidationIssue
from domains.master_data.models import Payer
from domains.patients.models import Patient
from domains.claims.schemas import (
    BatchSubmitRequest,
    ClaimCreate,
    ClaimLifecycleEvent,
    ClaimResponse,
    ClaimUpdate,
    ClaimValidationIssueResponse,
    CMS1500Preview,
)
from domains.claims.validation import ClaimValidator
from domains.identity.dependencies import TenantContext, require_permission
from domains.identity.models import User

router = APIRouter(tags=["claims"])


async def _load_claim(db: AsyncSession, claim_id: uuid.UUID, tenant_id: uuid.UUID) -> Claim:
    result = await db.execute(
        select(Claim)
        .where(Claim.id == claim_id, Claim.tenant_id == tenant_id)
        .options(
            selectinload(Claim.lines),
            selectinload(Claim.validation_issues),
            selectinload(Claim.status_events),
        )
    )
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim


@router.get("/claims", response_model=List[ClaimResponse])
async def list_claims(
    patient_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    payer_id: Optional[uuid.UUID] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("claims:read")),
):
    stmt = (
        select(Claim)
        .where(Claim.tenant_id == ctx.tenant_id)
        .options(selectinload(Claim.lines), selectinload(Claim.validation_issues))
    )
    if patient_id:
        stmt = stmt.where(Claim.patient_id == patient_id)
    if status_filter:
        stmt = stmt.where(Claim.status == status_filter)
    if payer_id:
        stmt = stmt.where(Claim.payer_id == payer_id)
    stmt = stmt.offset(offset).limit(limit).order_by(Claim.created_at.desc())
    result = await db.execute(stmt)
    claims = result.scalars().all()

    # Collect unique payer and patient IDs to fetch in bulk
    payer_ids = {c.payer_id for c in claims if c.payer_id}
    patient_ids = {c.patient_id for c in claims if c.patient_id}

    payer_map: dict = {}
    if payer_ids:
        payer_result = await db.execute(select(Payer).where(Payer.id.in_(payer_ids)))
        payer_map = {p.id: p.name for p in payer_result.scalars().all()}

    patient_map: dict = {}
    if patient_ids:
        patient_result = await db.execute(select(Patient).where(Patient.id.in_(patient_ids)))
        patient_map = {p.id: f"{p.first_name} {p.last_name}" for p in patient_result.scalars().all()}

    responses = []
    for claim in claims:
        resp = ClaimResponse.model_validate(claim)
        resp.payer_name = payer_map.get(claim.payer_id) if claim.payer_id else None
        resp.patient_name = patient_map.get(claim.patient_id) if claim.patient_id else None
        responses.append(resp)
    return responses


@router.post("/claims", response_model=ClaimResponse, status_code=status.HTTP_201_CREATED)
async def create_claim(
    body: ClaimCreate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("claims:write")),
):
    from datetime import date
    today = date.today()
    claim_number = f"CT-{today.strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"
    claim = Claim(
        tenant_id=ctx.tenant_id,
        claim_number=claim_number,
        **body.model_dump(),
    )
    db.add(claim)
    await db.flush()
    db.add(ClaimStatusEvent(
        tenant_id=ctx.tenant_id,
        claim_id=claim.id,
        from_status=None,
        to_status="draft",
        changed_by=current_user.id,
        note="Claim created",
    ))
    await db.flush()
    return await _load_claim(db, claim.id, ctx.tenant_id)


@router.get("/claims/repair-queue", response_model=List[ClaimResponse])
async def repair_queue(
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("claims:read")),
):
    """Return claims that have blocking validation issues or are stale."""
    result = await db.execute(
        select(Claim)
        .where(
            Claim.tenant_id == ctx.tenant_id,
            or_(
                Claim.validation_status == "invalid",
                Claim.status == "rejected",
                Claim.status == "denied",
            ),
        )
        .options(selectinload(Claim.lines), selectinload(Claim.validation_issues))
        .limit(200)
    )
    return result.scalars().all()


@router.get("/claims/{claim_id}", response_model=ClaimResponse)
async def get_claim(
    claim_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("claims:read")),
):
    return await _load_claim(db, claim_id, ctx.tenant_id)


@router.patch("/claims/{claim_id}", response_model=ClaimResponse)
async def update_claim(
    claim_id: uuid.UUID,
    body: ClaimUpdate,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("claims:write")),
):
    claim = await _load_claim(db, claim_id, ctx.tenant_id)
    old_status = claim.status
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(claim, k, v)
    if body.status and body.status != old_status:
        db.add(ClaimStatusEvent(
            tenant_id=ctx.tenant_id,
            claim_id=claim.id,
            from_status=old_status,
            to_status=body.status,
            changed_by=current_user.id,
        ))
    await db.flush()
    return await _load_claim(db, claim_id, ctx.tenant_id)


@router.post("/claims/{claim_id}/validate", response_model=List[ClaimValidationIssueResponse])
async def validate_claim(
    claim_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("claims:write")),
):
    claim = await _load_claim(db, claim_id, ctx.tenant_id)

    # Clear existing unresolved issues
    for issue in claim.validation_issues:
        if not issue.resolved:
            await db.delete(issue)
    await db.flush()

    validator = ClaimValidator(claim, db)
    issues_data = await validator.run_all()

    new_issues = []
    for issue_data in issues_data:
        issue = ClaimValidationIssue(
            tenant_id=ctx.tenant_id,
            claim_id=claim.id,
            **issue_data,
        )
        db.add(issue)
        new_issues.append(issue)

    has_blocking = any(i["severity"] == "blocking" for i in issues_data)
    claim.validation_status = "invalid" if has_blocking else ("warnings" if issues_data else "valid")
    await db.flush()

    return new_issues


@router.get("/claims/{claim_id}/cms1500-preview", response_model=CMS1500Preview)
async def cms1500_preview(
    claim_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("claims:read")),
):
    claim = await _load_claim(db, claim_id, ctx.tenant_id)

    # Load related data
    from domains.patients.models import Patient
    from domains.master_data.models import Provider, Payer, PatientInsurance

    patient_result = await db.execute(select(Patient).where(Patient.id == claim.patient_id))
    patient = patient_result.scalar_one_or_none()

    provider_name = None
    provider_npi = None
    if claim.provider_id:
        prov_result = await db.execute(select(Provider).where(Provider.id == claim.provider_id))
        prov = prov_result.scalar_one_or_none()
        if prov:
            provider_name = f"{prov.first_name} {prov.last_name}"
            provider_npi = prov.npi

    payer_name = None
    if claim.payer_id:
        payer_result = await db.execute(select(Payer).where(Payer.id == claim.payer_id))
        payer = payer_result.scalar_one_or_none()
        if payer:
            payer_name = payer.name

    insured_id = None
    if claim.patient_insurance_id:
        from domains.patients.models import PatientInsurance as PI
        ins_result = await db.execute(select(PI).where(PI.id == claim.patient_insurance_id))
        ins = ins_result.scalar_one_or_none()
        if ins:
            insured_id = getattr(ins, "member_id", None) or getattr(ins, "subscriber_id", None)

    diagnosis_codes = [d.get("icd_code") for d in (claim.diagnoses_snapshot or [])]
    service_lines = [
        {
            "cpt_code": l.cpt_code,
            "modifiers": l.modifiers,
            "units": l.units,
            "charge_amount": float(l.charge_amount or 0),
            "revenue_code": l.revenue_code,
        }
        for l in claim.lines
    ]

    patient_name = f"{patient.first_name} {patient.last_name}" if patient else "Unknown"
    dob = getattr(patient, "date_of_birth", None) or getattr(patient, "dob", None)

    return CMS1500Preview(
        claim_id=str(claim.id),
        patient_control_number=str(claim.id),
        claim_number=claim.claim_number,
        patient_name=patient_name,
        date_of_birth=dob,
        insured_id=insured_id,
        payer_name=payer_name,
        provider_name=provider_name,
        provider_npi=provider_npi,
        date_of_service=claim.date_of_service,
        place_of_service=None,
        diagnosis_codes=diagnosis_codes,
        service_lines=service_lines,
        total_charge=float(claim.total_charge),
    )


@router.get("/claims/{claim_id}/events", response_model=List[ClaimLifecycleEvent])
async def claim_events(
    claim_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("claims:read")),
):
    result = await db.execute(
        select(ClaimStatusEvent)
        .where(ClaimStatusEvent.claim_id == claim_id, ClaimStatusEvent.tenant_id == ctx.tenant_id)
        .order_by(ClaimStatusEvent.changed_at.asc())
    )
    return result.scalars().all()


@router.get("/claims/{claim_id}/edi837")
async def download_edi837(
    claim_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("claims:read")),
):
    """Generate and return an EDI 837P file for the claim."""
    from fastapi.responses import PlainTextResponse
    from domains.claims.edi837 import generate_837p
    from domains.master_data.models import Provider, Payer, BillingProvider
    from domains.patients.models import Patient, PatientInsurance

    claim = await _load_claim(db, claim_id, ctx.tenant_id)

    patient = (await db.execute(select(Patient).where(Patient.id == claim.patient_id))).scalar_one_or_none()
    prov = None
    if claim.provider_id:
        prov = (await db.execute(select(Provider).where(Provider.id == claim.provider_id))).scalar_one_or_none()
    payer = None
    if claim.payer_id:
        payer = (await db.execute(select(Payer).where(Payer.id == claim.payer_id))).scalar_one_or_none()
    bp = None
    if claim.billing_provider_id:
        bp = (await db.execute(select(BillingProvider).where(BillingProvider.id == claim.billing_provider_id))).scalar_one_or_none()
    ins = None
    if claim.patient_insurance_id:
        ins = (await db.execute(select(PatientInsurance).where(PatientInsurance.id == claim.patient_insurance_id))).scalar_one_or_none()

    diagnoses = [d.get("icd_code", "") for d in (claim.diagnoses_snapshot or [])]
    service_lines = [
        {
            "cpt_code": l.cpt_code,
            "modifiers": l.modifiers or [],
            "units": l.units,
            "charge": float(l.charge_amount),
            "diagnosis_pointers": l.diagnosis_pointers or [1],
        }
        for l in claim.lines
    ]

    edi = generate_837p(
        submitter_id=bp.npi if bp else "0000000000",
        submitter_name=bp.name if bp else "BILLING PROVIDER",
        receiver_id="999999999",
        receiver_name="CLEARINGHOUSE",
        billing_npi=bp.npi if bp else (prov.npi if prov else "0000000000"),
        billing_name=bp.name if bp else "BILLING PROVIDER",
        billing_tax_id=bp.tax_id if bp else "000000000",
        billing_address=bp.address_line1 if bp else "",
        billing_city=bp.city if bp else "",
        billing_state=bp.state if bp else "",
        billing_zip=bp.zip_code if bp else "",
        rendering_npi=prov.npi if prov else "0000000000",
        rendering_last=prov.last_name if prov else "",
        rendering_first=prov.first_name if prov else "",
        payer_id=payer.payer_id if payer else "UNKNOWN",
        payer_name=payer.name if payer else "UNKNOWN PAYER",
        subscriber_id=ins.member_id if ins and hasattr(ins, "member_id") else "000000000",
        subscriber_last=patient.last_name if patient else "",
        subscriber_first=patient.first_name if patient else "",
        subscriber_dob=getattr(patient, "date_of_birth", None) or getattr(patient, "dob", None),
        subscriber_gender=getattr(patient, "sex", "U") or "U",
        claim_number=claim.claim_number or str(claim.id),
        claim_total=float(claim.total_charge),
        date_of_service=claim.date_of_service,
        authorization_number=claim.authorization_number or "",
        diagnoses=diagnoses,
        service_lines=service_lines,
    )
    return PlainTextResponse(content=edi, media_type="text/plain",
                             headers={"Content-Disposition": f"attachment; filename=claim_{claim.claim_number}.837"})


@router.get("/claims/{claim_id}/cms1500/preview")
async def preview_cms1500_html(
    claim_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("claims:read")),
):
    """Return CMS-1500 as HTML for in-browser preview/print."""
    import os
    from fastapi.responses import HTMLResponse
    from jinja2 import Environment, FileSystemLoader
    from domains.patients.models import Patient, PatientInsurance
    from domains.master_data.models import Provider, Payer, BillingProvider

    claim = await _load_claim(db, claim_id, ctx.tenant_id)
    patient = (await db.execute(select(Patient).where(Patient.id == claim.patient_id))).scalar_one_or_none()
    prov = None
    if claim.provider_id:
        prov = (await db.execute(select(Provider).where(Provider.id == claim.provider_id))).scalar_one_or_none()
    bp = None
    if claim.billing_provider_id:
        bp = (await db.execute(select(BillingProvider).where(BillingProvider.id == claim.billing_provider_id))).scalar_one_or_none()
    payer = None
    if claim.payer_id:
        payer = (await db.execute(select(Payer).where(Payer.id == claim.payer_id))).scalar_one_or_none()
    ins = None
    if claim.patient_insurance_id:
        ins = (await db.execute(select(PatientInsurance).where(PatientInsurance.id == claim.patient_insurance_id))).scalar_one_or_none()

    diagnosis_codes = [d.get("icd_code", "") for d in (claim.diagnoses_snapshot or [])]
    service_lines = [
        {
            "dos_from": str(claim.date_of_service) if claim.date_of_service else "",
            "dos_to": str(claim.date_of_service) if claim.date_of_service else "",
            "pos": l.place_of_service_code or "11",
            "cpt_code": l.cpt_code,
            "modifiers": l.modifiers or [],
            "diagnosis_pointers": l.diagnosis_pointers or [1],
            "charge_amount": float(l.charge_amount or 0),
            "units": l.units,
        }
        for l in claim.lines
    ]
    dob_str = ""
    if patient:
        dob_val = getattr(patient, "dob", None)
        if dob_val:
            dob_str = dob_val.strftime("%m/%d/%Y")

    templates_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "templates"))
    jinja_env = Environment(loader=FileSystemLoader(templates_dir))
    template = jinja_env.get_template("cms1500.html")
    rendered_html = template.render(
        claim_number=claim.claim_number or str(claim.id),
        patient_name=f"{patient.last_name}, {patient.first_name}" if patient else "",
        patient_account_number=patient.account_number if patient else "",
        patient_address=patient.address_line1 if patient else "",
        patient_city=patient.city if patient else "",
        patient_state=patient.state if patient else "",
        patient_zip=patient.zip if patient else "",
        patient_phone=patient.phone_home or patient.phone_cell or "" if patient else "",
        dob=dob_str,
        sex=getattr(patient, "sex", "") if patient else "",
        insured_id=ins.subscriber_id if ins else "",
        group_number=ins.group_number if ins else "",
        payer_name=payer.name if payer else "",
        authorization_number=claim.authorization_number or "",
        date_of_service=str(claim.date_of_service) if claim.date_of_service else "",
        diagnosis_codes=diagnosis_codes,
        service_lines=service_lines,
        total_charge=float(claim.total_charge or 0),
        total_paid=float(claim.total_paid or 0),
        provider_name=f"{prov.first_name} {prov.last_name}" if prov else "",
        rendering_provider_npi=prov.npi if prov else "",
        billing_provider_name=bp.name if bp else (f"{prov.first_name} {prov.last_name}" if prov else ""),
        billing_provider_npi=bp.npi if bp else (prov.npi if prov else ""),
        billing_address=bp.address_line1 if bp else "",
        billing_tax_id=bp.tax_id if bp else "",
        insured_name=f"{patient.last_name}, {patient.first_name}" if patient else "",
        referring_provider="",
        referring_npi="",
        relationship_to_insured=ins.relationship_to_insured or "Self" if ins else "Self",
        employment_related="NO",
        auto_accident="NO",
        other_accident="NO",
        signature_date=str(claim.date_of_service) if claim.date_of_service else "",
    )
    return HTMLResponse(content=rendered_html)


@router.get("/claims/{claim_id}/cms1500/pdf")
async def download_cms1500_pdf(
    claim_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("claims:read")),
):
    """Render CMS-1500 form as PDF and return as attachment."""
    import os
    from fastapi.responses import Response
    from jinja2 import Environment, FileSystemLoader
    from domains.patients.models import Patient, PatientInsurance
    from domains.master_data.models import Provider, Payer, BillingProvider

    try:
        from weasyprint import HTML as WeasyHTML
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF generation library not available on this server.")

    claim = await _load_claim(db, claim_id, ctx.tenant_id)

    patient = (await db.execute(select(Patient).where(Patient.id == claim.patient_id))).scalar_one_or_none()

    prov = None
    if claim.provider_id:
        prov = (await db.execute(select(Provider).where(Provider.id == claim.provider_id))).scalar_one_or_none()

    bp = None
    if claim.billing_provider_id:
        bp = (await db.execute(select(BillingProvider).where(BillingProvider.id == claim.billing_provider_id))).scalar_one_or_none()

    payer = None
    if claim.payer_id:
        payer = (await db.execute(select(Payer).where(Payer.id == claim.payer_id))).scalar_one_or_none()

    ins = None
    if claim.patient_insurance_id:
        ins = (await db.execute(select(PatientInsurance).where(PatientInsurance.id == claim.patient_insurance_id))).scalar_one_or_none()

    diagnosis_codes = [d.get("icd_code", "") for d in (claim.diagnoses_snapshot or [])]
    service_lines = [
        {
            "dos_from": str(claim.date_of_service) if claim.date_of_service else "",
            "dos_to": str(claim.date_of_service) if claim.date_of_service else "",
            "pos": l.place_of_service_code or "11",
            "cpt_code": l.cpt_code,
            "modifiers": l.modifiers or [],
            "diagnosis_pointers": l.diagnosis_pointers or [1],
            "charge_amount": float(l.charge_amount or 0),
            "units": l.units,
        }
        for l in claim.lines
    ]

    dob_str = ""
    if patient:
        dob_val = getattr(patient, "dob", None)
        if dob_val:
            dob_str = dob_val.strftime("%m/%d/%Y")

    templates_dir = os.path.join(os.path.dirname(__file__), "..", "..", "templates")
    templates_dir = os.path.abspath(templates_dir)
    jinja_env = Environment(loader=FileSystemLoader(templates_dir))
    template = jinja_env.get_template("cms1500.html")

    rendered_html = template.render(
        claim_number=claim.claim_number or str(claim.id),
        patient_name=f"{patient.last_name}, {patient.first_name}" if patient else "",
        patient_account_number=patient.account_number if patient else "",
        patient_address=patient.address_line1 if patient else "",
        patient_city=patient.city if patient else "",
        patient_state=patient.state if patient else "",
        patient_zip=patient.zip if patient else "",
        patient_phone=patient.phone_home or patient.phone_cell or "" if patient else "",
        dob=dob_str,
        sex=getattr(patient, "sex", "") if patient else "",
        insured_id=ins.subscriber_id if ins else "",
        group_number=ins.group_number if ins else "",
        payer_name=payer.name if payer else "",
        authorization_number=claim.authorization_number or "",
        date_of_service=str(claim.date_of_service) if claim.date_of_service else "",
        place_of_service="11",
        diagnosis_codes=diagnosis_codes,
        service_lines=service_lines,
        total_charge=float(claim.total_charge or 0),
        total_paid=float(claim.total_paid or 0),
        provider_name=f"{prov.first_name} {prov.last_name}" if prov else "",
        provider_npi=prov.npi if prov else "",
        rendering_provider_npi=prov.npi if prov else "",
        billing_provider_name=bp.name if bp else (f"{prov.first_name} {prov.last_name}" if prov else ""),
        billing_provider_npi=bp.npi if bp else (prov.npi if prov else ""),
        billing_address=bp.address_line1 if bp else "",
        billing_tax_id=bp.tax_id if bp else "",
        relationship_to_insured=ins.relationship_to_insured or "Self" if ins else "Self",
        insured_name=ins.insured_name if ins and hasattr(ins, 'insured_name') and ins.insured_name else (f"{patient.last_name}, {patient.first_name}" if patient else ""),
        referring_provider="",
        referring_npi="",
        has_secondary="NO",
        employment_related="NO",
        auto_accident="NO",
        other_accident="NO",
        signature_date=str(claim.date_of_service) if claim.date_of_service else "",
    )

    try:
        pdf_bytes = WeasyHTML(string=rendered_html).write_pdf()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF rendering failed: {exc}")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=cms1500_{claim_id}.pdf"},
    )


@router.post("/claims/{claim_id}/crossover")
async def crossover_claim(
    claim_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("claims:write")),
):
    """Create a secondary (crossover) claim from the original primary claim."""
    from datetime import date
    from domains.patients.models import PatientInsurance

    claim = await _load_claim(db, claim_id, ctx.tenant_id)

    # Look for secondary insurance
    try:
        sec_ins_result = await db.execute(
            select(PatientInsurance).where(
                PatientInsurance.patient_id == claim.patient_id,
                PatientInsurance.priority == "secondary",
                PatientInsurance.is_active == True,
            )
        )
        sec_ins = sec_ins_result.scalar_one_or_none()
    except Exception:
        sec_ins = None

    if not sec_ins:
        return {"message": "no secondary insurance on file"}

    today = date.today()
    new_claim_number = f"CT-{today.strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}-X"

    secondary_claim = Claim(
        tenant_id=ctx.tenant_id,
        claim_number=new_claim_number,
        patient_id=claim.patient_id,
        visit_id=claim.visit_id,
        provider_id=claim.provider_id,
        billing_provider_id=claim.billing_provider_id,
        referring_provider_id=claim.referring_provider_id,
        payer_id=sec_ins.payer_id,
        patient_insurance_id=sec_ins.id,
        claim_type=claim.claim_type,
        date_of_service=claim.date_of_service,
        total_charge=claim.total_charge,
        status="draft",
        validation_status="pending",
        diagnoses_snapshot=claim.diagnoses_snapshot,
        is_secondary=True,
        primary_claim_id=claim.id,
    )
    db.add(secondary_claim)
    await db.flush()

    # Copy claim lines
    for line in claim.lines:
        new_line = ClaimLine(
            tenant_id=ctx.tenant_id,
            claim_id=secondary_claim.id,
            cpt_code=line.cpt_code,
            modifiers=line.modifiers,
            units=line.units,
            charge_amount=line.charge_amount,
            revenue_code=line.revenue_code,
            sequence=line.sequence,
            diagnosis_pointers=line.diagnosis_pointers,
            rendering_provider_id=line.rendering_provider_id,
            place_of_service_code=line.place_of_service_code,
        )
        db.add(new_line)

    db.add(ClaimStatusEvent(
        tenant_id=ctx.tenant_id,
        claim_id=secondary_claim.id,
        from_status=None,
        to_status="draft",
        changed_by=current_user.id,
        note=f"Secondary (crossover) claim created from primary claim {claim.claim_number or str(claim.id)}. "
             f"Primary paid: {float(claim.total_paid):.2f}",
    ))
    await db.flush()

    return {
        "id": str(secondary_claim.id),
        "claim_number": secondary_claim.claim_number,
        "status": secondary_claim.status,
        "payer_id": str(secondary_claim.payer_id) if secondary_claim.payer_id else None,
        "patient_insurance_id": str(secondary_claim.patient_insurance_id),
        "primary_claim_id": str(claim.id),
        "other_payer_paid": float(claim.total_paid),
        "total_charge": float(secondary_claim.total_charge),
        "is_secondary": True,
    }


@router.post("/claims/{claim_id}/denial")
async def create_denial(
    claim_id: uuid.UUID,
    body: dict,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("claims:write")),
):
    """Record a denial for a claim with CARC/RARC codes."""
    from domains.work_queue.models import DenialAppeal
    denial = DenialAppeal(
        tenant_id=ctx.tenant_id,
        claim_id=claim_id,
        carc_code=body.get("carc_code"),
        rarc_code=body.get("rarc_code"),
        denial_reason=body.get("denial_reason"),
        denied_amount=body.get("denied_amount"),
        appeal_status="draft",
        appeal_due_date=body.get("appeal_due_date"),
    )
    db.add(denial)
    claim = (await db.execute(select(Claim).where(Claim.id == claim_id, Claim.tenant_id == ctx.tenant_id))).scalar_one_or_none()
    if claim:
        claim.status = "denied"
    await db.flush()
    return {"id": str(denial.id), "status": "draft"}


@router.get("/claims/{claim_id}/denials")
async def list_denials(
    claim_id: uuid.UUID,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("claims:read")),
):
    from domains.work_queue.models import DenialAppeal
    result = await db.execute(
        select(DenialAppeal).where(DenialAppeal.claim_id == claim_id, DenialAppeal.tenant_id == ctx.tenant_id)
        .order_by(DenialAppeal.created_at.desc())
    )
    appeals = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "carc_code": a.carc_code,
            "rarc_code": a.rarc_code,
            "denial_reason": a.denial_reason,
            "denied_amount": a.denied_amount,
            "appeal_status": a.appeal_status,
            "appeal_due_date": str(a.appeal_due_date) if a.appeal_due_date else None,
            "appeal_submitted_date": str(a.appeal_submitted_date) if a.appeal_submitted_date else None,
            "appeal_notes": a.appeal_notes,
            "resolved_amount": a.resolved_amount,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in appeals
    ]


@router.patch("/denials/{denial_id}")
async def update_denial(
    denial_id: uuid.UUID,
    body: dict,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("claims:write")),
):
    from domains.work_queue.models import DenialAppeal
    denial = (await db.execute(select(DenialAppeal).where(DenialAppeal.id == denial_id, DenialAppeal.tenant_id == ctx.tenant_id))).scalar_one_or_none()
    if not denial:
        raise HTTPException(status_code=404, detail="Denial not found")
    for k, v in body.items():
        if hasattr(denial, k):
            setattr(denial, k, v)
    await db.flush()
    return {"id": str(denial.id), "appeal_status": denial.appeal_status}


@router.post("/claims/batch-submit")
async def batch_submit(
    body: BatchSubmitRequest,
    ctx: TenantContext = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("claims:write")),
):
    submitted = []
    errors = []
    for claim_id in body.claim_ids:
        result = await db.execute(
            select(Claim)
            .where(Claim.id == claim_id, Claim.tenant_id == ctx.tenant_id)
            .options(selectinload(Claim.lines), selectinload(Claim.validation_issues))
        )
        claim = result.scalar_one_or_none()
        if not claim:
            errors.append({"claim_id": str(claim_id), "error": "Not found"})
            continue
        if claim.validation_status == "invalid":
            errors.append({"claim_id": str(claim_id), "error": "Claim has blocking validation issues"})
            continue
        old_status = claim.status
        claim.status = "submitted"
        claim.last_submitted_at = datetime.now(timezone.utc)
        db.add(ClaimStatusEvent(
            tenant_id=ctx.tenant_id,
            claim_id=claim.id,
            from_status=old_status,
            to_status="submitted",
            changed_by=current_user.id,
            note="Batch submission",
        ))
        db.add(ClaimSubmission(
            tenant_id=ctx.tenant_id,
            claim_id=claim.id,
            submission_method="electronic",
            clearinghouse=body.clearinghouse,
            submitted_by=current_user.id,
        ))
        submitted.append(str(claim_id))

    await db.flush()
    return {"submitted": submitted, "errors": errors}
