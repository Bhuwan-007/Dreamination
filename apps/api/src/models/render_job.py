"""
RenderJob, StyleBible, and CharacterSheet models.
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
    from .dream import Dream
    from .entity import Entity
    from .user import User


class RenderJobStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class RenderJob(Base):
    """
    3D animation composition and rendering job state.
    """
    __tablename__ = "render_jobs"

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
    status: Mapped[str] = mapped_column(
        sa.String(32),
        default=RenderJobStatus.PENDING.value,
        index=True,
        nullable=False,
    )
    progress: Mapped[float] = mapped_column(
        sa.Float,
        default=0.0,
        nullable=False,
    )
    stage: Mapped[str | None] = mapped_column(
        sa.String(100),
        nullable=True,
    )
    error: Mapped[str | None] = mapped_column(
        sa.Text,
        nullable=True,
    )
    output_video_key: Mapped[str | None] = mapped_column(
        sa.String(255),
        nullable=True,
    )
    screenplay_json: Mapped[dict[str, Any] | None] = mapped_column(
        sa.JSON,
        nullable=True,
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

    dream: Mapped[Dream] = relationship("Dream", back_populates="render_jobs")


class StyleBible(Base):
    """
    User-specific or system style preset (toon palette, lighting, shader tuning).
    """
    __tablename__ = "style_bibles"

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
    style_name: Mapped[str] = mapped_column(
        sa.String(100),
        default="nocturne_toon",
        nullable=False,
    )
    style_prompt: Mapped[str] = mapped_column(
        sa.Text,
        nullable=False,
    )
    negative_prompt: Mapped[str | None] = mapped_column(
        sa.Text,
        nullable=True,
    )
    reference_image_keys: Mapped[list[str]] = mapped_column(
        sa.JSON,
        default=list,
        nullable=False,
    )
    palette: Mapped[dict[str, Any]] = mapped_column(
        sa.JSON,
        default=dict,
        nullable=False,
    )
    locked: Mapped[bool] = mapped_column(
        sa.Boolean,
        default=False,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    user: Mapped[User] = relationship(
        "User",
        back_populates="style_bibles",
        foreign_keys=[user_id],
    )


class CharacterSheet(Base):
    """
    Persistent visual sheet and avatar mapping for recurring dream entities.
    """
    __tablename__ = "character_sheets"

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
    entity_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("entities.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    image_keys: Mapped[list[str] | None] = mapped_column(
        sa.JSON,
        nullable=True,
    )
    visual_description: Mapped[str | None] = mapped_column(
        sa.Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    user: Mapped[User] = relationship("User", back_populates="character_sheets")
    entity: Mapped[Entity] = relationship("Entity", foreign_keys=[entity_id])
