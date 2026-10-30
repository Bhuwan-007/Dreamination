"""
Entity repository scoped strictly to user_id.
Manages personal dream graph nodes, edges, and symbol lexicon distributions.
"""

from __future__ import annotations

import uuid
from typing import Any

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.entity import Entity, EntityEdge, EntityType, SymbolMeaning
from .base import BaseScopedRepository, RecordNotFoundError, ScopedAccessError


class EntityRepository(BaseScopedRepository[Entity]):
    """Scoped repository for entities, graph edges, and symbol meanings."""

    model = Entity

    async def create_entity(
        self,
        canonical_name: str,
        type: str,
        aliases: list[str] | None = None,
        description: str | None = None,
        embedding: list[float] | None = None,
        first_seen_dream_id: uuid.UUID | None = None,
    ) -> Entity:
        """Creates an entity strictly owned by self.user_id."""
        entity = Entity(
            user_id=self.user_id,
            canonical_name=canonical_name.strip(),
            type=type,
            aliases=aliases or [],
            description=description,
            embedding=embedding,
            first_seen_dream_id=first_seen_dream_id,
        )
        self.db.add(entity)
        await self.db.flush()
        return entity

    async def get_by_name(self, canonical_name: str) -> Entity | None:
        """Finds an entity by its canonical name (case-insensitive) owned by self.user_id."""
        stmt = sa.select(Entity).where(
            Entity.user_id == self.user_id,
            sa.func.lower(Entity.canonical_name) == canonical_name.strip().lower(),
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_or_create(self, canonical_name: str, type: str) -> tuple[Entity, bool]:
        """Gets existing entity or creates a new one scoped to user_id."""
        existing = await self.get_by_name(canonical_name)
        if existing:
            return existing, False
        new_entity = await self.create_entity(canonical_name=canonical_name, type=type)
        return new_entity, True

    async def create_edge(
        self,
        source_entity_id: uuid.UUID,
        target_entity_id: uuid.UUID,
        relation_type: str,
        weight: float = 1.0,
        evidence_dream_ids: list[str] | None = None,
    ) -> EntityEdge:
        """
        Creates a directed graph edge.
        Enforces that BOTH source and target entities belong to self.user_id.
        """
        source = await self.get_by_id(source_entity_id)
        target = await self.get_by_id(target_entity_id)
        if source is None or target is None:
            raise ScopedAccessError("Both source and target entities must belong to the current user.")

        edge = EntityEdge(
            user_id=self.user_id,
            source_entity_id=source.id,
            target_entity_id=target.id,
            relation_type=relation_type,
            weight=weight,
            evidence_dream_ids=evidence_dream_ids or [],
        )
        self.db.add(edge)
        await self.db.flush()
        return edge

    async def list_edges(self) -> list[EntityEdge]:
        """Lists all graph edges for self.user_id."""
        stmt = sa.select(EntityEdge).where(EntityEdge.user_id == self.user_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_symbol_meaning(
        self,
        entity_id: uuid.UUID,
        meaning_label: str,
        probability: float,
        evidence_count: int = 1,
    ) -> SymbolMeaning:
        """
        Updates or creates a Dirichlet symbol meaning label for an entity owned by self.user_id.
        """
        entity = await self.get_by_id(entity_id)
        if entity is None:
            raise ScopedAccessError("Entity does not exist or belongs to another user.")

        stmt = sa.select(SymbolMeaning).where(
            SymbolMeaning.user_id == self.user_id,
            SymbolMeaning.entity_id == entity.id,
            SymbolMeaning.meaning_label == meaning_label,
        )
        result = await self.db.execute(stmt)
        meaning = result.scalars().first()

        if meaning is None:
            meaning = SymbolMeaning(
                user_id=self.user_id,
                entity_id=entity.id,
                meaning_label=meaning_label,
                probability=probability,
                evidence_count=evidence_count,
            )
            self.db.add(meaning)
        else:
            meaning.probability = probability
            meaning.evidence_count = evidence_count

        await self.db.flush()
        return meaning

    async def list_symbol_meanings(self, entity_id: uuid.UUID | None = None) -> list[SymbolMeaning]:
        """Lists symbol meanings scoped to self.user_id."""
        stmt = sa.select(SymbolMeaning).where(SymbolMeaning.user_id == self.user_id)
        if entity_id is not None:
            stmt = stmt.where(SymbolMeaning.entity_id == entity_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

