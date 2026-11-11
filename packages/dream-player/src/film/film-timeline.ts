/**
 * Pure, deterministic timeline maths for the 2.5D film player.
 * Everything here is a function of (manifest, time) so playback, scrubbing and export
 * all agree frame-for-frame. No three.js, no DOM — unit tested in film-timeline.test.ts.
 */

import type { FilmManifest, FilmScene, FilmSpeech, FilmEffect, CameraMove } from "./types";

export const TRANSITION_SECONDS = 1.2;

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (v: number) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export function sceneIndexAt(m: FilmManifest, t: number): number {
  if (!m.scenes.length) return -1;
  let idx = 0;
  for (let i = 0; i < m.scenes.length; i++) {
    if (m.scenes[i].startTime <= t + 1e-6) idx = i;
  }
  return idx;
}

export interface TransitionState {
  from: number;
  to: number;
  kind: FilmScene["transitionIn"];
  k: number; // 0 -> 1 progress of the incoming scene
}

/** Transition at the head of a scene (the opening scene fades in from black). */
export function transitionAt(m: FilmManifest, t: number): TransitionState | null {
  const i = sceneIndexAt(m, t);
  if (i < 0) return null;
  const scene = m.scenes[i];
  const local = t - scene.startTime;
  if (scene.transitionIn === "cut" && i > 0) return null;
  if (local >= TRANSITION_SECONDS) return null;
  return { from: i - 1, to: i, kind: i === 0 ? "fade_black" : scene.transitionIn, k: smooth(local / TRANSITION_SECONDS) };
}

/** Opacity of a black overlay for fade_black transitions (dips to black mid-transition). */
export function blackoutAt(m: FilmManifest, t: number): number {
  const tr = transitionAt(m, t);
  let black = 0;
  if (tr && tr.kind === "fade_black") black = tr.from < 0 ? 1 - tr.k : 1 - Math.abs(tr.k * 2 - 1);
  const tailStart = m.totalDuration - 1.5;
  if (t > tailStart) black = Math.max(black, smooth((t - tailStart) / 1.5));
  return clamp01(black);
}

export interface CameraState {
  x: number; // world units, horizontal pan
  y: number;
  z: number; // dolly; negative = closer
}

export function cameraAt(scene: FilmScene, t: number): CameraState {
  const u = smooth((t - scene.startTime) / Math.max(0.001, scene.duration));
  const move: CameraMove = scene.camera;
  switch (move) {
    case "push_in":
      return { x: 0, y: lerp(0, -0.15, u), z: lerp(0, -3.2, u) };
    case "pull_out":
      return { x: 0, y: lerp(-0.15, 0, u), z: lerp(-3.2, 0, u) };
    case "pan_left":
      return { x: lerp(1.3, -1.3, u), y: 0, z: -0.8 };
    case "pan_right":
      return { x: lerp(-1.3, 1.3, u), y: 0, z: -0.8 };
    case "still":
      return { x: 0, y: 0, z: -0.6 };
    case "drift":
    default:
      return { x: Math.sin(u * Math.PI) * 0.5, y: Math.sin(u * Math.PI * 2) * 0.06, z: lerp(-0.4, -1.4, u) };
  }
}

export function speechAt(scene: FilmScene, t: number): FilmSpeech | null {
  for (const s of scene.speeches) {
    if (t >= s.startTime && t < s.startTime + s.duration) return s;
  }
  return null;
}

export interface CharacterState {
  visible: boolean;
  opacity: number;
  x: number; // -1 .. 1 stage coordinates
  walking: boolean;
  speaking: boolean;
  gesture: number; // 0..1 bump
  facing: 1 | -1;
}

export function characterStateAt(scene: FilmScene, castId: string, t: number): CharacterState {
  const staged = scene.characters.find((c) => c.castId === castId);
  const beats = scene.beats.filter((b) => b.castId === castId).sort((a, b) => a.t - b.t);
  let x = staged ? staged.x : 0;
  let facing: 1 | -1 = staged ? staged.facing : 1;
  let opacity = 1;
  let walking = false;
  let gesture = 0;

  const enter = beats.find((b) => b.action === "enter");
  if (enter) opacity = smooth((t - enter.t) / 0.8);

  for (const b of beats) {
    if (b.action === "walk" && typeof b.toX === "number") {
      if (t < b.t) continue;
      const k = smooth((t - b.t) / Math.max(0.1, b.duration));
      const from = x;
      x = lerp(from, b.toX, k);
      if (k > 0 && k < 1) {
        walking = true;
        facing = b.toX >= from ? 1 : -1;
      }
    } else if (b.action === "exit" && t >= b.t) {
      opacity = Math.min(opacity, 1 - smooth((t - b.t) / Math.max(0.3, b.duration)));
    } else if (b.action === "gesture" && t >= b.t && t < b.t + b.duration) {
      gesture = Math.sin(((t - b.t) / b.duration) * Math.PI);
    } else if (b.action === "turn" && t >= b.t) {
      facing = facing === 1 ? -1 : 1;
    }
  }

  const speech = speechAt(scene, t);
  const speaking = !!speech && speech.castId === castId;

  // Listeners turn toward whoever is speaking.
  if (speech && !speaking && speech.castId !== "narrator" && !walking) {
    const speaker = scene.characters.find((c) => c.castId === speech.castId);
    if (speaker && Math.abs(speaker.x - x) > 0.05) facing = speaker.x > x ? 1 : -1;
  }

  return { visible: opacity > 0.01, opacity, x, walking, speaking, gesture, facing };
}

export interface Caption {
  castId: string;
  name: string;
  text: string;
  words: string[];
  activeWord: number;
}

export function captionAt(m: FilmManifest, t: number): Caption | null {
  const i = sceneIndexAt(m, t);
  if (i < 0) return null;
  const speech = speechAt(m.scenes[i], t);
  if (!speech) return null;
  const local = t - speech.startTime;
  let active = -1;
  speech.wordTimings.forEach((w, idx) => {
    if (local >= w.start) active = idx;
  });
  const name = speech.castId === "narrator" ? "" : m.cast.find((c) => c.castId === speech.castId)?.name ?? "";
  return {
    castId: speech.castId,
    name,
    text: speech.text,
    words: speech.wordTimings.length ? speech.wordTimings.map((w) => w.word) : speech.text.split(/\s+/),
    activeWord: active,
  };
}

/** 0..1 intensity of an effect. Floods hold once risen; others fade out after their duration. */
export function effectLevel(effect: FilmEffect, scene: FilmScene, t: number): number {
  if (t < effect.at) return 0;
  const rise = smooth((t - effect.at) / 2.5);
  if (effect.type === "flood") return rise;
  const fadeStart = Math.min(effect.at + effect.duration, scene.endTime - 1.0);
  return rise * (1 - smooth((t - fadeStart) / 1.5));
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
