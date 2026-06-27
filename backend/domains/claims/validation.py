from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


# Modifiers that cannot be billed together on the same line
_MUTUALLY_EXCLUSIVE_MODIFIERS: List[tuple] = [
    ("RT", "LT"),
]

# Right-sided ICD-10 patterns
_RIGHT_DIAGNOSIS_PATTERN = re.compile(r"[A-Z]\d{2,5}[1]$", re.IGNORECASE)
_LEFT_DIAGNOSIS_PATTERN = re.compile(r"[A-Z]\d{2,5}[2]$", re.IGNORECASE)

# Known hospice codes that auto-trigger modifier GV/GW
_HOSPICE_CPT_CODES = {"99377", "99378"}

# Rough NCCI-inspired pairs that are never separately billable together on same visit
_NCCI_COLUMN1_COLUMN2 = {
    "99213": {"99211", "99212"},
    "99214": {"99211", "99212", "99213"},
    "99215": {"99211", "99212", "99213", "99214"},
    "20610": {"20600"},
    "93000": {"93005", "93010"},
}

# Inactive ICD-10 codes (sample list — real implementation would use a database table)
_INACTIVE_ICD_CODES = {
    "Z05.0",  # example retired code
    "V91.07XA",  # example
}


class ValidationIssueBuilder:
    def __init__(self):
        self._issues: List[Dict[str, Any]] = []

    def error(self, code: str, message: str, field_path: str = None, line: int = None):
        self._issues.append({
            "severity": "blocking",
            "code": code,
            "message": message,
            "field_path": field_path,
            "line_sequence": line,
        })

    def warning(self, code: str, message: str, field_path: str = None, line: int = None):
        self._issues.append({
            "severity": "warning",
            "code": code,
            "message": message,
            "field_path": field_path,
            "line_sequence": line,
        })

    def info(self, code: str, message: str):
        self._issues.append({
            "severity": "info",
            "code": code,
            "message": message,
            "field_path": None,
            "line_sequence": None,
        })

    def get(self) -> List[Dict[str, Any]]:
        return list(self._issues)


class ClaimValidator:
    def __init__(self, claim, db: AsyncSession):
        self.claim = claim
        self.db = db
        self._builder = ValidationIssueBuilder()

    async def run_all(self) -> List[Dict[str, Any]]:
        await self.validate_completeness()
        await self.validate_dates()
        await self.validate_codes()
        await self.validate_modifiers()
        await self.validate_tfl()
        return self._builder.get()

    async def validate_dates(self):
        claim = self.claim
        today = date.today()

        if claim.date_of_service and claim.date_of_service > today:
            self._builder.error(
                "FUTURE_DOS",
                f"Date of service {claim.date_of_service} is in the future.",
                "date_of_service",
            )

        if claim.admit_date and claim.discharge_date:
            if claim.admit_date > claim.discharge_date:
                self._builder.error(
                    "ADMIT_AFTER_DISCHARGE",
                    "Admit date cannot be after discharge date.",
                    "admit_date",
                )

        if claim.date_of_service:
            days_old = (today - claim.date_of_service).days
            if days_old > 730:
                self._builder.warning(
                    "STALE_DOS",
                    f"Date of service is {days_old} days old (>2 years). Verify correctness.",
                    "date_of_service",
                )

    async def validate_modifiers(self):
        for line in self.claim.lines:
            mods = line.modifiers or []
            mod_set = set(mods)

            # RT/LT cannot coexist
            if "RT" in mod_set and "LT" in mod_set:
                self._builder.error(
                    "MOD_RT_LT_CONFLICT",
                    "Modifiers RT and LT cannot both appear on the same line.",
                    "modifiers",
                    line.sequence,
                )

            # Check RT/LT vs diagnosis laterality
            diag_codes = []
            if self.claim.diagnoses_snapshot:
                diag_codes = [d.get("icd_code", "") for d in self.claim.diagnoses_snapshot]

            has_right_dx = any(_RIGHT_DIAGNOSIS_PATTERN.search(c) for c in diag_codes)
            has_left_dx = any(_LEFT_DIAGNOSIS_PATTERN.search(c) for c in diag_codes)

            if "RT" in mod_set and has_left_dx and not has_right_dx:
                self._builder.warning(
                    "MOD_RT_LEFT_DX",
                    f"Line {line.sequence}: Modifier RT used but diagnosis indicates left laterality.",
                    "modifiers",
                    line.sequence,
                )
            if "LT" in mod_set and has_right_dx and not has_left_dx:
                self._builder.warning(
                    "MOD_LT_RIGHT_DX",
                    f"Line {line.sequence}: Modifier LT used but diagnosis indicates right laterality.",
                    "modifiers",
                    line.sequence,
                )

            # Modifier 59 check: require distinct procedure context
            if "59" in mod_set:
                other_cpts = [l.cpt_code for l in self.claim.lines if l.id != line.id]
                if not other_cpts:
                    self._builder.info(
                        "MOD_59_SINGLE_LINE",
                        f"Line {line.sequence}: Modifier 59 used on single-line claim; verify medical necessity documentation.",
                    )

            # Modifier 25: should only accompany E&M codes (99xxx)
            if "25" in mod_set and not line.cpt_code.startswith("99"):
                self._builder.warning(
                    "MOD_25_NON_EM",
                    f"Line {line.sequence}: Modifier 25 should only be appended to E&M codes (99xxx).",
                    "modifiers",
                    line.sequence,
                )

            # Hospice modifier auto-check
            if line.cpt_code in _HOSPICE_CPT_CODES:
                if "GV" not in mod_set and "GW" not in mod_set:
                    self._builder.warning(
                        "HOSPICE_MOD_MISSING",
                        f"Line {line.sequence}: CPT {line.cpt_code} is a hospice service — modifier GV or GW should be present.",
                        "modifiers",
                        line.sequence,
                    )

    async def validate_codes(self):
        claim = self.claim
        diag_codes = []
        if claim.diagnoses_snapshot:
            diag_codes = [d.get("icd_code", "") for d in claim.diagnoses_snapshot]

        # Check inactive ICD codes
        for code in diag_codes:
            if code in _INACTIVE_ICD_CODES:
                self._builder.error(
                    "INACTIVE_ICD",
                    f"Diagnosis code {code} is inactive/retired.",
                    "diagnoses_snapshot",
                )

        # Primary diagnosis check
        primary_diags = [
            d for d in (claim.diagnoses_snapshot or []) if d.get("sequence") == 1
        ]
        if not primary_diags:
            self._builder.error(
                "NO_PRIMARY_DIAGNOSIS",
                "No primary diagnosis (sequence 1) found.",
                "diagnoses_snapshot",
            )

        # NCCI-inspired edit simulation
        cpt_codes = [l.cpt_code for l in claim.lines]
        for i, cpt in enumerate(cpt_codes):
            bundled = _NCCI_COLUMN1_COLUMN2.get(cpt, set())
            for other_cpt in cpt_codes:
                if other_cpt != cpt and other_cpt in bundled:
                    self._builder.error(
                        "NCCI_EDIT",
                        f"NCCI edit: {other_cpt} is bundled into {cpt} and cannot be billed separately without modifier.",
                        "lines",
                    )

    async def validate_completeness(self):
        claim = self.claim

        if not claim.payer_id:
            self._builder.error("MISSING_PAYER", "Claim has no payer assigned.", "payer_id")

        if not claim.provider_id:
            self._builder.error("MISSING_PROVIDER", "Claim has no rendering provider.", "provider_id")

        if not claim.diagnoses_snapshot or len(claim.diagnoses_snapshot) == 0:
            self._builder.error("MISSING_DIAGNOSIS", "Claim has no diagnosis codes.", "diagnoses_snapshot")

        if not claim.lines or len(claim.lines) == 0:
            self._builder.error("MISSING_LINES", "Claim has no service lines.", "lines")

        if not claim.date_of_service:
            self._builder.error("MISSING_DOS", "Claim has no date of service.", "date_of_service")

        if claim.claim_type == "institutional":
            if not claim.admit_code:
                self._builder.warning(
                    "MISSING_ADMIT_CODE",
                    "Institutional claim missing admit type code (UB-04 FL 14).",
                    "admit_code",
                )
            if not claim.discharge_code:
                self._builder.error(
                    "MISSING_DISCHARGE_CODE",
                    "Institutional claim missing patient discharge status (UB-04 FL 17).",
                    "discharge_code",
                )

    async def validate_tfl(self):
        from domains.master_data.tfl_settings import get_tfl_days, is_within_tfl
        claim = self.claim
        if not claim.payer_id or not claim.date_of_service:
            return
        tfl_days = await get_tfl_days(self.db, claim.tenant_id, claim.payer_id)
        if not is_within_tfl(claim.date_of_service, tfl_days):
            days_over = (date.today() - claim.date_of_service).days - tfl_days
            self._builder.error(
                "TFL_EXCEEDED",
                f"Timely filing limit of {tfl_days} days exceeded by {days_over} days for this payer.",
                "date_of_service",
            )
        elif (date.today() - claim.date_of_service).days > (tfl_days * 0.8):
            remaining = tfl_days - (date.today() - claim.date_of_service).days
            self._builder.warning(
                "TFL_APPROACHING",
                f"Timely filing limit approaching — only {remaining} days remaining.",
                "date_of_service",
            )
