"""
Tests for Phase 5: Reconstruction Engine & Review (The Dream Weaver).
Verifies:
- Faithful vs Authored reconstruction modes
- Provenance tagging (user vs inferred) and inference reasons
- Cliché detection & validation
- Single-scene repair with user correction
- Dream version approval and status progression
- Strict multi-tenant isolation across all endpoints
"""

import uuid

import pytest
from apps.api.src.models.dream import DreamStatus
from apps.api.src.schemas.extraction import (
    DreamFragment,
    ExtractedEmotion,
    ExtractedEntity,
    ExtractedTransition,
    ExtractionOutput,
)
from apps.api.src.schemas.reconstruction import (
    BeatItem,
    ReconstructedScene,
    ReconstructionOutput,
)
from apps.api.src.stages.reconstruct import (
    ClichéValidationError,
    reconstruction_service,
    validate_reconstruction_rules,
)
from httpx import AsyncClient

pytestmark = pytest.mark.anyio


async def _get_auth_header(client: AsyncClient, email_prefix: str = "weaver") -> dict[str, str]:
    email = f"{email_prefix}_{uuid.uuid4().hex[:6]}@example.com"
    resp = await client.post("/auth/signup", json={"email": email, "password": "SecurePassword123!"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_extraction() -> ExtractionOutput:
    return ExtractionOutput(
        fragments=[
            DreamFragment(id="f1", text="I was walking along a dark shore with indigo sand.", order_hint=1),
            DreamFragment(id="f2", text="A floating wooden doorway stood upright in the shallow surf.", order_hint=2),
            DreamFragment(id="f3", text="Someone handed me a cold iron key wrapped in kelp.", order_hint=3),
        ],
        entities=[
            ExtractedEntity(
                name="Floating Doorway",
                type="symbol",
                description_from_user="a floating wooden doorway upright in surf",
                salience=0.9,
            ),
            ExtractedEntity(
                name="Tall Stranger",
                type="person",
                description_from_user="someone who handed me a cold iron key",
                salience=0.8,
            ),
        ],
        emotions=[
            ExtractedEmotion(label="Quiet Wonder", intensity=0.8, attached_to="f1"),
            ExtractedEmotion(label="Hushed Anticipation", intensity=0.7, attached_to="f2"),
        ],
        transitions=[
            ExtractedTransition(from_fragment="f1", to_fragment="f2", type="unexplained"),
            ExtractedTransition(from_fragment="f2", to_fragment="f3", type="cut"),
        ],
        day_residue_candidates=["iron key"],
        ending="The door unlocked onto a sky full of lanterns.",
    )


async def test_reconstruct_faithful_mode(sample_extraction: ExtractionOutput):
    """Verifies that faithful mode preserves every user fragment and tags inferred bridges."""
    notes = "I was walking along a dark shore with indigo sand. A floating wooden doorway stood in the shallow surf. Someone gave me an iron key."
    story = await reconstruction_service.reconstruct(
        extraction=sample_extraction,
        notes=notes,
        mode="faithful",
    )

    assert story.mode == "faithful"
    assert len(story.scenes) >= len(sample_extraction.fragments), "Must preserve all user fragment scenes"
    assert len(story.scenes) <= 8, "Must produce at most 8 scenes"

    # All user fragments should be present
    all_beats = [b for s in story.scenes for b in s.beats]
    user_beats = [b for b in all_beats if b.source == "user"]
    inferred_beats = [b for b in all_beats if b.source == "inferred"]

    assert len(user_beats) >= len(sample_extraction.fragments)
    assert len(inferred_beats) > 0, "Must contain inferred bridges between fragments"

    # Every inferred beat must possess an inference_reason
    for b in inferred_beats:
        assert b.inference_reason is not None
        assert len(b.inference_reason.strip()) > 5


async def test_authored_mode_infilling_unclear_memory():
    """
    Verifies that when the user says 'I don't remember' or indicates ambiguity,
    Authored Arc identifies the gap and in-fills it using the whole dream's context
    (places, symbols, characters) rather than adding a generic repeated sentence.
    """
    notes = (
        "I was standing on an indigo coast watching the sea. Someone handed me an old brass key. "
        "I don't remember how I reached the stone tower, but I unlocked the giant door."
    )
    extraction = ExtractionOutput(
        fragments=[
            DreamFragment(id="f1", text="I was standing on an indigo coast watching the sea.", order_hint=1),
            DreamFragment(id="f2", text="Someone handed me an old brass key.", order_hint=2),
            DreamFragment(id="f3", text="I don't remember how I reached the stone tower, but I unlocked the giant door.", order_hint=3),
        ],
        entities=[
            ExtractedEntity(name="Indigo Coast", type="place", description_from_user="an indigo coast watching sea", salience=0.9),
            ExtractedEntity(name="Brass Key", type="symbol", description_from_user="an old brass key", salience=0.8),
            ExtractedEntity(name="Stone Tower", type="place", description_from_user="the stone tower", salience=0.7),
        ],
        emotions=[ExtractedEmotion(label="Wonder", intensity=0.8, attached_to="f1")],
    )

    # 1. Test Faithful Mode: Pure RAW memory, no generic filler
    faithful_story = await reconstruction_service.reconstruct(
        extraction=extraction,
        notes=notes,
        mode="faithful",
    )
    assert faithful_story.mode == "faithful"
    for scene in faithful_story.scenes:
        # No canned repetition
        assert not any("thickens with the scent of cool rain" in b.text for b in scene.beats)
        # Every user fragment is preserved raw
        assert any(b.source == "user" for b in scene.beats)

    # 2. Test Authored Arc Mode: Gaps infilled with dream context
    authored_story = await reconstruction_service.reconstruct(
        extraction=extraction,
        notes=notes,
        mode="authored",
    )
    assert authored_story.mode == "authored"
    assert len(authored_story.scenes) == 5

    # Check that Scene 3 (The Infilled Passage) specifically in-filled the memory gap
    scene_3 = authored_story.scenes[2]
    inferred_beats = [b for b in scene_3.beats if b.source == "inferred"]
    assert len(inferred_beats) > 0

    gap_infill = inferred_beats[0]
    assert "don't remember" in gap_infill.inference_reason.lower() or "forgotten" in gap_infill.inference_reason.lower()
    # The infilled text must relate to the dream's actual places/symbols (coast / key / tower), not a generic line
    assert any(term in gap_infill.text.lower() for term in ["coast", "sea", "key", "tower", "passage", "water"])


async def test_reconstruct_authored_mode(sample_extraction: ExtractionOutput):
    """Verifies authored arc mode structure."""
    notes = "I was walking along a dark shore with indigo sand. A floating wooden doorway stood in the shallow surf."
    story = await reconstruction_service.reconstruct(
        extraction=sample_extraction,
        notes=notes,
        mode="authored",
    )

    assert story.mode == "authored"
    assert len(story.scenes) >= 5
    assert any("Threshold" in s.heading or "Shore" in s.heading or "Currents" in s.heading for s in story.scenes)


def test_cliche_detection():
    """Verifies that forbidden cliché phrases are rejected."""
    bad_output = ReconstructionOutput(
        title="False Ending",
        mode="faithful",
        scenes=[
            ReconstructedScene(
                scene_id=1,
                heading="The Waking",
                beats=[
                    BeatItem(
                        text="I suddenly woke up and realized it was all a dream.",
                        source="inferred",
                        inference_reason="Bridges ending",
                        confidence=0.5,
                    )
                ],
            )
        ],
    )

    with pytest.raises(ClichéValidationError):
        validate_reconstruction_rules(bad_output, raw_notes="I was on a shore.")


async def test_single_scene_repair():
    """Verifies single scene repair overwrites only the targeted scene using user correction."""
    target_scene = ReconstructedScene(
        scene_id=2,
        heading="The Floating Door",
        beats=[
            BeatItem(
                text="The door stood upright in the water.",
                source="user",
                confidence=1.0,
            )
        ],
    )

    correction = "The door was not in the water at all; it was suspended in mid-air over a field of dry lavender."
    repaired = await reconstruction_service.repair_single_scene(
        target_scene=target_scene,
        user_correction=correction,
        previous_scene_summary="Walking along indigo shore",
        next_scene_summary="Unlocking with the key",
    )

    assert repaired.scene_id == 2
    user_beats = [b for b in repaired.beats if b.source == "user"]
    assert any("dry lavender" in b.text for b in user_beats)


async def test_reconstruction_api_full_flow(client: AsyncClient):
    """
    Integration test:
    1. Create dream
    2. Extract dream
    3. Reconstruct in faithful mode
    4. Fetch versions
    5. Repair a single scene
    6. Approve the dream
    7. Verify dream status is approved
    """
    headers = await _get_auth_header(client, "alice_weaver")

    # 1. Create dream
    dream_res = await client.post(
        "/dreams",
        json={
            "raw_text": "I was walking in a library where the books were made of carved river ice. A clock on the wall melted into cold blue vapor.",
            "mood_on_waking": "wonder",
        },
        headers=headers,
    )
    assert dream_res.status_code == 201
    dream_id = dream_res.json()["id"]

    # 2. Extract
    extract_res = await client.post(f"/dreams/{dream_id}/extract", headers=headers)
    assert extract_res.status_code == 200

    # 3. Reconstruct
    recon_res = await client.post(
        f"/dreams/{dream_id}/reconstruct",
        json={"mode": "faithful"},
        headers=headers,
    )
    if recon_res.status_code != 200:
        print("RECON ERROR:", recon_res.text)
    assert recon_res.status_code == 200
    recon_data = recon_res.json()
    assert recon_data["mode"] == "faithful"
    assert len(recon_data["story"]["scenes"]) >= 2
    version_id = recon_data["id"]

    # 4. List versions
    versions_res = await client.get(f"/dreams/{dream_id}/versions", headers=headers)
    assert versions_res.status_code == 200
    versions = versions_res.json()
    assert len(versions) >= 1
    assert versions[0]["id"] == version_id

    # 5. Repair scene 1
    repair_res = await client.patch(
        f"/dreams/{dream_id}/scenes/1",
        json={"correction": "The river ice was glowing with an internal violet phosphorescence."},
        headers=headers,
    )
    assert repair_res.status_code == 200
    repaired_scene = repair_res.json()["scene"]
    assert repaired_scene["scene_id"] == 1
    assert any("violet phosphorescence" in b["text"] for b in repaired_scene["beats"])

    # 6. Approve dream
    approve_res = await client.post(
        f"/dreams/{dream_id}/approve",
        json={"version_id": version_id},
        headers=headers,
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == DreamStatus.APPROVED.value

    # 7. Check dream details show status approved
    check_res = await client.get(f"/dreams/{dream_id}", headers=headers)
    assert check_res.status_code == 200
    assert check_res.json()["status"] == DreamStatus.APPROVED.value


async def test_reconstruction_multi_tenant_isolation(client: AsyncClient):
    """Verifies that User B cannot view, reconstruct, repair, or approve User A's dream."""
    headers_a = await _get_auth_header(client, "user_a")
    headers_b = await _get_auth_header(client, "user_b")

    # User A creates a dream
    create_res = await client.post(
        "/dreams",
        json={"raw_text": "Private dream of user A with an iron clock.", "mood_on_waking": "serene"},
        headers=headers_a,
    )
    assert create_res.status_code == 201
    dream_id = create_res.json()["id"]

    # User B attempts to reconstruct User A's dream -> 404
    recon_attempt = await client.post(
        f"/dreams/{dream_id}/reconstruct",
        json={"mode": "faithful"},
        headers=headers_b,
    )
    assert recon_attempt.status_code in (404, 403)

    # User A reconstructs dream
    user_a_recon = await client.post(
        f"/dreams/{dream_id}/reconstruct",
        json={"mode": "faithful"},
        headers=headers_a,
    )
    assert user_a_recon.status_code == 200

    # User B attempts to list versions of User A's dream -> 404
    list_attempt = await client.get(f"/dreams/{dream_id}/versions", headers=headers_b)
    assert list_attempt.status_code in (404, 403)

    # User B attempts to repair a scene in User A's dream -> 404
    repair_attempt = await client.patch(
        f"/dreams/{dream_id}/scenes/1",
        json={"correction": "Malicious repair by foreign user."},
        headers=headers_b,
    )
    assert repair_attempt.status_code in (404, 403)

    # User B attempts to approve User A's dream -> 404
    approve_attempt = await client.post(
        f"/dreams/{dream_id}/approve",
        json={},
        headers=headers_b,
    )
    assert approve_attempt.status_code in (404, 403)
