"""
Director Script Validator.
Enforces the strict action vocabulary, world kit anchors/props, and cinematic rules.
Conforms to architecture.md 6.2 and prompts.md P7.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from packages.shared.src.shared.schemas.director import (
    AllowedEmotion,
    AnimateClip,
    DirectorScript,
    ShotPreset,
)
from pydantic import ValidationError

from .world_kits import WorldKitRegistry, world_kit_registry

logger = logging.getLogger("dream_machine.director_validator")

# Vocabulary groupings
CAMERA_ACTIONS = {"shot", "drift"}
WORLD_ACTIONS = {"set_kit", "sky", "light", "fog", "weather", "place_prop", "effect"}
CAST_ACTIONS = {"spawn", "walk_to", "run_to", "animate", "look_at", "emote", "speak", "exit"}
VALID_SHOT_PRESETS = {e.value for e in ShotPreset}
VALID_ANIMATE_CLIPS = {e.value for e in AnimateClip}
VALID_EMOTIONS = {e.value.lower() for e in AllowedEmotion}


@dataclass
class ValidationResult:
    is_valid: bool
    errors: list[str] = field(default_factory=list)
    script: DirectorScript | None = None


def validate_director_script(
    data: dict[str, Any] | DirectorScript,
    registry: WorldKitRegistry | None = None,
    expected_cast_entity_ids: dict[str, str] | None = None,
) -> ValidationResult:
    """
    Validates a director script dictionary or Pydantic model against all hard rules:
    1. Schema validity via Pydantic DirectorScript
    2. Scene count: 5 to 8 scenes
    3. Every scene opens with a camera 'shot' beat at t=0.0
    4. No identical shot preset in consecutive scene opening shots
    5. Action vocabulary matches actor type (camera, world, or cast member)
    6. Every 'speak' beat has a non-empty 'line' argument
    7. All world kits, props, and anchors exist in the registry
    8. Cast members maintain known entity_id if provided
    9. Animate clips and emotions belong to allowed enums
    """
    reg = registry or world_kit_registry
    errors: list[str] = []

    # 1. Pydantic schema validation
    script: DirectorScript
    if isinstance(data, DirectorScript):
        script = data
    else:
        try:
            script = DirectorScript.model_validate(data)
        except ValidationError as e:
            for err in e.errors():
                loc = " -> ".join(str(p) for p in err["loc"])
                errors.append(f"Schema error at {loc}: {err['msg']}")
            return ValidationResult(is_valid=False, errors=errors, script=None)

    # 2. Scene count (5 to 8)
    scene_count = len(script.scenes)
    if scene_count < 5 or scene_count > 8:
        errors.append(f"Scene count must be between 5 and 8 scenes; got {scene_count}.")

    last_opening_shot_preset: str | None = None

    # Iterate scenes
    for s_idx, scene in enumerate(script.scenes):
        scene_num = scene.scene_id

        # Kit validation
        kit_id = scene.world.kit
        kit = reg.get_kit(kit_id)
        if not kit:
            allowed_kits = ", ".join(reg.list_kits())
            errors.append(f"Scene {scene_num}: Unknown world kit '{kit_id}'. Allowed kits: {allowed_kits}.")
        else:
            # Validate props
            for prop in scene.world.props:
                if prop.id not in kit.props:
                    allowed_props = ", ".join(kit.props.keys())
                    errors.append(
                        f"Scene {scene_num}: Prop '{prop.id}' does not exist in kit '{kit_id}'. Allowed: {allowed_props}."
                    )
                elif not kit.is_prop_valid(prop.id, prop.anchor):
                    allowed_anchors = ", ".join(kit.props[prop.id].allowed_anchors)
                    errors.append(
                        f"Scene {scene_num}: Prop '{prop.id}' cannot be placed at anchor '{prop.anchor}'. Allowed anchors for this prop: {allowed_anchors}."
                    )

            # Validate cast spawn anchors
            for member in scene.cast:
                if not kit.is_anchor_valid(member.spawn):
                    allowed_anchors = ", ".join(kit.anchors.keys())
                    errors.append(
                        f"Scene {scene_num}: Cast '{member.name}' spawned at unknown anchor '{member.spawn}' in kit '{kit_id}'. Allowed anchors: {allowed_anchors}."
                    )

        # Cast map for this scene
        scene_cast_names = {m.name for m in scene.cast}

        # Check entity_id reuse
        if expected_cast_entity_ids:
            for member in scene.cast:
                if member.name in expected_cast_entity_ids:
                    expected_id = expected_cast_entity_ids[member.name]
                    if member.entity_id != expected_id:
                        errors.append(
                            f"Scene {scene_num}: Cast member '{member.name}' entity_id '{member.entity_id}' does not match expected '{expected_id}'."
                        )

        # Beats validation
        if not scene.beats:
            errors.append(f"Scene {scene_num} has no action beats.")
            continue

        # 3. Every scene begins with a camera "shot" beat at t = 0.0
        first_beat = scene.beats[0]
        if first_beat.actor != "camera" or first_beat.action != "shot":
            errors.append(
                f"Scene {scene_num}: First beat must be a camera 'shot' beat (got actor='{first_beat.actor}', action='{first_beat.action}')."
            )
        else:
            preset = str(first_beat.args.get("preset", "")).lower()
            if preset not in VALID_SHOT_PRESETS:
                errors.append(
                    f"Scene {scene_num}: Invalid shot preset '{preset}'. Allowed: {', '.join(sorted(VALID_SHOT_PRESETS))}."
                )
            else:
                # 4. No identical shot preset in consecutive scenes
                if last_opening_shot_preset and preset == last_opening_shot_preset:
                    errors.append(
                        f"Scene {scene_num}: Consecutive identical opening shot preset '{preset}' matches Scene {s_idx}. Must vary shot presets between scenes."
                    )
                last_opening_shot_preset = preset

        # Validate each beat
        for b_idx, beat in enumerate(scene.beats):
            actor = beat.actor
            action = beat.action
            args = beat.args

            if actor == "camera":
                if action not in CAMERA_ACTIONS:
                    errors.append(f"Scene {scene_num} beat {b_idx}: Invalid camera action '{action}'. Allowed: {CAMERA_ACTIONS}.")
                if action == "shot":
                    p = str(args.get("preset", "")).lower()
                    if p and p not in VALID_SHOT_PRESETS:
                        errors.append(f"Scene {scene_num} beat {b_idx}: Invalid shot preset '{p}'.")

            elif actor == "world":
                if action not in WORLD_ACTIONS:
                    errors.append(f"Scene {scene_num} beat {b_idx}: Invalid world action '{action}'. Allowed: {WORLD_ACTIONS}.")

            else:
                # Must be a declared cast member
                if actor not in scene_cast_names:
                    errors.append(
                        f"Scene {scene_num} beat {b_idx}: Actor '{actor}' is not in the scene cast ({scene_cast_names})."
                    )

                if action not in CAST_ACTIONS:
                    errors.append(
                        f"Scene {scene_num} beat {b_idx}: Invalid action '{action}' for character '{actor}'. Allowed: {CAST_ACTIONS}."
                    )

                # 6. Speak beat validation
                if action == "speak":
                    line = args.get("line")
                    if not line or not str(line).strip():
                        errors.append(f"Scene {scene_num} beat {b_idx}: 'speak' beat for '{actor}' must contain a non-empty 'line'.")
                    emotion = str(args.get("emotion", "")).lower()
                    if emotion and emotion not in VALID_EMOTIONS:
                        errors.append(
                            f"Scene {scene_num} beat {b_idx}: Unknown emotion '{emotion}'. Allowed: {', '.join(sorted(VALID_EMOTIONS))}."
                        )

                # Anchor validation on walk_to / run_to
                if action in ("walk_to", "run_to") and kit:
                    target_anchor = args.get("anchor")
                    if not target_anchor or not kit.is_anchor_valid(str(target_anchor)):
                        errors.append(
                            f"Scene {scene_num} beat {b_idx}: '{action}' destination anchor '{target_anchor}' is invalid in kit '{kit_id}'."
                        )

                # Animate clip validation
                if action == "animate":
                    clip = str(args.get("clip", "")).lower()
                    if clip and clip not in VALID_ANIMATE_CLIPS:
                        errors.append(
                            f"Scene {scene_num} beat {b_idx}: Unknown animation clip '{clip}'. Allowed: {', '.join(sorted(VALID_ANIMATE_CLIPS))}."
                        )

    is_valid = len(errors) == 0
    return ValidationResult(is_valid=is_valid, errors=errors, script=script if is_valid else None)
