import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PrimitivePuppet } from "./puppet";
import { LipSyncDriver, WordTiming } from "./lipsync";
import { FaceVisibility, AllowedEmotion, AnimateClip } from "../types/director";

export class DreamActor {
  public puppet: PrimitivePuppet;
  public lipsync: LipSyncDriver;
  public group: THREE.Group;

  // Rigged humanoid avatar (GLTF)
  private gltfModel: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Map<string, THREE.AnimationAction> = new Map();
  private activeAction: THREE.AnimationAction | null = null;
  public isGltfLoaded = false;
  private lastUpdateTime = 0;

  private isWalking = false;
  private walkStartPos = new THREE.Vector3();
  private walkTargetPos = new THREE.Vector3();
  private walkStartTime = 0;
  private walkDuration = 1.0;

  private currentAction: AnimateClip | "walk" = "idle";
  private currentSpeedMultiplier = 1.0;

  constructor() {
    this.puppet = new PrimitivePuppet();
    this.lipsync = new LipSyncDriver();
    this.group = new THREE.Group();
    this.group.add(this.puppet.group);

    this.loadRiggedAvatar();
  }

  private loadRiggedAvatar() {
    const loader = new GLTFLoader();

    const isPlayerSubpath = typeof window !== "undefined" && window.location.pathname.includes("/player");
    const humanUrl = isPlayerSubpath ? "./avatars/human_traveler.glb" : "/avatars/human_traveler.glb";
    const animUrl = isPlayerSubpath ? "./avatars/traveler.glb" : "/avatars/traveler.glb";

    loader.load(
      humanUrl,
      (humanGltf) => {
        const model = humanGltf.scene as THREE.Group;
        this.gltfModel = model;
        model.scale.set(1.0, 1.0, 1.0);

        model.traverse((child: THREE.Object3D) => {
          if ((child as THREE.SkinnedMesh).isSkinnedMesh || (child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this.mixer = new THREE.AnimationMixer(model);

        // Store initial bind rest rotations of ReadyPlayerMe bones
        const restRotations = new Map<string, THREE.Quaternion>();
        model.traverse((obj) => {
          if ((obj as THREE.Bone).isBone) {
            restRotations.set(obj.name, obj.quaternion.clone());
          }
        });

        loader.load(
          animUrl,
          (animGltf) => {
            for (const clip of animGltf.animations) {
              const retargetedTracks: THREE.KeyframeTrack[] = [];
              for (const track of clip.tracks) {
                const cleanName = track.name.replace(/^mixamorig:?/g, "");
                const parts = cleanName.split(".");
                const boneName = parts[0];
                const property = parts[1];
                const targetTrackName = `${boneName}.${property}`;

                if (property === "position" && boneName === "Hips") {
                  const cloned = track.clone();
                  cloned.name = targetTrackName;
                  for (let i = 0; i < cloned.values.length; i++) {
                    cloned.values[i] *= 0.01;
                  }
                  retargetedTracks.push(cloned);
                } else if (property === "quaternion") {
                  const restQ = restRotations.get(boneName) || new THREE.Quaternion(0, 0, 0, 1);
                  const cloned = track.clone();
                  cloned.name = targetTrackName;

                  for (let i = 0; i < cloned.values.length; i += 4) {
                    const qAnim = new THREE.Quaternion(
                      cloned.values[i],
                      cloned.values[i + 1],
                      cloned.values[i + 2],
                      cloned.values[i + 3]
                    );
                    const qFinal = restQ.clone().multiply(qAnim);
                    cloned.values[i] = qFinal.x;
                    cloned.values[i + 1] = qFinal.y;
                    cloned.values[i + 2] = qFinal.z;
                    cloned.values[i + 3] = qFinal.w;
                  }
                  retargetedTracks.push(cloned);
                }
              }

              const newClip = new THREE.AnimationClip(clip.name, clip.duration, retargetedTracks);
              this.actions.set(clip.name, this.mixer!.clipAction(newClip));
            }

            if (this.currentAction === "walk") {
              this.playGltfAction("walk", 0.15);
            } else {
              this.playGltfAction("idle", 0.15);
            }

            this.puppet.group.visible = false;
            this.group.add(model);
            this.isGltfLoaded = true;
          },
          undefined,
          (err) => {
            console.warn("Failed loading animation clips for human avatar:", err);
            this.puppet.group.visible = true;
          }
        );
      },
      undefined,
      (err) => {
        console.warn("Could not load human_traveler.glb, falling back to puppet:", err);
        this.puppet.group.visible = true;
        this.isGltfLoaded = false;
      }
    );
  }

  private playGltfAction(name: string, duration = 0.3) {
    if (!this.mixer) return;
    const targetAction = this.actions.get(name);
    if (!targetAction) return;

    if (this.activeAction === targetAction) return;

    if (this.activeAction) {
      this.activeAction.fadeOut(duration);
    }

    targetAction.reset().fadeIn(duration).play();
    this.activeAction = targetAction;
  }

  public setFaceVisibility(visibility: FaceVisibility) {
    this.puppet.setFaceVisibility(visibility);
  }

  public setEmotion(emotion: AllowedEmotion) {
    this.puppet.setEmotion(emotion);
  }

  public setLookAt(target: THREE.Vector3) {
    this.puppet.setLookAt(target);
    if (this.gltfModel) {
      // Look at with model
      this.group.lookAt(target.x, this.group.position.y, target.z);
    }
  }

  public teleport(position: THREE.Vector3, lookAt?: THREE.Vector3) {
    this.group.position.copy(position);
    if (lookAt) {
      this.group.lookAt(lookAt.x, this.group.position.y, lookAt.z);
    }
    this.isWalking = false;
    this.walkStartPos.copy(position);
    this.walkTargetPos.copy(position);
  }

  public walkTo(targetPos: THREE.Vector3, startTime: number, duration: number, isRunning = false) {
    if (
      this.isWalking &&
      this.walkTargetPos.distanceToSquared(targetPos) < 0.001 &&
      Math.abs(this.walkStartTime - startTime) < 0.001
    ) {
      return;
    }

    this.walkStartPos.copy(this.group.position);
    this.walkTargetPos.copy(targetPos);
    this.walkStartTime = startTime;
    this.walkDuration = Math.max(0.1, duration);
    this.isWalking = true;
    this.currentAction = "walk";
    this.currentSpeedMultiplier = isRunning ? 1.7 : 1.0;

    this.group.lookAt(targetPos.x, this.group.position.y, targetPos.z);
    if (this.isGltfLoaded) {
      const animName = isRunning && this.actions.has("run") ? "run" : "walk";
      this.playGltfAction(animName, 0.25);
    }
  }

  public playAction(action: AnimateClip | "walk", _startTime = 0, _duration = 1.0) {
    if (this.currentAction === action && !this.isWalking) {
      return;
    }

    this.currentAction = action;
    this.isWalking = action === "walk";

    if (this.isGltfLoaded) {
      switch (action) {
        case "walk":
          this.playGltfAction(this.actions.has("walk") ? "walk" : "idle", 0.25);
          break;
        case "look_around":
        case "wave":
          this.playGltfAction(this.actions.has("agree") ? "agree" : "idle", 0.3);
          break;
        case "reach":
        case "point":
          this.playGltfAction(this.actions.has("sad_pose") ? "sad_pose" : "idle", 0.3);
          break;
        case "think":
        case "shrug":
          this.playGltfAction(this.actions.has("headShake") ? "headShake" : "idle", 0.3);
          break;
        case "idle":
        default:
          this.playGltfAction("idle", 0.3);
          break;
      }
    }
  }

  public speak(line: string, startTime: number, duration: number, wordTimings?: WordTiming[]) {
    this.lipsync.setScript(line, startTime, duration, wordTimings);
  }

  public update(timeSeconds: number) {
    const delta = this.lastUpdateTime === 0 ? 0.016 : Math.max(0.001, Math.min(0.1, timeSeconds - this.lastUpdateTime));
    this.lastUpdateTime = timeSeconds;

    if (this.isGltfLoaded && this.mixer) {
      this.mixer.update(delta);
    }

    // 1. Locomotion Pathing
    if (this.isWalking && timeSeconds >= this.walkStartTime) {
      const elapsed = timeSeconds - this.walkStartTime;
      const progress = Math.min(1.0, elapsed / this.walkDuration);

      const smoothT = THREE.MathUtils.smoothstep(progress, 0, 1);
      this.group.position.lerpVectors(this.walkStartPos, this.walkTargetPos, smoothT);

      if (!this.isGltfLoaded) {
        this.puppet.applyWalkCycle(timeSeconds, this.currentSpeedMultiplier);
      }

      if (progress >= 1.0) {
        this.isWalking = false;
        this.playAction("idle", timeSeconds, 1.0);
      }
    } else if (!this.isGltfLoaded) {
      // Procedural gestures on PrimitivePuppet
      switch (this.currentAction) {
        case "walk":
          this.puppet.applyWalkCycle(timeSeconds, this.currentSpeedMultiplier);
          break;
        case "wave":
          this.puppet.applyWave(timeSeconds);
          break;
        case "point":
          this.puppet.applyPoint(timeSeconds);
          break;
        case "shrug":
          this.puppet.applyShrug(timeSeconds);
          break;
        case "look_around":
          this.puppet.applyLookAround(timeSeconds);
          break;
        case "reach":
          this.puppet.applyReach(timeSeconds);
          break;
        case "think":
          this.puppet.applyThink(timeSeconds);
          break;
        case "sit":
          this.puppet.applySit();
          break;
        case "fall":
          this.puppet.applyFall(1.0);
          break;
        case "idle":
        default:
          this.puppet.applyIdle(timeSeconds);
          break;
      }
    }

    // Lip-sync update
    const { mouthOpen, shape } = this.lipsync.update(timeSeconds);
    if (!this.isGltfLoaded) {
      this.puppet.setMouthOpen(mouthOpen, shape);
    } else if (this.gltfModel && mouthOpen > 0.05) {
      const head = this.gltfModel.getObjectByName("mixamorig:Head");
      if (head) {
        head.rotation.x = Math.sin(timeSeconds * 6.0) * 0.04 * mouthOpen;
      }
    }
  }
}
