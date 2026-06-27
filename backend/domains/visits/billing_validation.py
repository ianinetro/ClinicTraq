from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Optional


class BillingValidator:
    """Validates visit billing data and returns structured issues."""

    INPATIENT_POS = {"21", "51"}
    ADMIT_CODES = {str(c) for c in range(99221, 99224)}  # 99221-99223
    FOLLOWUP_CODES = {str(c) for c in range(99231, 99234)}  # 99231-99233

    def validate(self, visit: Any, charge_lines: List[Any]) -> List[Dict[str, str]]:
        issues: List[Dict[str, str]] = []
        issues.extend(self.validate_dates(visit, charge_lines))
        issues.extend(self.validate_diagnoses(visit))
        issues.extend(self.validate_charges(visit, charge_lines))
        issues.extend(self.validate_admit_codes(visit, charge_lines))
        return issues

    def validate_dates(self, visit: Any, charge_lines: List[Any]) -> List[Dict[str, str]]:
        issues = []
        today = date.today()
        one_year_ago = today - timedelta(days=365)

        for line in charge_lines:
            dos_from = line.dos_from
            dos_to = line.dos_to

            if dos_from and dos_from > today:
                issues.append({
                    "severity": "error",
                    "field": "dos_from",
                    "message": f"Date of service {dos_from} is in the future.",
                    "suggestion": "Correct the date of service to today or earlier.",
                })

            if dos_from and dos_to and dos_to < dos_from:
                issues.append({
                    "severity": "error",
                    "field": "dos_to",
                    "message": f"dos_to ({dos_to}) is before dos_from ({dos_from}).",
                    "suggestion": "Ensure dos_to is on or after dos_from.",
                })

            if dos_from and dos_from < one_year_ago:
                issues.append({
                    "severity": "warning",
                    "field": "dos_from",
                    "message": f"Date of service {dos_from} is more than 1 year old.",
                    "suggestion": "Verify timely filing limits with the payer — this claim may be denied.",
                })

        return issues

    def validate_admit_codes(self, visit: Any, charge_lines: List[Any]) -> List[Dict[str, str]]:
        issues = []
        pos_codes = {str(line.pos) for line in charge_lines if line.pos}

        if pos_codes & self.INPATIENT_POS:
            cpt_codes = {str(line.cpt_code) for line in charge_lines if line.cpt_code}
            has_admit = bool(cpt_codes & self.ADMIT_CODES)
            has_followup = bool(cpt_codes & self.FOLLOWUP_CODES)

            if not has_admit and not has_followup:
                issues.append({
                    "severity": "error",
                    "field": "charge_lines",
                    "message": "Inpatient claim (POS 21/51) is missing an admit or follow-up E&M code.",
                    "suggestion": "Add an admit code (99221-99223) or a follow-up code (99231-99233).",
                })
            elif has_admit:
                # Check if there are follow-up codes too in the same claim — potential duplicate admit
                if has_followup:
                    issues.append({
                        "severity": "warning",
                        "field": "charge_lines",
                        "message": "Both admit code and follow-up code present on the same claim.",
                        "suggestion": "Verify that these are not duplicate entries for the same admission.",
                    })

        return issues

    def validate_diagnoses(self, visit: Any) -> List[Dict[str, str]]:
        issues = []
        diagnoses = getattr(visit, "diagnoses", None) or []
        if not diagnoses:
            issues.append({
                "severity": "error",
                "field": "diagnoses",
                "message": "No diagnosis codes selected for this visit.",
                "suggestion": "Add at least one diagnosis code before creating a claim.",
            })
        return issues

    def validate_charges(self, visit: Any, charge_lines: List[Any]) -> List[Dict[str, str]]:
        issues = []
        if not charge_lines:
            issues.append({
                "severity": "error",
                "field": "charge_lines",
                "message": "No charge lines have been added to this visit.",
                "suggestion": "Add at least one procedure (CPT) code with a charge amount.",
            })
        return issues
