import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PrimitivePuppet } from "./puppet";
import { LipSyncDriver } from "./lipsync";

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

  private currentAction = "idle";

  constructor() {
    this.puppet = new PrimitivePuppet();
    this.lipsync = new LipSyncDriver();
    this.group = new THREE.Group();
    this.group.add(this.puppet.group);

    this.loadRiggedAvatar();
  }

  private loadRiggedAvatar() {
    const loader = new GLTFLoader();

    // 1. Load the realistic Human Avatar (with eyes, face, hair, clothing, shoes)
    loader.load(
      "/avatars/human_traveler.glb",
      (gltf) => {
        this.gltfModel = gltf.scene;
        this.gltfModel.scale.set(1.0, 1.0, 1.0);

        // Enable shadow casting & reception on all human meshes
        this.gltfModel.traverse((child) => {
          if ((child as THREE.SkinnedMesh).isSkinnedMesh || (child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this.mixer = new THREE.AnimationMixer(this.gltfModel);

        // Map rest quaternions for all bones in the human avatar to preserve anatomical bind pose
        const restMap = new Map<string, THREE.Quaternion>();
        this.gltfModel.traverse((obj) => {
          if ((obj as THREE.Bone).isBone || obj.type === "Bone" || obj.isObject3D) {
            restMap.set(obj.name, obj.quaternion.clone());
          }
        });

        // 2. Load animations from traveler.glb and retarget to the human skeleton
        loader.load(
          "/avatars/traveler.glb",
          (animGltf) => {
            for (const clip of animGltf.animations) {
              const retargetedTracks: THREE.KeyframeTrack[] = [];
              for (const track of clip.tracks) {
                // Strip mixamorig: prefix so tracks bind directly to Hips, LeftUpLeg, etc.
                const cleanName = track.name.replace(/^mixamorig:?/g, "");

                // Position tracks: Mixamo exports in centimeters (e.g. Hips = 103cm).
                // Scale Hips.position by 0.01 to match meter scale, and discard child bone
                // position tracks so anatomical limb proportions are preserved.
                if (cleanName.endsWith(".position")) {
                  if (cleanName.startsWith("Hips.")) {
                    const clonedTrack = track.clone();
                    clonedTrack.name = cleanName;
                    for (let i = 0; i < clonedTrack.values.length; i++) {
                      clonedTrack.values[i] *= 0.01;
                    }
                    retargetedTracks.push(clonedTrack);
                  }
                } else if (cleanName.endsWith(".quaternion")) {
                  const boneName = cleanName.split(".")[0];
                  const restQ = restMap.get(boneName) || new THREE.Quaternion(0, 0, 0, 1);
                  const clonedTrack = track.clone();
                  clonedTrack.name = cleanName;

                  // Retarget animation rotation relative to each bone's bind pose orientation
                  for (let i = 0; i < clonedTrack.values.length; i += 4) {
                    const qAnim = new THREE.Quaternion(
                      clonedTrack.values[i],
                      clonedTrack.values[i + 1],
                      clonedTrack.values[i + 2],
                      clonedTrack.values[i + 3]
                    );
                    const qFinal = qAnim.multiply(restQ);
                    clonedTrack.values[i] = qFinal.x;
                    clonedTrack.values[i + 1] = qFinal.y;
                    clonedTrack.values[i + 2] = qFinal.z;
                    clonedTrack.values[i + 3] = qFinal.w;
                  }

                  retargetedTracks.push(clonedTrack);
                }
              }

              const retargetedClip = new THREE.AnimationClip(clip.name, clip.duration, retargetedTracks);
              const action = this.mixer!.clipAction(retargetedClip);
              this.actions.set(clip.name, action);
            }

            // Sync with active action state
            if (this.currentAction === "walk") {
              this.playGltfAction("walk", 0.15);
            } else {
              this.playGltfAction("idle", 0.15);
            }

            // Replace procedural puppet with textured human avatar once animation is ready
            this.puppet.group.visible = false;
            this.group.add(this.gltfModel!);
            this.isGltfLoaded = true;
            console.log("Human avatar with skeletal animations ready and active in scene!");
          },
          undefined,
          (animErr) => {
            console.warn("Could not load animation clips; staying with procedural puppet:", animErr);
            this.puppet.group.visible = true;
          }
        );
      },
      undefined,
      (err) => {
        console.warn("Falling back to procedural human puppet:", err);
      }
    );
  }

  private playGltfAction(name: string, duration = 0.3) {
    if (!this.mixer) return;
    const targetAction = this.actions.get(name);
    if (!targetAction) return;

    if (this.activeAction && this.activeAction !== targetAction) {
      this.activeAction.fadeOut(duration);
    }

    targetAction.reset().fadeIn(duration).play();
    this.activeAction = targetAction;
  }

  public teleport(position: THREE.Vector3, lookAt?: THREE.Vector3) {
    this.group.position.copy(position);
    if (lookAt) {
      this.group.lookAt(lookAt.x, this.group.position.y, lookAt.z);
    }
    this.isWalking = false;
  }

  public walkTo(targetPos: THREE.Vector3, startTime: number, duration: number) {
    this.walkStartPos.copy(this.group.position);
    this.walkTargetPos.copy(targetPos);
    this.walkStartTime = startTime;
    this.walkDuration = Math.max(0.1, duration);
    this.isWalking = true;
    this.currentAction = "walk";

    this.group.lookAt(targetPos.x, this.group.position.y, targetPos.z);
    if (this.isGltfLoaded) {
      this.playGltfAction("walk", 0.25);
    }
  }

  public playAction(action: string, _startTime: number, _duration: number) {
    if (this.currentAction === action && this.activeAction?.isRunning()) return;
    this.currentAction = action;
    this.isWalking = false;

    if (this.isGltfLoaded) {
      switch (action) {
        case "walk":
          this.playGltfAction("walk", 0.25);
          break;
        case "look_around":
          this.playGltfAction(this.actions.has("agree") ? "agree" : "idle", 0.3);
          break;
        case "reach":
          this.playGltfAction(this.actions.has("sad_pose") ? "sad_pose" : "idle", 0.3);
          break;
        case "idle":
        default:
          this.playGltfAction("idle", 0.3);
          break;
      }
    }
  }

  public speak(line: string, startTime: number, duration: number) {
    this.lipsync.setScript(line, startTime, duration);
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
        this.puppet.applyWalkCycle(timeSeconds, 1.0);
      }

      if (progress >= 1.0) {
        this.isWalking = false;
        this.playAction("idle", timeSeconds, 1.0);
      }
    } else if (!this.isGltfLoaded) {
      // Procedural gestures
      switch (this.currentAction) {
        case "walk":
          this.puppet.applyWalkCycle(timeSeconds, 1.0);
          break;
        case "look_around":
          this.puppet.applyLookAround(timeSeconds);
          break;
        case "reach":
          this.puppet.applyReach(timeSeconds);
          break;
        case "idle":
        default:
          this.puppet.applyIdle(timeSeconds);
          break;
      }
    }

    // Lip-sync update
    const { mouthOpen, shape } = this.lipsync.update(timeSeconds);
    this.puppet.updateLipSync(mouthOpen, shape);

    // 3. Human Facial Blendshapes / Visemes for Lip Sync
    if (this.isGltfLoaded && this.gltfModel) {
      const headMesh = this.gltfModel.getObjectByName("Wolf3D_Head") as THREE.SkinnedMesh;
      const teethMesh = this.gltfModel.getObjectByName("Wolf3D_Teeth") as THREE.SkinnedMesh;
      const activeViseme = `viseme_${shape}`;

      if (headMesh?.morphTargetDictionary && headMesh.morphTargetInfluences) {
        const dict = headMesh.morphTargetDictionary;
        const influences = headMesh.morphTargetInfluences;
        for (const [key, idx] of Object.entries(dict)) {
          if (key.startsWith("viseme_")) {
            const targetWeight = key === activeViseme ? mouthOpen * 0.95 : 0.0;
            influences[idx] = THREE.MathUtils.lerp(influences[idx], targetWeight, 0.4);
          }
        }
      }

      if (teethMesh?.morphTargetDictionary && teethMesh.morphTargetInfluences) {
        const dict = teethMesh.morphTargetDictionary;
        const influences = teethMesh.morphTargetInfluences;
        for (const [key, idx] of Object.entries(dict)) {
          if (key.startsWith("viseme_")) {
            const targetWeight = key === activeViseme ? mouthOpen * 0.95 : 0.0;
            influences[idx] = THREE.MathUtils.lerp(influences[idx], targetWeight, 0.4);
          }
        }
      }

      // Natural arm drape relaxation (bringing hands down beside hips instead of T-pose)
      const leftArm = this.gltfModel.getObjectByName("LeftArm");
      const rightArm = this.gltfModel.getObjectByName("RightArm");
      if (leftArm && rightArm) {
        if (this.currentAction === "idle" || this.currentAction === "walk") {
          leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, -1.05, 0.1);
          rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, 1.05, 0.1);
        }
      }
    }
  }
}
