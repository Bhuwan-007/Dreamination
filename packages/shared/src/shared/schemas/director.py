"""
Director Script Schemas and Action Vocabulary.
Single source of truth for LLM-generated screenplay instructions executed by the Three.js Dream Player.
Conforms to architecture.md 6.2 and prompts.md P7.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class WorldKitName(str, Enum):
    FIELD = "field"
    CORRIDOR = "corridor"
    WATER = "water"
    CITY = "city"
    VOID = "void"
    FOREST = "forest"
    INTERIOR = "interior"


class TransitionType(str, Enum):
    CUT = "cut"
    DISSOLVE = "dissolve"
    MORPH = "morph"
    SUBMERGE_FADE = "submerge_fade"


class WorldEffectType(str, Enum):
    FLOOD = "flood"
    FLOAT = "float"
    INVERT_GRAVITY = "invert_gravity"
    LOOP = "loop"
    STRETCH = "stretch"
    DUPLICATE = "duplicate"
    DISSOLVE = "dissolve"


class WeatherType(str, Enum):
    RAIN = "rain"
    SNOW = "snow"
    ASH = "ash"
    NONE = "none"


class ShotPreset(str, Enum):
    WIDE = "wide"
    TWO_SHOT = "two_shot"
    CLOSE_UP = "close_up"
    HERO_LOW = "hero_low"
    OVER_SHOULDER = "over_shoulder"
    TOP_DOWN = "top_down"
    DOLLY_IN = "dolly_in"
    TRACKING = "tracking"
    ORBIT = "orbit"


class AnimateClip(str, Enum):
    IDLE = "idle"
    SIT = "sit"
    WAVE = "wave"
    POINT = "point"
    SHRUG = "shrug"
    LOOK_AROUND = "look_around"
    FALL = "fall"
    REACH = "reach"
    THINK = "think"


class FaceVisibility(str, Enum):
    FULL = "full"
    SHADOWED = "shadowed"
    HIDDEN = "hidden"


class AllowedEmotion(str, Enum):
    NEUTRAL = "neutral"
    CURIOUS = "curious"
    UNEEASY = "uneasy"
    WONDER = "wonder"
    MELANCHOLIC = "melancholic"
    FEARFUL = "fearful"
    PEACEFUL = "peaceful"
    BEWILDERED = "bewildered"


class FogConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    density: float = Field(default=0.02, ge=0.0, le=0.5, description="Exponential fog density")
    color: str = Field(default="#0c1c17", pattern=r"^#([A-Fa-f0-9]{6})$", description="Hex color")


class PropPlacement(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(description="Prop ID from the chosen world kit")
    anchor: str = Field(description="Named anchor point in the world kit")


class WorldEffect(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: WorldEffectType
    at: float = Field(ge=0.0, description="Start timestamp in seconds")
    duration: float = Field(gt=0.0, description="Duration in seconds")
    parameters: dict[str, Any] = Field(default_factory=dict)


class WorldConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kit: str = Field(description="World kit identifier (e.g. 'field', 'corridor', 'water', 'city', 'void', 'forest', 'interior')")
    sky: str = Field(description="Sky preset name (e.g. 'night_halo', 'dawn_mist', 'star_trail')")
    light: str = Field(description="Light preset name (e.g. 'moonlit_lantern', 'twilight_soft', 'sunburst')")
    fog: FogConfig = Field(default_factory=FogConfig)
    weather: WeatherType = Field(default=WeatherType.NONE)
    props: list[PropPlacement] = Field(default_factory=list)
    effects: list[WorldEffect] = Field(default_factory=list)


class CastMember(BaseModel):
    model_config = ConfigDict(extra="forbid")
    entity_id: str | None = Field(default=None, description="Persistent entity UUID from extraction or known cast")
    name: str = Field(description="Character name or role")
    spawn: str = Field(description="Named anchor point where actor spawns")
    face_visibility: FaceVisibility = Field(default=FaceVisibility.FULL)


class Beat(BaseModel):
    model_config = ConfigDict(extra="forbid")
    t: float = Field(ge=0.0, description="Beat offset in seconds from scene start")
    actor: str = Field(description="'camera', 'world', or character name from cast")
    action: str = Field(description="Vocabulary action (e.g. 'shot', 'drift', 'walk_to', 'speak', 'animate')")
    args: dict[str, Any] = Field(default_factory=dict, description="Action-specific arguments")


class Scene(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scene_id: int = Field(ge=1, description="Sequential 1-based scene index")
    transition_in: TransitionType = Field(default=TransitionType.DISSOLVE)
    world: WorldConfig
    cast: list[CastMember] = Field(default_factory=list)
    beats: list[Beat] = Field(default_factory=list)
    narration: str | None = Field(default=None, description="Optional spoken narrator line")
    ambient: str = Field(default="quiet_wind", description="Ambient soundscape preset or brief prompt")
    sound_motif: str | None = Field(default=None, description="Optional recurring sound motif key (e.g. 'ticking', 'water_drop')")


class DirectorScript(BaseModel):
    """The Director script: the sole contract between LLM and 3D Player."""
    model_config = ConfigDict(extra="forbid")

    title: str = Field(description="Dream title")
    style_id: str = Field(default="nocturne_toon", description="Art style ID locked per user")
    scenes: list[Scene] = Field(min_length=5, max_length=8, description="5 to 8 cinematic scenes")
