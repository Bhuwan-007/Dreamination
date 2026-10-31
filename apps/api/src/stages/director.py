"""
The Director Stage (Architecture 6.2, Prompts P7, BuildPlan Phase 8).
Transforms approved dream stories into deterministic, validated DirectorScript JSON
for execution by the Three.js Dream Player.
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from typing import Any

from packages.shared.src.shared.schemas.director import (
    AllowedEmotion,
    AnimateClip,
    Beat,
    CastMember,
    DirectorScript,
    FogConfig,
    PropPlacement,
    Scene,
    ShotPreset,
    TransitionType,
    WeatherType,
    WorldConfig,
    WorldEffect,
    WorldEffectType,
)

from ..logging import logger
from ..providers.llm import LLMGenerationError, complete_json
from .director_validator import validate_director_script
from .world_kits import WorldKitRegistry, world_kit_registry

PROMPT_FILE = Path(__file__).resolve().parents[2] / "prompts" / "director_v1.md"

FIXED_VOCABULARY_DESCRIPTION = """
GROUPS AND ALLOWED ACTIONS:
1. Camera Actions:
   - shot: args: { "preset": "wide|two_shot|close_up|hero_low|over_shoulder|top_down|dolly_in|tracking|orbit", "duration": float }
   - drift: args: { "speed": float, "amplitude_x": float, "amplitude_y": float }
2. World Actions:
   - set_kit: args: { "kit": "field|corridor|water|city|void|forest|interior" }
   - sky: args: { "preset": str }
   - light: args: { "preset": str }
   - fog: args: { "density": float, "color": "#hex" }
   - weather: args: { "type": "rain|snow|ash|none" }
   - place_prop: args: { "id": str, "anchor": str }
   - effect: args: { "type": "flood|float|invert_gravity|loop|stretch|duplicate|dissolve", "at": float, "duration": float }
3. Cast Actions (Actor must be in cast list):
   - spawn: args: { "anchor": str }
   - walk_to: args: { "anchor": str, "speed": "slow|normal|fast", "duration": float }
   - run_to: args: { "anchor": str, "duration": float }
   - animate: args: { "clip": "idle|sit|wave|point|shrug|look_around|fall|reach|think", "duration": float }
   - look_at: args: { "target": "camera|anchor_name|actor_name" }
   - emote: args: { "emotion": "neutral|curious|uneasy|wonder|melancholic|fearful|peaceful|bewildered" }
   - speak: args: { "line": "Required non-empty dialogue text", "emotion": "allowed_emotion" }
   - exit: args: { "fade": float }
4. Transitions: cut | dissolve | morph | submerge_fade
5. Allowed Emotions: neutral, curious, uneasy, wonder, melancholic, fearful, peaceful, bewildered
6. Allowed Animation Clips: idle, sit, wave, point, shrug, look_around, fall, reach, think
7. Face Visibility: full | shadowed | hidden
"""


def _detect_world_kit(heading: str, text: str) -> str:
    """Heuristic keyword matching for mapping story scene to standard world kit."""
    combined = f"{heading} {text}".lower()
    if any(k in combined for k in ["water", "sea", "lake", "ocean", "river", "shore", "submerge", "flood", "boat"]):
        return "water"
    if any(k in combined for k in ["corridor", "hall", "hallway", "locker", "school", "hospital", "doorway", "stairs"]):
        return "corridor"
    if any(k in combined for k in ["forest", "tree", "grove", "woods", "moss", "oak", "jungle"]):
        return "forest"
    if any(k in combined for k in ["city", "street", "alley", "asphalt", "building", "traffic", "crossroad"]):
        return "city"
    if any(k in combined for k in ["room", "house", "home", "bedroom", "kitchen", "attic", "window", "mirror", "balcony"]):
        return "interior"
    if any(k in combined for k in ["field", "hill", "grass", "meadow", "sky", "plain", "outdoor"]):
        return "field"
    return "void"


def _create_fallback_scene(
    scene_id: int,
    heading: str,
    beats_text: list[str],
    dialogue_list: list[dict[str, Any]],
    last_opening_preset: str | None,
    cast_map: dict[str, str],
    registry: WorldKitRegistry,
) -> Scene:
    """Deterministically synthesizes a strictly valid director Scene from story data."""
    kit_id = _detect_world_kit(heading, " ".join(beats_text))
    kit = registry.get_kit(kit_id) or registry.get_kit("void")
    assert kit is not None

    # Alternate shot presets to never match previous opening shot
    shot_sequence = [
        ShotPreset.WIDE.value,
        ShotPreset.TRACKING.value,
        ShotPreset.HERO_LOW.value,
        ShotPreset.CLOSE_UP.value,
        ShotPreset.TWO_SHOT.value,
        ShotPreset.ORBIT.value,
        ShotPreset.DOLLY_IN.value,
    ]
    chosen_preset = ShotPreset.WIDE.value
    for p in shot_sequence:
        if p != last_opening_preset:
            chosen_preset = p
            break

    # Anchors and props
    allowed_anchors = list(kit.anchors.keys())
    spawn_anchor = "center" if "center" in kit.anchors else allowed_anchors[0]
    target_anchor = "horizon" if "horizon" in kit.anchors else (allowed_anchors[-1] if len(allowed_anchors) > 1 else spawn_anchor)

    props: list[PropPlacement] = []
    if kit.props:
        first_prop_id = list(kit.props.keys())[0]
        first_prop_anchor = kit.props[first_prop_id].allowed_anchors[0]
        props.append(PropPlacement(id=first_prop_id, anchor=first_prop_anchor))

    effects: list[WorldEffect] = []
    text_lower = " ".join(beats_text).lower()
    if "flood" in text_lower or "water" in text_lower:
        effects.append(WorldEffect(type=WorldEffectType.FLOOD, at=2.0, duration=4.0))
    elif "float" in text_lower:
        effects.append(WorldEffect(type=WorldEffectType.FLOAT, at=1.5, duration=3.0))

    sky_preset = kit.skies[0] if kit.skies else "night_halo"
    light_preset = kit.lights[0] if kit.lights else "moonlit_lantern"

    # Cast setup
    character_name = "Traveler"
    if dialogue_list and dialogue_list[0].get("speaker"):
        character_name = str(dialogue_list[0]["speaker"])

    entity_id = cast_map.get(character_name)
    cast_members = [
        CastMember(
            entity_id=entity_id,
            name=character_name,
            spawn=spawn_anchor,
            face_visibility="shadowed" if "shadow" in text_lower or "faceless" in text_lower else "full",
        )
    ]

    # Action Beats
    action_beats: list[Beat] = [
        Beat(
            t=0.0,
            actor="camera",
            action="shot",
            args={"preset": chosen_preset, "duration": 4.5},
        )
    ]

    current_t = 0.5
    if spawn_anchor != target_anchor:
        action_beats.append(
            Beat(
                t=current_t,
                actor=character_name,
                action="walk_to",
                args={"anchor": target_anchor, "speed": "slow", "duration": 3.0},
            )
        )
        current_t += 2.5
    else:
        action_beats.append(
            Beat(
                t=current_t,
                actor=character_name,
                action="animate",
                args={"clip": AnimateClip.LOOK_AROUND.value, "duration": 2.0},
            )
        )
        current_t += 2.0

    # Spoken dialogue
    if dialogue_list:
        for diag in dialogue_list[:2]:
            line = diag.get("line") or "..."
            speaker = diag.get("speaker") or character_name
            if speaker != character_name:
                speaker = character_name
            action_beats.append(
                Beat(
                    t=current_t,
                    actor=speaker,
                    action="speak",
                    args={"line": line, "emotion": AllowedEmotion.WONDER.value},
                )
            )
            current_t += 3.0
    else:
        # Default speak line derived from beat text or gentle line
        speak_line = beats_text[0] if beats_text else "The dream shifts quietly."
        action_beats.append(
            Beat(
                t=current_t,
                actor=character_name,
                action="speak",
                args={"line": speak_line, "emotion": AllowedEmotion.CURIOUS.value},
            )
        )

    transitions = [
        TransitionType.DISSOLVE,
        TransitionType.CUT,
        TransitionType.MORPH,
        TransitionType.SUBMERGE_FADE,
    ]
    transition = transitions[(scene_id - 1) % len(transitions)]

    return Scene(
        scene_id=scene_id,
        transition_in=transition,
        world=WorldConfig(
            kit=kit.kit_id,
            sky=sky_preset,
            light=light_preset,
            fog=FogConfig(density=0.03, color="#0c1c17"),
            weather=WeatherType.NONE,
            props=props,
            effects=effects,
        ),
        cast=cast_members,
        beats=action_beats,
        narration=beats_text[0] if len(beats_text) > 1 else None,
        ambient=f"ambient_{kit.kit_id}",
        sound_motif="ticking" if "clock" in text_lower or "time" in text_lower else None,
    )


def generate_fallback_director_script(
    story: dict[str, Any],
    style_id: str = "nocturne_toon",
    cast: list[dict[str, Any]] | None = None,
    registry: WorldKitRegistry | None = None,
) -> DirectorScript:
    """
    Deterministically builds a guaranteed valid DirectorScript from story data.
    Ensures 5 to 8 scenes, valid world kits, valid anchors/props, alternating camera openers,
    and valid action vocabulary.
    """
    reg = registry or world_kit_registry
    cast_map = {c.get("name"): c.get("entity_id") for c in (cast or []) if c.get("name")}

    title = story.get("title", "Untitled Dream Performance")
    raw_scenes = story.get("scenes", [])

    # Ensure 5 to 8 scenes
    scenes_data: list[dict[str, Any]] = list(raw_scenes)

    # Pad if less than 5 scenes
    while len(scenes_data) < 5:
        idx = len(scenes_data) + 1
        scenes_data.append(
            {
                "scene_id": idx,
                "heading": f"Liminal Threshold {idx}",
                "beats": [{"text": "A quiet drift through shifting mist."}],
                "dialogue": [],
            }
        )

    # Truncate if more than 8 scenes
    if len(scenes_data) > 8:
        scenes_data = scenes_data[:8]

    built_scenes: list[Scene] = []
    last_opening_preset: str | None = None

    for idx, sc in enumerate(scenes_data, start=1):
        heading = sc.get("heading", f"Scene {idx}")
        beats_text = [b.get("text", "") for b in sc.get("beats", []) if isinstance(b, dict)]
        dialogue = sc.get("dialogue", [])

        built_scene = _create_fallback_scene(
            scene_id=idx,
            heading=heading,
            beats_text=beats_text,
            dialogue_list=dialogue,
            last_opening_preset=last_opening_preset,
            cast_map=cast_map,
            registry=reg,
        )
        last_opening_preset = built_scene.beats[0].args.get("preset")
        built_scenes.append(built_scene)

    script = DirectorScript(
        title=title,
        style_id=style_id,
        scenes=built_scenes,
    )

    # Run validator to verify guarantee
    val = validate_director_script(script, registry=reg, expected_cast_entity_ids=cast_map)
    if not val.is_valid:
        logger.error(f"Fallback director script failed validation: {val.errors}")
        raise ValueError(f"Fallback director script generated invalid output: {val.errors}")

    return script


class DirectorService:
    """Service orchestrating Director script generation and validation."""

    def __init__(
        self,
        registry: WorldKitRegistry | None = None,
        prompt_file: Path | None = None,
    ) -> None:
        self.registry = registry or world_kit_registry
        self.prompt_file = prompt_file or PROMPT_FILE

    async def generate_director_script(
        self,
        story: dict[str, Any],
        style_id: str = "nocturne_toon",
        cast: list[dict[str, Any]] | None = None,
        llm_client: Any | None = None,
    ) -> DirectorScript:
        """
        Generates a validated DirectorScript:
        1. Formats prompt with kits, vocabulary, style, cast, and story.
        2. Queries LLM provider.
        3. Validates against hard action vocabulary and kit rules.
        4. On failure, retries once with validator errors appended.
        5. Falls back to deterministic fallback if LLM is unavailable or fails twice.
        """
        cast_list = cast or []
        cast_map = {c.get("name"): c.get("entity_id") for c in cast_list if c.get("name")}

        world_kits_text = self.registry.format_kits_for_prompt()
        story_json_str = json.dumps(story, indent=2)
        cast_json_str = json.dumps(cast_list, indent=2)

        prompt_template = ""
        if self.prompt_file.exists():
            prompt_template = self.prompt_file.read_text(encoding="utf-8")
        else:
            logger.warning(f"Prompt file not found at {self.prompt_file}; using inline fallback.")

        base_prompt = (
            prompt_template.replace("{style}", f'{{"style_id": "{style_id}"}}')
            .replace("{cast}", cast_json_str)
            .replace("{world_kits}", world_kits_text)
            .replace("{vocabulary}", FIXED_VOCABULARY_DESCRIPTION)
            .replace("{approved_story}", story_json_str)
        )

        # Attempt 1: Call LLM
        try:
            logger.info("Generating director script via LLM provider...")
            if llm_client and hasattr(llm_client, "generate_json"):
                response_json = await llm_client.generate_json(base_prompt)
            else:
                response_json = await complete_json(base_prompt)

            # Validate Attempt 1
            result = validate_director_script(
                response_json,
                registry=self.registry,
                expected_cast_entity_ids=cast_map,
            )
            if result.is_valid and result.script:
                logger.info("Director script successfully generated and validated on Attempt 1.")
                return result.script

            # Attempt 2: Retry with validation error feedback
            logger.warning(f"Director script validation failed on Attempt 1: {result.errors}. Retrying with feedback...")
            retry_prompt = (
                f"{base_prompt}\n\n"
                f"<validation_errors>\n"
                f"Your previous attempt had the following errors:\n"
                + "\n".join(f"- {e}" for e in result.errors)
                + "\nFix all errors and return valid JSON matching the schema and vocabulary strictly.\n"
                "</validation_errors>"
            )

            if llm_client and hasattr(llm_client, "generate_json"):
                retry_json = await llm_client.generate_json(retry_prompt)
            else:
                retry_json = await complete_json(retry_prompt)

            retry_result = validate_director_script(
                retry_json,
                registry=self.registry,
                expected_cast_entity_ids=cast_map,
            )
            if retry_result.is_valid and retry_result.script:
                logger.info("Director script successfully validated on Attempt 2 retry.")
                return retry_result.script

            logger.warning(f"Director script retry validation also failed: {retry_result.errors}. Engaging deterministic fallback.")
        except (LLMGenerationError, Exception) as exc:
            logger.warning(f"LLM generation failed ({type(exc).__name__}: {exc}). Using deterministic fallback.")

        # Deterministic Fallback
        return generate_fallback_director_script(
            story=story,
            style_id=style_id,
            cast=cast_list,
            registry=self.registry,
        )


# Global service instance
director_service = DirectorService()


async def run_director_cli() -> None:
    """CLI entrypoint: python -m apps.api.src.stages.director --story story.json --style nocturne_toon"""
    parser = argparse.ArgumentParser(description="Director Script Generator CLI")
    parser.add_argument("--story", type=str, help="Path to story JSON file")
    parser.add_argument("--style", type=str, default="nocturne_toon", help="Art style ID")
    parser.add_argument("--output", type=str, help="Optional output JSON file path")
    args = parser.parse_args()

    if not args.story:
        print("Please provide --story <path/to/story.json>")
        return

    story_path = Path(args.story)
    if not story_path.exists():
        print(f"Error: Story file not found at {story_path}")
        return

    with story_path.open("r", encoding="utf-8") as f:
        story_data = json.load(f)

    service = DirectorService()
    script = await service.generate_director_script(
        story=story_data,
        style_id=args.style,
    )

    out_json = script.model_dump_json(indent=2)
    if args.output:
        out_path = Path(args.output)
        out_path.write_text(out_json, encoding="utf-8")
        print(f"Director script written to {out_path}")
    else:
        print(out_json)


if __name__ == "__main__":
    asyncio.run(run_director_cli())
