"""billing reference data, org hierarchy, body map

Revision ID: 001_billing_reference
Revises:
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001_billing_reference"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # NCCI PTP edit table
    # ------------------------------------------------------------------
    op.create_table(
        "ncci_edits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
        sa.Column("column1_code", sa.String(10), nullable=False),
        sa.Column("column2_code", sa.String(10), nullable=False),
        sa.Column("modifier_indicator", sa.Integer(), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("deletion_date", sa.Date(), nullable=True),
        sa.UniqueConstraint("column1_code", "column2_code", "effective_date", name="uq_ncci_edit"),
    )
    op.create_index("ix_ncci_edits_column1_code", "ncci_edits", ["column1_code"])
    op.create_index("ix_ncci_edits_column2_code", "ncci_edits", ["column2_code"])

    # ------------------------------------------------------------------
    # MUE limits
    # ------------------------------------------------------------------
    op.create_table(
        "mue_limits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
        sa.Column("cpt_code", sa.String(10), nullable=False),
        sa.Column("mue_value", sa.Integer(), nullable=False),
        sa.Column("adjudication_indicator", sa.String(20), nullable=True),
        sa.Column("rationale", sa.String(10), nullable=True),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("deletion_date", sa.Date(), nullable=True),
        sa.UniqueConstraint("cpt_code", "effective_date", name="uq_mue_limit"),
    )
    op.create_index("ix_mue_limits_cpt_code", "mue_limits", ["cpt_code"])

    # ------------------------------------------------------------------
    # CARC codes
    # ------------------------------------------------------------------
    op.create_table(
        "carc_codes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
        sa.Column("code", sa.String(10), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(5), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("effective_date", sa.Date(), nullable=True),
        sa.Column("termination_date", sa.Date(), nullable=True),
    )
    op.create_index("ix_carc_codes_code", "carc_codes", ["code"])

    # ------------------------------------------------------------------
    # RARC codes
    # ------------------------------------------------------------------
    op.create_table(
        "rarc_codes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
        sa.Column("code", sa.String(10), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("remark_type", sa.String(5), nullable=True),
        sa.Column("effective_date", sa.Date(), nullable=True),
        sa.Column("termination_date", sa.Date(), nullable=True),
    )
    op.create_index("ix_rarc_codes_code", "rarc_codes", ["code"])

    # ------------------------------------------------------------------
    # Denial appeals
    # ------------------------------------------------------------------
    op.create_table(
        "denial_appeals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("claim_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("carc_code", sa.String(10), nullable=True),
        sa.Column("rarc_code", sa.String(10), nullable=True),
        sa.Column("denial_reason", sa.Text(), nullable=True),
        sa.Column("denied_amount", sa.Float(), nullable=True),
        sa.Column("appeal_status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("appeal_due_date", sa.Date(), nullable=True),
        sa.Column("appeal_submitted_date", sa.Date(), nullable=True),
        sa.Column("appeal_notes", sa.Text(), nullable=True),
        sa.Column("supporting_docs", postgresql.JSONB(), nullable=True),
        sa.Column("resolved_amount", sa.Float(), nullable=True),
        sa.Column("resolved_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_denial_appeals_tenant_id", "denial_appeals", ["tenant_id"])
    op.create_index("ix_denial_appeals_claim_id", "denial_appeals", ["claim_id"])
    op.create_index("ix_denial_appeals_appeal_status", "denial_appeals", ["appeal_status"])

    # ------------------------------------------------------------------
    # Payer TFL settings
    # ------------------------------------------------------------------
    op.create_table(
        "payer_tfl_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("payer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tfl_days", sa.Integer(), nullable=False),
        sa.Column("warning_days_before", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("auto_crossover", sa.Boolean(), nullable=False, server_default="false"),
        sa.UniqueConstraint("tenant_id", "payer_id", name="uq_payer_tfl"),
    )
    op.create_index("ix_payer_tfl_settings_tenant_id", "payer_tfl_settings", ["tenant_id"])

    # ------------------------------------------------------------------
    # Org hierarchy: management groups
    # ------------------------------------------------------------------
    op.create_table(
        "management_groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("contact_email", sa.String(255), nullable=True),
        sa.Column("contact_phone", sa.String(20), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("settings", postgresql.JSONB(), nullable=True),
    )
    op.create_index("ix_management_groups_tenant_id", "management_groups", ["tenant_id"])

    # ------------------------------------------------------------------
    # Billing companies
    # ------------------------------------------------------------------
    op.create_table(
        "billing_companies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("management_group_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("management_groups.id"), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("npi", sa.String(10), nullable=True),
        sa.Column("tax_id", sa.String(20), nullable=True),
        sa.Column("contact_email", sa.String(255), nullable=True),
        sa.Column("contact_phone", sa.String(20), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.create_index("ix_billing_companies_tenant_id", "billing_companies", ["tenant_id"])

    # ------------------------------------------------------------------
    # Clinics
    # ------------------------------------------------------------------
    op.create_table(
        "clinics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("management_group_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("management_groups.id"), nullable=True),
        sa.Column("billing_company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("billing_companies.id"), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("npi", sa.String(10), nullable=True),
        sa.Column("tax_id", sa.String(20), nullable=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("state", sa.String(2), nullable=True),
        sa.Column("zip_code", sa.String(10), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("fax", sa.String(20), nullable=True),
        sa.Column("place_of_service_code", sa.String(2), nullable=False, server_default="11"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("settings", postgresql.JSONB(), nullable=True),
    )
    op.create_index("ix_clinics_tenant_id", "clinics", ["tenant_id"])

    # ------------------------------------------------------------------
    # Clinic staff assignments
    # ------------------------------------------------------------------
    op.create_table(
        "clinic_staff_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("clinic_role", sa.String(30), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.UniqueConstraint("clinic_id", "user_id", name="uq_clinic_staff"),
    )
    op.create_index("ix_clinic_staff_tenant_id", "clinic_staff_assignments", ["tenant_id"])
    op.create_index("ix_clinic_staff_clinic_id", "clinic_staff_assignments", ["clinic_id"])
    op.create_index("ix_clinic_staff_user_id", "clinic_staff_assignments", ["user_id"])

    # ------------------------------------------------------------------
    # Visit body maps
    # ------------------------------------------------------------------
    op.create_table(
        "visit_body_maps",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("visit_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("visits.id"), nullable=False, unique=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index("ix_visit_body_maps_tenant_id", "visit_body_maps", ["tenant_id"])
    op.create_index("ix_visit_body_maps_visit_id", "visit_body_maps", ["visit_id"])

    # ------------------------------------------------------------------
    # Body zone annotations
    # ------------------------------------------------------------------
    op.create_table(
        "body_zone_annotations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("body_map_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("visit_body_maps.id"), nullable=False),
        sa.Column("zone_key", sa.String(40), nullable=False),
        sa.Column("color", sa.String(10), nullable=False, server_default="yellow"),
        sa.Column("icd_codes", postgresql.JSONB(), nullable=True),
        sa.Column("cpt_codes", postgresql.JSONB(), nullable=True),
        sa.Column("medications", postgresql.JSONB(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("modifier_hint", sa.String(2), nullable=True),
        sa.UniqueConstraint("body_map_id", "zone_key", name="uq_annotation_zone"),
    )
    op.create_index("ix_body_zone_annotations_body_map_id", "body_zone_annotations", ["body_map_id"])
    op.create_index("ix_body_zone_annotations_tenant_id", "body_zone_annotations", ["tenant_id"])


def downgrade() -> None:
    op.drop_table("body_zone_annotations")
    op.drop_table("visit_body_maps")
    op.drop_table("clinic_staff_assignments")
    op.drop_table("clinics")
    op.drop_table("billing_companies")
    op.drop_table("management_groups")
    op.drop_table("payer_tfl_settings")
    op.drop_table("denial_appeals")
    op.drop_table("rarc_codes")
    op.drop_table("carc_codes")
    op.drop_table("mue_limits")
    op.drop_table("ncci_edits")
