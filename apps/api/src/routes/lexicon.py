"""
Lexicon endpoints for Personal Dream Graph (Phase 7, Prompt 7.2).
Exposes the user's learned Dirichlet symbol meanings distribution.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..database import get_db
from ..models.user import User
from ..stages.lexicon import lexicon_service

router = APIRouter()


@router.get("", response_model=list[dict[str, Any]])
async def get_my_lexicon(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """
    Returns the authenticated user's learned symbol lexicon with probability distributions.
    """
    return await lexicon_service.get_user_lexicon(db, current_user.id)
