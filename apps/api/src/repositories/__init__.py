"""
Repository layer providing row-level tenant scoping and field-level encryption.
"""

from .base import BaseScopedRepository, RecordNotFoundError, ScopedAccessError
from .dream import DecryptedDream, DreamRepository
from .entity import EntityRepository
from .user import UserRepository

__all__ = [
    "BaseScopedRepository",
    "RecordNotFoundError",
    "ScopedAccessError",
    "DreamRepository",
    "DecryptedDream",
    "EntityRepository",
    "UserRepository",
]

