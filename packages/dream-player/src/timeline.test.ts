import test from "node:test";
import assert from "node:assert/strict";
import { TimelineEngine } from "./timeline.ts";
import { DirectorScript } from "./types/director.ts";
import { RENDER_CONFIG } from "./config-loader.ts";
import { WORLD_KIT_ANCHORS } from "./world/props.ts";

const mockScript: DirectorScript = {
  title: "The Bell of Glass",
  style_id: "nocturne_toon",
  scenes: [
    {
      scene_id: 1,
      transition_in: "dissolve",
      world: {
        kit: "water",
        sky: "night_halo",
        light: "moonlit",
        weather: "snow",
        props: [{ id: "lantern_post", anchor: "shore" }],
        effects: [{ type: "flood", at: 1.0, duration: 3.0 }],
      },
      cast: [
        { name: "Traveler", spawn: "origin", face_visibility: "shadowed" }
      ],
      beats: [
        { t: 0.0, actor: "camera", action: "shot", args: { preset: "wide" } },
        { t: 0.5, actor: "Traveler", action: "speak", args: { line: "The tide is speaking." } },
        { t: 3.0, actor: "Traveler", action: "walk_to", args: { target: "shore", speed: "slow" } },
        { t: 4.5, actor: "camera", action: "shot", args: { preset: "tracking" } },
      ],
      narration: "A dream submerged under cold glass.",
      ambient: "underwater_hum",
      sound_motif: "bell_chime",
    },
    {
      scene_id: 2,
      transition_in: "morph",
      world: {
        kit: "corridor",
        sky: "storm_violet",
        light: "lantern_amber",
        weather: "rain",
      },
      cast: [
        { name: "Traveler", spawn: "door", face_visibility: "full" }
      ],
      beats: [
        { t: 0.0, actor: "camera", action: "shot", args: { preset: "hero_low" } },
        { t: 1.0, actor: "Traveler", action: "speak", args: { line: "Every door is locked." } },
      ],
      ambient: "institutional_drone",
    }
  ]
};

test("TimelineEngine compiles script into deterministic audio-first manifest", () => {
  const manifest = TimelineEngine.compileScriptToManifest(mockScript);

  assert.equal(manifest.title, "The Bell of Glass");
  assert.equal(manifest.styleId, "nocturne_toon");
  assert.equal(manifest.scenes.length, 2);

  // Scene 1 assertions
  const s1 = manifest.scenes[0];
  assert.equal(s1.sceneId, 1);
  assert.equal(s1.startTime, 0.0);
  assert.ok(s1.duration >= TimelineEngine.MIN_SCENE_DURATION);
  assert.ok(s1.duration <= TimelineEngine.MAX_SCENE_DURATION);
  assert.equal(s1.endTime, s1.startTime + s1.duration);
  assert.equal(s1.world.kit, "water");
  assert.equal(s1.world.weather, "snow");
  assert.equal(s1.ambient, "underwater_hum");
  assert.equal(s1.soundMotif, "bell_chime");
  assert.equal(s1.speeches.length, 2); // Traveler speak + narration

  // Scene 2 assertions
  const s2 = manifest.scenes[1];
  assert.equal(s2.sceneId, 2);
  assert.equal(s2.startTime, s1.endTime);
  assert.equal(s2.world.kit, "corridor");
  assert.equal(s2.world.weather, "rain");
  assert.equal(s2.ambient, "institutional_drone");
  assert.equal(manifest.totalDuration, s2.endTime);
});

test("TimelineEngine respects custom audio durations for exact beat sync", () => {
  const customDurations = {
    scene_1_Traveler_speak: 4.8,
    scene_1_narration: 5.2,
  };

  const manifest = TimelineEngine.compileScriptToManifest(mockScript, customDurations);
  const s1 = manifest.scenes[0];

  const travelerSpeech = s1.speeches.find((s) => s.actor === "Traveler");
  assert.ok(travelerSpeech);
  assert.equal(travelerSpeech?.duration, 4.8);

  const narrationSpeech = s1.speeches.find((s) => s.actor === "narrator");
  assert.ok(narrationSpeech);
  assert.equal(narrationSpeech?.duration, 5.2);
});

test("TimelineEngine evaluates scene states deterministically during scrub", () => {
  const manifest = TimelineEngine.compileScriptToManifest(mockScript);

  // t = 0.0 (Scene 1 start)
  const eval0 = TimelineEngine.evaluateAtTime(manifest, 0.0);
  assert.equal(eval0.sceneIndex, 0);
  assert.equal(eval0.currentScene.sceneId, 1);
  assert.equal(eval0.activeCameraShot, "wide");
  assert.equal(eval0.ambientPreset, "underwater_hum");

  // t = 0.8 (Traveler speaking)
  const eval1 = TimelineEngine.evaluateAtTime(manifest, 0.8);
  assert.equal(eval1.isSpeechActive, true);
  assert.equal(eval1.activeSubtitle, "The tide is speaking.");

  // Evaluate at Scene 2 start
  const s2Start = manifest.scenes[1].startTime;
  const evalS2 = TimelineEngine.evaluateAtTime(manifest, s2Start + 0.2);
  assert.equal(evalS2.sceneIndex, 1);
  assert.equal(evalS2.currentScene.sceneId, 2);
  assert.equal(evalS2.isMidTransition, true); // Scene 2 has morph transition
  assert.ok(evalS2.transitionProgress > 0 && evalS2.transitionProgress <= 1.0);
  assert.equal(evalS2.activeCameraShot, "hero_low");
  assert.equal(evalS2.ambientPreset, "institutional_drone");
});

test("RENDER_CONFIG defines all 9 camera shots from production specification", () => {
  const requiredShots = [
    "wide",
    "two_shot",
    "close_up",
    "hero_low",
    "over_shoulder",
    "top_down",
    "dolly_in",
    "tracking",
    "orbit",
  ];

  for (const shot of requiredShots) {
    const preset = RENDER_CONFIG.shots[shot];
    assert.ok(preset, `Preset ${shot} must be defined in RENDER_CONFIG.shots`);
    assert.ok(typeof preset.fov === "number" && preset.fov > 10 && preset.fov < 120);
    assert.ok(typeof preset.distance === "number" && preset.distance > 0);
    assert.ok(Array.isArray(preset.targetOffset) && preset.targetOffset.length === 3);
  }
});

test("WORLD_KIT_ANCHORS specifies positions for all 7 world kits", () => {
  const kits = ["field", "corridor", "water", "city", "void", "forest", "interior"];

  for (const kit of kits) {
    const anchors = WORLD_KIT_ANCHORS[kit];
    assert.ok(anchors, `Anchors for kit ${kit} must exist`);
    assert.ok(anchors["origin"], `Kit ${kit} must have an origin anchor`);
  }
});
