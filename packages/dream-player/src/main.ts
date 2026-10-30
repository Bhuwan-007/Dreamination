import * as THREE from "three";
import { NOCTURNE_STYLE } from "./config-loader";
import { DreamTerrain } from "./world/terrain";
import { DreamSky } from "./world/sky";
import { DreamProps } from "./world/props";
import { DreamFloodEffect } from "./world/effects/flood";
import { DreamActor } from "./cast/actor";
import { DirectorCamera } from "./camera/director-camera";
import { DreamAudioEngine } from "./audio/ambient-bed";
import { DreamSpeechSynthesizer } from "./audio/speech-synth";
import { VideoExporter } from "./export/video-exporter";
import spikeScript from "../../../samples/spike.director.json";

class DreamPlayer {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private cameraController: DirectorCamera;

  private terrain: DreamTerrain;
  private sky: DreamSky;
  private props: DreamProps;
  private flood: DreamFloodEffect;
  private actor: DreamActor;
  private audio: DreamAudioEngine;
  private speech: DreamSpeechSynthesizer;

  // Timeline state
  private isPlaying = false;
  private currentTime = 0.0;
  private totalDuration = 38.0;
  private lastRafTime = 0;

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

  private speechTriggered = false;

  constructor() {
    this.canvas = document.getElementById("dream-canvas") as HTMLCanvasElement;
    this.fpsValEl = document.getElementById("fps-val");
    this.shotValEl = document.getElementById("shot-val");
    this.sceneValEl = document.getElementById("scene-val");
    this.captionEl = document.getElementById("caption-text");
    console.log(`Loaded director script: "${spikeScript.title}" (${spikeScript.scenes.length} scenes)`);
    this.playBtn = document.getElementById("play-pause-btn") as HTMLButtonElement;
    this.soundBtn = document.getElementById("sound-btn") as HTMLButtonElement;
    this.timeSlider = document.getElementById("time-slider") as HTMLInputElement;
    this.currentTimeEl = document.getElementById("current-time");
    this.exportBtn = document.getElementById("export-btn") as HTMLButtonElement;
    this.exportProgressEl = document.getElementById("export-progress-bar");
    this.exportStatusEl = document.getElementById("export-status");
    this.exportPercentEl = document.getElementById("export-percent");
    this.progressFillEl = document.getElementById("progress-fill");

    // 1. Initialize Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // 2. Initialize Scene & Exponential Fog (Forest Night)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(NOCTURNE_STYLE.palette.void);
    this.scene.fog = new THREE.FogExp2(NOCTURNE_STYLE.fog.color, NOCTURNE_STYLE.fog.density);

    // 3. Initialize Lighting
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

    // 4. Instantiate World Modules
    this.terrain = new DreamTerrain();
    this.scene.add(this.terrain.mesh);

    this.sky = new DreamSky();
    this.scene.add(this.sky.group);

    this.props = new DreamProps();
    this.scene.add(this.props.group);

    this.flood = new DreamFloodEffect();
    this.scene.add(this.flood.mesh);

    // 5. Instantiate Cast & Camera
    this.actor = new DreamActor();
    this.scene.add(this.actor.group);

    this.cameraController = new DirectorCamera(window.innerWidth / window.innerHeight);

    // 6. Audio & Speech
    this.audio = new DreamAudioEngine();
    this.speech = new DreamSpeechSynthesizer();

    // Setup initial state from Scene 1
    this.seek(0.0);

    // Bind event handlers
    this.setupEventListeners();

    // Start RAF render loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
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

  private togglePlay() {
    this.isPlaying = !this.isPlaying;
    if (!this.audio.isMuted) {
      this.audio.init();
      this.audio.resume();
    }

    if (this.playBtn) {
      this.playBtn.innerText = this.isPlaying ? "❚❚ Pause" : "▶ Play";
    }

    if (this.isPlaying && this.currentTime >= this.totalDuration) {
      this.seek(0.0);
    }
  }

  private toggleSound() {
    const isMuted = this.audio.toggleMute();
    this.speech.isMuted = isMuted;
    if (isMuted) {
      this.speech.stop();
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

  public getSubtitleForTime(t: number): string {
    if (t >= 14.6 && t <= 18.8) {
      return "“The tide is rising, but none of the clocks have hands.”";
    }
    if (t >= 22.0 && t <= 32.0) {
      return "Water filled the doorway, still and warm as breath.";
    }
    return "";
  }

  public seek(targetTime: number) {
    this.currentTime = Math.max(0.0, Math.min(this.totalDuration, targetTime));
    if (this.timeSlider) this.timeSlider.value = this.currentTime.toString();
    this.updateHUDTime();

    // Reset procedural states on seek
    this.flood.reset();

    // Evaluate script at exact timestamp
    this.evaluateDirectorScript(this.currentTime, true);
  }

  private evaluateDirectorScript(t: number, isSeek = false) {
    const doorPos = this.props.anchors.door_far;
    const centerPos = this.props.anchors.center;

    // Update active caption
    this.setCaption(this.getSubtitleForTime(t));

    // --- SCENE 1: Arrival & Walk (0.0s - 12.0s) ---
    if (t < 12.0) {
      if (this.sceneValEl) this.sceneValEl.innerText = "1/4";
      this.actor.puppet.setFaceVisibility("shadowed");
      this.audio.setTicking(false);

      if (t < 2.0) {
        if (isSeek || (t >= 0.0 && t <= 0.1)) {
          this.cameraController.setShot("wide", centerPos, t, "dissolve");
          this.actor.teleport(doorPos, centerPos);
        }
      } else {
        if (isSeek || (t >= 2.0 && t <= 2.1)) {
          this.cameraController.setShot("tracking", this.actor.group.position, t, "cut");
        }
      }

      // Actor walking from door_far to center (0.8s to 7.3s)
      if (t >= 0.8 && t < 7.3) {
        const progress = (t - 0.8) / 6.5;
        this.actor.group.position.lerpVectors(doorPos, centerPos, progress);
        this.actor.group.lookAt(centerPos.x, this.actor.group.position.y, centerPos.z);
        this.actor.playAction("walk", 0.8, 6.5);
        this.actor.puppet.applyWalkCycle(t, 1.0);
      } else if (t >= 7.3) {
        this.actor.group.position.copy(centerPos);
        this.actor.playAction("idle", 7.3, 4.7);
        this.actor.puppet.applyIdle(t);
      } else {
        this.actor.playAction("idle", 0.0, 0.8);
      }
    }

    // --- SCENE 2: Speech & Clocks (12.0s - 22.0s) ---
    else if (t >= 12.0 && t < 22.0) {
      if (this.sceneValEl) this.sceneValEl.innerText = "2/4";
      this.actor.group.position.copy(centerPos);
      this.actor.puppet.setFaceVisibility("full");
      this.audio.setTicking(true);

      if (t < 14.2) {
        if (isSeek || (t >= 12.0 && t <= 12.1)) {
          this.cameraController.setShot("hero_low", centerPos, t, "cut");
          this.actor.playAction("look_around", 12.0, 2.2);
        }
        this.setCaption("");
      } else {
        if (isSeek || (t >= 14.2 && t <= 14.3)) {
          this.cameraController.setShot("close_up", centerPos, t, "cut");
        }

        // Speaking beat (14.6s - 18.8s)
        const line = "The tide is rising, but none of the clocks have hands.";

        if (t >= 14.6 && t <= 18.8) {
          if (!this.audio.isMuted && !this.speechTriggered && this.isPlaying) {
            this.speech.speak(line);
            this.speechTriggered = true;
          }
          this.actor.speak(line, 14.6, 4.2);
        }
      }
    }

    // --- SCENE 3: Flood Effect & Water Rising (22.0s - 32.0s) ---
    else if (t >= 22.0 && t < 32.0) {
      if (this.sceneValEl) this.sceneValEl.innerText = "3/4";
      this.actor.puppet.setFaceVisibility("shadowed");
      this.audio.setTicking(true);
      this.speechTriggered = false;

      if (t < 25.5) {
        if (isSeek || (t >= 22.0 && t <= 22.1)) {
          this.cameraController.setShot("wide", centerPos, t, "cut");
          this.actor.playAction("reach", 24.0, 3.0);
        }
      } else {
        if (isSeek || (t >= 25.5 && t <= 25.6)) {
          this.cameraController.setShot("dolly_in", centerPos, t, "cut");
        }
      }

      // Water plane rising over 5.5s (23.0s to 28.5s)
      if (t >= 23.0 && t <= 28.5) {
        const floodProgress = (t - 23.0) / 5.5;
        this.flood.setProgress(floodProgress);
      } else if (t > 28.5) {
        this.flood.setProgress(1.0);
      }
    }

    // --- SCENE 4: Epilogue & Dissolve (32.0s - 38.0s) ---
    else {
      if (this.sceneValEl) this.sceneValEl.innerText = "4/4";
      this.audio.setTicking(false);
      this.setCaption("");
      this.flood.setProgress(1.0);

      if (t < 33.5) {
        if (isSeek || (t >= 32.0 && t <= 32.1)) {
          this.cameraController.setShot("close_up", centerPos, t, "dissolve");
        }
      } else {
        if (isSeek || (t >= 33.5 && t <= 33.6)) {
          this.cameraController.setShot("hero_low", centerPos, t, "dissolve");
          this.actor.playAction("idle", 33.5, 4.5);
        }
      }
    }

    // Update active shot HUD label
    if (this.shotValEl) {
      this.shotValEl.innerText = this.cameraController.getActiveShotName();
    }
  }

  private setCaption(text: string) {
    if (this.captionEl) {
      this.captionEl.innerText = text;
      this.captionEl.style.opacity = text ? "1" : "0";
    }
  }

  private updateHUDTime() {
    if (this.currentTimeEl) {
      const mins = Math.floor(this.currentTime / 60);
      const secs = Math.floor(this.currentTime % 60);
      this.currentTimeEl.innerText = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
  }

  private animate(rafTime: number) {
    requestAnimationFrame(this.animate);

    const delta = this.lastRafTime === 0 ? 0.016 : Math.min(0.1, (rafTime - this.lastRafTime) / 1000);
    this.lastRafTime = rafTime;

    if (this.isPlaying) {
      this.currentTime += delta;
      if (this.currentTime >= this.totalDuration) {
        this.currentTime = this.totalDuration;
        this.togglePlay();
      }

      if (this.timeSlider) this.timeSlider.value = this.currentTime.toString();
      this.updateHUDTime();

      this.evaluateDirectorScript(this.currentTime);
    }

    // Render step at current timestamp
    this.renderFrame(this.currentTime);

    // FPS calculation
    this.frameCount++;
    if (rafTime - this.lastFpsTime >= 500) {
      const fps = Math.round((this.frameCount * 1000) / (rafTime - this.lastFpsTime));
      if (this.fpsValEl) {
        this.fpsValEl.innerText = fps.toString();
      }
      this.frameCount = 0;
      this.lastFpsTime = rafTime;
    }
  }

  public renderFrame(timeSeconds: number) {
    // 1. Update actor
    this.actor.update(timeSeconds);

    // 2. Update props (floating clocks bobbing)
    const isFloating = timeSeconds >= 23.0 && timeSeconds <= 32.0;
    this.props.update(timeSeconds * 1000, isFloating);

    // 3. Update sky (slow rotation of star ring)
    this.sky.update(timeSeconds * 1000);

    // 4. Update water ripple
    this.flood.update(timeSeconds);

    // 5. Update audio sound motifs
    this.audio.update(timeSeconds);

    // 6. Update camera tracking & drift
    this.cameraController.update(timeSeconds, this.actor.group.position);

    // 7. Render Three.js scene
    this.renderer.render(this.scene, this.cameraController.camera);
  }

  private async exportVideo() {
    if (!VideoExporter.isSupported()) {
      alert("WebCodecs is not supported in this browser. Please use Chrome/Edge to export video.");
      return;
    }

    const wasPlaying = this.isPlaying;
    this.isPlaying = false;
    if (this.playBtn) this.playBtn.innerText = "▶ Play";

    if (this.exportProgressEl) this.exportProgressEl.classList.remove("hidden");
    if (this.exportBtn) this.exportBtn.disabled = true;

    try {
      const blob = await VideoExporter.exportScene(
        this.canvas,
        this.totalDuration,
        (t) => {
          this.evaluateDirectorScript(t, true);
          this.renderFrame(t);
        },
        (t) => this.getSubtitleForTime(t),
        (progress, status) => {
          if (this.progressFillEl) this.progressFillEl.style.width = `${progress}%`;
          if (this.exportPercentEl) this.exportPercentEl.innerText = `${progress}%`;
          if (this.exportStatusEl) this.exportStatusEl.innerText = status;
        }
      );

      VideoExporter.downloadBlob(blob, "dream-animation-spike.mp4");
    } catch (err: any) {
      console.error("Export failed:", err);
      alert(`Export failed: ${err.message}`);
    } finally {
      if (this.exportProgressEl) this.exportProgressEl.classList.add("hidden");
      if (this.exportBtn) this.exportBtn.disabled = false;
      if (wasPlaying) this.togglePlay();
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new DreamPlayer();
});
