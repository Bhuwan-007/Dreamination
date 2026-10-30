"""
User model representing authenticated dreamers.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, utc_now

if TYPE_CHECKING:
    from .dream import Dream
    from .entity import Entity, EntityEdge, SymbolMeaning
    from .render_job import CharacterSheet, StyleBible


def default_user_settings() -> dict[str, Any]:
    return {
        "local_only_mode": False,
        "allow_sharing": False,
        "preferred_style_preset": "nocturne_toon",
    }


class User(Base):
    """User account model."""
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(
        sa.String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    password_hash: Mapped[str] = mapped_column(
        sa.String(255),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    settings: Mapped[dict[str, Any]] = mapped_column(
        sa.JSON,
        default=default_user_settings,
        nullable=False,
    )
    style_bible_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("style_bibles.id", ondelete="SET NULL", use_alter=True, name="fk_user_style_bible"),
        nullable=True,
    )

    # Relationships
    dreams: Mapped[list[Dream]] = relationship(
        "Dream",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    entities: Mapped[list[Entity]] = relationship(
        "Entity",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    entity_edges: Mapped[list[EntityEdge]] = relationship(
        "EntityEdge",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    symbol_meanings: Mapped[list[SymbolMeaning]] = relationship(
        "SymbolMeaning",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    style_bibles: Mapped[list[StyleBible]] = relationship(
        "StyleBible",
        back_populates="user",
        foreign_keys="StyleBible.user_id",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    character_sheets: Mapped[list[CharacterSheet]] = relationship(
        "CharacterSheet",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

