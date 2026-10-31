"""
Insights and Dream Weather endpoints (Phase 7, Prompt 7.3).
Exposes longitudinal pattern synthesis, dominant emotions, and recurring motifs.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..database import get_db
from ..models.user import User
from ..stages.insights import insights_service

router = APIRouter()


@router.get("/weather", response_model=dict[str, Any])
async def get_my_dream_weather(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Returns weekly/monthly Dream Weather synthesis with dominant emotions and recurring motifs.
    """
    return await insights_service.get_dream_weather(db, current_user.id)
