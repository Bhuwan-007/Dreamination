"""
Film plan schema for the 2.5D "living ink" dream film.

A FilmPlan is the art-directed, asset-free description of one dream's film. It is built
from the dream's own story and characters (never from a fixed template), then the asset
stage turns it into a FilmManifest with image/audio URLs and absolute timings.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Depth = Literal["far", "mid", "near"]
CameraMove = Literal["push_in", "pull_out", "pan_left", "pan_right", "drift", "still"]
EffectType = Literal["flood", "float", "rain", "snow", "ash", "glow", "fireflies"]
Transition = Literal["dissolve", "cut", "fade_black", "submerge"]
BeatAction = Literal["enter", "exit", "walk", "speak", "gesture", "turn"]
Visibility = Literal["full", "shadowed", "hidden"]
Source = Literal["llm", "fallback"]


class FigureSpec(BaseModel):
    """Visual description of a cast member's ink figure, parsed from the user's words."""

    kind: str = Field(default="human", description="human, or a creature kind such as dog, bird, fox")
    height: float = Field(default=1.0, ge=0.5, le=1.6, description="Relative height (1.0 = average adult)")
    build: Literal["slight", "average", "broad"] = "average"
    hair: Literal["short", "long", "bald", "hood", "curly"] = "short"
    garment: Literal["coat", "dress", "robe", "suit", "plain", "uniform"] = "plain"
    color: str = Field(default="#559CA9", description="Garment accent colour (hex)")
    accessory: Literal["none", "hat", "umbrella", "cane", "bag", "glasses", "lantern"] = "none"


class VoiceSpec(BaseModel):
    tone: Literal["low", "mid", "high"] = "mid"
    rate: int = Field(default=0, ge=-4, le=4, description="Relative speaking rate")


class CastMember(BaseModel):
    cast_id: str
    name: str
    entity_id: str | None = None
    description: str = ""
    visibility: Visibility = "full"
    figure: FigureSpec = Field(default_factory=FigureSpec)
    voice: VoiceSpec = Field(default_factory=VoiceSpec)
    returning: bool = Field(default=False, description="Seen in an earlier dream (reused figure)")


class SceneObject(BaseModel):
    name: str
    depth: Depth = "mid"
    x: float = Field(default=0.0, ge=-1.0, le=1.0, description="Horizontal placement, -1 left .. 1 right")
    scale: float = Field(default=1.0, ge=0.3, le=2.5)
    floating: bool = False


class StagedCharacter(BaseModel):
    cast_id: str
    x: float = Field(default=0.0, ge=-1.0, le=1.0)
    facing: Literal[-1, 1] = 1


class FilmBeat(BaseModel):
    t: float = Field(ge=0.0, description="Seconds from scene start (speech beats are re-timed from audio)")
    cast_id: str
    action: BeatAction
    to_x: float | None = None
    line: str | None = None
    emotion: str = "neutral"


class SceneEffect(BaseModel):
    type: EffectType
    at: float = Field(default=0.5, ge=0.0)
    duration: float = Field(default=4.0, gt=0.0)


class FilmScene(BaseModel):
    scene_id: int
    heading: str
    setting: str = Field(description="One-line visual description of where this scene happens")
    mood: str = "wonder"
    setting_kind: str = Field(default="void", description="water, forest, city, corridor, interior, mountain, desert, sky, field, void")
    time_of_day: Literal["night", "dusk", "dawn", "day", "timeless"] = "night"
    backdrop_prompt: str = Field(description="Prompt for the opaque painted backdrop (no names)")
    objects: list[SceneObject] = Field(default_factory=list)
    characters: list[StagedCharacter] = Field(default_factory=list)
    beats: list[FilmBeat] = Field(default_factory=list)
    narration: str | None = None
    camera: CameraMove = "drift"
    effects: list[SceneEffect] = Field(default_factory=list)
    transition_in: Transition = "dissolve"
    ambient: str = "forest_whisper"
    source: Source = "fallback"


class FilmPlan(BaseModel):
    version: Literal[2] = 2
    title: str
    style_id: str = "ink_wash"
    palette: dict[str, str] = Field(default_factory=dict)
    cast: list[CastMember] = Field(default_factory=list)
    scenes: list[FilmScene] = Field(default_factory=list)
