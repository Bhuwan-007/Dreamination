"""
Interpretation, DreamEmbedding, and AuditLog models.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, utc_now

if TYPE_CHECKING:
    from .dream import Dream


class InterpretationFeedback(str, enum.Enum):
    RESONATES = "resonates"
    FELT_DIFFERENT = "felt_different"
    NONE = "none"


class Interpretation(Base):
    """
    Psychological and archetypal reflection threads generated for a dream.
    """
    __tablename__ = "interpretations"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    dream_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("dreams.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    threads_json: Mapped[list[dict[str, Any]]] = mapped_column(
        sa.JSON,
        nullable=False,
    )
    selected_thread_index: Mapped[int | None] = mapped_column(
        sa.Integer,
        nullable=True,
    )
    feedback: Mapped[str] = mapped_column(
        sa.String(32),
        default=InterpretationFeedback.NONE.value,
        nullable=False,
    )
    feedback_note: Mapped[str | None] = mapped_column(
        sa.Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    dream: Mapped[Dream] = relationship("Dream", back_populates="interpretations")


class DreamEmbedding(Base):
    """
    Vector embeddings for a dream (semantic summary embedding and emotional embedding).
    """
    __tablename__ = "dream_embeddings"

    dream_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("dreams.id", ondelete="CASCADE"),
        primary_key=True,
    )
    summary_embedding: Mapped[list[float] | None] = mapped_column(
        Vector(1536),
        nullable=True,
    )
    emotion_embedding: Mapped[list[float] | None] = mapped_column(
        Vector(1536),
        nullable=True,
    )

    dream: Mapped[Dream] = relationship("Dream", back_populates="embedding")


class AuditLog(Base):
    """
    Security and privacy audit trail.
    STRICT PRIVACY RULE: Never records dream content or text. Only action type, user, and timestamp.
    """
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    action: Mapped[str] = mapped_column(
        sa.String(100),
        nullable=False,
    )
    at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

