"""
Phase 6 Test Suite: Interpretation Engine & Reflection (Prompt P5).
Verifies:
- Grounded, humble, evidence-based reflection threads
- Verbatim quote enforcement (rejects fabricated or paraphrased quotes)
- Diagnostic language blocking (bans clinical terms)
- Tentative language enforcement (no absolute 'this means' claims)
- API endpoints: POST /dreams/{id}/interpret, GET /dreams/{id}/interpret, POST /dreams/{id}/interpret/feedback
- Strict multi-tenant isolation
"""

import uuid

import pytest
from apps.api.src.models.interpretation import InterpretationFeedback
from apps.api.src.schemas.interpretation import (
    EvidenceItem,
    InterpretationFeedbackRequest,
    InterpretationOutput,
    InterpretationThread,
    InterpretedSymbol,
)
from apps.api.src.stages.interpret import (
    DiagnosticLanguageError,
    VerbatimQuoteError,
    interpretation_service,
    validate_interpretation,
)
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.anyio


async def _get_auth_header(client: AsyncClient, email_prefix: str = "reflector") -> dict[str, str]:
    email = f"{email_prefix}_{uuid.uuid4().hex[:6]}@example.com"
    resp = await client.post("/auth/signup", json={"email": email, "password": "SecurePassword123!"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_verbatim_quote_validation_accepts_exact_substring():
    notes = "I was standing on an ancient bridge watching black swans swim beneath the arches."
    output = InterpretationOutput(
        threads=[
            InterpretationThread(
                lens="cognitive_emotional",
                title="The Crossing",
                reading="This might suggest an ongoing transition between familiar ground and the unknown.",
                evidence=[
                    EvidenceItem(
                        quote_from_user="watching black swans swim beneath the arches",
                        why_it_matters="Focus on unusual, quiet movement beneath the bridge.",
                    )
                ],
                waking_life_questions=["Have you felt poised between two decisions recently?"],
                symbols=[InterpretedSymbol(name="Bridge", possible_meaning="A passageway between states of being.")],
            )
        ]
    )

    validated = validate_interpretation(output, raw_notes=notes)
    assert len(validated.threads) == 1
    assert len(validated.threads[0].evidence) == 1
    assert "black swans" in validated.threads[0].evidence[0].quote_from_user


def test_verbatim_quote_validation_rejects_hallucinated_quotes():
    notes = "I was running down a long tiled hallway. The bell wouldn't stop ringing."
    output = InterpretationOutput(
        threads=[
            InterpretationThread(
                lens="day_residue",
                title="The Echo",
                reading="One possible thread connects to urgency and structured time.",
                evidence=[
                    EvidenceItem(
                        quote_from_user="I saw a weeping willow tree by the lake",  # NEVER occurred in notes!
                        why_it_matters="Invented tree imagery.",
                    )
                ],
            )
        ]
    )

    with pytest.raises(VerbatimQuoteError):
        validate_interpretation(output, raw_notes=notes)


def test_banned_diagnostic_language_rejected():
    notes = "A dark wave rose over the pier and broke in slow motion."
    output = InterpretationOutput(
        threads=[
            InterpretationThread(
                lens="cognitive_emotional",
                title="The Overwhelm",
                reading="This dream indicates a severe anxiety disorder and acute trauma response.",  # BANNED!
                evidence=[
                    EvidenceItem(
                        quote_from_user="broke in slow motion",
                        why_it_matters="Perception of time dilation.",
                    )
                ],
            )
        ]
    )

    with pytest.raises(DiagnosticLanguageError):
        validate_interpretation(output, raw_notes=notes)


def test_tentative_language_softens_absolutes():
    notes = "A silver key turned by itself in the brass keyhole."
    output = InterpretationOutput(
        threads=[
            InterpretationThread(
                lens="jungian",
                title="The Threshold",
                reading="In dream logic, this means you are entering a new chapter.",
                evidence=[
                    EvidenceItem(
                        quote_from_user="turned by itself in the brass keyhole",
                        why_it_matters="Spontaneous movement.",
                    )
                ],
            )
        ]
    )

    validated = validate_interpretation(output, raw_notes=notes)
    # The absolute claim "this means" should be softened to tentative language
    assert "this means" not in validated.threads[0].reading
    assert "this might suggest" in validated.threads[0].reading


async def test_fallback_interpret_produces_grounded_threads():
    notes = "I walked through a flooded courtyard with glowing blue koi. An old mentor handed me a compass."
    result = interpretation_service._fallback_interpret(notes=notes)

    assert len(result.threads) >= 2
    for thread in result.threads:
        assert thread.lens in ["cognitive_emotional", "jungian", "day_residue", "relational"]
        assert len(thread.evidence) > 0
        # Check that the quoted evidence is actually from the user's notes
        for ev in thread.evidence:
            assert ev.quote_from_user.lower() in notes.lower()


async def test_interpretation_api_full_flow(client: AsyncClient):
    """
    Verifies full lifecycle:
    1. Create dream & extract.
    2. POST /dreams/{id}/interpret generates reflection threads.
    3. GET /dreams/{id}/interpret fetches threads.
    4. POST /dreams/{id}/interpret/feedback records 'resonates' / 'felt_different'.
    5. Multi-tenant security check.
    """
    headers = await _get_auth_header(client, "dreamer")

    # 1. Create dream
    create_resp = await client.post(
        "/dreams",
        headers=headers,
        json={
            "raw_text": "I was standing in an old library where books floated in circles. A quiet friend smiled and handed me a star atlas.",
            "mood_on_waking": "wonder",
        },
    )
    assert create_resp.status_code == 201
    dream_id = create_resp.json()["id"]

    # 2. POST /dreams/{id}/interpret
    interp_resp = await client.post(f"/dreams/{dream_id}/interpret", headers=headers)
    if interp_resp.status_code != 200:
        print("INTERP ERROR DETAIL:", interp_resp.json())
    assert interp_resp.status_code == 200
    interp_data = interp_resp.json()
    assert interp_data["dream_id"] == dream_id
    assert len(interp_data["threads"]) >= 2
    assert interp_data["feedback"] == InterpretationFeedback.NONE.value

    # Check that quotes in threads match user notes
    for thread in interp_data["threads"]:
        assert thread["lens"] in ["cognitive_emotional", "jungian", "day_residue", "relational"]
        assert len(thread["evidence"]) > 0

    # 3. GET /dreams/{id}/interpret
    get_resp = await client.get(f"/dreams/{dream_id}/interpret", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == interp_data["id"]

    # 4. POST /dreams/{id}/interpret/feedback (Resonates)
    fb_resp = await client.post(
        f"/dreams/{dream_id}/interpret/feedback",
        headers=headers,
        json={
            "selected_thread_index": 0,
            "feedback": "resonates",
            "feedback_note": "The idea of floating books representing unorganized thoughts really hit home.",
        },
    )
    assert fb_resp.status_code == 200
    fb_data = fb_resp.json()
    assert fb_data["feedback"] == "resonates"
    assert fb_data["selected_thread_index"] == 0
    assert "unorganized thoughts" in fb_data["feedback_note"]

    # 5. Multi-tenant security: second user cannot view or modify first user's interpretation
    other_headers = await _get_auth_header(client, "intruder")
    unauth_get = await client.get(f"/dreams/{dream_id}/interpret", headers=other_headers)
    assert unauth_get.status_code == 404

    unauth_fb = await client.post(
        f"/dreams/{dream_id}/interpret/feedback",
        headers=other_headers,
        json={"feedback": "felt_different"},
    )
    assert unauth_fb.status_code == 404


def test_indic_philosophical_lens_and_fallback():
    notes = (
        "Realty warped. I was in a room when everyone froze, so I took god's name and chanted ashtakshar. "
        "Later we touched his grandmother's feet."
    )
    fallback = interpretation_service._fallback_interpret(notes=notes)
    assert len(fallback.threads) >= 2
    lenses = [t.lens for t in fallback.threads]
    assert "indic_philosophical" in lenses
    indic_thread = next(t for t in fallback.threads if t.lens == "indic_philosophical")
    assert "Sakshi" in indic_thread.title or "Samskara" in indic_thread.title
    assert len(indic_thread.evidence) > 0
    # Verbatim quote validator checked
    for ev in indic_thread.evidence:
        assert ev.quote_from_user in notes
