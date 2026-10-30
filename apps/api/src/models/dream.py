"""
Dream and DreamVersion models.
Dream text columns are stored as encrypted byte blobs (AES-256-GCM envelope).
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, utc_now

if TYPE_CHECKING:
    from .entity import DreamEntityLink
    from .interpretation import DreamEmbedding, Interpretation
    from .render_job import RenderJob
    from .user import User


class DreamStatus(str, enum.Enum):
    CAPTURED = "captured"
    EXTRACTED = "extracted"
    RECONSTRUCTED = "reconstructed"
    INTERPRETED = "interpreted"
    APPROVED = "approved"
    RENDERING = "rendering"
    RENDERED = "rendered"
    FAILED = "failed"


class DreamVersionMode(str, enum.Enum):
    FAITHFUL = "faithful"
    AUTHORED = "authored"


class Dream(Base):
    """
    Dream entry.
    All dream text columns are application-layer encrypted (AES-256-GCM).
    """
    __tablename__ = "dreams"

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
    captured_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    # Encrypted fields (AES-256-GCM authenticated envelopes)
    raw_text_encrypted: Mapped[bytes | None] = mapped_column(
        sa.LargeBinary,
        nullable=True,
    )
    raw_audio_key: Mapped[str | None] = mapped_column(
        sa.String(255),
        nullable=True,
    )
    transcript_encrypted: Mapped[bytes | None] = mapped_column(
        sa.LargeBinary,
        nullable=True,
    )
    mood_on_waking: Mapped[str | None] = mapped_column(
        sa.String(50),
        nullable=True,
    )
    recent_life_context_encrypted: Mapped[bytes | None] = mapped_column(
        sa.LargeBinary,
        nullable=True,
    )

    # Lifecycle state
    status: Mapped[str] = mapped_column(
        sa.String(32),
        default=DreamStatus.CAPTURED.value,
        index=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="dreams")
    versions: Mapped[list[DreamVersion]] = relationship(
        "DreamVersion",
        back_populates="dream",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    interpretations: Mapped[list[Interpretation]] = relationship(
        "Interpretation",
        back_populates="dream",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    entity_links: Mapped[list[DreamEntityLink]] = relationship(
        "DreamEntityLink",
        back_populates="dream",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    render_jobs: Mapped[list[RenderJob]] = relationship(
        "RenderJob",
        back_populates="dream",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    embedding: Mapped[DreamEmbedding | None] = relationship(
        "DreamEmbedding",
        back_populates="dream",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class DreamVersion(Base):
    """
    Reconstructed story version of a dream (faithful or authored).
    """
    __tablename__ = "dream_versions"

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
    mode: Mapped[str] = mapped_column(
        sa.String(32),
        default=DreamVersionMode.FAITHFUL.value,
        nullable=False,
    )
    story_json: Mapped[dict[str, Any]] = mapped_column(
        sa.JSON,
        nullable=False,
    )
    gap_fills_json: Mapped[list[Any] | None] = mapped_column(
        sa.JSON,
        nullable=True,
    )
    is_approved: Mapped[bool] = mapped_column(
        sa.Boolean,
        default=False,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    dream: Mapped[Dream] = relationship("Dream", back_populates="versions")

