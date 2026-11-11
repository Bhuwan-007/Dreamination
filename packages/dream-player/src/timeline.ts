/**
 * Deterministic Timeline and Manifest Engine for The Dream Machine.
 * Resolves Director Scripts into exact audio-first timelines (Architecture.md §6.6).
 */

import { DirectorScript, Beat, WorldEffectType, WeatherType, TransitionType } from "./types/director";

export interface WordTiming {
  word: string;
  start: number;
  end: number;
  viseme?: "aa" | "E" | "I" | "O" | "U" | "neutral";
}

export interface SpeechManifest {
  actor: string;
  text: string;
  startTime: number;
  duration: number;
  audioUrl?: string;
  wordTimings?: WordTiming[];
}

export interface TimedBeat extends Beat {
  absoluteTime: number;
  duration: number;
}

export interface ManifestScene {
  sceneId: number;
  index: number;
  startTime: number;
  duration: number;
  endTime: number;
  transitionIn: TransitionType;
  world: {
    kit: string;
    sky: string;
    light: string;
    fog: { density: number; color: string };
    weather: WeatherType;
    props: Array<{ id: string; anchor: string }>;
    effects: Array<{ type: WorldEffectType; at: number; duration: number; parameters?: Record<string, unknown> }>;
  };
  cast: Array<{
    entityId?: string | null;
    name: string;
    spawn: string;
    faceVisibility: "full" | "shadowed" | "hidden";
  }>;
  beats: TimedBeat[];
  speeches: SpeechManifest[];
  narration: string | null;
  ambient: string;
  soundMotif: string | null;
}

export interface SceneManifest {
  title: string;
  styleId: string;
  totalDuration: number;
  scenes: ManifestScene[];
}

export interface TimelineEvaluation {
  currentTime: number;
  totalDuration: number;
  sceneIndex: number;
  currentScene: ManifestScene;
  localSceneTime: number;
  isMidTransition: boolean;
  transitionProgress: number; // 0.0 to 1.0
  activeCameraShot: string;
  activeActorActions: Record<
    string,
    {
      action: string;
      args: Record<string, unknown>;
      progress: number;
    }
  >;
  activeSubtitle: string;
  isSpeechActive: boolean;
  activeSpeech?: SpeechManifest | null;
  ambientPreset: string;
  activeMotif: string | null;
}

export class TimelineEngine {
  public static readonly MIN_SCENE_DURATION = 3.5; // seconds
  public static readonly MAX_SCENE_DURATION = 12.0; // seconds
  public static readonly TRANSITION_DURATION = 1.0; // seconds

  /**
   * Compiles a validated DirectorScript into a deterministic, audio-first SceneManifest.
   * If real audio durations are provided, beats snap to real speech waveforms;
   * otherwise deterministic syllable pacing is used.
   */
  public static compileScriptToManifest(
    script: DirectorScript,
    audioDurations?: Record<string, number>
  ): SceneManifest {
    let cursorTime = 0.0;
    const compiledScenes: ManifestScene[] = [];

    for (let sIdx = 0; sIdx < script.scenes.length; sIdx++) {
      const rawScene = script.scenes[sIdx];
      const speeches: SpeechManifest[] = [];
      const timedBeats: TimedBeat[] = [];

      // 1. Resolve speech/narration beats and audio durations
      let maxSpeechEndTime = 0.0;
      for (const beat of rawScene.beats) {
        let beatDuration = 2.0;

        if (beat.action === "speak") {
          const line = (beat.args?.line as string) || "";
          const customKey = `scene_${rawScene.scene_id}_${beat.actor}_speak`;
          const audioDur = audioDurations?.[customKey];

          if (audioDur && audioDur > 0) {
            beatDuration = audioDur;
          } else {
            // Syllable/word pacing: roughly 0.32s per word + 0.4s pause, min 2.2s
            const wordCount = line.trim().split(/\s+/).filter(Boolean).length;
            beatDuration = Math.max(2.2, wordCount * 0.32 + 0.4);
          }

          const beatStartTime = beat.t;
          maxSpeechEndTime = Math.max(maxSpeechEndTime, beatStartTime + beatDuration);

          speeches.push({
            actor: beat.actor,
            text: line,
            startTime: cursorTime + beatStartTime,
            duration: beatDuration,
          });
        } else if (beat.action === "walk_to" || beat.action === "run_to") {
          const speed = (beat.args?.speed as string) || (beat.action === "run_to" ? "fast" : "normal");
          beatDuration = speed === "slow" ? 4.5 : speed === "fast" ? 2.0 : 3.0;
        } else if (beat.action === "shot") {
          beatDuration = typeof beat.args?.duration === "number" ? beat.args.duration : 4.0;
        }

        timedBeats.push({
          ...beat,
          absoluteTime: cursorTime + beat.t,
          duration: beatDuration,
        });
      }

      // Handle narration line if present
      if (rawScene.narration) {
        const narrKey = `scene_${rawScene.scene_id}_narration`;
        const narrDur = audioDurations?.[narrKey] || Math.max(2.5, rawScene.narration.split(/\s+/).length * 0.35);
        speeches.push({
          actor: "narrator",
          text: rawScene.narration,
          startTime: cursorTime + 0.5,
          duration: narrDur,
        });
        maxSpeechEndTime = Math.max(maxSpeechEndTime, 0.5 + narrDur);
      }

      // 2. Compute scene duration: max of speech/beats, clamped between MIN and MAX
      const naturalDuration = Math.max(maxSpeechEndTime + 0.8, this.MIN_SCENE_DURATION);
      const sceneDuration = Math.min(this.MAX_SCENE_DURATION, naturalDuration);

      const sceneStartTime = cursorTime;
      const sceneEndTime = sceneStartTime + sceneDuration;

      compiledScenes.push({
        sceneId: rawScene.scene_id,
        index: sIdx,
        startTime: sceneStartTime,
        duration: sceneDuration,
        endTime: sceneEndTime,
        transitionIn: rawScene.transition_in || (sIdx === 0 ? "dissolve" : "cut"),
        world: {
          kit: rawScene.world.kit || "void",
          sky: rawScene.world.sky || "night_halo",
          light: rawScene.world.light || "moonlit",
          fog: {
            density: rawScene.world.fog?.density ?? 0.035,
            color: rawScene.world.fog?.color ?? "#0c1c17",
          },
          weather: rawScene.world.weather || "none",
          props: rawScene.world.props || [],
          effects: rawScene.world.effects || [],
        },
        cast: (rawScene.cast || []).map((c) => ({
          entityId: c.entity_id,
          name: c.name,
          spawn: c.spawn || "center",
          faceVisibility: c.face_visibility || "shadowed",
        })),
        beats: timedBeats,
        speeches,
        narration: rawScene.narration || null,
        ambient: rawScene.ambient || "forest_whisper",
        soundMotif: rawScene.sound_motif || null,
      });

      cursorTime = sceneEndTime;
    }

    return {
      title: script.title || "The Dream Machine",
      styleId: script.style_id || "nocturne_toon",
      totalDuration: cursorTime,
      scenes: compiledScenes,
    };
  }

  /**
   * Deterministically evaluates the entire scene state at an arbitrary timestamp.
   * Enables instantaneous frame scrubbing and deterministic offline video export.
   */
  public static evaluateAtTime(manifest: SceneManifest, currentTimeSeconds: number): TimelineEvaluation {
    const t = Math.max(0.0, Math.min(manifest.totalDuration, currentTimeSeconds));

    // Find active scene
    let activeScene = manifest.scenes[0];
    let sceneIndex = 0;

    for (let i = 0; i < manifest.scenes.length; i++) {
      const s = manifest.scenes[i];
      if (t >= s.startTime && t <= s.endTime) {
        activeScene = s;
        sceneIndex = i;
        break;
      }
      if (t > s.endTime && i === manifest.scenes.length - 1) {
        activeScene = s;
        sceneIndex = i;
      }
    }

    const localTime = Math.max(0.0, t - activeScene.startTime);

    // Compute transition progress if within transition window at start of scene
    let isMidTransition = false;
    let transitionProgress = 0.0;
    if (activeScene.transitionIn !== "cut" && localTime < this.TRANSITION_DURATION && sceneIndex > 0) {
      isMidTransition = true;
      transitionProgress = Math.min(1.0, localTime / this.TRANSITION_DURATION);
    }

    // Determine active camera shot from beats
    let activeCameraShot = "wide";
    for (const b of activeScene.beats) {
      if (b.actor === "camera" && b.action === "shot" && localTime >= b.t) {
        activeCameraShot = (b.args?.preset as string) || "wide";
      }
    }

    // Determine actor actions
    const activeActorActions: Record<string, { action: string; args: Record<string, unknown>; progress: number }> = {};
    for (const actor of activeScene.cast) {
      activeActorActions[actor.name] = {
        action: "idle",
        args: {},
        progress: 0.0,
      };
    }

    for (const b of activeScene.beats) {
      if (b.actor !== "camera" && b.actor !== "world" && localTime >= b.t) {
        const elapsedSinceBeat = localTime - b.t;
        const progress = Math.min(1.0, Math.max(0.0, elapsedSinceBeat / Math.max(0.1, b.duration)));
        activeActorActions[b.actor] = {
          action: b.action,
          args: b.args || {},
          progress,
        };
      }
    }

    // Check active subtitles and speech state
    let activeSubtitle = "";
    let isSpeechActive = false;
    let activeSpeech: SpeechManifest | null = null;

    for (const sp of activeScene.speeches) {
      if (t >= sp.startTime && t <= sp.startTime + sp.duration) {
        activeSubtitle = sp.text;
        isSpeechActive = true;
        activeSpeech = sp;
        break;
      }
    }

    return {
      currentTime: t,
      totalDuration: manifest.totalDuration,
      sceneIndex,
      currentScene: activeScene,
      localSceneTime: localTime,
      isMidTransition,
      transitionProgress,
      activeCameraShot,
      activeActorActions,
      activeSubtitle,
      isSpeechActive,
      activeSpeech,
      ambientPreset: activeScene.ambient,
      activeMotif: activeScene.soundMotif,
    };
  }
}

