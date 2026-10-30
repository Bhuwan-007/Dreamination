"""
Entity, DreamEntityLink, EntityEdge, and SymbolMeaning models.
Represents the user's personal dream graph, recurring cast, and Dirichlet symbol lexicon.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, utc_now

if TYPE_CHECKING:
    from .dream import Dream
    from .render_job import CharacterSheet
    from .user import User


class EntityType(str, enum.Enum):
    PERSON = "person"
    PLACE = "place"
    SYMBOL = "symbol"
    OBJECT = "object"
    EMOTION = "emotion"
    CREATURE = "creature"


class Entity(Base):
    """
    Graph node representing a person, place, symbol, or object recurring across dreams.
    """
    __tablename__ = "entities"

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
    type: Mapped[str] = mapped_column(
        sa.String(32),
        index=True,
        nullable=False,
    )
    canonical_name: Mapped[str] = mapped_column(
        sa.String(255),
        index=True,
        nullable=False,
    )
    aliases: Mapped[list[str]] = mapped_column(
        sa.JSON,
        default=list,
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        sa.Text,
        nullable=True,
    )
    first_seen_dream_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("dreams.id", ondelete="SET NULL", name="fk_entity_first_seen_dream"),
        nullable=True,
    )
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(1536),
        nullable=True,
    )
    character_sheet_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("character_sheets.id", ondelete="SET NULL", use_alter=True, name="fk_entity_character_sheet"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="entities")
    dream_links: Mapped[list[DreamEntityLink]] = relationship(
        "DreamEntityLink",
        back_populates="entity",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    meanings: Mapped[list[SymbolMeaning]] = relationship(
        "SymbolMeaning",
        back_populates="entity",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    character_sheet: Mapped[CharacterSheet | None] = relationship(
        "CharacterSheet",
        foreign_keys=[character_sheet_id],
        post_update=True,
    )


class DreamEntityLink(Base):
    """
    Junction table linking a dream to the entities that appeared within it.
    """
    __tablename__ = "dream_entity_links"

    dream_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("dreams.id", ondelete="CASCADE"),
        primary_key=True,
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("entities.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role: Mapped[str | None] = mapped_column(
        sa.String(100),
        nullable=True,
    )
    salience: Mapped[float] = mapped_column(
        sa.Float,
        default=1.0,
        nullable=False,
    )
    emotion_valence: Mapped[float] = mapped_column(
        sa.Float,
        default=0.0,
        nullable=False,
    )

    # Relationships
    dream: Mapped[Dream] = relationship("Dream", back_populates="entity_links")
    entity: Mapped[Entity] = relationship("Entity", back_populates="dream_links")


class EntityEdge(Base):
    """
    Graph edge connecting co-occurring or related entities in a user's dream universe.
    """
    __tablename__ = "entity_edges"

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
    source_entity_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("entities.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    target_entity_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("entities.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    relation_type: Mapped[str] = mapped_column(
        sa.String(100),
        nullable=False,
    )
    weight: Mapped[float] = mapped_column(
        sa.Float,
        default=1.0,
        nullable=False,
    )
    evidence_dream_ids: Mapped[list[str]] = mapped_column(
        sa.JSON,
        default=list,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    user: Mapped[User] = relationship("User", back_populates="entity_edges")


class SymbolMeaning(Base):
    """
    Per-user learned Dirichlet probability distribution over meanings for a symbol.
    """
    __tablename__ = "symbol_meanings"

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
    meaning_label: Mapped[str] = mapped_column(
        sa.String(255),
        nullable=False,
    )
    probability: Mapped[float] = mapped_column(
        sa.Float,
        default=0.0,
        nullable=False,
    )
    evidence_count: Mapped[int] = mapped_column(
        sa.Integer,
        default=1,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    user: Mapped[User] = relationship("User", back_populates="symbol_meanings")
    entity: Mapped[Entity] = relationship("Entity", back_populates="meanings")

