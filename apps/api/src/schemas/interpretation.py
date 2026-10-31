"""
Pydantic schemas for Phase 6: Interpretation Engine & Reflection UI (Prompt P5).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class EvidenceItem(BaseModel):
    quote_from_user: str = Field(
        description="Exact verbatim substring copied from dream notes or follow-up answers"
    )
    why_it_matters: str = Field(
        description="Explanation of why this detail might matter emotionally or psychologically"
    )


class InterpretedSymbol(BaseModel):
    name: str = Field(description="Name of the symbol or motif")
    possible_meaning: str = Field(
        description="Tentative, context-aware meaning suggested for this dream"
    )


class InterpretationThread(BaseModel):
    lens: Literal[
        "cognitive_emotional",
        "jungian",
        "day_residue",
        "relational",
        "indic_philosophical",
    ] | str = Field(
        description="Psychological lens: cognitive_emotional, jungian, day_residue, relational, indic_philosophical"
    )
    title: str = Field(description="Short, plain phrase characterizing this thread")
    reading: str = Field(
        description="2 to 4 sentences in tentative language ('might', 'one possible thread')"
    )
    evidence: list[EvidenceItem] = Field(
        default_factory=list,
        description="1 to 3 items citing verbatim quotes from the user",
    )
    waking_life_questions: list[str] = Field(
        default_factory=list,
        description="At most 2 gentle, open questions for waking reflection",
    )
    symbols: list[InterpretedSymbol] = Field(
        default_factory=list,
        description="Symbols and their suggested contextual meanings",
    )


class InterpretationOutput(BaseModel):
    threads: list[InterpretationThread] = Field(
        default_factory=list,
        description="2 or 3 possible reflection threads",
    )


class InterpretationFeedbackRequest(BaseModel):
    selected_thread_index: int | None = Field(
        default=None,
        description="Index (0-based) of the thread chosen or reflected upon",
    )
    feedback: Literal["resonates", "felt_different", "none"] = Field(
        default="none",
        description="User resonance feedback",
    )
    feedback_note: str | None = Field(
        default=None,
        description="Optional user note explaining how it felt different or what it meant to them",
    )


class InterpretationResponse(BaseModel):
    id: uuid.UUID
    dream_id: uuid.UUID
    threads: list[InterpretationThread]
    selected_thread_index: int | None = None
    feedback: str = "none"
    feedback_note: str | None = None
    created_at: datetime
