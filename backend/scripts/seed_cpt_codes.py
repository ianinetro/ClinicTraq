"""
Seed CPT codes into the database.

Usage:
    python scripts/seed_cpt_codes.py --tenant-id <uuid>

Covers the most-billed categories in US physician practice:
  E&M (office, hospital, preventive, telehealth, mental health)
  Procedures (minor surgery, injections, casting, wound care)
  Radiology (X-ray, ultrasound)
  Laboratory (common in-office labs)
  Physical medicine / therapy
  Cardiology diagnostics
  Immunizations
  Anesthesia modifiers
"""
from __future__ import annotations

import argparse
import asyncio
import sys
import uuid
from datetime import date
from pathlib import Path

# Allow running from repo root or scripts/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from database import AsyncSessionLocal
from domains.master_data.models import CPTCode

# ---------------------------------------------------------------------------
# Code table  (code, description, category, default_units, default_fee)
# ---------------------------------------------------------------------------
CPT_DATA: list[tuple[str, str, str, int, float]] = [
    # ── Evaluation & Management — Office / Outpatient ─────────────────────
    ("99202", "Office/outpatient visit, new patient, low medical decision making", "E&M", 1, 109.00),
    ("99203", "Office/outpatient visit, new patient, moderate medical decision making", "E&M", 1, 149.00),
    ("99204", "Office/outpatient visit, new patient, high medical decision making", "E&M", 1, 214.00),
    ("99205", "Office/outpatient visit, new patient, high complexity", "E&M", 1, 261.00),
    ("99211", "Office/outpatient visit, established patient, minimal", "E&M", 1, 26.00),
    ("99212", "Office/outpatient visit, established patient, low", "E&M", 1, 75.00),
    ("99213", "Office/outpatient visit, established patient, moderate", "E&M", 1, 111.00),
    ("99214", "Office/outpatient visit, established patient, moderate-high", "E&M", 1, 167.00),
    ("99215", "Office/outpatient visit, established patient, high complexity", "E&M", 1, 211.00),
    # ── Telehealth ────────────────────────────────────────────────────────
    ("99441", "Telephone evaluation and management service, 5-10 min", "E&M", 1, 38.00),
    ("99442", "Telephone evaluation and management service, 11-20 min", "E&M", 1, 74.00),
    ("99443", "Telephone evaluation and management service, 21-30 min", "E&M", 1, 109.00),
    ("99421", "Online digital E&M service, 5-10 min", "E&M", 1, 38.00),
    ("99422", "Online digital E&M service, 11-20 min", "E&M", 1, 74.00),
    ("99423", "Online digital E&M service, 21 or more min", "E&M", 1, 109.00),
    # ── Preventive Medicine ───────────────────────────────────────────────
    ("99381", "Preventive visit, new patient, infant (< 1 year)", "Preventive", 1, 165.00),
    ("99382", "Preventive visit, new patient, early childhood (1-4)", "Preventive", 1, 165.00),
    ("99383", "Preventive visit, new patient, late childhood (5-11)", "Preventive", 1, 165.00),
    ("99384", "Preventive visit, new patient, adolescent (12-17)", "Preventive", 1, 185.00),
    ("99385", "Preventive visit, new patient, adult (18-39)", "Preventive", 1, 185.00),
    ("99386", "Preventive visit, new patient, adult (40-64)", "Preventive", 1, 215.00),
    ("99387", "Preventive visit, new patient, adult (65+)", "Preventive", 1, 215.00),
    ("99391", "Preventive visit, established patient, infant", "Preventive", 1, 135.00),
    ("99392", "Preventive visit, established patient, early childhood", "Preventive", 1, 135.00),
    ("99393", "Preventive visit, established patient, late childhood", "Preventive", 1, 135.00),
    ("99394", "Preventive visit, established patient, adolescent", "Preventive", 1, 155.00),
    ("99395", "Preventive visit, established patient, adult (18-39)", "Preventive", 1, 155.00),
    ("99396", "Preventive visit, established patient, adult (40-64)", "Preventive", 1, 185.00),
    ("99397", "Preventive visit, established patient, adult (65+)", "Preventive", 1, 185.00),
    # ── Medicare Wellness ─────────────────────────────────────────────────
    ("G0402", "Welcome to Medicare preventive visit", "Medicare", 1, 165.00),
    ("G0438", "Annual wellness visit, initial", "Medicare", 1, 165.00),
    ("G0439", "Annual wellness visit, subsequent", "Medicare", 1, 116.00),
    # ── Hospital / Inpatient ──────────────────────────────────────────────
    ("99221", "Initial hospital care, low complexity", "E&M Hospital", 1, 115.00),
    ("99222", "Initial hospital care, moderate complexity", "E&M Hospital", 1, 166.00),
    ("99223", "Initial hospital care, high complexity", "E&M Hospital", 1, 231.00),
    ("99231", "Subsequent hospital care, low complexity", "E&M Hospital", 1, 68.00),
    ("99232", "Subsequent hospital care, moderate complexity", "E&M Hospital", 1, 109.00),
    ("99233", "Subsequent hospital care, high complexity", "E&M Hospital", 1, 160.00),
    ("99238", "Hospital discharge day management, 30 min or less", "E&M Hospital", 1, 90.00),
    ("99239", "Hospital discharge day management, more than 30 min", "E&M Hospital", 1, 135.00),
    # ── Emergency Department ──────────────────────────────────────────────
    ("99281", "Emergency department visit, minimal severity", "E&M ED", 1, 42.00),
    ("99282", "Emergency department visit, low complexity", "E&M ED", 1, 78.00),
    ("99283", "Emergency department visit, moderate complexity", "E&M ED", 1, 139.00),
    ("99284", "Emergency department visit, high severity", "E&M ED", 1, 229.00),
    ("99285", "Emergency department visit, high severity, threat to life", "E&M ED", 1, 336.00),
    # ── Behavioral Health ─────────────────────────────────────────────────
    ("90791", "Psychiatric diagnostic evaluation", "Behavioral Health", 1, 198.00),
    ("90792", "Psychiatric diagnostic evaluation with medical services", "Behavioral Health", 1, 243.00),
    ("90832", "Psychotherapy, 30 min", "Behavioral Health", 1, 75.00),
    ("90834", "Psychotherapy, 45 min", "Behavioral Health", 1, 100.00),
    ("90837", "Psychotherapy, 60 min", "Behavioral Health", 1, 146.00),
    ("90846", "Family psychotherapy without patient present", "Behavioral Health", 1, 117.00),
    ("90847", "Family psychotherapy with patient present", "Behavioral Health", 1, 130.00),
    ("90853", "Group psychotherapy", "Behavioral Health", 1, 52.00),
    # ── Procedures — Minor Surgery & Wound Care ───────────────────────────
    ("10060", "Incision and drainage of abscess, simple", "Surgery Minor", 1, 195.00),
    ("10061", "Incision and drainage of abscess, complicated", "Surgery Minor", 1, 368.00),
    ("10120", "Incision and removal of foreign body, simple", "Surgery Minor", 1, 195.00),
    ("10121", "Incision and removal of foreign body, complicated", "Surgery Minor", 1, 340.00),
    ("11000", "Debridement of infected skin, up to 10%", "Surgery Minor", 1, 105.00),
    ("11055", "Paring or cutting of benign hyperkeratotic lesion, single", "Surgery Minor", 1, 55.00),
    ("11200", "Removal of skin tags, up to and including 15 lesions", "Surgery Minor", 1, 115.00),
    ("11300", "Shaving of epidermal or dermal lesion, trunk/arm/leg, 0.5 cm or less", "Surgery Minor", 1, 115.00),
    ("11400", "Excision benign lesion, trunk/arm/leg, 0.5 cm or less", "Surgery Minor", 1, 170.00),
    ("11600", "Excision malignant lesion, trunk/arm/leg, 0.5 cm or less", "Surgery Minor", 1, 225.00),
    ("12001", "Repair simple wound, scalp/neck/axillae/trunk/extremities, 2.5 cm or less", "Surgery Minor", 1, 195.00),
    ("12002", "Repair simple wound, 2.6-7.5 cm", "Surgery Minor", 1, 220.00),
    ("12011", "Repair simple wound, face/ears/eyelids/nose/lips/mucous membranes, 2.5 cm or less", "Surgery Minor", 1, 210.00),
    # ── Injections ────────────────────────────────────────────────────────
    ("20600", "Aspiration and/or injection, small joint", "Injections", 1, 95.00),
    ("20605", "Aspiration and/or injection, intermediate joint", "Injections", 1, 115.00),
    ("20610", "Aspiration and/or injection, major joint or bursa", "Injections", 1, 140.00),
    ("20611", "Aspiration and/or injection, major joint with ultrasound guidance", "Injections", 1, 205.00),
    ("96372", "Therapeutic/prophylactic/diagnostic injection, subcutaneous or IM", "Injections", 1, 32.00),
    ("96374", "Therapeutic/prophylactic/diagnostic IV push, single", "Injections", 1, 95.00),
    ("96375", "Therapeutic/prophylactic IV push, each additional sequential drug", "Injections", 1, 54.00),
    ("96401", "Chemotherapy injection, subcutaneous or IM, non-hormonal", "Injections", 1, 120.00),
    # ── Casting & Splinting ───────────────────────────────────────────────
    ("29125", "Application of short arm splint, static", "Casting", 1, 110.00),
    ("29126", "Application of short arm splint, dynamic", "Casting", 1, 130.00),
    ("29130", "Application of finger splint, static", "Casting", 1, 60.00),
    ("29200", "Strapping, thorax", "Casting", 1, 90.00),
    ("29505", "Application of long leg splint", "Casting", 1, 155.00),
    ("29515", "Application of short leg splint", "Casting", 1, 120.00),
    # ── Cardiology ────────────────────────────────────────────────────────
    ("93000", "Electrocardiogram, routine ECG with interpretation and report", "Cardiology", 1, 55.00),
    ("93005", "Electrocardiogram, routine ECG, tracing only", "Cardiology", 1, 30.00),
    ("93010", "Electrocardiogram, routine ECG, interpretation and report only", "Cardiology", 1, 28.00),
    ("93306", "Echocardiography, transthoracic, complete", "Cardiology", 1, 810.00),
    ("93350", "Echocardiography, stress test (treadmill or pharmacological)", "Cardiology", 1, 970.00),
    ("93000", "Electrocardiogram with interpretation", "Cardiology", 1, 55.00),
    # ── Pulmonary ─────────────────────────────────────────────────────────
    ("94010", "Spirometry including graphic record, total/timed vital capacity, expiratory flow rate", "Pulmonary", 1, 115.00),
    ("94060", "Bronchodilator responsiveness, spirometry as in 94010", "Pulmonary", 1, 155.00),
    ("94375", "Respiratory flow volume loop", "Pulmonary", 1, 90.00),
    ("94640", "Pressurized or nonpressurized inhalation treatment for acute airway obstruction", "Pulmonary", 1, 52.00),
    # ── Radiology / Imaging ───────────────────────────────────────────────
    ("71046", "Radiologic examination, chest, 2 views", "Radiology", 1, 54.00),
    ("71045", "Radiologic examination, chest, single view", "Radiology", 1, 36.00),
    ("72050", "Radiologic examination, spine, cervical, 2-3 views", "Radiology", 1, 67.00),
    ("72100", "Radiologic examination, spine, lumbosacral, 2-3 views", "Radiology", 1, 67.00),
    ("73030", "Radiologic examination, shoulder, minimum 2 views", "Radiology", 1, 58.00),
    ("73060", "Radiologic examination, humerus, minimum 2 views", "Radiology", 1, 54.00),
    ("73100", "Radiologic examination, wrist, 2 views", "Radiology", 1, 55.00),
    ("73130", "Radiologic examination, hand, minimum 3 views", "Radiology", 1, 60.00),
    ("73510", "Radiologic examination, hip, unilateral, minimum 2 views", "Radiology", 1, 70.00),
    ("73560", "Radiologic examination, knee, 1-2 views", "Radiology", 1, 54.00),
    ("73600", "Radiologic examination, ankle, minimum 2 views", "Radiology", 1, 55.00),
    ("73620", "Radiologic examination, foot, minimum 2 views", "Radiology", 1, 57.00),
    ("76700", "Ultrasound, abdominal, real time with image documentation", "Radiology", 1, 215.00),
    ("76705", "Ultrasound, abdominal, real time with image documentation, limited", "Radiology", 1, 140.00),
    ("76830", "Ultrasound, transvaginal", "Radiology", 1, 210.00),
    ("76856", "Ultrasound, pelvic (nonobstetric), real time with image documentation", "Radiology", 1, 195.00),
    # ── Laboratory ────────────────────────────────────────────────────────
    ("80053", "Comprehensive metabolic panel", "Laboratory", 1, 22.00),
    ("80048", "Basic metabolic panel", "Laboratory", 1, 14.00),
    ("81000", "Urinalysis, non-automated, with microscopy", "Laboratory", 1, 10.00),
    ("81001", "Urinalysis, automated, with microscopy", "Laboratory", 1, 11.00),
    ("81002", "Urinalysis, non-automated, without microscopy", "Laboratory", 1, 5.00),
    ("82043", "Albumin, urine, microalbumin, quantitative", "Laboratory", 1, 12.00),
    ("82947", "Glucose, quantitative, blood", "Laboratory", 1, 8.00),
    ("82962", "Glucose, blood by glucose monitoring device(s)", "Laboratory", 1, 5.00),
    ("83036", "Hemoglobin A1c", "Laboratory", 1, 14.00),
    ("83718", "Lipoprotein, direct measurement, high density cholesterol (HDL)", "Laboratory", 1, 14.00),
    ("84153", "Prostate specific antigen (PSA), total", "Laboratory", 1, 25.00),
    ("84443", "Thyroid stimulating hormone (TSH)", "Laboratory", 1, 22.00),
    ("85025", "Blood count, complete (CBC), automated, with differential", "Laboratory", 1, 13.00),
    ("85027", "Blood count, complete (CBC), automated", "Laboratory", 1, 11.00),
    ("86580", "TB intradermal test", "Laboratory", 1, 15.00),
    ("86592", "Syphilis test, qualitative (RPR/VDRL)", "Laboratory", 1, 11.00),
    ("87086", "Culture, bacterial, urine, quantitative", "Laboratory", 1, 18.00),
    ("87210", "Smear, primary source with interpretation, wet mount", "Laboratory", 1, 10.00),
    ("87430", "Streptococcus, group A antigen detection, direct optical", "Laboratory", 1, 18.00),
    ("87491", "Chlamydia trachomatis, amplified probe technique", "Laboratory", 1, 37.00),
    ("87591", "Neisseria gonorrhoeae, amplified probe technique", "Laboratory", 1, 37.00),
    ("87804", "Influenza virus, antigen detection", "Laboratory", 1, 25.00),
    ("87811", "SARS-CoV-2 (COVID-19), antigen", "Laboratory", 1, 42.00),
    ("87635", "SARS-CoV-2 (COVID-19), PCR", "Laboratory", 1, 51.00),
    # ── Physical Medicine & Rehabilitation ───────────────────────────────
    ("97010", "Hot or cold packs application", "Physical Medicine", 1, 20.00),
    ("97012", "Mechanical traction therapy", "Physical Medicine", 1, 28.00),
    ("97014", "Electrical stimulation (unattended)", "Physical Medicine", 1, 22.00),
    ("97016", "Vasopneumatic devices therapy", "Physical Medicine", 1, 28.00),
    ("97018", "Paraffin bath therapy", "Physical Medicine", 1, 20.00),
    ("97022", "Whirlpool therapy", "Physical Medicine", 1, 28.00),
    ("97032", "Electrical stimulation (attended)", "Physical Medicine", 1, 32.00),
    ("97033", "Iontophoresis therapy", "Physical Medicine", 1, 38.00),
    ("97035", "Ultrasound therapy", "Physical Medicine", 1, 30.00),
    ("97110", "Therapeutic exercises", "Physical Medicine", 1, 55.00),
    ("97112", "Neuromuscular reeducation", "Physical Medicine", 1, 55.00),
    ("97116", "Gait training therapy", "Physical Medicine", 1, 52.00),
    ("97140", "Manual therapy techniques, one or more regions", "Physical Medicine", 1, 58.00),
    ("97150", "Therapeutic procedure(s), group (2 or more individuals)", "Physical Medicine", 1, 30.00),
    ("97530", "Therapeutic activities, direct patient contact", "Physical Medicine", 1, 58.00),
    ("97535", "Self-care/home management training", "Physical Medicine", 1, 58.00),
    ("97750", "Physical performance test or measurement", "Physical Medicine", 1, 45.00),
    # ── Immunizations ─────────────────────────────────────────────────────
    ("90460", "Immunization administration, first vaccine component, with counseling", "Immunization", 1, 25.00),
    ("90461", "Immunization administration, each additional component", "Immunization", 1, 12.00),
    ("90471", "Immunization administration, one injection, no counseling", "Immunization", 1, 25.00),
    ("90472", "Immunization administration, each additional injection", "Immunization", 1, 12.00),
    ("90632", "Hepatitis A vaccine, adult dosage, IM", "Immunization", 1, 70.00),
    ("90644", "Meningococcal vaccine", "Immunization", 1, 135.00),
    ("90645", "Haemophilus influenza B vaccine", "Immunization", 1, 22.00),
    ("90651", "Human Papillomavirus vaccine, 9-valent", "Immunization", 1, 250.00),
    ("90656", "Influenza virus vaccine, trivalent, preservative free, 0.5 mL IM", "Immunization", 1, 25.00),
    ("90660", "Influenza virus vaccine, live, intranasal", "Immunization", 1, 35.00),
    ("90670", "Pneumococcal conjugate vaccine, 13-valent, IM", "Immunization", 1, 205.00),
    ("90686", "Influenza virus vaccine, quadrivalent (IIV4), preservative free, 0.5 mL IM", "Immunization", 1, 30.00),
    ("90714", "Tetanus and diphtheria toxoids (Td) adult, preservative free, IM", "Immunization", 1, 32.00),
    ("90715", "Tetanus, diphtheria, acellular pertussis (Tdap), preservative free, IM", "Immunization", 1, 42.00),
    ("90732", "Pneumococcal polysaccharide vaccine, 23-valent, adult, IM or SC", "Immunization", 1, 110.00),
    ("90746", "Hepatitis B vaccine, adult dosage, IM", "Immunization", 1, 70.00),
    # ── Screenings & Preventive ───────────────────────────────────────────
    ("G0101", "Cervical or vaginal cancer screening, pelvic and breast exam", "Preventive", 1, 110.00),
    ("G0107", "Colorectal cancer screening, fecal-occult blood test", "Preventive", 1, 15.00),
    ("G0121", "Colorectal cancer screening, colonoscopy on individual not high risk", "Preventive", 1, 450.00),
    ("G0123", "Screening cytopathology, cervical or vaginal (Pap smear), automated thin layer", "Preventive", 1, 32.00),
    ("G0202", "Screening mammography", "Preventive", 1, 155.00),
    ("G0204", "Diagnostic mammography", "Preventive", 1, 185.00),
    # ── Chronic Care & Remote Monitoring ─────────────────────────────────
    ("99490", "Chronic care management, at least 20 min", "Chronic Care", 1, 62.00),
    ("99491", "Chronic care management, at least 30 min", "Chronic Care", 1, 84.00),
    ("99453", "Remote physiologic monitoring, set-up and education", "Chronic Care", 1, 19.00),
    ("99454", "Remote physiologic monitoring, device supply with data transmission, 30 days", "Chronic Care", 1, 64.00),
    ("99457", "Remote physiologic monitoring, clinical staff/MD, first 20 min", "Chronic Care", 1, 52.00),
    ("99458", "Remote physiologic monitoring, each additional 20 min", "Chronic Care", 1, 41.00),
    # ── Diabetes / Metabolic ─────────────────────────────────────────────
    ("99213", "Office/outpatient visit, established patient, moderate", "E&M", 1, 111.00),
    ("G0108", "Diabetes self-management training, individual", "Chronic Care", 1, 60.00),
    ("G0109", "Diabetes self-management training, group", "Chronic Care", 1, 30.00),
]

# ---------------------------------------------------------------------------

async def seed(tenant_id: str) -> None:
    tid = uuid.UUID(tenant_id)
    today = date.today()

    async with AsyncSessionLocal() as session:
        # Fetch codes already seeded for this tenant
        existing_result = await session.execute(
            select(CPTCode.code).where(CPTCode.tenant_id == tid)
        )
        existing_codes = {row[0] for row in existing_result.fetchall()}
        print(f"Existing CPT codes for tenant: {len(existing_codes)}")

        inserted = 0
        skipped = 0
        for code, description, category, units, fee in CPT_DATA:
            if code in existing_codes:
                skipped += 1
                continue
            session.add(CPTCode(
                id=uuid.uuid4(),
                tenant_id=tid,
                code=code,
                description=description,
                category=category,
                default_units=units,
                default_fee=fee,
                is_active=True,
                effective_date=today,
            ))
            existing_codes.add(code)
            inserted += 1

        await session.commit()
        print(f"Inserted {inserted} CPT codes, skipped {skipped} duplicates.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed CPT codes")
    parser.add_argument("--tenant-id", required=True, help="Tenant UUID to seed codes for")
    args = parser.parse_args()
    asyncio.run(seed(args.tenant_id))
