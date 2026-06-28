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
    op.create_table(
        "denial_appeals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("claim_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("carc_code", sa.String(10), nullable=True),
        sa.Column("rarc_code", sa.String(10), nullable=True),
        sa.Column("denial_reason", sa.Text, nullable=True),
        sa.Column("denied_amount", sa.Float, nullable=True),
        sa.Column("appeal_status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("appeal_due_date", sa.Date, nullable=True),
        sa.Column("appeal_submitted_date", sa.Date, nullable=True),
        sa.Column("appeal_notes", sa.Text, nullable=True),
        sa.Column("supporting_docs", postgresql.JSONB, nullable=True),
        sa.Column("resolved_amount", sa.Float, nullable=True),
        sa.Column("resolved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_denial_appeals_tenant_id", "denial_appeals", ["tenant_id"])
    op.create_index("ix_denial_appeals_claim_id", "denial_appeals", ["claim_id"])
    op.create_index("ix_denial_appeals_appeal_status", "denial_appeals", ["appeal_status"])


def downgrade() -> None:
    op.drop_index("ix_denial_appeals_appeal_status", table_name="denial_appeals")
    op.drop_index("ix_denial_appeals_claim_id", table_name="denial_appeals")
    op.drop_index("ix_denial_appeals_tenant_id", table_name="denial_appeals")
    op.drop_table("denial_appeals")
