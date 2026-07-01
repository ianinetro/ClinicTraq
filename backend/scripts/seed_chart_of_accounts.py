"""
Seed standard medical practice chart of accounts into the database.

Usage:
    python scripts/seed_chart_of_accounts.py --tenant-id <uuid>

Covers revenue, assets, liabilities, and expenses standard to a medical billing practice.
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
from domains.master_data.models import ChartAccount

# ---------------------------------------------------------------------------
# Account table  (account_number, name, account_type, parent_account_number)
# parent_account_number is None for top-level accounts
# ---------------------------------------------------------------------------
COA_DATA: list[tuple[str, str, str, str | None]] = [
    # ── Assets (1xxx) ─────────────────────────────────────────────────────
    ("1000", "Current Assets", "asset", None),
    ("1100", "Accounts Receivable - Insurance", "asset", "1000"),
    ("1110", "AR - Medicare", "asset", "1100"),
    ("1120", "AR - Medicaid", "asset", "1100"),
    ("1130", "AR - Commercial", "asset", "1100"),
    ("1200", "Accounts Receivable - Patient", "asset", "1000"),
    ("1300", "Unearned Revenue", "asset", "1000"),
    ("1400", "Cash", "asset", "1000"),

    # ── Liabilities (2xxx) ────────────────────────────────────────────────
    ("2000", "Current Liabilities", "liability", None),
    ("2100", "Refunds Payable - Insurance", "liability", "2000"),
    ("2200", "Refunds Payable - Patient", "liability", "2000"),
    ("2300", "Credit Balances", "liability", "2000"),

    # ── Revenue (4xxx) ────────────────────────────────────────────────────
    ("4000", "Patient Services Revenue", "income", None),
    ("4100", "Office Visit Revenue", "income", "4000"),
    ("4110", "New Patient Visits", "income", "4100"),
    ("4120", "Established Patient Visits", "income", "4100"),
    ("4130", "Preventive Care", "income", "4100"),
    ("4200", "Procedure Revenue", "income", "4000"),
    ("4210", "Minor Surgical Procedures", "income", "4200"),
    ("4220", "Diagnostic Procedures", "income", "4200"),
    ("4300", "Lab Revenue", "income", "4000"),
    ("4400", "Radiology Revenue", "income", "4000"),
    ("4500", "Telehealth Revenue", "income", "4000"),
    ("4600", "Secondary Insurance Revenue", "income", "4000"),
    ("4700", "Patient Copay Revenue", "income", "4000"),
    ("4800", "Other Revenue", "income", "4000"),
    ("4900", "Revenue Adjustments", "income", "4000"),
    ("4910", "Contractual Adjustments", "income", "4900"),
    ("4920", "Write-offs", "income", "4900"),
    ("4930", "Bad Debt", "income", "4900"),

    # ── Expenses (5xxx) ───────────────────────────────────────────────────
    ("5000", "Operating Expenses", "expense", None),
    ("5100", "Staff Salaries", "expense", "5000"),
    ("5200", "Benefits", "expense", "5000"),
    ("5300", "Medical Supplies", "expense", "5000"),
    ("5400", "Facility Costs", "expense", "5000"),
    ("5500", "Technology/Software", "expense", "5000"),
    ("5600", "Billing Costs", "expense", "5000"),
]

# ---------------------------------------------------------------------------

async def seed(tenant_id: str) -> None:
    tid = uuid.UUID(tenant_id)

    async with AsyncSessionLocal() as session:
        existing_result = await session.execute(
            select(ChartAccount.account_number).where(ChartAccount.tenant_id == tid)
        )
        existing_numbers = {row[0] for row in existing_result.fetchall()}
        print(f"Existing chart accounts for tenant: {len(existing_numbers)}")

        # First pass: create all accounts (without parent_id) to get their IDs
        # We need to build a map from account_number -> id for parent resolution
        number_to_id: dict[str, uuid.UUID] = {}

        # Load IDs of already-existing accounts so we can resolve parents
        if existing_numbers:
            existing_rows = await session.execute(
                select(ChartAccount.account_number, ChartAccount.id).where(
                    ChartAccount.tenant_id == tid
                )
            )
            for acct_number, acct_id in existing_rows.fetchall():
                number_to_id[acct_number] = acct_id

        # Assign new IDs for accounts to be inserted
        to_insert = [row for row in COA_DATA if row[0] not in existing_numbers]
        for account_number, name, account_type, _parent in to_insert:
            number_to_id[account_number] = uuid.uuid4()

        inserted = 0
        skipped = len(existing_numbers)
        for account_number, name, account_type, parent_account_number in to_insert:
            parent_id = number_to_id.get(parent_account_number) if parent_account_number else None
            session.add(ChartAccount(
                id=number_to_id[account_number],
                tenant_id=tid,
                account_number=account_number,
                name=name,
                account_type=account_type,
                parent_id=parent_id,
                is_active=True,
            ))
            inserted += 1

        await session.commit()
        print(f"Inserted {inserted} chart accounts, skipped {skipped} existing.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed chart of accounts")
    parser.add_argument("--tenant-id", required=True, help="Tenant UUID to seed accounts for")
    args = parser.parse_args()
    asyncio.run(seed(args.tenant_id))
