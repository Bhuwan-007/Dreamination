"""
Longitudinal Insights & Dream Weather Service (Phase 7, Prompt 7.3).
Aggregates emotional patterns, recurring symbols, and life context correlations
into a gentle, tentative 'Dream Weather' reflection.
"""

from __future__ import annotations

import logging
import uuid
from collections import Counter
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.entity import DreamEntityLink, Entity
from ..repositories.dream import DreamRepository

logger = logging.getLogger("dream_machine")


class InsightsService:
    """Computes longitudinal pattern insights and periodic Dream Weather."""

    async def get_dream_weather(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> dict[str, Any]:
        """
        Computes weekly/monthly summary with dominant emotions, top recurring symbols,
        and a sentence of tentative reflection.
        """
        dream_repo = DreamRepository(db, user_id)
        dreams = await dream_repo.list(limit=50)

        if not dreams:
            return {
                "dream_count": 0,
                "dominant_emotions": [],
                "recurring_motifs": [],
                "weather_summary": "Your dream journal is just beginning. As you record more nights, gentle patterns will emerge here.",
            }

        # 1. Tally moods
        moods = [d.mood_on_waking.lower() for d in dreams if d.mood_on_waking]
        mood_counts = Counter(moods).most_common(3)
        dominant_emotions = [{"emotion": m, "count": c} for m, c in mood_counts]

        # 2. Tally recurring entities across dreams
        stmt_links = (
            select(Entity.canonical_name, Entity.type)
            .join(DreamEntityLink, Entity.id == DreamEntityLink.entity_id)
            .where(Entity.user_id == user_id)
        )
        entity_rows = (await db.execute(stmt_links)).all()
        entity_counter = Counter(name for name, _ in entity_rows).most_common(5)
        recurring_motifs = [
            {"name": name, "appearances": count}
            for name, count in entity_counter
            if count >= 1
        ]

        # 3. Synthesize tentative gentle reflection sentence
        top_mood = mood_counts[0][0] if mood_counts else "reflective"
        top_motif = recurring_motifs[0]["name"] if recurring_motifs else "shifting thresholds"

        weather_summary = (
            f"Recent nights carry a prevailing sense of {top_mood}, with '{top_motif}' "
            "recurring as an orienting motif. The landscape appears to be processing adaptations "
            "and subtle thresholds quietly in the background."
        )

        return {
            "dream_count": len(dreams),
            "dominant_emotions": dominant_emotions,
            "recurring_motifs": recurring_motifs,
            "weather_summary": weather_summary,
        }


insights_service = InsightsService()
