import * as THREE from "three";
import { NOCTURNE_STYLE } from "./config-loader";
import { DreamTerrain } from "./world/terrain";
import { DreamSky } from "./world/sky";
import { DreamProps } from "./world/props";
import { DreamEffectsManager } from "./world/effects/effects-manager";
import { DreamWeatherSystem } from "./world/weather";
import { DreamActor } from "./cast/actor";
import { DirectorCamera } from "./camera/director-camera";
import { DreamAudioEngine } from "./audio/ambient-bed";
import { DreamSpeechSynthesizer } from "./audio/speech-synth";
import { VideoExporter } from "./export/video-exporter";
import { TimelineEngine, SceneManifest } from "./timeline";
import { DirectorScript, AllowedEmotion, AnimateClip } from "./types/director";
import spikeScript from "../../../samples/spike.director.json";

export class DreamPlayer {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private cameraController: DirectorCamera;

  private terrain: DreamTerrain;
  private sky: DreamSky;
  private props: DreamProps;
  private effects: DreamEffectsManager;
  private weather: DreamWeatherSystem;
  private actor: DreamActor;
  private audio: DreamAudioEngine;
  private speech: DreamSpeechSynthesizer;

  // Timeline state
  private manifest: SceneManifest;
  private isPlaying = false;
  private currentTime = 0.0;
  private lastRafTime = 0;
  private currentSceneIndex = -1;
  private lastPlayedSpeechKey = "";

  // Performance HUD
  private frameCount = 0;
  private lastFpsTime = performance.now();
  private fpsValEl: HTMLElement | null;
  private shotValEl: HTMLElement | null;
  private sceneValEl: HTMLElement | null;
  private captionEl: HTMLElement | null;

  // UI elements
  private playBtn: HTMLButtonElement | null;
  private soundBtn: HTMLButtonElement | null;
  private timeSlider: HTMLInputElement | null;
  private currentTimeEl: HTMLElement | null;
  private exportBtn: HTMLButtonElement | null;
  private exportProgressEl: HTMLElement | null;
  private exportStatusEl: HTMLElement | null;
  private exportPercentEl: HTMLElement | null;
  private progressFillEl: HTMLElement | null;

  constructor() {
    this.canvas = document.getElementById("dream-canvas") as HTMLCanvasElement;
    this.fpsValEl = document.getElementById("fps-val");
    this.shotValEl = document.getElementById("shot-val");
    this.sceneValEl = document.getElementById("scene-val");
    this.captionEl = document.getElementById("caption-text");

    this.playBtn = document.getElementById("play-pause-btn") as HTMLButtonElement;
    this.soundBtn = document.getElementById("sound-btn") as HTMLButtonElement;
    this.timeSlider = document.getElementById("time-slider") as HTMLInputElement;
    this.currentTimeEl = document.getElementById("current-time");
    this.exportBtn = document.getElementById("export-btn") as HTMLButtonElement;
    this.exportProgressEl = document.getElementById("export-progress-bar");
    this.exportStatusEl = document.getElementById("export-status");
    this.exportPercentEl = document.getElementById("export-percent");
    this.progressFillEl = document.getElementById("progress-fill");

    // 1. Compile initial manifest (defaults to spikeScript until host provides dynamic script)
    this.manifest = TimelineEngine.compileScriptToManifest(spikeScript as unknown as DirectorScript);
    console.log(`Loaded initial manifest: "${this.manifest.title}" (${this.manifest.scenes.length} scenes, ${this.manifest.totalDuration.toFixed(1)}s)`);

    // 2. Initialize Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // 3. Initialize Scene & Exponential Fog (Forest Night)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(NOCTURNE_STYLE.palette.void);
    this.scene.fog = new THREE.FogExp2(NOCTURNE_STYLE.fog.color, NOCTURNE_STYLE.fog.density);

    // 4. Initialize Lighting
    const ambientLight = new THREE.AmbientLight(
      NOCTURNE_STYLE.lighting.ambientColor,
      NOCTURNE_STYLE.lighting.ambientIntensity
    );
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(
      NOCTURNE_STYLE.lighting.keyColor,
      NOCTURNE_STYLE.lighting.keyIntensity
    );
    keyLight.position.set(
      NOCTURNE_STYLE.lighting.keyPos[0],
      NOCTURNE_STYLE.lighting.keyPos[1],
      NOCTURNE_STYLE.lighting.keyPos[2]
    );
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(
      NOCTURNE_STYLE.lighting.fillColor,
      NOCTURNE_STYLE.lighting.fillIntensity
    );
    fillLight.position.set(-3.0, 2.0, -2.0);
    this.scene.add(fillLight);

    // 5. Instantiate World Modules
    this.terrain = new DreamTerrain();
    this.scene.add(this.terrain.mesh);

    this.sky = new DreamSky();
    this.scene.add(this.sky.group);

    this.props = new DreamProps();
    this.scene.add(this.props.group);

    this.effects = new DreamEffectsManager();
    this.scene.add(this.effects.group);

    this.weather = new DreamWeatherSystem();
    this.scene.add(this.weather.group);

    // 6. Instantiate Cast & Camera
    this.actor = new DreamActor();
    this.scene.add(this.actor.group);
    this.effects.bindTargets(this.props.group, this.actor.group);

    this.cameraController = new DirectorCamera(window.innerWidth / window.innerHeight);

    // 7. Audio & Speech
    this.audio = new DreamAudioEngine();
    this.speech = new DreamSpeechSynthesizer();
    this.speech.isMuted = this.audio.isMuted;

    if (this.soundBtn) {
      this.soundBtn.innerText = this.audio.isMuted ? "🔇 Sound: OFF" : "🔊 Sound: ON";
      if (this.audio.isMuted) {
        this.soundBtn.classList.add("muted");
      } else {
        this.soundBtn.classList.remove("muted");
      }
    }

    // Setup initial state from Scene 1
    this.seek(0.0);

    // Bind event handlers
    this.setupEventListeners();
    this.setupPostMessageBridge();

    // Start RAF render loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  public loadScript(script: DirectorScript, audioDurations?: Record<string, number>) {
    this.manifest = TimelineEngine.compileScriptToManifest(script, audioDurations);
    this.currentSceneIndex = -1;
    this.seek(0.0);
    console.log(`Loaded dynamic script: "${this.manifest.title}" (${this.manifest.scenes.length} scenes, ${this.manifest.totalDuration.toFixed(1)}s)`);
  }

  public loadManifest(manifest: SceneManifest) {
    this.manifest = manifest;
    this.currentSceneIndex = -1;
    this.seek(0.0);
    console.log(`Loaded pre-compiled manifest: "${this.manifest.title}" (${this.manifest.totalDuration.toFixed(1)}s)`);
  }

  private setupEventListeners() {
    window.addEventListener("resize", () => {
      this.cameraController.onResize(window.innerWidth / window.innerHeight);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.playBtn?.addEventListener("click", () => {
      this.togglePlay();
    });

    document.getElementById("restart-btn")?.addEventListener("click", () => {
      this.seek(0.0);
      if (!this.isPlaying) this.togglePlay();
    });

    this.soundBtn?.addEventListener("click", () => {
      this.toggleSound();
    });

    this.timeSlider?.addEventListener("input", (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.seek(val);
    });

    this.exportBtn?.addEventListener("click", () => {
      this.exportVideo();
    });
  }

  private setupPostMessageBridge() {
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      switch (data.type) {
        case "LOAD_SCRIPT":
          if (data.script) this.loadScript(data.script, data.audioDurations);
          break;
        case "LOAD_MANIFEST":
          if (data.manifest) this.loadManifest(data.manifest);
          break;
        case "PLAY":
          if (!this.isPlaying) this.togglePlay();
          break;
        case "PAUSE":
          if (this.isPlaying) this.togglePlay();
          break;
        case "SEEK":
          if (typeof data.time === "number") this.seek(data.time);
          break;
        case "EXPORT":
          this.exportVideo();
          break;
      }
    });
  }

  private notifyParentStatus(evalState: any) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: "PLAYER_STATUS",
          currentTime: this.currentTime,
          totalDuration: this.manifest.totalDuration,
          sceneIndex: evalState.sceneIndex,
          currentShot: evalState.activeCameraShot,
          activeSubtitle: evalState.activeSubtitle,
          isPlaying: this.isPlaying,
        },
        "*"
      );
    }
  }

  private togglePlay() {
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
      this.lastPlayedSpeechKey = "";
      if (!this.audio.isMuted) {
        this.audio.init();
        this.audio.resume();
      }
    } else {
      this.speech.stop();
    }

    if (this.playBtn) {
      this.playBtn.innerText = this.isPlaying ? "❚❚ Pause" : "▶ Play";
    }

    if (this.isPlaying && this.currentTime >= this.manifest.totalDuration) {
      this.seek(0.0);
    }
  }

  private toggleSound() {
    const isMuted = this.audio.toggleMute();
    this.speech.isMuted = isMuted;
    if (isMuted) {
      this.speech.stop();
    } else {
      if (this.isPlaying) {
        this.lastPlayedSpeechKey = "";
      }
    }

    if (this.soundBtn) {
      this.soundBtn.innerText = isMuted ? "🔇 Sound: OFF" : "🔊 Sound: ON";
      if (isMuted) {
        this.soundBtn.classList.add("muted");
      } else {
        this.soundBtn.classList.remove("muted");
      }
    }
  }

  public seek(targetTime: number) {
    this.speech.stop();
    this.lastPlayedSpeechKey = "";
    this.currentTime = Math.max(0.0, Math.min(this.manifest.totalDuration, targetTime));
    if (this.timeSlider) {
      this.timeSlider.max = this.manifest.totalDuration.toString();
      this.timeSlider.value = this.currentTime.toString();
    }
    this.updateHUDTime();

    // Evaluate manifest state at exact timestamp
    this.evaluateManifest(this.currentTime, true);
  }

  private evaluateManifest(t: number, isSeek = false) {
    const evalState = TimelineEngine.evaluateAtTime(this.manifest, t);
    const scene = evalState.currentScene;

    // 1. Scene Switch Handling
    if (this.currentSceneIndex !== evalState.sceneIndex || isSeek) {
      this.currentSceneIndex = evalState.sceneIndex;

      // Update World Kit, anchors, and props
      this.props.setWorldKit(scene.world.kit, scene.world.props);
      this.effects.setSceneEffects(scene.world.effects);
      this.weather.setWeather(scene.world.weather);
      this.effects.bindTargets(this.props.group, this.actor.group);

      // Spawn actor at initial anchor
      const defaultActor = scene.cast[0];
      if (defaultActor) {
        const spawnPos = this.props.anchors[defaultActor.spawn] || this.props.anchors.center || new THREE.Vector3();
        this.actor.teleport(spawnPos);
        this.actor.setFaceVisibility(defaultActor.faceVisibility);
      }

      // Set initial camera shot
      const anchorPos = this.actor.group.position;
      this.cameraController.setShot(evalState.activeCameraShot, anchorPos, t, scene.transitionIn);

      // Update ambient audio preset
      this.audio.setAmbientPreset(scene.ambient);

      if (this.sceneValEl) {
        this.sceneValEl.innerText = `${scene.index + 1}/${this.manifest.scenes.length}`;
      }
    }

    // 2. Continuous Camera Update
    if (this.shotValEl) {
      this.shotValEl.innerText = evalState.activeCameraShot;
    }
    this.cameraController.update(t, this.actor.group.position);

    // 3. Actor Gestures & Locomotion
    const defaultActor = scene.cast[0];
    if (defaultActor) {
      const actorAction = evalState.activeActorActions[defaultActor.name] || { action: "idle", args: {} };
      if (actorAction.action === "walk_to" || actorAction.action === "run_to") {
        const destAnchor = (actorAction.args?.anchor as string) || "center";
        const targetPos = this.props.anchors[destAnchor] || new THREE.Vector3();
        this.actor.walkTo(targetPos, scene.startTime, scene.duration, actorAction.action === "run_to");
      } else {
        this.actor.playAction(actorAction.action as AnimateClip);
      }

      if (actorAction.args?.emotion) {
        this.actor.setEmotion(actorAction.args.emotion as AllowedEmotion);
      }
      if (actorAction.args?.look_at) {
        const lookAnchor = this.props.anchors[actorAction.args.look_at as string];
        if (lookAnchor) this.actor.setLookAt(lookAnchor);
      }
    }

    // 4. Effects & Weather Update
    this.effects.update(evalState.localSceneTime, t);

    // 5. Speech & Audio Ducking
    this.audio.setSpeechDucking(evalState.isSpeechActive);
    this.audio.setMotif(evalState.activeMotif);

    if (this.isPlaying && evalState.isSpeechActive && evalState.activeSpeech) {
      const speechKey = `${evalState.activeSpeech.startTime}_${evalState.activeSpeech.text}`;
      if (this.lastPlayedSpeechKey !== speechKey) {
        this.lastPlayedSpeechKey = speechKey;
        this.actor.speak(
          evalState.activeSpeech.text,
          evalState.activeSpeech.startTime,
          evalState.activeSpeech.duration,
          evalState.activeSpeech.wordTimings
        );
        if (!this.audio.isMuted) {
          this.speech.speak(
            evalState.activeSpeech.text,
            evalState.activeSpeech.audioUrl
          );
        }
      }
    } else if (!evalState.isSpeechActive) {
      this.lastPlayedSpeechKey = "";
    }

    // 6. Subtitles & HUD Update
    this.setCaption(evalState.activeSubtitle);
    this.notifyParentStatus(evalState);
  }

  private setCaption(text: string) {
    if (!this.captionEl) return;
    if (text) {
      this.captionEl.innerText = text;
      this.captionEl.style.opacity = "1";
    } else {
      this.captionEl.style.opacity = "0";
    }
  }

  private updateHUDTime() {
    if (!this.currentTimeEl) return;
    const curM = Math.floor(this.currentTime / 60);
    const curS = Math.floor(this.currentTime % 60);
    const totM = Math.floor(this.manifest.totalDuration / 60);
    const totS = Math.floor(this.manifest.totalDuration % 60);
    this.currentTimeEl.innerText = `${curM}:${curS.toString().padStart(2, "0")} / ${totM}:${totS.toString().padStart(2, "0")}`;

    if (this.progressFillEl) {
      const pct = (this.currentTime / Math.max(1, this.manifest.totalDuration)) * 100;
      this.progressFillEl.style.width = `${pct}%`;
    }
  }

  private updateFPS() {
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      if (this.fpsValEl) this.fpsValEl.innerText = fps.toString();
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
  }

  private animate(now: number) {
    requestAnimationFrame(this.animate);

    if (this.lastRafTime === 0) this.lastRafTime = now;
    const deltaSeconds = Math.min(0.1, (now - this.lastRafTime) / 1000);
    this.lastRafTime = now;

    if (this.isPlaying) {
      this.currentTime += deltaSeconds;
      if (this.currentTime >= this.manifest.totalDuration) {
        this.currentTime = this.manifest.totalDuration;
        this.isPlaying = false;
        if (this.playBtn) this.playBtn.innerText = "▶ Play";
      }

      if (this.timeSlider) this.timeSlider.value = this.currentTime.toString();
      this.updateHUDTime();
      this.evaluateManifest(this.currentTime, false);
    }

    this.actor.update(this.currentTime);
    this.props.update(this.currentTime);
    this.weather.update(deltaSeconds, this.currentTime);
    this.audio.update(this.currentTime);

    this.renderer.render(this.scene, this.cameraController.camera);
    this.updateFPS();
  }

  public async exportVideo() {
    if (this.isPlaying) this.togglePlay();

    if (this.exportBtn) this.exportBtn.disabled = true;
    if (this.exportProgressEl) this.exportProgressEl.classList.remove("hidden");
    if (this.exportStatusEl) this.exportStatusEl.innerText = "Rendering frames deterministically...";

    try {
      const blob = await VideoExporter.exportScene(
        this.canvas,
        this.manifest.totalDuration,
        (t) => {
          this.evaluateManifest(t, true);
          this.actor.update(t);
          this.renderer.render(this.scene, this.cameraController.camera);
        },
        (t) => TimelineEngine.evaluateAtTime(this.manifest, t).activeSubtitle,
        (progress, stage) => {
          const pct = Math.round(progress * 100);
          if (this.exportPercentEl) this.exportPercentEl.innerText = `${pct}%`;
          if (this.exportStatusEl) this.exportStatusEl.innerText = `${stage} (${pct}%)`;
        }
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${this.manifest.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_sanctum.mp4`;
      a.click();
      URL.revokeObjectURL(url);

      if (this.exportStatusEl) this.exportStatusEl.innerText = "Export Complete!";
    } catch (err: any) {
      console.error("Export failed:", err);
      if (this.exportStatusEl) this.exportStatusEl.innerText = `Export Failed: ${err.message}`;
    } finally {
      if (this.exportBtn) this.exportBtn.disabled = false;
    }
  }
}

// Auto-boot player on window load
window.addEventListener("DOMContentLoaded", () => {
  (window as any).__dreamPlayer = new DreamPlayer();
});
