"""
EDI 837P (Professional) claim generator.
Produces ASC X12N 005010A1 formatted output for physician practice billing.
"""
from __future__ import annotations

import textwrap
from datetime import date, datetime
from typing import Any, Dict, List, Optional


def _fmt_date(d: date) -> str:
    return d.strftime("%Y%m%d")


def _fmt_time() -> str:
    return datetime.now().strftime("%H%M")


def _money(amount: float) -> str:
    return f"{float(amount):.2f}"


def _seg(*parts: str, term: str = "~") -> str:
    return "*".join(str(p) for p in parts) + term


def generate_837p(
    *,
    interchange_control_number: str = "000000001",
    group_control_number: str = "1",
    transaction_control_number: str = "0001",
    submitter_id: str,
    submitter_name: str,
    receiver_id: str = "999999999",
    receiver_name: str = "CLEARINGHOUSE",
    billing_npi: str,
    billing_name: str,
    billing_tax_id: str,
    billing_address: str = "",
    billing_city: str = "",
    billing_state: str = "",
    billing_zip: str = "",
    rendering_npi: str,
    rendering_last: str,
    rendering_first: str,
    payer_id: str,
    payer_name: str,
    subscriber_id: str,
    subscriber_last: str,
    subscriber_first: str,
    subscriber_dob: Optional[date] = None,
    subscriber_gender: str = "U",
    patient_last: str = "",
    patient_first: str = "",
    patient_dob: Optional[date] = None,
    patient_gender: str = "U",
    subscriber_is_patient: bool = True,
    claim_number: str,
    claim_total: float,
    place_of_service: str = "11",
    date_of_service: date = None,
    authorization_number: str = "",
    diagnoses: List[str] = None,
    service_lines: List[Dict[str, Any]] = None,
    referring_npi: str = "",
    referring_last: str = "",
    referring_first: str = "",
    test_mode: bool = True,
) -> str:
    """
    Returns a complete 837P X12 string.

    service_lines: list of dicts with keys:
        cpt_code, modifiers (list), units, charge, diagnosis_pointers (list of 1-based ints)
    """
    diagnoses = diagnoses or []
    service_lines = service_lines or []
    dos = date_of_service or date.today()
    today = date.today()

    lines: List[str] = []

    def seg(*parts) -> None:
        lines.append(_seg(*parts))

    # ISA — Interchange Control Header
    seg(
        "ISA", "00", "          ", "00", "          ",
        "ZZ", submitter_id.ljust(15),
        "ZZ", receiver_id.ljust(15),
        today.strftime("%y%m%d"),
        _fmt_time(),
        "^", "00501",
        interchange_control_number.zfill(9),
        "0",
        "T" if test_mode else "P",
        ":",
    )

    # GS — Functional Group Header
    seg("GS", "HC", submitter_id, receiver_id, _fmt_date(today), _fmt_time(), group_control_number, "X", "005010A1")

    # ST — Transaction Set Header
    seg("ST", "837", transaction_control_number.zfill(4), "005010X222A1")

    # BHT — Beginning Hierarchical Transaction
    seg("BHT", "0019", "00", claim_number, _fmt_date(today), _fmt_time(), "CH")

    # Loop 1000A — Submitter
    seg("NM1", "41", "2", submitter_name, "", "", "", "", "46", submitter_id)
    seg("PER", "IC", submitter_name, "TE", "8005551234")

    # Loop 1000B — Receiver
    seg("NM1", "40", "2", receiver_name, "", "", "", "", "46", receiver_id)

    # HL — Billing Provider Hierarchical Level
    seg("HL", "1", "", "20", "1")

    # Loop 2010AA — Billing Provider Name
    seg("NM1", "85", "2", billing_name, "", "", "", "", "XX", billing_npi)
    if billing_address:
        seg("N3", billing_address)
    if billing_city:
        seg("N4", billing_city, billing_state, billing_zip)
    seg("REF", "EI", billing_tax_id)

    # HL — Subscriber Hierarchical Level
    seg("HL", "2", "1", "22", "0" if subscriber_is_patient else "1")
    seg("SBR", "P", "18", "", "", "", "", "", "", "MB")

    # Loop 2010BA — Subscriber
    gender_code = {"M": "M", "F": "F"}.get(subscriber_gender, "U")
    seg("NM1", "IL", "1", subscriber_last, subscriber_first, "", "", "", "MI", subscriber_id)
    if subscriber_dob:
        seg("DMG", "D8", _fmt_date(subscriber_dob), gender_code)

    # Loop 2010BB — Payer
    seg("NM1", "PR", "2", payer_name, "", "", "", "", "PI", payer_id)

    # If patient differs from subscriber (dependent)
    if not subscriber_is_patient:
        seg("HL", "3", "2", "23", "0")
        seg("PAT", "19")  # 19 = child
        seg("NM1", "QC", "1", patient_last, patient_first)
        if patient_dob:
            seg("DMG", "D8", _fmt_date(patient_dob), {"M": "M", "F": "F"}.get(patient_gender, "U"))

    # Loop 2300 — Claim Information
    seg("CLM", claim_number, _money(claim_total), "", "", f"{place_of_service}:B:1", "Y", "A", "Y", "I")
    seg("DTP", "434", "D8", _fmt_date(dos))

    if authorization_number:
        seg("REF", "G1", authorization_number)

    # Referring provider
    if referring_npi:
        seg("NM1", "DN", "1", referring_last, referring_first, "", "", "", "XX", referring_npi)

    # Rendering provider (Loop 2310B)
    seg("NM1", "82", "1", rendering_last, rendering_first, "", "", "", "XX", rendering_npi)

    # HI — Diagnoses
    diag_qualifier = "ABK"  # ICD-10-CM principal
    secondary_qualifier = "ABF"
    for i, dx in enumerate(diagnoses[:12]):
        q = diag_qualifier if i == 0 else secondary_qualifier
        if i == 0:
            seg("HI", f"{q}:{dx}")
        # Additional diagnoses appended to same HI segment
        # (simplified: one HI per diagnosis for clarity)
        else:
            seg("HI", f"{q}:{dx}")

    # Loop 2400 — Service Lines
    for idx, svc in enumerate(service_lines, start=1):
        cpt = svc.get("cpt_code", "")
        mods = svc.get("modifiers", [])
        units = svc.get("units", 1)
        charge = svc.get("charge", 0.0)
        diag_ptrs = svc.get("diagnosis_pointers", [1])

        seg("LX", str(idx))

        mod_parts = mods[:4] + [""] * (4 - len(mods[:4]))
        seg("SV1", f"HC:{cpt}:{mod_parts[0]}:{mod_parts[1]}:{mod_parts[2]}:{mod_parts[3]}",
            _money(charge), "UN", str(units), place_of_service, "",
            ":".join(str(p) for p in diag_ptrs))
        seg("DTP", "472", "D8", _fmt_date(dos))

    # SE — Transaction Set Trailer
    seg_count = len(lines) + 1  # +1 for SE itself
    seg("SE", str(seg_count), transaction_control_number.zfill(4))

    # GE — Functional Group Trailer
    seg("GE", "1", group_control_number)

    # IEA — Interchange Control Trailer
    seg("IEA", "1", interchange_control_number.zfill(9))

    return "\n".join(lines)
