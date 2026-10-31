/**
 * Director Script Types and Action Vocabulary for Dream Player.
 * Generated / mirrored from packages/shared/src/shared/schemas/director.py.
 * Conforms to architecture.md 6.2 and prompts.md P7.
 */

export type WorldKitName =
  | "field"
  | "corridor"
  | "water"
  | "city"
  | "void"
  | "forest"
  | "interior";

export type TransitionType = "cut" | "dissolve" | "morph" | "submerge_fade";

export type WorldEffectType =
  | "flood"
  | "float"
  | "invert_gravity"
  | "loop"
  | "stretch"
  | "duplicate"
  | "dissolve";

export type WeatherType = "rain" | "snow" | "ash" | "none";

export type ShotPreset =
  | "wide"
  | "two_shot"
  | "close_up"
  | "hero_low"
  | "over_shoulder"
  | "top_down"
  | "dolly_in"
  | "tracking"
  | "orbit";

export type AnimateClip =
  | "idle"
  | "sit"
  | "wave"
  | "point"
  | "shrug"
  | "look_around"
  | "fall"
  | "reach"
  | "think";

export type FaceVisibility = "full" | "shadowed" | "hidden";

export type AllowedEmotion =
  | "neutral"
  | "curious"
  | "uneasy"
  | "wonder"
  | "melancholic"
  | "fearful"
  | "peaceful"
  | "bewildered";

export interface FogConfig {
  density?: number;
  color?: string;
}

export interface PropPlacement {
  id: string;
  anchor: string;
}

export interface WorldEffect {
  type: WorldEffectType;
  at: number;
  duration: number;
  parameters?: Record<string, unknown>;
}

export interface WorldConfig {
  kit: string;
  sky: string;
  light: string;
  fog?: FogConfig;
  weather?: WeatherType;
  props?: PropPlacement[];
  effects?: WorldEffect[];
}

export interface CastMember {
  entity_id?: string | null;
  name: string;
  spawn: string;
  face_visibility?: FaceVisibility;
}

export interface Beat {
  t: number;
  actor: string;
  action: string;
  args?: Record<string, unknown>;
}

export interface Scene {
  scene_id: number;
  transition_in?: TransitionType;
  world: WorldConfig;
  cast?: CastMember[];
  beats: Beat[];
  narration?: string | null;
  ambient?: string;
  sound_motif?: string | null;
}

export interface DirectorScript {
  title: string;
  style_id: string;
  scenes: Scene[];
}
