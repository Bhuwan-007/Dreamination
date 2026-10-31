"""
Tests for Phase 8: Director Script Generation and Action Vocabulary.
Validates World Kit Registry, Director Validator Rules, Retry Flow, and Structural Compliance
across 10 Sample Approved Dream Stories.
"""

from __future__ import annotations

import pytest
from apps.api.src.stages.director import (
    DirectorService,
    director_service,
    generate_fallback_director_script,
)
from apps.api.src.stages.director_validator import (
    validate_director_script,
)
from apps.api.src.stages.world_kits import WorldKitRegistry, world_kit_registry
from apps.api.tests.fixtures.sample_stories import SAMPLE_STORIES
from packages.shared.src.shared.schemas.director import (
    DirectorScript,
    ShotPreset,
)

pytestmark = pytest.mark.anyio


class MockLLMProvider:
    """Mock LLM provider for simulating first-attempt failure followed by retry success."""

    def __init__(self, responses: list[dict]):
        self.responses = list(responses)
        self.calls: list[str] = []

    async def generate_json(self, prompt: str) -> dict:
        self.calls.append(prompt)
        if self.responses:
            return self.responses.pop(0)
        raise RuntimeError("No more mock responses")


def test_world_kit_registry_loads_all_7_kits():
    """Verifies that all 7 required world kits are correctly loaded with anchors and props."""
    expected_kits = {"field", "corridor", "water", "city", "void", "forest", "interior"}
    loaded_kits = set(world_kit_registry.list_kits())

    assert expected_kits.issubset(loaded_kits), f"Missing kits: {expected_kits - loaded_kits}"

    for kit_id in expected_kits:
        kit = world_kit_registry.get_kit(kit_id)
        assert kit is not None, f"Kit {kit_id} could not be retrieved"
        assert len(kit.anchors) >= 4, f"Kit {kit_id} has fewer than 4 anchors"
        assert len(kit.props) >= 3, f"Kit {kit_id} has fewer than 3 props"
        assert len(kit.skies) >= 2, f"Kit {kit_id} has fewer than 2 skies"
        assert len(kit.lights) >= 2, f"Kit {kit_id} has fewer than 2 lights"

        # Check anchor and prop validity methods
        first_anchor = list(kit.anchors.keys())[0]
        assert kit.is_anchor_valid(first_anchor)
        assert not kit.is_anchor_valid("totally_bogus_anchor_name")

    prompt_summary = world_kit_registry.format_kits_for_prompt()
    assert "field" in prompt_summary
    assert "corridor" in prompt_summary
    assert "water" in prompt_summary


def test_director_validator_invalid_scene_count():
    """Asserts that fewer than 5 or more than 8 scenes fail validation."""
    story = SAMPLE_STORIES[0]
    valid_script = generate_fallback_director_script(story)

    # 4 scenes
    script_dict = valid_script.model_dump()
    script_dict["scenes"] = script_dict["scenes"][:4]
    res_short = validate_director_script(script_dict)
    assert not res_short.is_valid
    assert any("Scene count must be between 5 and 8" in e or "at least 5 items" in e for e in res_short.errors)

    # 9 scenes
    extra_scene = dict(script_dict["scenes"][0])
    extra_scene["scene_id"] = 9
    script_dict_long = valid_script.model_dump()
    while len(script_dict_long["scenes"]) < 9:
        sc = dict(script_dict_long["scenes"][0])
        sc["scene_id"] = len(script_dict_long["scenes"]) + 1
        script_dict_long["scenes"].append(sc)

    res_long = validate_director_script(script_dict_long)
    assert not res_long.is_valid
    assert any("Scene count must be between 5 and 8" in e or "at most 8 items" in e for e in res_long.errors)


def test_director_validator_first_beat_not_camera_shot():
    """Asserts that a scene must begin with a camera 'shot' beat."""
    story = SAMPLE_STORIES[0]
    script = generate_fallback_director_script(story)
    script_dict = script.model_dump()

    # Change first beat of scene 1 to walk_to
    script_dict["scenes"][0]["beats"][0] = {
        "t": 0.0,
        "actor": "Traveler",
        "action": "walk_to",
        "args": {"anchor": "center", "duration": 2.0},
    }

    res = validate_director_script(script_dict)
    assert not res.is_valid
    assert any("First beat must be a camera 'shot' beat" in e for e in res.errors)


def test_director_validator_consecutive_identical_shot_preset():
    """Asserts that consecutive scenes cannot use identical opening shot presets."""
    story = SAMPLE_STORIES[0]
    script = generate_fallback_director_script(story)
    script_dict = script.model_dump()

    # Set both Scene 1 and Scene 2 opening shot to 'wide'
    script_dict["scenes"][0]["beats"][0]["args"]["preset"] = ShotPreset.WIDE.value
    script_dict["scenes"][1]["beats"][0]["args"]["preset"] = ShotPreset.WIDE.value

    res = validate_director_script(script_dict)
    assert not res.is_valid
    assert any("Consecutive identical opening shot preset 'wide'" in e for e in res.errors)


def test_director_validator_speak_without_line():
    """Asserts that a 'speak' beat with empty or missing line argument is rejected."""
    story = SAMPLE_STORIES[0]
    script = generate_fallback_director_script(story)
    script_dict = script.model_dump()

    # Empty line
    for beat in script_dict["scenes"][0]["beats"]:
        if beat["action"] == "speak":
            beat["args"]["line"] = ""
            break

    res = validate_director_script(script_dict)
    assert not res.is_valid
    assert any("must contain a non-empty 'line'" in e for e in res.errors)


def test_director_validator_unknown_anchor_and_prop():
    """Asserts that anchors and props not belonging to the chosen kit are rejected."""
    story = SAMPLE_STORIES[0]
    script = generate_fallback_director_script(story)
    script_dict = script.model_dump()

    # Unknown anchor in cast spawn
    script_dict["scenes"][0]["cast"][0]["spawn"] = "floating_volcano_crater"

    res = validate_director_script(script_dict)
    assert not res.is_valid
    assert any("unknown anchor 'floating_volcano_crater'" in e for e in res.errors)


def test_director_validator_cast_entity_id_preservation():
    """Asserts that expected cast entity_id mapping is enforced."""
    story = SAMPLE_STORIES[0]
    script = generate_fallback_director_script(
        story,
        cast=[{"name": "Traveler", "entity_id": "expected-traveler-uuid-123"}],
    )
    script_dict = script.model_dump()

    # Change entity_id to mismatched value
    script_dict["scenes"][0]["cast"][0]["entity_id"] = "different-corrupted-uuid"

    res = validate_director_script(
        script_dict,
        expected_cast_entity_ids={"Traveler": "expected-traveler-uuid-123"},
    )
    assert not res.is_valid
    assert any("does not match expected 'expected-traveler-uuid-123'" in e for e in res.errors)


async def test_director_retry_flow_with_validator_errors():
    """Tests that on initial validation error, the stage retries with error feedback and succeeds."""
    story = SAMPLE_STORIES[0]
    valid_script = generate_fallback_director_script(story)

    # Broken attempt 1: Scene 1 opens with walk_to instead of camera shot
    bad_dict = valid_script.model_dump()
    bad_dict["scenes"][0]["beats"][0] = {
        "t": 0.0,
        "actor": "Traveler",
        "action": "walk_to",
        "args": {"anchor": "center", "duration": 2.0},
    }

    # Valid attempt 2
    good_dict = valid_script.model_dump()

    mock_llm = MockLLMProvider([bad_dict, good_dict])
    service = DirectorService()

    final_script = await service.generate_director_script(
        story=story,
        llm_client=mock_llm,
    )

    assert isinstance(final_script, DirectorScript)
    assert len(mock_llm.calls) == 2, "Expected 2 calls: initial and retry"
    assert "<validation_errors>" in mock_llm.calls[1]
    assert "First beat must be a camera 'shot' beat" in mock_llm.calls[1]


async def test_all_10_sample_stories_generate_valid_director_scripts():
    """
    Structural validation test:
    Directs all 10 sample dream stories and verifies that every generated DirectorScript
    satisfies 100% of the validator rules:
    - 5 to 8 scenes
    - Alternating camera opening presets
    - Valid world kits, anchors, and props
    - Valid action vocabulary and emotion enums
    - Valid speak beats with non-empty lines
    """
    assert len(SAMPLE_STORIES) == 10, f"Expected 10 sample stories, got {len(SAMPLE_STORIES)}"

    for story in SAMPLE_STORIES:
        script = await director_service.generate_director_script(
            story=story,
            style_id="nocturne_toon",
        )

        assert isinstance(script, DirectorScript)
        assert 5 <= len(script.scenes) <= 8

        # Run strict validation
        val_result = validate_director_script(script)
        assert val_result.is_valid, f"Story '{story['title']}' generated invalid script: {val_result.errors}"

        # Structural assertions on individual scenes
        last_opening_shot = None
        for scene in script.scenes:
            assert scene.world.kit in world_kit_registry.list_kits()
            first_beat = scene.beats[0]
            assert first_beat.actor == "camera"
            assert first_beat.action == "shot"
            current_preset = first_beat.args.get("preset")
            assert current_preset in {e.value for e in ShotPreset}
            assert current_preset != last_opening_shot, f"Consecutive repeated shot: {current_preset}"
            last_opening_shot = current_preset

            # Check beats
            for beat in scene.beats:
                if beat.action == "speak":
                    assert beat.args.get("line"), f"Empty speak line in scene {scene.scene_id}"
