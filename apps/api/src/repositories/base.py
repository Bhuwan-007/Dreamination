"""
Base scoped repository enforcing tenant isolation (user_id filtering).
Rule: Every database query on user-owned tables MUST be filtered by user_id.
"""

from __future__ import annotations

import uuid
from typing import Any, Generic, TypeVar

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class ScopedAccessError(Exception):
    """Raised when an operation violates tenant boundary isolation."""


class RecordNotFoundError(Exception):
    """Raised when a requested record does not exist within the tenant boundary."""


class BaseScopedRepository(Generic[ModelT]):
    """
    Abstract base repository automatically constraining all operations
    to the authenticated user's tenant (user_id).
    """

    model: type[ModelT]

    def __init__(self, db: AsyncSession, user_id: uuid.UUID | str) -> None:
        self.db = db
        self.user_id = uuid.UUID(str(user_id)) if not isinstance(user_id, uuid.UUID) else user_id

    def _scope_query(self, query: sa.Select) -> sa.Select:
        """Appends user_id filter to a select statement."""
        if hasattr(self.model, "user_id"):
            return query.where(self.model.user_id == self.user_id)
        return query

    async def get_by_id(self, record_id: uuid.UUID) -> ModelT | None:
        """Fetch record by ID strictly scoped to user_id."""
        stmt = sa.select(self.model).where(
            self.model.id == record_id,  # type: ignore[attr-defined]
            self.model.user_id == self.user_id,  # type: ignore[attr-defined]
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_or_raise(self, record_id: uuid.UUID) -> ModelT:
        """Fetch record by ID or raise RecordNotFoundError (never reveals existence to other tenants)."""
        record = await self.get_by_id(record_id)
        if record is None:
            raise RecordNotFoundError(f"{self.model.__name__} not found")
        return record

    async def list(self, offset: int = 0, limit: int = 50) -> list[ModelT]:
        """List records scoped strictly to current user_id."""
        stmt = (
            sa.select(self.model)
            .where(self.model.user_id == self.user_id)  # type: ignore[attr-defined]
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def count(self) -> int:
        """Count records owned strictly by current user_id."""
        stmt = (
            sa.select(sa.func.count())
            .select_from(self.model)
            .where(self.model.user_id == self.user_id)  # type: ignore[attr-defined]
        )
        result = await self.db.execute(stmt)
        return result.scalar_one()

    async def delete(self, record_id: uuid.UUID) -> bool:
        """Delete a record only if owned by current user_id."""
        stmt = (
            sa.delete(self.model)
            .where(
                self.model.id == record_id,  # type: ignore[attr-defined]
                self.model.user_id == self.user_id,  # type: ignore[attr-defined]
            )
            .returning(self.model.id)  # type: ignore[attr-defined]
        )
        result = await self.db.execute(stmt)
        deleted_id = result.scalar_one_or_none()
        return deleted_id is not None

