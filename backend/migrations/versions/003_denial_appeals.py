"""add denial_appeals table

Revision ID: 003_denial_appeals
Revises: 001_billing_reference
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "003_denial_appeals"
down_revision = "001_billing_reference"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # denial_appeals was already created in 001_billing_reference — no-op
    pass


def downgrade() -> None:
    pass
