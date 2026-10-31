"""
Phase 7 Test Suite: Personal Dream Graph & Semantic Embeddings (Prompt 7.1).
Verifies:
- Vector embedding unit-normalization and token-overlap cosine similarity.
- sync_dream_to_graph persists dream_embeddings and entity co-occurrence edges.
- get_relevant_history returns similar dreams, recurring entities, and learned meanings.
- Multi-tenant isolation: User A cannot search or retrieve User B's graph or embeddings.
"""

import uuid

import pytest
from apps.api.src.models.dream import Dream, DreamStatus, DreamVersion
from apps.api.src.models.entity import DreamEntityLink, EntityType
from apps.api.src.providers.embeddings import (
    DeterministicEmbeddingProvider,
    _normalize,
)
from apps.api.src.repositories.dream import DreamRepository
from apps.api.src.repositories.entity import EntityRepository
from apps.api.src.stages.graph import _cosine_similarity, graph_service
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.anyio


def test_deterministic_embedding_normalization_and_similarity():
    embedder = DeterministicEmbeddingProvider()
    import asyncio

    v1 = asyncio.run(embedder.embed_text("A dark ocean with stormy waves breaking against the lighthouse"))
    v2 = asyncio.run(embedder.embed_text("A calm ocean with gentle waves under the stars"))
    v3 = asyncio.run(embedder.embed_text("An ancient locked clockwork grandfather clock in the attic"))

    assert len(v1) == 1536
    assert len(v2) == 1536
    assert len(v3) == 1536

    # Unit length check
    norm1 = sum(x * x for x in v1)
    assert abs(norm1 - 1.0) < 1e-4

    # Ocean dreams share tokens ('ocean', 'waves') so cosine similarity should be higher than clock dream
    sim_ocean = _cosine_similarity(v1, v2)
    sim_unrelated = _cosine_similarity(v1, v3)
    assert sim_ocean > sim_unrelated


async def test_sync_dream_to_graph_creates_embeddings_and_edges(client: AsyncClient, db_session: AsyncSession):
    # 1. Create a user
    resp = await client.post("/auth/signup", json={"email": f"graph_{uuid.uuid4().hex[:6]}@example.com", "password": "SecurePassword123!"})
    user_id = uuid.UUID(resp.json()["user"]["id"])

    dream_repo = DreamRepository(db_session, user_id)
    entity_repo = EntityRepository(db_session, user_id)

    # 2. Create dream
    dream = await dream_repo.create_dream(
        raw_text="Walking through ancient stone corridors towards a starry balcony.",
        mood_on_waking="wonder",
        status=DreamStatus.APPROVED.value,
    )

    # Link two entities
    e1 = await entity_repo.create_entity(canonical_name="Stone Corridor", type=EntityType.PLACE.value)
    e2 = await entity_repo.create_entity(canonical_name="Starry Balcony", type=EntityType.PLACE.value)

    db_session.add(DreamEntityLink(dream_id=dream.id, entity_id=e1.id, role="setting", salience=1.0))
    db_session.add(DreamEntityLink(dream_id=dream.id, entity_id=e2.id, role="destination", salience=1.0))
    await db_session.commit()

    # 3. Sync to graph
    await graph_service.sync_dream_to_graph(db_session, dream_id=dream.id, user_id=user_id)
    await db_session.commit()

    # 4. Verify co-occurrence edge created
    edges = await entity_repo.list_edges()
    assert len(edges) >= 1
    edge = edges[0]
    assert edge.relation_type == "co_occurs_with"
    assert edge.weight == 1.0
    assert str(dream.id) in edge.evidence_dream_ids

    # 5. Verify retrieval of relevant history
    history = await graph_service.get_relevant_history(
        db_session,
        user_id=user_id,
        current_dream_id=dream.id,
        query_text="ancient stone walls and arches",
    )
    assert "similar_dreams" in history
    assert "recurring_entities" in history
    assert "learned_meanings" in history


async def test_graph_multi_tenant_isolation(client: AsyncClient, db_session: AsyncSession):
    # User A creates a dream
    resp_a = await client.post("/auth/signup", json={"email": f"usera_{uuid.uuid4().hex[:6]}@example.com", "password": "SecurePassword123!"})
    user_a_id = uuid.UUID(resp_a.json()["user"]["id"])

    # User B
    resp_b = await client.post("/auth/signup", json={"email": f"userb_{uuid.uuid4().hex[:6]}@example.com", "password": "SecurePassword123!"})
    user_b_id = uuid.UUID(resp_b.json()["user"]["id"])

    repo_a = DreamRepository(db_session, user_a_id)
    dream_a = await repo_a.create_dream(
        raw_text="User A secret private dream about an obsidian tower.",
        status=DreamStatus.APPROVED.value,
    )
    await graph_service.sync_dream_to_graph(db_session, dream_id=dream_a.id, user_id=user_a_id)
    await db_session.commit()

    # User B queries history: must NOT see User A's dream
    history_b = await graph_service.get_relevant_history(
        db_session,
        user_id=user_b_id,
        query_text="obsidian tower",
    )
    assert len(history_b["similar_dreams"]) == 0
