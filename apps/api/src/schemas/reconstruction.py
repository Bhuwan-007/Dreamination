"""
Pydantic schemas for Reconstruction & Review stage (Prompt P3 & P4).
Validates faithful and authored reconstructed stories, scene beats with inference tags,
dialogue items, and single-scene repair requests.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class BeatItem(BaseModel):
    """A single sentence or narrative beat tagged with provenance."""
    text: str = Field(description="Sentence describing this beat of the dream")
    source: Literal["user", "inferred"] = Field(
        default="user", description="Whether beat came directly from user or was inferred"
    )
    inference_reason: str | None = Field(
        default=None,
        description="One-line explanation bridging the gap when source is inferred",
    )
    confidence: float = Field(
        default=1.0, ge=0.0, le=1.0, description="Confidence in this beat (0.0 to 1.0)"
    )

    @model_validator(mode="after")
    def validate_inferred_reason(self) -> BeatItem:
        if self.source == "inferred" and not self.inference_reason:
            # Provide a fallback default reason if omitted by LLM
            self.inference_reason = "Bridges narrative continuity between remembered fragments."
        return self


class DialogueItem(BaseModel):
    """A spoken dialogue line inside a dream scene."""
    speaker: str = Field(description="Name of speaking entity")
    line: str = Field(description="Spoken dialogue line")
    emotion: str = Field(default="neutral", description="Emotion or delivery nuance")
    source: Literal["user", "inferred"] = Field(
        default="user", description="Whether dialogue was spoken in original notes or inferred"
    )


class ReconstructedScene(BaseModel):
    """A discrete scene within the reconstructed dream."""
    scene_id: int = Field(description="Sequential index of the scene (1 to 8)")
    heading: str = Field(description="Short place or mood label, e.g. 'The Lavender Coast'")
    beats: list[BeatItem] = Field(default_factory=list, description="Narrative beats")
    dialogue: list[DialogueItem] = Field(default_factory=list, description="Dialogue lines")


class ReconstructionOutput(BaseModel):
    """Complete reconstructed dream story."""
    title: str = Field(description="Evocative poetic title")
    mode: Literal["faithful", "authored"] = Field(
        default="faithful", description="Reconstruction mode"
    )
    scenes: list[ReconstructedScene] = Field(
        default_factory=list,
        description="List of 5 to 8 reconstructed scenes",
    )


class ReconstructDreamRequest(BaseModel):
    mode: Literal["faithful", "authored"] = Field(
        default="faithful", description="Desired reconstruction mode"
    )
    history_snippets: list[str] | None = Field(
        default=None, description="Optional retrieved recurring entity history snippets"
    )
    force_rebuild: bool = Field(
        default=False, description="Whether to bypass existing cached version"
    )


class SceneRepairRequest(BaseModel):
    """User correction to regenerate only a single scene."""
    correction: str = Field(
        min_length=3,
        description="User correction explaining what actually happened in this scene",
    )


class SceneUpdateRequest(BaseModel):
    """Direct manual edit of scene contents."""
    heading: str | None = None
    beats: list[BeatItem] | None = None
    dialogue: list[DialogueItem] | None = None


class ApproveDreamRequest(BaseModel):
    version_id: uuid.UUID | None = Field(
        default=None,
        description="ID of the version to approve (defaults to latest active)",
    )


class DreamVersionResponse(BaseModel):
    id: uuid.UUID
    dream_id: uuid.UUID
    mode: str
    story: ReconstructionOutput
    is_approved: bool
    created_at: datetime


class ApproveDreamResponse(BaseModel):
    status: str
    dream_id: uuid.UUID
    version_id: uuid.UUID
    message: str = "Dream approved and ready for 3D world composition."

