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

  private prevCameraPos = new THREE.Vector3();
  private prevTargetPos = new THREE.Vector3();

  constructor(aspect: number) {
    this.currentPreset = RENDER_CONFIG.shots.wide;
    this.camera = new THREE.PerspectiveCamera(this.currentPreset.fov, aspect, 0.1, 150);
  }

  public setShot(presetName: string, actorPosition: THREE.Vector3, currentTime: number, transition = "cut") {
    const preset = RENDER_CONFIG.shots[presetName] || RENDER_CONFIG.shots.wide;
    this.currentPresetName = presetName;
    this.currentPreset = preset;
    this.camera.fov = preset.fov;
    this.camera.updateProjectionMatrix();

    this.prevCameraPos.copy(this.camera.position);
    this.prevTargetPos.copy(this.targetPos);

    // Compute goal target and camera position based on preset
    const offset = preset.targetOffset;
    this.targetPos.set(
      actorPosition.x + offset[0],
      actorPosition.y + offset[1],
      actorPosition.z + offset[2]
    );

    // Position camera along -Z relative to actor or angle
    const angle = presetName === "hero_low" ? -0.2 : presetName === "tracking" ? 0.35 : 0.0;
    const dx = Math.sin(angle) * preset.distance;
    const dz = Math.cos(angle) * preset.distance;

    this.cameraPos.set(
      actorPosition.x + dx,
      actorPosition.y + preset.height,
      actorPosition.z + dz
    );

    if (transition === "cut") {
      this.camera.position.copy(this.cameraPos);
      this.camera.lookAt(this.targetPos);
      this.isTransitioning = false;
    } else {
      // Dissolve / smooth transition
      this.transitionStartTime = currentTime;
      this.transitionDuration = 1.0;
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

    // Compute base goal
    const offset = preset.targetOffset;
    const goalTarget = new THREE.Vector3(
      actorPosition.x + offset[0],
      actorPosition.y + offset[1],
      actorPosition.z + offset[2]
    );

    const angle = this.currentPresetName === "hero_low" ? -0.2 : this.currentPresetName === "tracking" ? 0.35 : 0.0;
    const goalCamera = new THREE.Vector3(
      actorPosition.x + Math.sin(angle) * preset.distance + driftX,
      actorPosition.y + preset.height + driftY,
      actorPosition.z + Math.cos(angle) * (preset.distance + dollyOffset)
    );

    if (this.isTransitioning && this.transitionDuration > 0) {
      const elapsed = timeSeconds - this.transitionStartTime;
      const progress = Math.min(1.0, elapsed / this.transitionDuration);
      const t = THREE.MathUtils.smoothstep(progress, 0, 1);

      this.camera.position.lerpVectors(this.prevCameraPos, goalCamera, t);
      const curTarget = new THREE.Vector3().lerpVectors(this.prevTargetPos, goalTarget, t);
      this.camera.lookAt(curTarget);

      if (progress >= 1.0) {
        this.isTransitioning = false;
      }
    } else {
      // Smooth tracking towards goal
      this.camera.position.lerp(goalCamera, 0.08);
      this.targetPos.lerp(goalTarget, 0.08);
      this.camera.lookAt(this.targetPos);
    }
  }

  public onResize(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  public getActiveShotName(): string {
    return this.currentPreset.name;
  }
}

