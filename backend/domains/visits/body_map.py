"""
Body map models for anatomical zone documentation.

28 clickable zones covering anterior + posterior views with bilateral support.
Each zone annotation links to ICD-10 diagnoses, CPT procedures, and medications.
"""
from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

# Canonical 28-zone taxonomy.  front/back × region × laterality.
# zone_key must be stable — it is stored in annotations.
BODY_ZONES = [
    # --- Anterior (front) ---
    {"zone_key": "head_front",       "label": "Head / Face",          "view": "front", "region": "head"},
    {"zone_key": "neck_front",       "label": "Neck (anterior)",      "view": "front", "region": "neck"},
    {"zone_key": "chest",            "label": "Chest / Thorax",       "view": "front", "region": "chest"},
    {"zone_key": "abdomen",          "label": "Abdomen",              "view": "front", "region": "abdomen"},
    {"zone_key": "pelvis",           "label": "Pelvis / Groin",       "view": "front", "region": "pelvis"},
    {"zone_key": "shoulder_right",   "label": "Right Shoulder",       "view": "front", "region": "shoulder", "laterality": "right"},
    {"zone_key": "shoulder_left",    "label": "Left Shoulder",        "view": "front", "region": "shoulder", "laterality": "left"},
    {"zone_key": "upper_arm_right",  "label": "Right Upper Arm",      "view": "front", "region": "arm",      "laterality": "right"},
    {"zone_key": "upper_arm_left",   "label": "Left Upper Arm",       "view": "front", "region": "arm",      "laterality": "left"},
    {"zone_key": "elbow_right",      "label": "Right Elbow",          "view": "front", "region": "elbow",    "laterality": "right"},
    {"zone_key": "elbow_left",       "label": "Left Elbow",           "view": "front", "region": "elbow",    "laterality": "left"},
    {"zone_key": "forearm_right",    "label": "Right Forearm / Wrist","view": "front", "region": "forearm",  "laterality": "right"},
    {"zone_key": "forearm_left",     "label": "Left Forearm / Wrist", "view": "front", "region": "forearm",  "laterality": "left"},
    {"zone_key": "hand_right",       "label": "Right Hand",           "view": "front", "region": "hand",     "laterality": "right"},
    {"zone_key": "hand_left",        "label": "Left Hand",            "view": "front", "region": "hand",     "laterality": "left"},
    {"zone_key": "thigh_right",      "label": "Right Thigh",          "view": "front", "region": "thigh",    "laterality": "right"},
    {"zone_key": "thigh_left",       "label": "Left Thigh",           "view": "front", "region": "thigh",    "laterality": "left"},
    {"zone_key": "knee_right",       "label": "Right Knee",           "view": "front", "region": "knee",     "laterality": "right"},
    {"zone_key": "knee_left",        "label": "Left Knee",            "view": "front", "region": "knee",     "laterality": "left"},
    {"zone_key": "lower_leg_right",  "label": "Right Lower Leg",      "view": "front", "region": "lower_leg","laterality": "right"},
    {"zone_key": "lower_leg_left",   "label": "Left Lower Leg",       "view": "front", "region": "lower_leg","laterality": "left"},
    {"zone_key": "foot_right",       "label": "Right Foot / Ankle",   "view": "front", "region": "foot",     "laterality": "right"},
    {"zone_key": "foot_left",        "label": "Left Foot / Ankle",    "view": "front", "region": "foot",     "laterality": "left"},
    # --- Posterior (back) ---
    {"zone_key": "head_back",        "label": "Head (posterior)",     "view": "back",  "region": "head"},
    {"zone_key": "neck_back",        "label": "Neck (posterior)",     "view": "back",  "region": "neck"},
    {"zone_key": "upper_back",       "label": "Upper Back / Thoracic","view": "back",  "region": "back"},
    {"zone_key": "lower_back",       "label": "Lower Back / Lumbar",  "view": "back",  "region": "back"},
    {"zone_key": "buttocks",         "label": "Buttocks / Sacrum",    "view": "back",  "region": "pelvis"},
]

# Annotation severity colours (maps to UI: blue / yellow / red)
ZONE_COLOR_INFO     = "blue"    # history / chronic condition
ZONE_COLOR_WARNING  = "yellow"  # sub-acute / monitoring
ZONE_COLOR_CRITICAL = "red"     # acute / primary complaint


class VisitBodyMap(Base):
    """
    One body-map document per visit.  Stores all zone annotations as JSONB
    for flexibility, with the structured annotations stored in BodyZoneAnnotation rows.
    """
    __tablename__ = "visit_body_maps"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    visit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("visits.id"), nullable=False, unique=True, index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    annotations: Mapped[List["BodyZoneAnnotation"]] = relationship(
        "BodyZoneAnnotation", back_populates="body_map", cascade="all, delete-orphan"
    )


class BodyZoneAnnotation(Base):
    """
    One annotation on a specific zone of the body map.

    color:        blue | yellow | red (info / warning / critical)
    icd_codes:    list of ICD-10-CM codes associated with this zone finding
    cpt_codes:    list of CPT codes for procedures on this zone
    medications:  list of {name, dose, route} dicts for treatments on this zone
    notes:        free-text clinical note for this zone
    modifier_hint: auto-derived laterality modifier (RT/LT/50) for claim generation
    """
    __tablename__ = "body_zone_annotations"
    __table_args__ = (UniqueConstraint("body_map_id", "zone_key", name="uq_annotation_zone"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    body_map_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("visit_body_maps.id"), nullable=False, index=True
    )
    zone_key: Mapped[str] = mapped_column(String(40), nullable=False)
    color: Mapped[str] = mapped_column(String(10), default=ZONE_COLOR_WARNING, nullable=False)
    icd_codes: Mapped[Optional[List[str]]] = mapped_column(JSONB)
    cpt_codes: Mapped[Optional[List[str]]] = mapped_column(JSONB)
    medications: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    modifier_hint: Mapped[Optional[str]] = mapped_column(String(2))

    body_map: Mapped["VisitBodyMap"] = relationship("VisitBodyMap", back_populates="annotations")
