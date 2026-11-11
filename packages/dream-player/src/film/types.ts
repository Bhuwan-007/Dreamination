/** FilmManifest v2 — produced by apps/worker/src/tasks/film_render.py. All times are absolute seconds. */

export type CameraMove = "push_in" | "pull_out" | "pan_left" | "pan_right" | "drift" | "still";
export type TransitionKind = "dissolve" | "cut" | "fade_black" | "submerge";
export type EffectKind = "flood" | "float" | "rain" | "snow" | "ash" | "glow" | "fireflies";
export type BeatKind = "enter" | "exit" | "walk" | "speak" | "gesture" | "turn";

export interface WordTiming {
  word: string;
  start: number; // seconds from the speech's start
  end: number;
}

export interface FilmCast {
  castId: string;
  name: string;
  description: string;
  visibility: "full" | "shadowed" | "hidden";
  returning: boolean;
  color?: string;
  kind: string;
  height: number;
  figureUrl: string;
  aspect: number; // width / height of the figure image
}

export interface FilmLayer {
  depth: "sky" | "mist" | "near";
  url: string;
  provider?: string;
}

export interface FilmObject {
  name: string;
  depth: "far" | "mid" | "near";
  x: number;
  scale: number;
  floating: boolean;
  url: string;
  aspect: number;
}

export interface FilmBeat {
  t: number;
  castId: string;
  action: BeatKind;
  toX?: number | null;
  duration: number;
  emotion?: string;
}

export interface FilmSpeech {
  castId: string; // "narrator" for narration
  text: string;
  startTime: number;
  duration: number;
  audioUrl: string;
  wordTimings: WordTiming[];
}

export interface FilmEffect {
  type: EffectKind;
  at: number;
  duration: number;
}

export interface FilmScene {
  index: number;
  sceneId: number;
  heading: string;
  setting: string;
  settingKind: string;
  mood: string;
  timeOfDay: string;
  source: "llm" | "fallback";
  startTime: number;
  duration: number;
  endTime: number;
  transitionIn: TransitionKind;
  camera: CameraMove;
  layers: FilmLayer[];
  objects: FilmObject[];
  characters: { castId: string; x: number; facing: 1 | -1 }[];
  beats: FilmBeat[];
  speeches: FilmSpeech[];
  narration?: string | null;
  effects: FilmEffect[];
  ambient?: string;
  ambientUrl?: string;
}

export interface FilmManifest {
  version: 2;
  renderId?: string;
  dreamId: string;
  versionId?: string | null;
  title: string;
  styleId: string;
  palette: Record<string, string>;
  totalDuration: number;
  provenance?: { director: string; imageProvider: string; images: Record<string, number> };
  cast: FilmCast[];
  scenes: FilmScene[];
  stale?: boolean;
}
