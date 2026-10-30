"""
Pydantic schemas for the Extract stage (Prompt P2 / extract_v1).
Strict validation ensuring faithfulness to user notes, structured graph entities,
emotions with intensities, and dream-logic transitions.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class DreamFragment(BaseModel):
    id: str = Field(description="Fragment identifier, e.g. f1")
    text: str = Field(description="Original narrative fragment in user's phrasing")
    order_hint: int = Field(default=1, description="Chronological sequence hint")
    certainty: Literal["vivid", "vague", "uncertain"] = Field(
        default="vivid", description="Clarity of memory for this fragment"
    )


class ExtractedEntity(BaseModel):
    name: str = Field(description="Canonical entity name")
    type: Literal["person", "place", "symbol", "object", "emotion", "creature"] = Field(
        description="Graph entity category"
    )
    description_from_user: str = Field(
        description="User's original phrasing describing this entity"
    )
    matches_known: str | None = Field(
        default=None, description="Name of matched existing entity if known"
    )
    is_known_person: bool = Field(
        default=False, description="Whether entity represents a known person in waking life"
    )
    salience: float = Field(
        default=0.5, ge=0.0, le=1.0, description="Prominence in the dream narrative"
    )


class ExtractedEmotion(BaseModel):
    label: str = Field(description="Emotion name (e.g. awe, dread, quiet curiosity)")
    intensity: float = Field(
        default=0.5, ge=0.0, le=1.0, description="Intensity of the emotion"
    )
    attached_to: str | None = Field(
        default=None, description="Fragment ID to which this emotion is attached"
    )


class ExtractedTransition(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_fragment: str | None = Field(
        default="f1",
        alias="from",
        description="Source fragment ID",
    )
    to_fragment: str | None = Field(
        default="f2",
        alias="to",
        description="Target fragment ID",
    )
    type: str | None = Field(
        default="unexplained",
        description="Dream-logic transition mechanism",
    )


class ExtractionOutput(BaseModel):
    """Structured extraction outcome from raw notes and follow-up answers."""
    fragments: list[DreamFragment] = Field(default_factory=list)
    entities: list[ExtractedEntity] = Field(default_factory=list)
    emotions: list[ExtractedEmotion] = Field(default_factory=list)
    transitions: list[ExtractedTransition] = Field(default_factory=list)
    day_residue_candidates: list[str] = Field(default_factory=list)
    ending: str | None = Field(default=None, description="How the dream concluded or let go")

