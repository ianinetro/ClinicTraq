"""
Seed ICD-10-CM diagnosis codes into the database.

Usage:
    python scripts/seed_icd_codes.py --tenant-id <uuid>

Covers the most commonly billed ICD-10-CM codes in US physician practices.
"""
from __future__ import annotations

import argparse
import asyncio
import sys
import uuid
from pathlib import Path

# Allow running from repo root or scripts/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from database import AsyncSessionLocal
from domains.master_data.models import DiagnosisCode

# ---------------------------------------------------------------------------
# Code table  (code, description, category)
# ---------------------------------------------------------------------------
ICD_DATA: list[tuple[str, str, str]] = [
    # ── Cardiovascular ────────────────────────────────────────────────────
    ("I10", "Essential (primary) hypertension", "Cardiovascular"),
    ("I48.0", "Paroxysmal atrial fibrillation", "Cardiovascular"),
    ("I48.11", "Longstanding persistent atrial fibrillation", "Cardiovascular"),
    ("I48.19", "Other persistent atrial fibrillation", "Cardiovascular"),
    ("I48.20", "Chronic atrial fibrillation, unspecified", "Cardiovascular"),
    ("I48.91", "Unspecified atrial fibrillation", "Cardiovascular"),
    ("I50.9", "Heart failure, unspecified", "Cardiovascular"),
    ("I50.22", "Chronic systolic (congestive) heart failure", "Cardiovascular"),
    ("I50.32", "Chronic diastolic (congestive) heart failure", "Cardiovascular"),
    ("I25.10", "Atherosclerotic heart disease of native coronary artery without angina pectoris", "Cardiovascular"),
    ("I25.110", "Atherosclerotic heart disease of native coronary artery with unstable angina pectoris", "Cardiovascular"),
    ("I25.9", "Chronic ischemic heart disease, unspecified", "Cardiovascular"),
    ("R07.9", "Chest pain, unspecified", "Cardiovascular"),
    ("R07.1", "Chest pain on breathing", "Cardiovascular"),
    ("R07.2", "Precordial pain", "Cardiovascular"),
    ("R07.89", "Other chest pain", "Cardiovascular"),

    # ── Endocrine ─────────────────────────────────────────────────────────
    ("E11.9", "Type 2 diabetes mellitus without complications", "Endocrine"),
    ("E11.65", "Type 2 diabetes mellitus with hyperglycemia", "Endocrine"),
    ("E11.649", "Type 2 diabetes mellitus with hypoglycemia without coma", "Endocrine"),
    ("E11.40", "Type 2 diabetes mellitus with diabetic neuropathy, unspecified", "Endocrine"),
    ("E11.319", "Type 2 diabetes mellitus with unspecified diabetic retinopathy without macular edema", "Endocrine"),
    ("E11.22", "Type 2 diabetes mellitus with diabetic chronic kidney disease, stage 3", "Endocrine"),
    ("E11.51", "Type 2 diabetes mellitus with diabetic peripheral angiopathy without gangrene", "Endocrine"),
    ("E11.610", "Type 2 diabetes mellitus with diabetic neuropathic arthropathy", "Endocrine"),
    ("E78.5", "Hyperlipidemia, unspecified", "Endocrine"),
    ("E78.00", "Pure hypercholesterolemia, unspecified", "Endocrine"),
    ("E78.1", "Pure hyperglyceridemia", "Endocrine"),
    ("E78.2", "Mixed hyperlipidemia", "Endocrine"),
    ("E03.9", "Hypothyroidism, unspecified", "Endocrine"),
    ("E03.0", "Congenital hypothyroidism with diffuse goiter", "Endocrine"),
    ("E66.9", "Obesity, unspecified", "Endocrine"),
    ("E66.01", "Morbid (severe) obesity due to excess calories", "Endocrine"),
    ("E55.9", "Vitamin D deficiency, unspecified", "Endocrine"),

    # ── Mental Health ─────────────────────────────────────────────────────
    ("F41.1", "Generalized anxiety disorder", "Mental Health"),
    ("F41.0", "Panic disorder without agoraphobia", "Mental Health"),
    ("F41.9", "Anxiety disorder, unspecified", "Mental Health"),
    ("F41.8", "Other specified anxiety disorders", "Mental Health"),
    ("F32.9", "Major depressive disorder, single episode, unspecified", "Mental Health"),
    ("F32.0", "Major depressive disorder, single episode, mild", "Mental Health"),
    ("F32.1", "Major depressive disorder, single episode, moderate", "Mental Health"),
    ("F32.2", "Major depressive disorder, single episode, severe without psychotic features", "Mental Health"),
    ("F33.0", "Major depressive disorder, recurrent, mild", "Mental Health"),
    ("F33.1", "Major depressive disorder, recurrent, moderate", "Mental Health"),
    ("F33.9", "Major depressive disorder, recurrent, unspecified", "Mental Health"),

    # ── Respiratory ───────────────────────────────────────────────────────
    ("J45.20", "Mild intermittent asthma, uncomplicated", "Respiratory"),
    ("J45.30", "Mild persistent asthma, uncomplicated", "Respiratory"),
    ("J45.40", "Moderate persistent asthma, uncomplicated", "Respiratory"),
    ("J45.50", "Severe persistent asthma, uncomplicated", "Respiratory"),
    ("J45.901", "Unspecified asthma with (acute) exacerbation", "Respiratory"),
    ("J45.909", "Unspecified asthma, uncomplicated", "Respiratory"),
    ("J44.1", "Chronic obstructive pulmonary disease with (acute) exacerbation", "Respiratory"),
    ("J44.0", "Chronic obstructive pulmonary disease with acute lower respiratory infection", "Respiratory"),
    ("J44.9", "Chronic obstructive pulmonary disease, unspecified", "Respiratory"),
    ("J06.9", "Acute upper respiratory infection, unspecified", "Respiratory"),
    ("J02.9", "Acute pharyngitis, unspecified", "Respiratory"),
    ("J02.0", "Streptococcal pharyngitis", "Respiratory"),
    ("J01.90", "Acute sinusitis, unspecified", "Respiratory"),
    ("J01.00", "Acute maxillary sinusitis, unspecified", "Respiratory"),
    ("J01.10", "Acute frontal sinusitis, unspecified", "Respiratory"),
    ("J32.0", "Chronic maxillary sinusitis", "Respiratory"),
    ("J32.9", "Chronic sinusitis, unspecified", "Respiratory"),
    ("J30.9", "Allergic rhinitis, unspecified", "Respiratory"),
    ("J30.1", "Allergic rhinitis due to pollen", "Respiratory"),
    ("J09.X1", "Influenza due to identified novel influenza A virus with pneumonia", "Respiratory"),
    ("J10.1", "Influenza due to other identified influenza virus with other respiratory manifestations", "Respiratory"),
    ("J11.1", "Influenza due to unidentified influenza virus with other respiratory manifestations", "Respiratory"),
    ("U07.1", "COVID-19", "Respiratory"),

    # ── Musculoskeletal ───────────────────────────────────────────────────
    ("M54.2", "Cervicalgia", "Musculoskeletal"),
    ("M54.50", "Low back pain, unspecified", "Musculoskeletal"),
    ("M54.51", "Vertebrogenic low back pain", "Musculoskeletal"),
    ("M54.59", "Other low back pain", "Musculoskeletal"),
    ("M54.4", "Lumbago with sciatica, right side", "Musculoskeletal"),
    ("M54.42", "Lumbago with sciatica, left side", "Musculoskeletal"),
    ("M54.5", "Low back pain", "Musculoskeletal"),
    ("M25.561", "Pain in right knee", "Musculoskeletal"),
    ("M25.562", "Pain in left knee", "Musculoskeletal"),
    ("M25.511", "Pain in right shoulder", "Musculoskeletal"),
    ("M25.512", "Pain in left shoulder", "Musculoskeletal"),
    ("M15.9", "Polyosteoarthritis, unspecified", "Musculoskeletal"),
    ("M17.11", "Primary osteoarthritis, right knee", "Musculoskeletal"),
    ("M17.12", "Primary osteoarthritis, left knee", "Musculoskeletal"),
    ("M19.011", "Primary osteoarthritis, right shoulder", "Musculoskeletal"),
    ("M19.90", "Unspecified osteoarthritis, unspecified site", "Musculoskeletal"),
    ("M79.3", "Panniculitis", "Musculoskeletal"),
    ("M79.7", "Fibromyalgia", "Musculoskeletal"),

    # ── Neurology ─────────────────────────────────────────────────────────
    ("G43.909", "Migraine, unspecified, not intractable, without status migrainosus", "Neurology"),
    ("G43.019", "Migraine without aura, intractable, without status migrainosus", "Neurology"),
    ("G43.109", "Migraine with aura, not intractable, without status migrainosus", "Neurology"),
    ("R51.9", "Headache, unspecified", "Neurology"),
    ("G47.00", "Insomnia, unspecified", "Neurology"),
    ("G47.09", "Other insomnia", "Neurology"),

    # ── Gastrointestinal ──────────────────────────────────────────────────
    ("K21.0", "Gastro-esophageal reflux disease with esophagitis", "Gastrointestinal"),
    ("K21.9", "Gastro-esophageal reflux disease without esophagitis", "Gastrointestinal"),
    ("K59.00", "Constipation, unspecified", "Gastrointestinal"),
    ("K59.09", "Other constipation", "Gastrointestinal"),
    ("K59.1", "Functional diarrhea", "Gastrointestinal"),
    ("K58.9", "Irritable bowel syndrome without diarrhea", "Gastrointestinal"),
    ("K58.0", "Irritable bowel syndrome with diarrhea", "Gastrointestinal"),
    ("K64.9", "Unspecified hemorrhoids", "Gastrointestinal"),
    ("K64.0", "First degree hemorrhoids", "Gastrointestinal"),
    ("R10.9", "Unspecified abdominal pain", "Gastrointestinal"),
    ("R10.0", "Acute abdomen", "Gastrointestinal"),
    ("R10.13", "Epigastric pain", "Gastrointestinal"),
    ("R10.31", "Right lower quadrant pain", "Gastrointestinal"),
    ("R10.32", "Left lower quadrant pain", "Gastrointestinal"),
    ("R11.10", "Vomiting, unspecified", "Gastrointestinal"),
    ("R11.0", "Nausea", "Gastrointestinal"),
    ("R11.2", "Nausea with vomiting, unspecified", "Gastrointestinal"),

    # ── Genitourinary ─────────────────────────────────────────────────────
    ("N39.0", "Urinary tract infection, site not specified", "Genitourinary"),
    ("N52.9", "Male erectile dysfunction, unspecified", "Genitourinary"),
    ("N40.0", "Benign prostatic hyperplasia without lower urinary tract symptoms", "Genitourinary"),
    ("N40.1", "Benign prostatic hyperplasia with lower urinary tract symptoms", "Genitourinary"),
    ("N76.0", "Acute vaginitis", "Genitourinary"),
    ("N76.1", "Subacute and chronic vaginitis", "Genitourinary"),
    ("R10.2", "Pelvic and perineal pain", "Genitourinary"),

    # ── Dermatology ───────────────────────────────────────────────────────
    ("L20.9", "Atopic dermatitis, unspecified", "Dermatology"),
    ("L20.89", "Other atopic dermatitis", "Dermatology"),
    ("L30.9", "Dermatitis, unspecified", "Dermatology"),
    ("L30.0", "Nummular dermatitis", "Dermatology"),
    ("L40.9", "Psoriasis, unspecified", "Dermatology"),
    ("L40.0", "Psoriasis vulgaris", "Dermatology"),
    ("L70.9", "Acne, unspecified", "Dermatology"),
    ("L70.0", "Acne vulgaris", "Dermatology"),
    ("L03.90", "Cellulitis, unspecified", "Dermatology"),
    ("L03.011", "Cellulitis of right finger", "Dermatology"),
    ("L03.115", "Cellulitis of right lower limb", "Dermatology"),

    # ── Hematology ────────────────────────────────────────────────────────
    ("D50.9", "Iron deficiency anemia, unspecified", "Symptoms/Signs"),

    # ── Symptoms/Signs ────────────────────────────────────────────────────
    ("R53.83", "Other fatigue", "Symptoms/Signs"),
    ("R53.1", "Weakness", "Symptoms/Signs"),

    # ── Infectious Disease ────────────────────────────────────────────────
    ("B37.3", "Candidiasis of vulva and vagina", "Infectious Disease"),
    ("B34.9", "Viral infection, unspecified", "Infectious Disease"),

    # ── Obstetrics ────────────────────────────────────────────────────────
    ("Z34.00", "Encounter for supervision of normal first pregnancy, unspecified trimester", "Obstetrics"),
    ("Z34.30", "Encounter for supervision of normal third trimester pregnancy, unspecified trimester", "Obstetrics"),
    ("Z34.90", "Encounter for supervision of normal pregnancy, unspecified, unspecified trimester", "Obstetrics"),
    ("O10.012", "Pre-existing essential hypertension complicating pregnancy, second trimester", "Obstetrics"),
    ("O10.013", "Pre-existing essential hypertension complicating pregnancy, third trimester", "Obstetrics"),
    ("O13.1", "Gestational (pregnancy-induced) hypertension without significant proteinuria, first trimester", "Obstetrics"),
    ("O13.2", "Gestational hypertension without significant proteinuria, second trimester", "Obstetrics"),
    ("O13.3", "Gestational hypertension without significant proteinuria, third trimester", "Obstetrics"),

    # ── Preventive/Screening ──────────────────────────────────────────────
    ("Z00.00", "Encounter for general adult medical examination without abnormal findings", "Preventive/Screening"),
    ("Z00.01", "Encounter for general adult medical examination with abnormal findings", "Preventive/Screening"),
    ("Z00.121", "Encounter for routine child health examination with abnormal findings", "Preventive/Screening"),
    ("Z00.129", "Encounter for routine child health examination without abnormal findings", "Preventive/Screening"),
    ("Z01.818", "Encounter for other preprocedural examination", "Preventive/Screening"),
    ("Z12.11", "Encounter for screening for malignant neoplasm of colon", "Preventive/Screening"),
    ("Z12.31", "Encounter for screening mammogram for malignant neoplasm of breast", "Preventive/Screening"),

    # ── Substance Use ─────────────────────────────────────────────────────
    ("F17.210", "Nicotine dependence, cigarettes, uncomplicated", "Substance Use"),
    ("F17.200", "Nicotine dependence, unspecified, uncomplicated", "Substance Use"),
    ("F17.220", "Nicotine dependence, chewing tobacco, uncomplicated", "Substance Use"),
    ("F10.10", "Alcohol abuse, uncomplicated", "Substance Use"),
    ("F10.20", "Alcohol dependence, uncomplicated", "Substance Use"),
    ("F10.90", "Alcohol use, unspecified, uncomplicated", "Substance Use"),
]

# ---------------------------------------------------------------------------

async def seed(tenant_id: str) -> None:
    tid = uuid.UUID(tenant_id)

    async with AsyncSessionLocal() as session:
        existing_result = await session.execute(
            select(DiagnosisCode.code).where(DiagnosisCode.tenant_id == tid)
        )
        existing_codes = {row[0] for row in existing_result.fetchall()}
        print(f"Existing ICD-10 codes for tenant: {len(existing_codes)}")

        inserted = 0
        skipped = 0
        for code, description, _category in ICD_DATA:
            if code in existing_codes:
                skipped += 1
                continue
            session.add(DiagnosisCode(
                id=uuid.uuid4(),
                tenant_id=tid,
                code=code,
                description=description,
                code_type="ICD-10",
                is_active=True,
            ))
            existing_codes.add(code)
            inserted += 1

        await session.commit()
        print(f"Inserted {inserted} ICD-10 codes, skipped {skipped} duplicates.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed ICD-10-CM diagnosis codes")
    parser.add_argument("--tenant-id", required=True, help="Tenant UUID to seed codes for")
    args = parser.parse_args()
    asyncio.run(seed(args.tenant_id))
