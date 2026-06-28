from __future__ import annotations

import uuid
from datetime import date
from typing import Any, Dict, List, Optional

from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Practice(Base):
    __tablename__ = "practices"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    npi: Mapped[Optional[str]] = mapped_column(String(10))
    tax_id: Mapped[Optional[str]] = mapped_column(String(20))
    taxonomy_code: Mapped[Optional[str]] = mapped_column(String(10))
    address_line1: Mapped[Optional[str]] = mapped_column(String(255))
    address_line2: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(2))
    zip_code: Mapped[Optional[str]] = mapped_column(String(10))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    fax: Mapped[Optional[str]] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Office(Base):
    __tablename__ = "offices"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    practice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("practices.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    npi: Mapped[Optional[str]] = mapped_column(String(10))
    address_line1: Mapped[Optional[str]] = mapped_column(String(255))
    address_line2: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(2))
    zip_code: Mapped[Optional[str]] = mapped_column(String(10))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    place_of_service_code: Mapped[Optional[str]] = mapped_column(String(2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    practice: Mapped["Practice"] = relationship("Practice")


class Provider(Base):
    __tablename__ = "providers"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    npi: Mapped[str] = mapped_column(String(10), nullable=False)
    taxonomy_code: Mapped[Optional[str]] = mapped_column(String(10))
    specialty: Mapped[Optional[str]] = mapped_column(String(100))
    credential: Mapped[Optional[str]] = mapped_column(String(50))  # MD, DO, NP, PA
    upin: Mapped[Optional[str]] = mapped_column(String(20))
    license_number: Mapped[Optional[str]] = mapped_column(String(50))
    license_state: Mapped[Optional[str]] = mapped_column(String(2))
    dea_numbers: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)  # {state: number}
    office_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("offices.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    office: Mapped[Optional["Office"]] = relationship("Office")


class BillingProvider(Base):
    __tablename__ = "billing_providers"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    npi: Mapped[str] = mapped_column(String(10), nullable=False)
    tax_id: Mapped[str] = mapped_column(String(20), nullable=False)
    taxonomy_code: Mapped[Optional[str]] = mapped_column(String(10))
    address_line1: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(2))
    zip_code: Mapped[Optional[str]] = mapped_column(String(10))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ReferringProvider(Base):
    __tablename__ = "referring_providers"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    npi: Mapped[str] = mapped_column(String(10), nullable=False)
    specialty: Mapped[Optional[str]] = mapped_column(String(100))
    address_line1: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(2))
    zip_code: Mapped[Optional[str]] = mapped_column(String(10))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Facility(Base):
    __tablename__ = "facilities"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    npi: Mapped[Optional[str]] = mapped_column(String(10))
    place_of_service_code: Mapped[Optional[str]] = mapped_column(String(2))
    address_line1: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(2))
    zip_code: Mapped[Optional[str]] = mapped_column(String(10))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Payer(Base):
    __tablename__ = "payers"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    payer_id: Mapped[str] = mapped_column(String(50), nullable=False)  # EDI payer ID
    payer_type: Mapped[str] = mapped_column(String(50), default="commercial")  # commercial, medicare, medicaid
    address_line1: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(2))
    zip_code: Mapped[Optional[str]] = mapped_column(String(10))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    billing_rules: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    tfl_days: Mapped[int] = mapped_column(Integer, default=365)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class CPTCode(Base):
    __tablename__ = "cpt_codes"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(10), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(100))
    default_units: Mapped[int] = mapped_column(Integer, default=1)
    default_fee: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    effective_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)


class DiagnosisCode(Base):
    __tablename__ = "diagnosis_codes"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(10), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    code_type: Mapped[str] = mapped_column(String(10), default="ICD-10")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    effective_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)


class ChartAccount(Base):
    __tablename__ = "chart_accounts"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    account_number: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_type: Mapped[str] = mapped_column(String(50), nullable=False)  # income, expense, asset, liability
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_accounts.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class PayerTFLSetting(Base):
    __tablename__ = "payer_tfl_settings"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    payer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payers.id"), nullable=False)
    tfl_days: Mapped[int] = mapped_column(Integer, nullable=False, default=365)
    auto_crossover: Mapped[bool] = mapped_column(Boolean, default=False)

    payer: Mapped["Payer"] = relationship("Payer")


class NCCIEdit(Base):
    """CMS NCCI Procedure-to-Procedure (PTP) edits — loaded quarterly from CMS files."""
    __tablename__ = "ncci_edits"
    __table_args__ = (
        UniqueConstraint("column1_code", "column2_code", "effective_date", name="uq_ncci_edit"),
    )

    column1_code: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    column2_code: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    modifier_indicator: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=never, 1=allowed, 9=n/a
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    deletion_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)


class MUELimit(Base):
    """CMS Medically Unlikely Edits — max units per CPT per day."""
    __tablename__ = "mue_limits"
    __table_args__ = (
        UniqueConstraint("cpt_code", "effective_date", name="uq_mue_limit"),
    )

    cpt_code: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    mue_value: Mapped[int] = mapped_column(Integer, nullable=False)
    adjudication_indicator: Mapped[str] = mapped_column(String(20), default="claim")  # claim/line/date-of-service
    rationale: Mapped[Optional[str]] = mapped_column(String(200))
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    deletion_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)


class CARCCode(Base):
    """Claim Adjustment Reason Codes — explains why payer adjusted/denied claim."""
    __tablename__ = "carc_codes"

    code: Mapped[str] = mapped_column(String(10), nullable=False, unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(10))  # CO, PR, OA, PI, CR
    notes: Mapped[Optional[str]] = mapped_column(Text)
    effective_date: Mapped[Optional[date]] = mapped_column(Date)
    termination_date: Mapped[Optional[date]] = mapped_column(Date)


class RARCCode(Base):
    """Remittance Advice Remark Codes — additional detail for CARC adjustments."""
    __tablename__ = "rarc_codes"

    code: Mapped[str] = mapped_column(String(10), nullable=False, unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    remark_type: Mapped[Optional[str]] = mapped_column(String(10))  # ADD, DEF, OA, HE
    effective_date: Mapped[Optional[date]] = mapped_column(Date)
    termination_date: Mapped[Optional[date]] = mapped_column(Date)


class ProviderPayerPin(Base):
    __tablename__ = "provider_payer_pins"
    __table_args__ = (
        UniqueConstraint("tenant_id", "provider_id", "payer_id", name="uq_provider_payer_pin"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    provider_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("providers.id"), nullable=False)
    payer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payers.id"), nullable=False)
    pin: Mapped[str] = mapped_column(String(50), nullable=False)
    group_number: Mapped[Optional[str]] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    provider: Mapped["Provider"] = relationship("Provider")
    payer: Mapped["Payer"] = relationship("Payer")
