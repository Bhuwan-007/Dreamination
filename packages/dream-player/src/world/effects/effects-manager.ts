import * as THREE from "three";
import { WorldEffectType } from "../../types/director";
import { DreamFloodEffect } from "./flood";

export interface ActiveEffect {
  type: WorldEffectType;
  startTime: number;
  duration: number;
  parameters?: Record<string, unknown>;
}

export class DreamEffectsManager {
  public group: THREE.Group;
  public flood: DreamFloodEffect;

  private activeEffects: ActiveEffect[] = [];
  private targetPropsGroup: THREE.Group | null = null;
  private targetActorGroup: THREE.Group | null = null;

  // Transform caches for clean reset/scrubbing
  private initialActorY = 0;
  private initialPropsY: Map<THREE.Object3D, number> = new Map();

  constructor() {
    this.group = new THREE.Group();
    this.flood = new DreamFloodEffect();
    this.group.add(this.flood.mesh);
  }

  public bindTargets(propsGroup: THREE.Group, actorGroup: THREE.Group) {
    this.targetPropsGroup = propsGroup;
    this.targetActorGroup = actorGroup;
    this.initialActorY = actorGroup.position.y;

    this.initialPropsY.clear();
    propsGroup.children.forEach((child) => {
      this.initialPropsY.set(child, child.position.y);
    });
  }

  public setSceneEffects(effects: Array<{ type: WorldEffectType; at: number; duration: number; parameters?: Record<string, unknown> }>) {
    this.reset();
    this.activeEffects = effects.map((e) => ({
      type: e.type,
      startTime: e.at,
      duration: e.duration || 4.0,
      parameters: e.parameters,
    }));
  }

  public reset() {
    this.flood.reset();

    if (this.targetActorGroup) {
      this.targetActorGroup.position.y = this.initialActorY;
      this.targetActorGroup.scale.set(1, 1, 1);
      this.targetActorGroup.rotation.z = 0;
    }

    if (this.targetPropsGroup) {
      this.targetPropsGroup.children.forEach((child) => {
        const initY = this.initialPropsY.get(child) ?? 0;
        child.position.y = initY;
        child.scale.set(1, 1, 1);
        child.rotation.z = 0;
      });
    }
  }

  public update(localSceneTime: number, totalTime: number) {
    this.flood.update(totalTime);

    for (const eff of this.activeEffects) {
      const isTriggered = localSceneTime >= eff.startTime && localSceneTime <= eff.startTime + eff.duration;
      const elapsed = Math.max(0, localSceneTime - eff.startTime);
      const progress = Math.min(1.0, Math.max(0.0, elapsed / Math.max(0.1, eff.duration)));

      if (isTriggered) {
        this.applyEffect(eff.type, progress, totalTime, eff.parameters);
      }
    }
  }

  private applyEffect(type: WorldEffectType, progress: number, timeSeconds: number, _params?: Record<string, unknown>) {
    const intensity = Math.sin(progress * Math.PI); // Smooth in-and-out envelope

    switch (type) {
      case "flood":
        this.flood.setProgress(progress);
        break;

      case "float":
        // Zero-G vertical lift and sinusoidal oscillation
        if (this.targetActorGroup) {
          const lift = intensity * 1.6 + Math.sin(timeSeconds * 2.5) * 0.15;
          this.targetActorGroup.position.y = this.initialActorY + lift;
        }
        if (this.targetPropsGroup) {
          this.targetPropsGroup.children.forEach((child, i) => {
            const initY = this.initialPropsY.get(child) ?? 0;
            const lift = intensity * 1.8 + Math.sin(timeSeconds * 2.0 + i) * 0.2;
            child.position.y = initY + lift;
          });
        }
        break;

      case "invert_gravity":
        // Inverted orientation and upward lift
        if (this.targetActorGroup) {
          this.targetActorGroup.position.y = this.initialActorY + intensity * 3.5;
          this.targetActorGroup.rotation.z = intensity * Math.PI; // upside down
        }
        if (this.targetPropsGroup) {
          this.targetPropsGroup.children.forEach((child) => {
            const initY = this.initialPropsY.get(child) ?? 0;
            child.position.y = initY + intensity * 4.0;
          });
        }
        break;

      case "stretch":
        // Non-uniform geometric scale distortion
        {
          const scaleY = 1.0 + Math.sin(timeSeconds * 6.0) * 0.45 * intensity;
          const scaleXZ = 1.0 / Math.sqrt(Math.max(0.1, scaleY));
          if (this.targetActorGroup) {
            this.targetActorGroup.scale.set(scaleXZ, scaleY, scaleXZ);
          }
          if (this.targetPropsGroup) {
            this.targetPropsGroup.children.forEach((child) => {
              child.scale.set(scaleXZ, scaleY, scaleXZ);
            });
          }
        }
        break;

      case "loop":
        // Endless geometric scroll / loop oscillation
        if (this.targetPropsGroup) {
          const zShift = ((timeSeconds * 3.0) % 6.0) - 3.0;
          this.targetPropsGroup.position.z = zShift * intensity;
        }
        break;

      case "duplicate":
        // Duplicate illusion: small echoing lateral offset
        if (this.targetPropsGroup) {
          this.targetPropsGroup.position.x = Math.sin(timeSeconds * 4.0) * 0.8 * intensity;
        }
        break;

      case "dissolve":
        // Dissolve into floor: scale down and sink
        if (this.targetActorGroup) {
          const fadeScale = Math.max(0.01, 1.0 - progress);
          this.targetActorGroup.scale.set(fadeScale, fadeScale, fadeScale);
          this.targetActorGroup.position.y = this.initialActorY - progress * 1.2;
        }
        break;
    }
  }
}

