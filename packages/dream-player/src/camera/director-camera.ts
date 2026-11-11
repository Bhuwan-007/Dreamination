import * as THREE from "three";
import { RENDER_CONFIG, ShotPreset } from "../config-loader";

export class DirectorCamera {
  public camera: THREE.PerspectiveCamera;
  private currentPresetName = "wide";
  private currentPreset: ShotPreset;

  private targetPos = new THREE.Vector3();
  private cameraPos = new THREE.Vector3();
  private transitionStartTime = 0;
  private transitionDuration = 0.0;
  private isTransitioning = false;
  private transitionType = "cut";

  private prevCameraPos = new THREE.Vector3();
  private prevTargetPos = new THREE.Vector3();
  private prevFov = 42;

  // Orbit angle accumulator
  private orbitAngle = 0.0;

  constructor(aspect: number) {
    this.currentPreset = RENDER_CONFIG.shots.wide;
    this.camera = new THREE.PerspectiveCamera(this.currentPreset.fov, aspect, 0.1, 180);
    this.camera.position.set(0, 3.2, 9.5);
    this.camera.lookAt(0, 0.8, 0);
  }

  public onResize(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  public getCurrentShotName(): string {
    return this.currentPresetName;
  }

  public getTransitionType(): string {
    return this.transitionType;
  }

  public setShot(
    presetName: string,
    actorPosition: THREE.Vector3,
    currentTime: number,
    transition: "cut" | "dissolve" | "morph" | "submerge_fade" = "cut"
  ) {
    const preset = RENDER_CONFIG.shots[presetName] || RENDER_CONFIG.shots.wide;
    this.currentPresetName = presetName;
    this.currentPreset = preset;
    this.transitionType = transition;

    this.prevCameraPos.copy(this.camera.position);
    this.prevTargetPos.copy(this.targetPos);
    this.prevFov = this.camera.fov;

    // Compute base target position with targetOffset
    const offset = preset.targetOffset;
    this.targetPos.set(
      actorPosition.x + offset[0],
      actorPosition.y + offset[1],
      actorPosition.z + offset[2]
    );

    // Compute camera position relative to target based on preset angles
    let angleX = 0.0;
    let elevation = preset.height;
    let dist = preset.distance;

    switch (presetName) {
      case "hero_low":
        angleX = -0.2;
        break;
      case "tracking":
        angleX = 0.35;
        break;
      case "over_shoulder":
        angleX = -0.15;
        break;
      case "two_shot":
        angleX = 0.18;
        break;
      case "top_down":
        angleX = 0.0;
        dist = 0.5; // almost directly overhead
        break;
      case "orbit":
        angleX = this.orbitAngle;
        break;
      default:
        angleX = 0.0;
    }

    const dx = Math.sin(angleX) * dist;
    const dz = Math.cos(angleX) * dist;

    this.cameraPos.set(
      actorPosition.x + dx,
      actorPosition.y + elevation,
      actorPosition.z + dz
    );

    if (transition === "cut") {
      this.camera.fov = preset.fov;
      this.camera.updateProjectionMatrix();
      this.camera.position.copy(this.cameraPos);
      this.camera.lookAt(this.targetPos);
      this.isTransitioning = false;
    } else {
      // Smooth transitions (dissolve / morph / submerge_fade)
      this.transitionStartTime = currentTime;
      this.transitionDuration = transition === "morph" ? 1.4 : 1.0;
      this.isTransitioning = true;
    }
  }

  public update(timeSeconds: number, actorPosition: THREE.Vector3) {
    const preset = this.currentPreset;

    // 1. Slow Hypnotic Camera Drift
    const drift = preset.drift;
    const driftX = Math.sin(timeSeconds * drift.speed * 1000) * drift.amplitudeX;
    const driftY = Math.cos(timeSeconds * drift.speed * 800) * drift.amplitudeY;
    const dollyOffset = drift.dollyRate ? timeSeconds * drift.dollyRate * 0.1 : 0.0;

    // Orbit increment
    if (this.currentPresetName === "orbit" && drift.orbitSpeed) {
      this.orbitAngle = timeSeconds * drift.orbitSpeed;
    }

    // Compute goal target and camera
    const offset = preset.targetOffset;
    const goalTarget = new THREE.Vector3(
      actorPosition.x + offset[0],
      actorPosition.y + offset[1],
      actorPosition.z + offset[2]
    );

    let angleX = 0.0;
    let dist = preset.distance + dollyOffset;

    if (this.currentPresetName === "hero_low") {
      angleX = -0.2;
    } else if (this.currentPresetName === "tracking") {
      angleX = 0.35;
    } else if (this.currentPresetName === "over_shoulder") {
      angleX = -0.15;
    } else if (this.currentPresetName === "orbit") {
      angleX = this.orbitAngle;
    }

    const goalCamera = new THREE.Vector3(
      actorPosition.x + Math.sin(angleX) * dist + driftX,
      actorPosition.y + preset.height + driftY,
      actorPosition.z + Math.cos(angleX) * dist
    );

    if (this.isTransitioning && this.transitionDuration > 0) {
      const elapsed = timeSeconds - this.transitionStartTime;
      const progress = Math.min(1.0, elapsed / this.transitionDuration);

      // Hermite smoothstep interpolation
      const t = THREE.MathUtils.smoothstep(progress, 0, 1);

      this.camera.position.lerpVectors(this.prevCameraPos, goalCamera, t);
      const curTarget = new THREE.Vector3().lerpVectors(this.prevTargetPos, goalTarget, t);
      this.camera.lookAt(curTarget);

      // FOV transition for morph
      this.camera.fov = THREE.MathUtils.lerp(this.prevFov, preset.fov, t);
      this.camera.updateProjectionMatrix();

      if (progress >= 1.0) {
        this.isTransitioning = false;
      }
    } else {
      this.camera.position.copy(goalCamera);
      this.camera.lookAt(goalTarget);
      if (this.camera.fov !== preset.fov) {
        this.camera.fov = preset.fov;
        this.camera.updateProjectionMatrix();
      }
    }
  }
}
