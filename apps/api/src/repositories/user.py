"""
User repository for authentication, settings management, and full hard-delete cascades.
"""

from __future__ import annotations

import uuid
from typing import Any

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.dream import Dream
from ..models.entity import Entity, EntityEdge, SymbolMeaning
from ..models.interpretation import AuditLog
from ..models.render_job import CharacterSheet, StyleBible
from ..models.user import User


class UserRepository:
    """Repository for user accounts and identity operations."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        """Fetch user by primary key."""
        stmt = sa.select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_email(self, email: str) -> User | None:
        """Fetch user by email (case-insensitive)."""
        stmt = sa.select(User).where(sa.func.lower(User.email) == email.strip().lower())
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def create_user(
        self,
        email: str,
        password_hash: str,
        settings: dict[str, Any] | None = None,
    ) -> User:
        """Creates a new user record."""
        user = User(
            email=email.strip().lower(),
            password_hash=password_hash,
            settings=settings if settings is not None else {
                "local_only_mode": False,
                "allow_sharing": False,
                "preferred_style_preset": "nocturne_toon",
            },
        )
        self.db.add(user)
        await self.db.flush()
        return user

    async def update_settings(self, user_id: uuid.UUID, new_settings: dict[str, Any]) -> User | None:
        """Updates user privacy and profile settings."""
        user = await self.get_by_id(user_id)
        if user is None:
            return None

        # Merge new settings with existing settings
        merged = dict(user.settings)
        merged.update(new_settings)
        user.settings = merged
        await self.db.flush()
        return user

    async def hard_delete_user_and_all_data(self, user_id: uuid.UUID) -> bool:
        """
        Hard-deletes the user and ALL associated dreams, entities, versions,
        render jobs, symbol meanings, style bibles, character sheets, and audit logs.
        Guarantees complete irreversible erasure under privacy regulations.
        """
        user = await self.get_by_id(user_id)
        if user is None:
            return False

        # Explicitly delete all child records across all dependent tables to guarantee
        # complete irreversible erasure across both PostgreSQL and SQLite
        await self.db.execute(sa.delete(AuditLog).where(AuditLog.user_id == user_id))
        await self.db.execute(sa.delete(SymbolMeaning).where(SymbolMeaning.user_id == user_id))
        await self.db.execute(sa.delete(EntityEdge).where(EntityEdge.user_id == user_id))
        await self.db.execute(sa.delete(CharacterSheet).where(CharacterSheet.user_id == user_id))
        await self.db.execute(sa.delete(StyleBible).where(StyleBible.user_id == user_id))
        await self.db.execute(sa.delete(Entity).where(Entity.user_id == user_id))
        await self.db.execute(sa.delete(Dream).where(Dream.user_id == user_id))

        # Delete the user record
        await self.db.delete(user)
        await self.db.flush()
        return True
