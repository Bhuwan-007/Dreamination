from typing import Any, Literal
from pydantic import BaseModel, Field


class FogConfig(BaseModel):
    density: float = Field(default=0.02, ge=0.0, le=1.0)
    color: str = Field(default="#1b2a4a", pattern=r"^#([A-Fa-f0-9]{6})$")


class PropPlacement(BaseModel):
    id: str
    anchor: str


class WorldEffect(BaseModel):
    type: Literal["flood", "float", "invert_gravity", "loop", "stretch", "duplicate", "dissolve"]
    at: float = Field(ge=0.0, description="Start timestamp in seconds")
    duration: float = Field(gt=0.0, description="Duration in seconds")
    parameters: dict[str, Any] = Field(default_factory=dict)


class WorldConfig(BaseModel):
    kit: str
    sky: str
    light: str
    fog: FogConfig = Field(default_factory=FogConfig)
    props: list[PropPlacement] = Field(default_factory=list)
    effects: list[WorldEffect] = Field(default_factory=list)


class CastMember(BaseModel):
    entity_id: str | None = None
    name: str
    spawn: str
    face_visibility: Literal["full", "shadowed", "hidden"] = "full"


class Beat(BaseModel):
    t: float = Field(ge=0.0, description="Beat offset in seconds")
    actor: str = Field(description="'camera', 'world', or character name")
    action: str = Field(description="Action matching vocabulary")
    args: dict[str, Any] = Field(default_factory=dict)


class Scene(BaseModel):
    scene_id: int = Field(ge=1)
    transition_in: Literal["cut", "dissolve", "morph", "submerge_fade"] = "dissolve"
    world: WorldConfig
    cast: list[CastMember] = Field(default_factory=list)
    beats: list[Beat] = Field(default_factory=list)
    narration: str | None = None
    ambient: str = "quiet_wind"
    sound_motif: str | None = None


class DirectorScript(BaseModel):
    """The Director script: the sole contract between LLM and 3D Player."""
    title: str
    style_id: str
    scenes: list[Scene] = Field(min_length=1, max_length=10)
