import test from "node:test";
import assert from "node:assert/strict";
import {
  sceneIndexAt,
  transitionAt,
  blackoutAt,
  cameraAt,
  characterStateAt,
  captionAt,
  effectLevel,
} from "./film-timeline.ts";
import type { FilmManifest, FilmScene } from "./types.ts";

function scene(partial: Partial<FilmScene> & { index: number; startTime: number; duration: number }): FilmScene {
  return {
    sceneId: partial.index + 1,
    heading: "h",
    setting: "s",
    settingKind: "void",
    mood: "wonder",
    timeOfDay: "night",
    source: "fallback",
    endTime: partial.startTime + partial.duration,
    transitionIn: "dissolve",
    camera: "drift",
    layers: [],
    objects: [],
    characters: [],
    beats: [],
    speeches: [],
    effects: [],
    ...partial,
  } as FilmScene;
}

const s0 = scene({
  index: 0,
  startTime: 0,
  duration: 10,
  camera: "push_in",
  characters: [
    { castId: "dreamer", x: -0.5, facing: 1 },
    { castId: "arjun", x: 0.5, facing: -1 },
  ],
  beats: [
    { t: 0.2, castId: "dreamer", action: "enter", duration: 1 },
    { t: 0.65, castId: "arjun", action: "enter", duration: 1 },
    { t: 2.0, castId: "dreamer", action: "walk", toX: 0.1, duration: 2 },
    { t: 8.0, castId: "arjun", action: "exit", duration: 1 },
  ],
  speeches: [
    {
      castId: "arjun",
      text: "You are always late.",
      startTime: 4.5,
      duration: 2.0,
      audioUrl: "/a.wav",
      wordTimings: [
        { word: "You", start: 0.1, end: 0.3 },
        { word: "are", start: 0.4, end: 0.6 },
        { word: "always", start: 0.7, end: 1.1 },
        { word: "late.", start: 1.2, end: 1.8 },
      ],
    },
  ],
  effects: [{ type: "flood", at: 3, duration: 4 }, { type: "rain", at: 1, duration: 3 }],
});
const s1 = scene({ index: 1, startTime: 10, duration: 8, transitionIn: "dissolve", camera: "pan_left" });
const s2 = scene({ index: 2, startTime: 18, duration: 6, transitionIn: "cut" });

const manifest: FilmManifest = {
  version: 2,
  dreamId: "d",
  title: "T",
  styleId: "ink_wash",
  palette: {},
  totalDuration: 24,
  cast: [
    { castId: "dreamer", name: "You", description: "", visibility: "shadowed", returning: false, kind: "human", height: 1, figureUrl: "", aspect: 0.4 },
    { castId: "arjun", name: "Arjun", description: "", visibility: "full", returning: true, kind: "human", height: 1, figureUrl: "", aspect: 0.4 },
  ],
  scenes: [s0, s1, s2],
};

test("scene lookup follows absolute start times", () => {
  assert.equal(sceneIndexAt(manifest, 0), 0);
  assert.equal(sceneIndexAt(manifest, 9.99), 0);
  assert.equal(sceneIndexAt(manifest, 10), 1);
  assert.equal(sceneIndexAt(manifest, 23), 2);
});

test("transitions: opening fades from black, dissolves blend, cuts are instant", () => {
  const open = transitionAt(manifest, 0.3);
  assert.equal(open?.kind, "fade_black");
  assert.ok(blackoutAt(manifest, 0.05) > 0.9);
  assert.ok(blackoutAt(manifest, 3) === 0);
  const mid = transitionAt(manifest, 10.6);
  assert.equal(mid?.from, 0);
  assert.equal(mid?.to, 1);
  assert.ok(mid!.k > 0 && mid!.k < 1);
  assert.equal(transitionAt(manifest, 18.1), null);
  assert.ok(blackoutAt(manifest, 23.95) > 0.9, "film fades out at the end");
});

test("camera moves are continuous and directional", () => {
  const a = cameraAt(s0, 0);
  const b = cameraAt(s0, 10);
  assert.equal(a.z, 0);
  assert.ok(b.z < -3);
  const p0 = cameraAt(s1, 10);
  const p1 = cameraAt(s1, 18);
  assert.ok(p0.x > 0 && p1.x < 0, "pan_left travels right to left");
});

test("characters enter, walk, face the speaker and exit", () => {
  assert.equal(characterStateAt(s0, "arjun", 0.1).visible, false);
  assert.ok(characterStateAt(s0, "dreamer", 1.5).opacity > 0.99);
  const walking = characterStateAt(s0, "dreamer", 3.0);
  assert.equal(walking.walking, true);
  assert.ok(walking.x > -0.5 && walking.x < 0.1);
  assert.equal(walking.facing, 1);
  const arrived = characterStateAt(s0, "dreamer", 4.6);
  assert.ok(Math.abs(arrived.x - 0.1) < 1e-6);
  assert.equal(characterStateAt(s0, "arjun", 5).speaking, true);
  assert.equal(characterStateAt(s0, "dreamer", 5).speaking, false);
  assert.equal(characterStateAt(s0, "dreamer", 5).facing, 1, "listener faces the speaker on the right");
  assert.ok(characterStateAt(s0, "arjun", 9.5).opacity < 0.05);
});

test("captions name the speaker and track the current word", () => {
  const c = captionAt(manifest, 5.3);
  assert.equal(c?.name, "Arjun");
  assert.equal(c?.words[c.activeWord], "always");
  assert.equal(captionAt(manifest, 7), null);
});

test("floods hold once risen; other effects fade", () => {
  const flood = s0.effects[0];
  const rain = s0.effects[1];
  assert.equal(effectLevel(flood, s0, 2), 0);
  assert.ok(effectLevel(flood, s0, 9.9) > 0.99);
  assert.ok(effectLevel(rain, s0, 3) > 0.5);
  assert.ok(effectLevel(rain, s0, 9.5) < 0.05);
});
