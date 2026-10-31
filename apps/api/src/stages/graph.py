"""
Personal Dream Graph & Relevant History Service (Phase 7, Prompt 7.1).
Maintains vector embeddings for dreams and entities, co-occurrence edges,
and provides semantic graph retrieval (get_relevant_history) to ground Reconstruct & Interpret prompts.
"""

from __future__ import annotations

import logging
import math
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.dream import Dream
from ..models.entity import DreamEntityLink, EntityEdge
from ..models.interpretation import DreamEmbedding
from ..providers.embeddings import get_embedding_provider
from ..repositories.dream import DreamRepository
from ..repositories.entity import EntityRepository
from .lexicon import lexicon_service

logger = logging.getLogger("dream_machine")


def _cosine_similarity(v1: list[float], v2: list[float]) -> float:
    """Computes cosine similarity between two unit-normalized vectors."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2, strict=False))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 < 1e-12 or norm2 < 1e-12:
        return 0.0
    return dot / (norm1 * norm2)


class DreamGraphService:
    """Coordinates embedding generation, graph edge maintenance, and relevant history retrieval."""

    async def sync_dream_to_graph(
        self,
        db: AsyncSession,
        dream_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        """
        Embeds an approved dream and updates personal graph nodes and edges:
        1. Embeds dream summary and emotion profile -> dream_embeddings.
        2. Embeds entities if missing -> entities.embedding.
        3. Creates co-occurrence edges between all entities in this dream.
        4. Creates temporal 'preceded_by' edge from immediate previous dream.
        """
        embedder = get_embedding_provider()
        dream_repo = DreamRepository(db, user_id)
        entity_repo = EntityRepository(db, user_id)

        dream = await dream_repo.get_by_id(dream_id)
        if not dream:
            return

        decrypted = await dream_repo.get_decrypted(dream_id)
        notes = (decrypted.raw_text or decrypted.transcript or "") if decrypted else ""
        mood = dream.mood_on_waking or "neutral"

        # 1. Retrieve latest approved story text
        latest_version = await dream_repo.get_latest_version(dream_id)
        story_text = ""
        if latest_version and latest_version.story_json:
            scenes = latest_version.story_json.get("scenes", [])
            story_text = " ".join(
                b.get("text", "")
                for s in scenes
                for b in s.get("beats", [])
                if isinstance(b, dict) and b.get("text")
            )

        summary_text = story_text or notes
        emotion_profile_text = f"Waking mood: {mood}. Emotional tone: {notes[:200]}"

        summary_vec = await embedder.embed_text(summary_text)
        emotion_vec = await embedder.embed_text(emotion_profile_text)

        # Upsert into dream_embeddings
        stmt_emb = select(DreamEmbedding).where(DreamEmbedding.dream_id == dream_id)
        existing_emb = (await db.execute(stmt_emb)).scalars().first()
        if existing_emb:
            existing_emb.summary_embedding = summary_vec
            existing_emb.emotion_embedding = emotion_vec
        else:
            db.add(
                DreamEmbedding(
                    dream_id=dream_id,
                    summary_embedding=summary_vec,
                    emotion_embedding=emotion_vec,
                )
            )

        # 2. Find entities linked to this dream
        stmt_links = select(DreamEntityLink).where(DreamEntityLink.dream_id == dream_id)
        links = (await db.execute(stmt_links)).scalars().all()
        entity_ids = [link.entity_id for link in links]

        # Embed entities if not embedded
        for eid in entity_ids:
            ent = await entity_repo.get_by_id(eid)
            if ent and ent.embedding is None:
                desc = ent.description or f"{ent.type}: {ent.canonical_name}"
                ent.embedding = await embedder.embed_text(desc)

        # 3. Create or update pairwise co-occurrence edges
        for i in range(len(entity_ids)):
            for j in range(i + 1, len(entity_ids)):
                e1, e2 = entity_ids[i], entity_ids[j]
                # Check existing edge
                stmt_edge = select(EntityEdge).where(
                    EntityEdge.user_id == user_id,
                    EntityEdge.source_entity_id == e1,
                    EntityEdge.target_entity_id == e2,
                    EntityEdge.relation_type == "co_occurs_with",
                )
                edge = (await db.execute(stmt_edge)).scalars().first()
                str_dream_id = str(dream_id)
                if edge:
                    edge.weight += 1.0
                    if str_dream_id not in edge.evidence_dream_ids:
                        edge.evidence_dream_ids = edge.evidence_dream_ids + [str_dream_id]
                else:
                    await entity_repo.create_edge(
                        source_entity_id=e1,
                        target_entity_id=e2,
                        relation_type="co_occurs_with",
                        weight=1.0,
                        evidence_dream_ids=[str_dream_id],
                    )

        # 4. Temporal predecessor edge: find previous approved dream for user
        stmt_prev = (
            select(Dream)
            .where(
                Dream.user_id == user_id,
                Dream.id != dream_id,
                Dream.created_at < dream.created_at,
            )
            .order_by(Dream.created_at.desc())
        )
        prev_dream = (await db.execute(stmt_prev)).scalars().first()
        if prev_dream:
            logger.info(f"Dream {dream_id} chronologically preceded by {prev_dream.id}")

        await db.flush()

    async def get_relevant_history(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        current_dream_id: uuid.UUID | None = None,
        query_text: str | None = None,
        limit: int = 3,
    ) -> dict[str, Any]:
        """
        Retrieves relevant history for grounding Reconstruct and Interpret prompts:
        (a) Similar past dreams by vector similarity.
        (b) Prior appearances of matched entities with emotional context.
        (c) Learned symbol meanings from the personal lexicon.
        """
        embedder = get_embedding_provider()
        dream_repo = DreamRepository(db, user_id)
        entity_repo = EntityRepository(db, user_id)

        # 1. Determine query vector
        query_vec: list[float] | None = None
        if query_text:
            query_vec = await embedder.embed_text(query_text)
        elif current_dream_id:
            stmt_emb = select(DreamEmbedding).where(DreamEmbedding.dream_id == current_dream_id)
            curr_emb = (await db.execute(stmt_emb)).scalars().first()
            if curr_emb:
                query_vec = curr_emb.summary_embedding
            else:
                decrypted = await dream_repo.get_decrypted(current_dream_id)
                if decrypted and (decrypted.raw_text or decrypted.transcript):
                    query_vec = await embedder.embed_text(decrypted.raw_text or decrypted.transcript or "")

        # 2. Search similar past dreams
        similar_dreams: list[dict[str, Any]] = []
        if query_vec:
            stmt_all = (
                select(Dream, DreamEmbedding)
                .join(DreamEmbedding, Dream.id == DreamEmbedding.dream_id)
                .where(Dream.user_id == user_id)
            )
            if current_dream_id:
                stmt_all = stmt_all.where(Dream.id != current_dream_id)

            rows = (await db.execute(stmt_all)).all()
            scored: list[tuple[float, Dream]] = []
            for d, emb in rows:
                score = _cosine_similarity(query_vec, emb.summary_embedding)
                scored.append((score, d))

            scored.sort(key=lambda x: x[0], reverse=True)
            for score, d in scored[:limit]:
                dec = await dream_repo.get_decrypted(d.id)
                text = (dec.raw_text or dec.transcript or "")[:200] if dec else ""
                similar_dreams.append({
                    "dream_id": str(d.id),
                    "captured_at": str(d.captured_at),
                    "mood": d.mood_on_waking,
                    "similarity": round(score, 3),
                    "snippet": text,
                })

        # 3. Retrieve recurring entities and their prior appearances
        recurring_entities: list[dict[str, Any]] = []
        if current_dream_id:
            stmt_links = select(DreamEntityLink).where(DreamEntityLink.dream_id == current_dream_id)
            curr_links = (await db.execute(stmt_links)).scalars().all()
            for link in curr_links:
                ent = await entity_repo.get_by_id(link.entity_id)
                if not ent:
                    continue
                # Count prior appearances
                stmt_count = select(DreamEntityLink).where(
                    DreamEntityLink.entity_id == ent.id,
                    DreamEntityLink.dream_id != current_dream_id,
                )
                prior_links = (await db.execute(stmt_count)).scalars().all()
                if prior_links:
                    recurring_entities.append({
                        "name": ent.canonical_name,
                        "type": ent.type,
                        "prior_appearances": len(prior_links),
                        "first_seen_dream_id": str(ent.first_seen_dream_id) if ent.first_seen_dream_id else None,
                    })

        # 4. Retrieve learned symbol meanings
        lexicon_entries = await lexicon_service.get_user_lexicon(db, user_id)
        learned_meanings: list[dict[str, Any]] = []
        for entry in lexicon_entries:
            top_meanings = [
                {"label": m["label"], "probability": m["probability"]}
                for m in entry.get("meanings", [])
                if m.get("probability", 0) > 0.25
            ]
            if top_meanings:
                learned_meanings.append({
                    "symbol": entry["canonical_name"],
                    "learned_meanings": top_meanings,
                })

        return {
            "similar_dreams": similar_dreams,
            "recurring_entities": recurring_entities,
            "learned_meanings": learned_meanings,
        }


graph_service = DreamGraphService()
