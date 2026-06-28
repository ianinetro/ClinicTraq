"""add appointments table for scheduling domain

Revision ID: 005_scheduling
Revises: 003_denial_appeals
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "005_scheduling"
down_revision = "003_denial_appeals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "appointments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("office_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("appointment_type", sa.String(50), nullable=False, server_default="office_visit"),
        sa.Column("status", sa.String(50), nullable=False, server_default="scheduled"),
        sa.Column("chief_complaint", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], name="fk_appointments_patient_id"),
        sa.ForeignKeyConstraint(["provider_id"], ["providers.id"], name="fk_appointments_provider_id"),
        sa.ForeignKeyConstraint(["office_id"], ["offices.id"], name="fk_appointments_office_id"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_appointments_created_by"),
    )
    op.create_index("ix_appointments_tenant_id", "appointments", ["tenant_id"])
    op.create_index("ix_appointments_patient_id", "appointments", ["patient_id"])
    op.create_index("ix_appointments_provider_id", "appointments", ["provider_id"])
    op.create_index("ix_appointments_start_time", "appointments", ["start_time"])
    op.create_index("ix_appointments_status", "appointments", ["status"])


def downgrade() -> None:
    op.drop_index("ix_appointments_status", table_name="appointments")
    op.drop_index("ix_appointments_start_time", table_name="appointments")
    op.drop_index("ix_appointments_provider_id", table_name="appointments")
    op.drop_index("ix_appointments_patient_id", table_name="appointments")
    op.drop_index("ix_appointments_tenant_id", table_name="appointments")
    op.drop_table("appointments")
