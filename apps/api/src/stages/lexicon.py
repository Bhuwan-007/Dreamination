"""
Personal Symbol Lexicon Service (Phase 7, Prompt 7.2).
Maintains per-user learned Dirichlet probability distributions over symbol meanings,
driven by user resonance feedback ('resonates' / 'felt_different' + personal notes).
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.entity import Entity, EntityType, SymbolMeaning
from ..models.interpretation import Interpretation, InterpretationFeedback
from ..repositories.entity import EntityRepository

logger = logging.getLogger("dream_machine")

DELTA_RESONATES = 2.0
DELTA_PENALTY = 1.0
DELTA_NEW_USER_LABEL = 2.5
MIN_ALPHA = 0.2


def clean_meaning_label(text: str) -> str:
    """Extracts and normalizes a clean meaning label from text or user notes."""
    cleaned = text.strip()
    prefixes = [
        "in this dream,",
        "it felt like",
        "to me it felt like",
        "it felt",
        "i felt",
        "for me it was",
        "it was",
        "rather than",
    ]
    lower = cleaned.lower()
    for prefix in prefixes:
        if lower.startswith(prefix):
            cleaned = cleaned[len(prefix):].strip()
            lower = cleaned.lower()

    if len(cleaned) > 80:
        cleaned = cleaned[:77] + "..."
    return cleaned.strip().capitalize() if cleaned else "Unspecified"


class LexiconService:
    """Coordinates Bayesian Dirichlet updates for user symbol meanings."""

    async def update_from_feedback(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        dream_id: uuid.UUID,
        selected_thread_index: int | None,
        feedback: str,
        feedback_note: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Updates symbol meaning distributions based on user feedback.
        """
        if feedback not in (InterpretationFeedback.RESONATES.value, InterpretationFeedback.FELT_DIFFERENT.value):
            return []

        # 1. Fetch latest interpretation for this dream
        stmt = (
            select(Interpretation)
            .where(Interpretation.dream_id == dream_id)
            .order_by(Interpretation.created_at.desc())
        )
        res = await db.execute(stmt)
        interp = res.scalars().first()
        if not interp or not interp.threads_json:
            return []

        idx = selected_thread_index if selected_thread_index is not None else 0
        if idx < 0 or idx >= len(interp.threads_json):
            idx = 0

        thread = interp.threads_json[idx]
        symbols_in_thread = thread.get("symbols", [])
        if not symbols_in_thread:
            return []

        entity_repo = EntityRepository(db, user_id)
        updated_records: list[dict[str, Any]] = []

        for sym_data in symbols_in_thread:
            sym_name = sym_data.get("name", "").strip()
            sym_meaning_text = sym_data.get("possible_meaning", "").strip()
            if not sym_name:
                continue

            # Ensure symbol entity exists in personal dream graph
            entity, _ = await entity_repo.get_or_create(
                canonical_name=sym_name,
                type=EntityType.SYMBOL.value,
            )

            # Retrieve existing meaning rows for this entity
            stmt_meanings = select(SymbolMeaning).where(
                SymbolMeaning.user_id == user_id,
                SymbolMeaning.entity_id == entity.id,
            )
            existing_meanings = (await db.execute(stmt_meanings)).scalars().all()

            # Map existing labels to meaning objects
            meaning_map = {m.meaning_label.lower(): m for m in existing_meanings}
            norm_meaning_label = clean_meaning_label(sym_meaning_text)

            # Apply Bayesian update
            if feedback == InterpretationFeedback.RESONATES.value:
                # Reinforce current thread's meaning label
                target = meaning_map.get(norm_meaning_label.lower())
                if target:
                    target.evidence_count += 1
                    current_alpha = target.probability * max(1, len(existing_meanings))
                    target.probability = current_alpha + DELTA_RESONATES
                else:
                    target = SymbolMeaning(
                        user_id=user_id,
                        entity_id=entity.id,
                        meaning_label=norm_meaning_label,
                        evidence_count=2,
                        probability=1.0 + DELTA_RESONATES,
                    )
                    db.add(target)
                    existing_meanings.append(target)
                    meaning_map[norm_meaning_label.lower()] = target

            elif feedback == InterpretationFeedback.FELT_DIFFERENT.value:
                # Penalize current thread's suggested meaning
                target = meaning_map.get(norm_meaning_label.lower())
                if target:
                    current_alpha = target.probability * max(1, len(existing_meanings))
                    target.probability = max(MIN_ALPHA, current_alpha - DELTA_PENALTY)
                    target.evidence_count += 1
                else:
                    target = SymbolMeaning(
                        user_id=user_id,
                        entity_id=entity.id,
                        meaning_label=norm_meaning_label,
                        evidence_count=1,
                        probability=MIN_ALPHA,
                    )
                    db.add(target)
                    existing_meanings.append(target)
                    meaning_map[norm_meaning_label.lower()] = target

                # If user provided custom note, extract and add new personal meaning
                if feedback_note and feedback_note.strip():
                    custom_label = clean_meaning_label(feedback_note)
                    custom_target = meaning_map.get(custom_label.lower())
                    if custom_target:
                        custom_target.evidence_count += 2
                    else:
                        custom_target = SymbolMeaning(
                            user_id=user_id,
                            entity_id=entity.id,
                            meaning_label=custom_label,
                            evidence_count=2,
                            probability=DELTA_NEW_USER_LABEL,
                        )
                        db.add(custom_target)
                        existing_meanings.append(custom_target)

            # Re-normalize Dirichlet probabilities across all meaning labels for this entity
            total_weight = 0.0
            weights: list[float] = []
            for m in existing_meanings:
                w = max(MIN_ALPHA, m.probability if m.probability > 0 else 1.0)
                weights.append(w)
                total_weight += w

            if total_weight > 0:
                for m, w in zip(existing_meanings, weights, strict=False):
                    m.probability = round(w / total_weight, 4)

            updated_records.append({
                "entity_name": entity.canonical_name,
                "meanings": [
                    {
                        "label": m.meaning_label,
                        "probability": m.probability,
                        "evidence_count": m.evidence_count,
                    }
                    for m in existing_meanings
                ],
            })

        await db.flush()
        return updated_records

    async def get_user_lexicon(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[dict[str, Any]]:
        """
        Retrieves the complete learned symbol lexicon for a user.
        """
        stmt = (
            select(Entity)
            .where(
                Entity.user_id == user_id,
                Entity.type == EntityType.SYMBOL.value,
            )
            .order_by(Entity.canonical_name.asc())
        )
        entities = (await db.execute(stmt)).scalars().all()

        lexicon: list[dict[str, Any]] = []
        for ent in entities:
            stmt_meanings = (
                select(SymbolMeaning)
                .where(
                    SymbolMeaning.user_id == user_id,
                    SymbolMeaning.entity_id == ent.id,
                )
                .order_by(SymbolMeaning.probability.desc())
            )
            meanings = (await db.execute(stmt_meanings)).scalars().all()
            if meanings:
                lexicon.append({
                    "entity_id": ent.id,
                    "canonical_name": ent.canonical_name,
                    "first_seen_dream_id": ent.first_seen_dream_id,
                    "meanings": [
                        {
                            "label": m.meaning_label,
                            "probability": m.probability,
                            "evidence_count": m.evidence_count,
                            "updated_at": m.updated_at,
                        }
                        for m in meanings
                    ],
                })

        return lexicon


lexicon_service = LexiconService()
