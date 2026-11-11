"""Unit tests for the 2.5D film director: dream-specific scenes, full cast, privacy."""

from __future__ import annotations

from apps.api.src.stages.film_director import apply_enrichment, build_film_plan, figure_record

SHORE_DREAM = {
    "title": "The Speaking Tide",
    "scenes": [
        {
            "scene_id": 1,
            "heading": "The Glass Shore",
            "beats": [{"text": "I stood on a glass shore at night while the sea rose around a floating clock."}],
            "dialogue": [{"speaker": "Grandmother", "line": "The tide remembers you.", "emotion": "peaceful"}],
        },
        {
            "scene_id": 2,
            "heading": "The Lighthouse",
            "beats": [{"text": "A lighthouse stood in the water and its door was open."}],
            "dialogue": [],
        },
    ],
}

CITY_DREAM = {
    "title": "Late for the Train",
    "scenes": [
        {
            "scene_id": 1,
            "heading": "The Station",
            "beats": [{"text": "I ran through a crowded city street toward the station, but the train kept moving."}],
            "dialogue": [
                {"speaker": "Arjun", "line": "You are always late.", "emotion": "uneasy"},
                {"speaker": "Me", "line": "The clocks are lying.", "emotion": "fearful"},
            ],
        }
    ],
}

ENTITIES = [
    {"entity_id": "11111111-1111-1111-1111-111111111111", "name": "Grandmother", "type": "person",
     "description": "my grandmother in a red saree with long hair"},
    {"entity_id": "22222222-2222-2222-2222-222222222222", "name": "a black dog", "type": "creature",
     "description": "a black dog that followed me"},
]


def test_different_dreams_produce_different_films():
    shore = build_film_plan(SHORE_DREAM, ENTITIES)
    city = build_film_plan(CITY_DREAM, [])
    assert shore.scenes[0].setting_kind == "water"
    assert city.scenes[0].setting_kind == "city"
    assert shore.scenes[0].backdrop_prompt != city.scenes[0].backdrop_prompt
    assert "clock" in [o.name for o in shore.scenes[0].objects]
    assert "train" in [o.name for o in city.scenes[0].objects]
    assert "tower" in [o.name for o in shore.scenes[1].objects]


def test_every_speaker_is_cast_and_staged():
    city = build_film_plan(CITY_DREAM, [])
    assert {c.cast_id for c in city.cast} == {"dreamer", "arjun"}
    assert {c.cast_id for c in city.scenes[0].characters} == {"dreamer", "arjun"}
    speakers = [b.cast_id for b in city.scenes[0].beats if b.action == "speak"]
    assert speakers == ["arjun", "dreamer"]


def test_characters_get_distinct_figures_from_their_description():
    shore = build_film_plan(SHORE_DREAM, ENTITIES)
    grandma = next(c for c in shore.cast if c.name == "Grandmother")
    assert grandma.figure.garment == "dress"
    assert grandma.figure.hair == "long"
    assert grandma.figure.color.lower() == "#b5534c"  # red
    assert grandma.voice.tone == "high"
    dreamer = next(c for c in shore.cast if c.cast_id == "dreamer")
    assert dreamer.figure.color != grandma.figure.color


def test_recurring_character_reuses_stored_figure():
    first = build_film_plan(SHORE_DREAM, ENTITIES)
    grandma = next(c for c in first.cast if c.name == "Grandmother")
    stored = {grandma.entity_id: figure_record(grandma)}
    stored[grandma.entity_id]["figure"]["accessory"] = "umbrella"  # e.g. edited by the user
    second = build_film_plan(SHORE_DREAM, ENTITIES, known_figures=stored)
    again = next(c for c in second.cast if c.name == "Grandmother")
    assert again.returning is True
    assert again.figure.accessory == "umbrella"


def test_names_never_reach_image_prompts():
    plan = build_film_plan(CITY_DREAM, [])
    for scene in plan.scenes:
        assert "arjun" not in scene.backdrop_prompt.lower()
    enriched = apply_enrichment(
        plan.scenes[0],
        {
            "setting": "A station of endless platforms",
            "backdrop_prompt": "Arjun waiting on an endless platform under green lamps",
            "objects": [{"name": "train", "depth": "far"}, "Arjun's watch"],
            "camera": "pan_left",
            "effects": ["rain", "lava"],
        },
        plan.cast,
    )
    assert enriched.source == "llm"
    assert "arjun" not in enriched.backdrop_prompt.lower()
    assert all("arjun" not in o.name for o in enriched.objects)
    assert enriched.camera == "pan_left"
    assert [e.type for e in enriched.effects] == ["rain"]


def test_bad_llm_output_keeps_deterministic_scene():
    plan = build_film_plan(SHORE_DREAM, ENTITIES)
    same = apply_enrichment(plan.scenes[0], {"camera": "spin_wildly", "objects": "nope"}, plan.cast)
    assert same.source == "fallback"
    assert same.objects == plan.scenes[0].objects
