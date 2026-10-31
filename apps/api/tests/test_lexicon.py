"""
Phase 7 Test Suite: Bayesian Symbol Lexicon & Dream Weather (Prompt 7.2 & 7.3).
Verifies:
- Dirichlet-Categorical update mechanics on 'resonates' and 'felt_different'.
- Extraction and registration of new custom symbol meanings from user notes.
- GET /lexicon endpoint returns learned distributions and probabilities.
- GET /insights/weather returns dominant emotions, motifs, and atmospheric summary.
- Strict multi-tenant isolation.
"""

import uuid

import pytest
from apps.api.src.models.dream import Dream, DreamStatus
from apps.api.src.models.interpretation import Interpretation, InterpretationFeedback
from apps.api.src.repositories.dream import DreamRepository
from apps.api.src.stages.lexicon import clean_meaning_label, lexicon_service
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.anyio


def test_clean_meaning_label():
    assert clean_meaning_label("In this dream, it felt like suffocating cold water") == "Suffocating cold water"
    assert clean_meaning_label("to me it felt like freedom and flight") == "Freedom and flight"
    assert clean_meaning_label("   an anchor of truth   ") == "An anchor of truth"


async def test_lexicon_dirichlet_updating_and_endpoints(client: AsyncClient, db_session: AsyncSession):
    # 1. Signup user
    email = f"lexicon_{uuid.uuid4().hex[:6]}@example.com"
    resp = await client.post("/auth/signup", json={"email": email, "password": "SecurePassword123!"})
    token = resp.json()["access_token"]
    user_id = uuid.UUID(resp.json()["user"]["id"])
    headers = {"Authorization": f"Bearer {token}"}

    dream_repo = DreamRepository(db_session, user_id)
    dream = await dream_repo.create_dream(
        raw_text="I was watching star trails while an ancient gate opened silently.",
        mood_on_waking="wonder",
        status=DreamStatus.APPROVED.value,
    )

    # Add interpretation with symbols
    interp = Interpretation(
        id=uuid.uuid4(),
        dream_id=dream.id,
        threads_json=[
            {
                "lens": "jungian",
                "title": "Cosmic Guidance",
                "reading": "A possible thread connects the celestial pattern with inner guidance.",
                "evidence": [{"quote_from_user": "star trails", "why_it_matters": "Celestial movement"}],
                "symbols": [
                    {"name": "Star Trail", "possible_meaning": "Cosmic guidance and transcendence"},
                    {"name": "Ancient Gate", "possible_meaning": "A threshold of consciousness"},
                ],
            }
        ],
        feedback=InterpretationFeedback.NONE.value,
    )
    db_session.add(interp)
    await db_session.commit()

    # 2. User provides "resonates" feedback via endpoint
    fb_resp = await client.post(
        f"/dreams/{dream.id}/interpret/feedback",
        headers=headers,
        json={"selected_thread_index": 0, "feedback": "resonates"},
    )
    assert fb_resp.status_code == 200

    # 3. GET /lexicon: Verify symbol registered with high probability
    lex_resp = await client.get("/lexicon", headers=headers)
    assert lex_resp.status_code == 200
    lex_data = lex_resp.json()
    assert len(lex_data) >= 2
    star_entry = next((e for e in lex_data if e["canonical_name"] == "Star Trail"), None)
    assert star_entry is not None
    assert star_entry["meanings"][0]["probability"] > 0.5
    assert star_entry["meanings"][0]["evidence_count"] >= 2

    # 4. User provides "felt_different" with a custom note on a second interaction
    fb_resp2 = await client.post(
        f"/dreams/{dream.id}/interpret/feedback",
        headers=headers,
        json={
            "selected_thread_index": 0,
            "feedback": "felt_different",
            "feedback_note": "To me it felt like passing time and the fleeting nature of life",
        },
    )
    assert fb_resp2.status_code == 200

    # Verify new label extracted and added to Star Trail distribution
    lex_resp2 = await client.get("/lexicon", headers=headers)
    star_entry2 = next((e for e in lex_resp2.json() if e["canonical_name"] == "Star Trail"), None)
    assert star_entry2 is not None
    labels = [m["label"].lower() for m in star_entry2["meanings"]]
    assert any("fleeting" in lbl or "passing time" in lbl for lbl in labels)

    # 5. GET /insights/weather endpoint
    weather_resp = await client.get("/insights/weather", headers=headers)
    assert weather_resp.status_code == 200
    weather = weather_resp.json()
    assert weather["dream_count"] >= 1
    assert "wonder" in [e["emotion"] for e in weather["dominant_emotions"]]
    assert len(weather["weather_summary"]) > 10


async def test_lexicon_multi_tenant_isolation(client: AsyncClient, db_session: AsyncSession):
    # User A
    resp_a = await client.post("/auth/signup", json={"email": f"lexa_{uuid.uuid4().hex[:6]}@example.com", "password": "SecurePassword123!"})
    user_a_id = uuid.UUID(resp_a.json()["user"]["id"])

    # User B
    resp_b = await client.post("/auth/signup", json={"email": f"lexb_{uuid.uuid4().hex[:6]}@example.com", "password": "SecurePassword123!"})
    token_b = resp_b.json()["access_token"]

    # Manually register meaning for User A
    from apps.api.src.models.entity import EntityType
    from apps.api.src.repositories.entity import EntityRepository
    repo_a = EntityRepository(db_session, user_a_id)
    ent_a = await repo_a.create_entity("Golden Key", type=EntityType.SYMBOL.value)
    await repo_a.update_symbol_meaning(ent_a.id, "Secret knowledge", probability=1.0, evidence_count=3)
    await db_session.commit()

    # User B fetches lexicon: must be empty (0 entries)
    resp_lex_b = await client.get("/lexicon", headers={"Authorization": f"Bearer {token_b}"})
    assert resp_lex_b.status_code == 200
    assert len(resp_lex_b.json()) == 0
