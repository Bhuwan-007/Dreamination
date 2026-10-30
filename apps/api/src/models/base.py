"""
Base declarative class and common model utilities.
"""

from datetime import UTC, datetime

import sqlalchemy as sa
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utc_now() -> datetime:
    """Returns current UTC timestamp with timezone."""
    return datetime.now(UTC)


class Base(DeclarativeBase):
    """SQLAlchemy declarative base class."""


class TimestampMixin:
    """Mixin adding created_at and updated_at columns."""
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

