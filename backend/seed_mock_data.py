"""
Mock data seed — run on the Azure VM after migrations:
    cd backend
    python seed_mock_data.py

Creates realistic clinic data so every button in the UI goes somewhere:
  - 1 tenant + practice + office + billing provider
  - 4 payers (BCBS, Aetna, Medicare, self-pay)
  - 10 CPT codes + 10 ICD-10 codes
  - 3 providers + 2 referring providers
  - 3 staff users (front_desk, billing, provider roles)
  - 15 patients with insurance
  - 30 visits spread across the past 90 days
  - 30 claims (various statuses)
  - 15 payments + applications
  - 10 work-queue items
  - 10 appointments for today + tomorrow
  - 5 denial appeals
"""

import asyncio
import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

sys.path.insert(0, os.path.dirname(__file__))

from passlib.context import CryptContext
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://clinictraq:clinictraq_dev@localhost:5432/clinictraq",
)

engine = create_async_engine(DATABASE_URL, echo=False)
Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def uid() -> uuid.UUID:
    return uuid.uuid4()


def today() -> date:
    return date.today()


def days_ago(n: int) -> date:
    return today() - timedelta(days=n)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def get_or_create_tenant(s: AsyncSession) -> uuid.UUID:
    r = await s.execute(text("SELECT id FROM tenants WHERE slug = 'billerbay-demo'"))
    row = r.fetchone()
    if row:
        return row[0]
    tid = uid()
    await s.execute(text("""
        INSERT INTO tenants (id, name, slug, is_active, plan, timezone, npi, tax_id, created_at, updated_at)
        VALUES (:id, :name, :slug, true, 'enterprise', 'America/New_York', '1234567890', '12-3456789',
                NOW(), NOW())
        ON CONFLICT (slug) DO NOTHING
    """), {"id": tid, "name": "BillerBay Demo Clinic", "slug": "billerbay-demo"})
    return tid


async def get_tenant(s: AsyncSession) -> uuid.UUID:
    r = await s.execute(text("SELECT id FROM tenants WHERE slug = 'billerbay-demo'"))
    row = r.fetchone()
    if row:
        return row[0]
    r = await s.execute(text("SELECT id FROM tenants LIMIT 1"))
    row = r.fetchone()
    if row:
        return row[0]
    raise RuntimeError("No tenant found — run seed_admin.py first")


# ---------------------------------------------------------------------------
# Main seed
# ---------------------------------------------------------------------------

async def seed():
    async with Session() as s:
        async with s.begin():

            # ── Tenant ──────────────────────────────────────────────────────
            tid = await get_or_create_tenant(s)
            print(f"Tenant: {tid}")

            # ── Practice ────────────────────────────────────────────────────
            r = await s.execute(text("SELECT id FROM practices WHERE tenant_id = :t LIMIT 1"), {"t": tid})
            practice_row = r.fetchone()
            if practice_row:
                practice_id = practice_row[0]
            else:
                practice_id = uid()
                await s.execute(text("""
                    INSERT INTO practices (id, tenant_id, name, npi, tax_id, taxonomy_code,
                        address_line1, city, state, zip_code, phone, is_active, created_at, updated_at)
                    VALUES (:id, :t, 'BillerBay Family Medicine', '1234567890', '12-3456789',
                        '207Q00000X', '100 Medical Blvd', 'Orlando', 'FL', '32801',
                        '(407) 555-0100', true, NOW(), NOW())
                """), {"id": practice_id, "t": tid})
                print(f"Practice: {practice_id}")

            # ── Office ──────────────────────────────────────────────────────
            r = await s.execute(text("SELECT id FROM offices WHERE tenant_id = :t LIMIT 1"), {"t": tid})
            office_row = r.fetchone()
            if office_row:
                office_id = office_row[0]
            else:
                office_id = uid()
                await s.execute(text("""
                    INSERT INTO offices (id, tenant_id, practice_id, name, npi,
                        address_line1, city, state, zip_code, phone, place_of_service_code,
                        is_active, created_at, updated_at)
                    VALUES (:id, :t, :p, 'Main Office', '1234567890',
                        '100 Medical Blvd Suite 200', 'Orlando', 'FL', '32801', '(407) 555-0100',
                        '11', true, NOW(), NOW())
                """), {"id": office_id, "t": tid, "p": practice_id})
                print(f"Office: {office_id}")

            # ── Billing Provider ─────────────────────────────────────────────
            r = await s.execute(text("SELECT id FROM billing_providers WHERE tenant_id = :t LIMIT 1"), {"t": tid})
            bp_row = r.fetchone()
            if bp_row:
                billing_provider_id = bp_row[0]
            else:
                billing_provider_id = uid()
                await s.execute(text("""
                    INSERT INTO billing_providers (id, tenant_id, name, npi, tax_id, taxonomy_code,
                        address_line1, city, state, zip_code, is_active, created_at, updated_at)
                    VALUES (:id, :t, 'BillerBay Family Medicine Group', '1234567890', '12-3456789',
                        '207Q00000X', '100 Medical Blvd', 'Orlando', 'FL', '32801', true, NOW(), NOW())
                """), {"id": billing_provider_id, "t": tid})
                print(f"Billing provider: {billing_provider_id}")

            # ── Payers ──────────────────────────────────────────────────────
            payer_data = [
                ("BCBS Florida", "00590", "commercial"),
                ("Aetna", "60054", "commercial"),
                ("Medicare Part B", "00882", "medicare"),
                ("Self-Pay", "SELF", "self_pay"),
            ]
            payer_ids: dict[str, uuid.UUID] = {}
            for name, payer_code, ptype in payer_data:
                r = await s.execute(
                    text("SELECT id FROM payers WHERE tenant_id = :t AND payer_id = :pid"),
                    {"t": tid, "pid": payer_code},
                )
                row = r.fetchone()
                if row:
                    payer_ids[payer_code] = row[0]
                else:
                    pid = uid()
                    await s.execute(text("""
                        INSERT INTO payers (id, tenant_id, name, payer_id, payer_type,
                            address_line1, city, state, zip_code, phone, tfl_days, is_active,
                            created_at, updated_at)
                        VALUES (:id, :t, :name, :pid, :ptype,
                            '200 Insurance Way', 'Jacksonville', 'FL', '32202', '(800) 555-0200',
                            365, true, NOW(), NOW())
                    """), {"id": pid, "t": tid, "name": name, "pid": payer_code, "ptype": ptype})
                    payer_ids[payer_code] = pid
            print(f"Payers: {list(payer_ids.keys())}")

            # ── Providers ──────────────────────────────────────────────────
            provider_data = [
                ("Sarah", "Mitchell", "1111111111", "Family Medicine", "MD"),
                ("James", "Rodriguez", "2222222222", "Internal Medicine", "DO"),
                ("Emily", "Chen", "3333333333", "Pediatrics", "MD"),
            ]
            provider_ids: list[uuid.UUID] = []
            for first, last, npi, specialty, cred in provider_data:
                r = await s.execute(
                    text("SELECT id FROM providers WHERE tenant_id = :t AND npi = :n"),
                    {"t": tid, "n": npi},
                )
                row = r.fetchone()
                if row:
                    provider_ids.append(row[0])
                else:
                    pid = uid()
                    await s.execute(text("""
                        INSERT INTO providers (id, tenant_id, first_name, last_name, npi,
                            taxonomy_code, specialty, credential, is_active, created_at, updated_at)
                        VALUES (:id, :t, :f, :l, :n, '207Q00000X', :sp, :cr, true, NOW(), NOW())
                    """), {"id": pid, "t": tid, "f": first, "l": last, "n": npi, "sp": specialty, "cr": cred})
                    provider_ids.append(pid)
            print(f"Providers: {len(provider_ids)}")

            # ── Referring Providers ─────────────────────────────────────────
            ref_data = [
                ("David", "Park", "4444444444", "Cardiology"),
                ("Linda", "Torres", "5555555555", "Orthopedics"),
            ]
            ref_ids: list[uuid.UUID] = []
            for first, last, npi, spec in ref_data:
                r = await s.execute(
                    text("SELECT id FROM referring_providers WHERE tenant_id = :t AND npi = :n"),
                    {"t": tid, "n": npi},
                )
                row = r.fetchone()
                if row:
                    ref_ids.append(row[0])
                else:
                    rid = uid()
                    await s.execute(text("""
                        INSERT INTO referring_providers (id, tenant_id, first_name, last_name,
                            npi, specialty, address_line1, city, state, zip_code, phone,
                            is_active, created_at, updated_at)
                        VALUES (:id, :t, :f, :l, :n, :sp, '300 Specialist Blvd',
                            'Orlando', 'FL', '32801', '(407) 555-0300', true, NOW(), NOW())
                    """), {"id": rid, "t": tid, "f": first, "l": last, "n": npi, "sp": spec})
                    ref_ids.append(rid)
            print(f"Referring providers: {len(ref_ids)}")

            # ── CPT Codes ───────────────────────────────────────────────────
            cpt_data = [
                ("99213", "Office Visit, Est Patient, Low Complexity", 150.00),
                ("99214", "Office Visit, Est Patient, Mod Complexity", 200.00),
                ("99203", "Office Visit, New Patient, Low Complexity", 180.00),
                ("99204", "Office Visit, New Patient, Mod Complexity", 250.00),
                ("99396", "Periodic Preventive, Est 40-64 years", 220.00),
                ("93000", "Electrocardiogram, 12-lead", 85.00),
                ("85025", "Complete CBC w/ automated differential", 45.00),
                ("80053", "Comprehensive Metabolic Panel", 55.00),
                ("71046", "Chest X-Ray, 2 views", 120.00),
                ("G0463", "Hospital Outpatient Clinic Visit", 175.00),
            ]
            cpt_ids: dict[str, uuid.UUID] = {}
            for code, desc, fee in cpt_data:
                r = await s.execute(
                    text("SELECT id FROM cpt_codes WHERE tenant_id = :t AND code = :c"),
                    {"t": tid, "c": code},
                )
                row = r.fetchone()
                if row:
                    cpt_ids[code] = row[0]
                else:
                    cid = uid()
                    await s.execute(text("""
                        INSERT INTO cpt_codes (id, tenant_id, code, description, category,
                            default_units, default_fee, is_active, created_at, updated_at)
                        VALUES (:id, :t, :c, :d, 'E/M', 1, :f, true, NOW(), NOW())
                    """), {"id": cid, "t": tid, "c": code, "d": desc, "f": fee})
                    cpt_ids[code] = cid
            print(f"CPT codes: {len(cpt_ids)}")

            # ── ICD-10 Codes ─────────────────────────────────────────────────
            icd_data = [
                ("Z00.00", "Encounter for general adult medical examination"),
                ("I10", "Essential (primary) hypertension"),
                ("E11.9", "Type 2 diabetes mellitus without complications"),
                ("J06.9", "Acute upper respiratory infection, unspecified"),
                ("M54.5", "Low back pain"),
                ("F41.1", "Generalized anxiety disorder"),
                ("E78.5", "Hyperlipidemia, unspecified"),
                ("J45.909", "Unspecified asthma, uncomplicated"),
                ("N39.0", "Urinary tract infection, site not specified"),
                ("K21.0", "GERD with esophagitis"),
            ]
            icd_ids: dict[str, uuid.UUID] = {}
            for code, desc in icd_data:
                r = await s.execute(
                    text("SELECT id FROM diagnosis_codes WHERE tenant_id = :t AND code = :c"),
                    {"t": tid, "c": code},
                )
                row = r.fetchone()
                if row:
                    icd_ids[code] = row[0]
                else:
                    did = uid()
                    await s.execute(text("""
                        INSERT INTO diagnosis_codes (id, tenant_id, code, description,
                            code_type, is_active, created_at, updated_at)
                        VALUES (:id, :t, :c, :d, 'ICD10', true, NOW(), NOW())
                    """), {"id": did, "t": tid, "c": code, "d": desc})
                    icd_ids[code] = did
            print(f"ICD-10 codes: {len(icd_ids)}")

            # ── Staff Users ──────────────────────────────────────────────────
            staff_data = [
                ("Maya", "Johnson", "frontdesk@demo.clinic", "front_desk"),
                ("Carlos", "Rivera", "billing@demo.clinic", "billing"),
                ("Dr. Sarah", "Mitchell", "provider@demo.clinic", "provider"),
            ]
            for first, last, email, role in staff_data:
                r = await s.execute(
                    text("SELECT id FROM users WHERE tenant_id = :t AND email = :e"),
                    {"t": tid, "e": email},
                )
                if not r.fetchone():
                    await s.execute(text("""
                        INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name,
                            is_active, is_superuser, created_at, updated_at)
                        VALUES (:id, :t, :e, :ph, :f, :l, true, false, NOW(), NOW())
                    """), {
                        "id": uid(), "t": tid, "e": email,
                        "ph": pwd.hash("Demo2026!"),
                        "f": first, "l": last,
                    })
            print("Staff users created")

            # ── Patients ─────────────────────────────────────────────────────
            patients_raw = [
                ("Alice", "Thompson", "F", "1975-03-15", "AT-001", "407-555-1001", "alice.thompson@email.com", "00590", "BCB123456789", "GRP-001"),
                ("Robert", "Garcia", "M", "1962-07-22", "RG-002", "407-555-1002", "r.garcia@email.com", "60054", "AET987654321", "GRP-200"),
                ("Jennifer", "Williams", "F", "1988-11-05", "JW-003", "407-555-1003", "jwilliams@email.com", "00590", "BCB555666777", "GRP-001"),
                ("Michael", "Davis", "M", "1955-01-30", "MD-004", "407-555-1004", "mdavis@email.com", "00882", "1EG4-TE5-MK72", None),
                ("Patricia", "Martinez", "F", "1970-09-12", "PM-005", "407-555-1005", "pmartinez@email.com", "60054", "AET111222333", "GRP-200"),
                ("Thomas", "Anderson", "M", "1948-04-18", "TA-006", "407-555-1006", "tanderson@email.com", "00882", "1EG4-TE5-MK99", None),
                ("Linda", "Jackson", "F", "1982-06-27", "LJ-007", "407-555-1007", "ljackson@email.com", "00590", "BCB777888999", "GRP-001"),
                ("William", "White", "M", "1995-12-03", "WW-008", "407-555-1008", "wwhite@email.com", "SELF", None, None),
                ("Barbara", "Harris", "F", "1968-08-14", "BH-009", "407-555-1009", "bharris@email.com", "60054", "AET444555666", "GRP-200"),
                ("James", "Clark", "M", "1980-02-09", "JC-010", "407-555-1010", "jclark@email.com", "00590", "BCB100200300", "GRP-001"),
                ("Susan", "Lewis", "F", "1972-05-21", "SL-011", "407-555-1011", "slewis@email.com", "00882", "1EG4-TE5-MK50", None),
                ("Charles", "Robinson", "M", "1990-10-08", "CR-012", "407-555-1012", "crobinson@email.com", "SELF", None, None),
                ("Margaret", "Walker", "F", "1957-03-25", "MW-013", "407-555-1013", "mwalker@email.com", "60054", "AET789012345", "GRP-200"),
                ("Joseph", "Hall", "M", "1985-07-16", "JH-014", "407-555-1014", "jhall@email.com", "00590", "BCB400500600", "GRP-001"),
                ("Dorothy", "Allen", "F", "1944-12-30", "DA-015", "407-555-1015", "dallen@email.com", "00882", "1EG4-TE5-MK88", None),
            ]

            patient_ids: list[uuid.UUID] = []
            insurance_ids: list[uuid.UUID] = []
            for first, last, sex, dob, acct, phone, email, payer_code, sub_id, group_num in patients_raw:
                r = await s.execute(
                    text("SELECT id FROM patients WHERE tenant_id = :t AND account_number = :a"),
                    {"t": tid, "a": acct},
                )
                row = r.fetchone()
                if row:
                    patient_ids.append(row[0])
                else:
                    pid = uid()
                    await s.execute(text("""
                        INSERT INTO patients (id, tenant_id, practice_id, account_number,
                            first_name, last_name, dob, sex, status, account_type,
                            phone_home, phone_cell, email, preferred_phone,
                            address_line1, city, state, zip,
                            primary_care_provider_id,
                            emergency_contact,
                            created_at, updated_at)
                        VALUES (:id, :t, :prac, :acct, :f, :l, :dob, :sex, 'active', 'patient',
                            :phone, :phone, :email, :phone,
                            '123 Main St', 'Orlando', 'FL', '32801',
                            :provider,
                            :ec,
                            NOW(), NOW())
                    """), {
                        "id": pid, "t": tid, "prac": practice_id, "acct": acct,
                        "f": first, "l": last, "dob": dob, "sex": sex.lower(),
                        "phone": phone, "email": email,
                        "provider": provider_ids[0],
                        "ec": '{"name": "Emergency Contact", "phone": "407-555-9999", "relationship": "Spouse"}',
                    })
                    patient_ids.append(pid)

                    # insurance
                    if payer_code and payer_code in payer_ids:
                        ins_id = uid()
                        copay = Decimal("20.00") if payer_code != "00882" else Decimal("0.00")
                        deductible = Decimal("1500.00") if payer_code == "00590" else Decimal("2000.00") if payer_code == "60054" else Decimal("0.00")
                        await s.execute(text("""
                            INSERT INTO patient_insurances (id, patient_id, priority, payer_id,
                                subscriber_id, group_number, plan_name,
                                copay, deductible, relationship_to_insured,
                                release_of_info, signature_on_file, is_active,
                                created_at, updated_at)
                            VALUES (:id, :pat, 'primary', :payer,
                                :sub, :grp, :plan,
                                :copay, :ded, 'self',
                                true, true, true, NOW(), NOW())
                        """), {
                            "id": ins_id, "pat": pid, "payer": payer_ids[payer_code],
                            "sub": sub_id, "grp": group_num,
                            "plan": {"00590": "BCBS Gold PPO", "60054": "Aetna Select", "00882": "Medicare Part B"}.get(payer_code, "Self-Pay"),
                            "copay": copay, "ded": deductible,
                        })
                        insurance_ids.append(ins_id)
            print(f"Patients: {len(patient_ids)}")

            # ── Visits ────────────────────────────────────────────────────────
            import random
            random.seed(42)

            visit_scenarios = [
                ("99213", "I10", "Hypertension follow-up", days_ago(5)),
                ("99214", "E11.9", "Diabetes management", days_ago(8)),
                ("99203", "Z00.00", "New patient annual exam", days_ago(12)),
                ("99396", "Z00.00", "Preventive visit", days_ago(15)),
                ("99213", "J06.9", "URI / cold symptoms", days_ago(3)),
                ("99214", "M54.5", "Low back pain evaluation", days_ago(22)),
                ("93000", "I10", "EKG for hypertension monitoring", days_ago(30)),
                ("85025", "E11.9", "CBC lab work", days_ago(35)),
                ("80053", "E78.5", "Metabolic panel - hyperlipidemia", days_ago(40)),
                ("99213", "F41.1", "Anxiety check-in", days_ago(7)),
                ("99214", "K21.0", "GERD management", days_ago(18)),
                ("71046", "J45.909", "Chest X-ray for asthma", days_ago(25)),
                ("99203", "N39.0", "UTI new complaint", days_ago(2)),
                ("99213", "I10", "BP recheck", days_ago(45)),
                ("99214", "E11.9", "A1C review", days_ago(60)),
                ("99213", "M54.5", "Back pain follow-up", days_ago(10)),
                ("99396", "Z00.00", "Annual wellness", days_ago(70)),
                ("93000", "F41.1", "Cardiac screening", days_ago(55)),
                ("99213", "K21.0", "GERD follow-up", days_ago(4)),
                ("99214", "E78.5", "Lipid recheck", days_ago(28)),
                ("85025", "N39.0", "UA/CBC for UTI", days_ago(1)),
                ("99213", "J06.9", "Sick visit", days_ago(14)),
                ("99214", "I10", "Hypertension management", days_ago(50)),
                ("99203", "M54.5", "New patient back pain", days_ago(6)),
                ("71046", "J06.9", "Chest film URI", days_ago(33)),
                ("99213", "F41.1", "Anxiety medication review", days_ago(20)),
                ("99214", "K21.0", "GERD + lifestyle counseling", days_ago(42)),
                ("99213", "E11.9", "Diabetes routine", days_ago(65)),
                ("80053", "E78.5", "Lipid panel", days_ago(80)),
                ("99214", "Z00.00", "Preventive exam + labs", days_ago(90)),
            ]

            visit_statuses = ["completed", "completed", "completed", "completed", "billed"]
            visit_ids: list[uuid.UUID] = []

            for i, (cpt, icd, reason, vdate) in enumerate(visit_scenarios):
                pat_id = patient_ids[i % len(patient_ids)]
                prov_id = provider_ids[i % len(provider_ids)]
                status = random.choice(visit_statuses)

                r = await s.execute(
                    text("SELECT id FROM visits WHERE patient_id = :p AND visit_date = :d"),
                    {"p": pat_id, "d": vdate},
                )
                row = r.fetchone()
                if row:
                    visit_ids.append(row[0])
                    continue

                vid = uid()
                await s.execute(text("""
                    INSERT INTO visits (id, tenant_id, patient_id, practice_id, office_id,
                        provider_id, billing_provider_id, visit_date, visit_type,
                        reason, chief_complaint, status, created_at, updated_at)
                    VALUES (:id, :t, :pat, :prac, :off, :prov, :bp,
                        :vdate, 'office_visit', :reason, :reason, :status, NOW(), NOW())
                """), {
                    "id": vid, "t": tid, "pat": pat_id, "prac": practice_id,
                    "off": office_id, "prov": prov_id, "bp": billing_provider_id,
                    "vdate": vdate, "reason": reason, "status": status,
                })

                # diagnosis
                await s.execute(text("""
                    INSERT INTO visit_diagnoses (id, visit_id, code_type, diagnosis_code,
                        description, pointer_label, sequence, created_at, updated_at)
                    VALUES (:id, :v, 'ICD10', :code, :desc, 'A', 1, NOW(), NOW())
                """), {
                    "id": uid(), "v": vid, "code": icd,
                    "desc": dict(icd_data).get(icd, icd),
                })

                # charge line
                fee = dict((c, f) for c, d, f in cpt_data).get(cpt, 150.00)
                await s.execute(text("""
                    INSERT INTO charge_lines (id, visit_id, sequence, dos_from, dos_to,
                        pos, cpt_code, description, charge, units, created_at, updated_at)
                    VALUES (:id, :v, 1, :dos, :dos, '11', :cpt, :desc, :charge, 1, NOW(), NOW())
                """), {
                    "id": uid(), "v": vid, "dos": vdate,
                    "cpt": cpt, "desc": dict((c, d) for c, d, f in cpt_data).get(cpt, cpt),
                    "charge": fee,
                })

                visit_ids.append(vid)
            print(f"Visits: {len(visit_ids)}")

            # ── Claims ─────────────────────────────────────────────────────────
            claim_statuses = [
                "submitted", "submitted", "submitted",
                "paid", "paid", "paid", "paid",
                "denied", "denied",
                "draft", "draft",
                "pending_review",
            ]
            claim_ids: list[uuid.UUID] = []

            for i, vid in enumerate(visit_ids):
                r_v = await s.execute(
                    text("SELECT patient_id, visit_date, provider_id FROM visits WHERE id = :v"),
                    {"v": vid},
                )
                v_row = r_v.fetchone()
                if not v_row:
                    continue
                v_pat, v_date, v_prov = v_row

                # find insurance
                r_i = await s.execute(
                    text("SELECT id, payer_id FROM patient_insurances WHERE patient_id = :p AND priority = 'primary' LIMIT 1"),
                    {"p": v_pat},
                )
                ins_row = r_i.fetchone()
                ins_id_val = ins_row[0] if ins_row else None
                payer_id_val = ins_row[1] if ins_row else payer_ids.get("SELF")

                # skip if claim already exists
                r_c = await s.execute(
                    text("SELECT id FROM claims WHERE visit_id = :v"),
                    {"v": vid},
                )
                if r_c.fetchone():
                    r_c2 = await s.execute(text("SELECT id FROM claims WHERE visit_id = :v"), {"v": vid})
                    row_c2 = r_c2.fetchone()
                    if row_c2:
                        claim_ids.append(row_c2[0])
                    continue

                cstatus = claim_statuses[i % len(claim_statuses)]
                charge = Decimal("150.00") if i % 3 == 0 else Decimal("200.00") if i % 3 == 1 else Decimal("250.00")
                paid = charge * Decimal("0.80") if cstatus == "paid" else Decimal("0.00")
                balance = charge - paid

                cid = uid()
                claim_number = f"CLM{str(i+1).zfill(6)}"
                await s.execute(text("""
                    INSERT INTO claims (id, tenant_id, claim_number, patient_id, visit_id,
                        provider_id, billing_provider_id, payer_id, patient_insurance_id,
                        claim_type, date_of_service, total_charge, total_paid,
                        total_adjustment, patient_responsibility, balance, status,
                        created_at, updated_at)
                    VALUES (:id, :t, :cn, :pat, :v, :prov, :bp, :payer, :ins,
                        'professional', :dos, :charge, :paid,
                        :adj, :resp, :bal, :status, NOW(), NOW())
                """), {
                    "id": cid, "t": tid, "cn": claim_number,
                    "pat": v_pat, "v": vid, "prov": v_prov,
                    "bp": billing_provider_id, "payer": payer_id_val, "ins": ins_id_val,
                    "dos": v_date, "charge": charge, "paid": paid,
                    "adj": paid * Decimal("0.05") if cstatus == "paid" else Decimal("0.00"),
                    "resp": Decimal("20.00") if cstatus == "paid" else Decimal("0.00"),
                    "bal": balance, "status": cstatus,
                })
                claim_ids.append(cid)

                # Add a claim line
                await s.execute(text("""
                    INSERT INTO claim_lines (id, tenant_id, claim_id, cpt_code, modifiers,
                        units, charge_amount, allowed_amount, paid_amount, adjustment_amount,
                        place_of_service_code, sequence, created_at, updated_at)
                    VALUES (:id, :t, :c, '99213', '[]', 1, :charge, :allowed, :paid,
                        :adj, '11', 1, NOW(), NOW())
                """), {
                    "id": uid(), "t": tid, "c": cid,
                    "charge": charge,
                    "allowed": charge * Decimal("0.85") if cstatus == "paid" else charge,
                    "paid": paid,
                    "adj": paid * Decimal("0.05") if cstatus == "paid" else Decimal("0.00"),
                })

                # Status event
                await s.execute(text("""
                    INSERT INTO claim_status_events (id, tenant_id, claim_id, from_status,
                        to_status, note, changed_at, created_at, updated_at)
                    VALUES (:id, :t, :c, 'draft', :status, 'Initial status', NOW(), NOW(), NOW())
                """), {"id": uid(), "t": tid, "c": cid, "status": cstatus})

            print(f"Claims: {len(claim_ids)}")

            # ── Payments ──────────────────────────────────────────────────────
            paid_claim_ids = []
            for cid in claim_ids:
                r_c = await s.execute(text("SELECT id, status, total_charge, patient_id, payer_id FROM claims WHERE id = :c"), {"c": cid})
                row = r_c.fetchone()
                if row and row[1] == "paid":
                    paid_claim_ids.append(row)

            for i, (cid, _, charge, pat_id, pay_id) in enumerate(paid_claim_ids[:15]):
                r_p = await s.execute(text("SELECT id FROM payments WHERE tenant_id = :t AND reference_number = :r"), {"t": tid, "r": f"CHK{str(i+1).zfill(5)}"})
                if r_p.fetchone():
                    continue

                amt = charge * Decimal("0.80")
                pmnt_id = uid()
                await s.execute(text("""
                    INSERT INTO payments (id, tenant_id, patient_id, payer_id, payment_date,
                        payment_type, payment_method, amount, unapplied_amount,
                        check_number, reference_number, deposit_date,
                        is_reversed, created_at, updated_at)
                    VALUES (:id, :t, :pat, :payer, :pdate, 'insurance', 'check',
                        :amt, 0, :chk, :ref, :pdate, false, NOW(), NOW())
                """), {
                    "id": pmnt_id, "t": tid, "pat": pat_id, "payer": pay_id,
                    "pdate": days_ago(i * 3),
                    "amt": amt, "chk": f"CHK{str(i+1).zfill(5)}",
                    "ref": f"CHK{str(i+1).zfill(5)}",
                })

                # Apply to claim
                await s.execute(text("""
                    INSERT INTO payment_applications (id, tenant_id, payment_id, claim_id,
                        amount_applied, adjustment_amount, adjustment_code,
                        is_reversed, applied_at, created_at, updated_at)
                    VALUES (:id, :t, :pay, :c, :amt, :adj, 'CO-45', false, NOW(), NOW(), NOW())
                """), {
                    "id": uid(), "t": tid, "pay": pmnt_id, "c": cid,
                    "amt": amt, "adj": amt * Decimal("0.05"),
                })
            print(f"Payments: {len(paid_claim_ids[:15])}")

            # ── Work Queue Items ──────────────────────────────────────────────
            wq_items = [
                ("denial_management", "high", "Denial — CO-97", "Denials", "Service not covered by plan"),
                ("missing_info", "medium", "Missing Subscriber ID", "Missing Info", "Insurance subscriber ID blank"),
                ("auth_required", "high", "Prior Auth Expired", "Auth", "Authorization expired before DOS"),
                ("resubmission", "medium", "Claim Rejected — NPI", "Resubmission", "Rendering NPI not on file with payer"),
                ("timely_filing", "high", "Timely Filing Risk", "Timely Filing", "Claim >300 days, approaching limit"),
                ("patient_balance", "low", "Patient Balance Due", "Patient Balance", "Patient owes $45 copay"),
                ("denial_management", "medium", "Denial — CO-4", "Denials", "Modifier required but not provided"),
                ("missing_info", "low", "No Referring NPI", "Missing Info", "Referring provider NPI missing"),
                ("auth_required", "medium", "Auth Needed — MRI", "Auth", "Imaging order requires pre-auth"),
                ("resubmission", "high", "ERA Discrepancy", "Payments", "ERA amount doesn't match claim"),
            ]

            for i, (item_type, priority, title, category, desc) in enumerate(wq_items):
                r_w = await s.execute(
                    text("SELECT id FROM work_items WHERE tenant_id = :t AND title = :ti"),
                    {"t": tid, "ti": title},
                )
                if r_w.fetchone():
                    continue

                pat_id = patient_ids[i % len(patient_ids)]
                claim_id_val = claim_ids[i % len(claim_ids)] if claim_ids else None

                await s.execute(text("""
                    INSERT INTO work_items (id, tenant_id, item_type, status, priority,
                        title, description, patient_id, claim_id, due_date,
                        escalated, created_at, updated_at)
                    VALUES (:id, :t, :type, 'open', :pri,
                        :title, :desc, :pat, :claim, :due,
                        false, NOW(), NOW())
                """), {
                    "id": uid(), "t": tid, "type": item_type,
                    "pri": priority, "title": title, "desc": desc,
                    "pat": pat_id, "claim": claim_id_val,
                    "due": days_ago(-7 + i),  # due in 7-16 days
                })
            print("Work queue items created")

            # ── Denial Appeals ────────────────────────────────────────────────
            denied_claims = []
            for cid in claim_ids:
                r = await s.execute(text("SELECT id FROM claims WHERE id = :c AND status = 'denied'"), {"c": cid})
                if r.fetchone():
                    denied_claims.append(cid)

            for i, cid in enumerate(denied_claims[:5]):
                r_d = await s.execute(text("SELECT id FROM denial_appeals WHERE claim_id = :c"), {"c": cid})
                if r_d.fetchone():
                    continue

                await s.execute(text("""
                    INSERT INTO denial_appeals (id, tenant_id, claim_id, carc_code, rarc_code,
                        denial_reason, denied_amount, appeal_status, appeal_due_date,
                        created_at, updated_at)
                    VALUES (:id, :t, :c, :carc, :rarc, :reason, :amt, :status, :due, NOW(), NOW())
                """), {
                    "id": uid(), "t": tid, "c": cid,
                    "carc": ["CO-97", "CO-4", "CO-109", "PR-1", "CO-96"][i],
                    "rarc": ["N30", "N95", "M86", "N115", "N20"][i],
                    "reason": [
                        "Benefit not covered under plan",
                        "Modifier inconsistent with procedure",
                        "Claim not covered — not medically necessary",
                        "Deductible not met",
                        "Non-covered service",
                    ][i],
                    "amt": Decimal("150.00"),
                    "status": ["pending", "submitted", "pending", "won", "lost"][i],
                    "due": days_ago(-14 + i * 7),
                })
            print(f"Denial appeals: {len(denied_claims[:5])}")

            # ── Appointments ─────────────────────────────────────────────────
            appt_scenarios = [
                (0, 0, "office_visit", "scheduled", 9, 0),
                (1, 1, "follow_up", "confirmed", 9, 30),
                (2, 0, "new_patient", "checked_in", 10, 0),
                (3, 2, "office_visit", "roomed", 10, 30),
                (4, 1, "telehealth", "in_exam", 11, 0),
                (5, 0, "office_visit", "checked_out", 11, 30),
                (6, 2, "follow_up", "scheduled", 13, 0),
                (7, 1, "procedure", "confirmed", 13, 30),
                (8, 0, "office_visit", "scheduled", 14, 0),
                (9, 2, "new_patient", "no_show", 14, 30),
                # tomorrow
                (10, 0, "office_visit", "scheduled", 9, 0),
                (11, 1, "follow_up", "scheduled", 9, 30),
                (12, 2, "office_visit", "scheduled", 10, 0),
                (13, 0, "new_patient", "scheduled", 10, 30),
                (14, 1, "telehealth", "scheduled", 11, 0),
            ]

            today_dt = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            tomorrow_dt = today_dt + timedelta(days=1)

            for i, (pat_i, prov_i, appt_type, status, hour, minute) in enumerate(appt_scenarios):
                pat_id = patient_ids[pat_i % len(patient_ids)]
                prov_id = provider_ids[prov_i % len(provider_ids)]
                base_dt = today_dt if i < 10 else tomorrow_dt
                start = base_dt + timedelta(hours=hour, minutes=minute)
                end = start + timedelta(minutes=30)

                r_a = await s.execute(
                    text("SELECT id FROM appointments WHERE patient_id = :p AND start_time = :s"),
                    {"p": pat_id, "s": start},
                )
                if r_a.fetchone():
                    continue

                await s.execute(text("""
                    INSERT INTO appointments (id, tenant_id, patient_id, provider_id, office_id,
                        start_time, end_time, appointment_type, status, created_at, updated_at)
                    VALUES (:id, :t, :pat, :prov, :off,
                        :start, :end, :type, :status, NOW(), NOW())
                """), {
                    "id": uid(), "t": tid, "pat": pat_id, "prov": prov_id, "off": office_id,
                    "start": start, "end": end, "type": appt_type, "status": status,
                })
            print("Appointments created")

        await s.commit()

    await engine.dispose()
    print("\n✓ Mock data seed complete.")
    print("  Login: admin@clinictraq.com / ClinicTraq2026!")
    print("  Staff: frontdesk@demo.clinic / billing@demo.clinic / provider@demo.clinic")
    print("  Password for staff: Demo2026!")


if __name__ == "__main__":
    asyncio.run(seed())
