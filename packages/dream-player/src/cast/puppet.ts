import * as THREE from "three";
import { NOCTURNE_STYLE } from "../config-loader";
import { FaceVisibility, AllowedEmotion } from "../types/director";

/**
 * CloakedTraveler: A proportioned, atmospheric humanoid wanderer.
 * Inspired by Journey, Gris, and "The Traveler" motif from Design.md Section 16.
 * Implements articulated limbs, expressive head gaze, viseme mouth, and procedural gestures.
 */
export class PrimitivePuppet {
  public group: THREE.Group;
  public headGroup: THREE.Group;
  private mantleGroup: THREE.Group;
  private capeMesh: THREE.Mesh;

  // Articulated Limbs
  private leftUpperArm: THREE.Group;
  private leftForearm: THREE.Group;
  private rightUpperArm: THREE.Group;
  private rightForearm: THREE.Group;

  private leftThigh: THREE.Group;
  private leftShin: THREE.Group;
  private rightThigh: THREE.Group;
  private rightShin: THREE.Group;

  private mouthMesh: THREE.Mesh;
  private leftEye: THREE.Mesh;
  private rightEye: THREE.Mesh;
  private shadowMaskMesh: THREE.Mesh;

  public faceVisibility: FaceVisibility = "shadowed";
  public currentEmotion: AllowedEmotion = "neutral";

  constructor() {
    this.group = new THREE.Group();

    // Cel-shaded Materials in Nocturne Palette
    const robeMat = new THREE.MeshToonMaterial({
      color: NOCTURNE_STYLE.palette.viridian,
    });

    const mantleMat = new THREE.MeshToonMaterial({
      color: NOCTURNE_STYLE.palette.slate,
    });

    const goldAccentMat = new THREE.MeshToonMaterial({
      color: NOCTURNE_STYLE.palette.lantern,
    });

    const skinShadowMat = new THREE.MeshBasicMaterial({
      color: 0x070b0e,
      transparent: true,
      opacity: 0.85,
    });

    const bootsMat = new THREE.MeshToonMaterial({
      color: NOCTURNE_STYLE.palette.forestNight,
    });

    // 1. CHEST & UPPER TORSO
    const chestGeo = new THREE.CylinderGeometry(0.24, 0.18, 0.45, 12);
    const chest = new THREE.Mesh(chestGeo, robeMat);
    chest.position.y = 1.25;
    this.group.add(chest);

    // Shoulder Mantle / Cowl drape over chest
    this.mantleGroup = new THREE.Group();
    const mantleGeo = new THREE.CylinderGeometry(0.32, 0.26, 0.28, 12);
    const mantle = new THREE.Mesh(mantleGeo, mantleMat);
    mantle.position.y = 1.38;
    this.mantleGroup.add(mantle);
    this.group.add(this.mantleGroup);

    // 2. WAIST & FLOWING LOWER ROBE
    const beltGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.08, 16);
    const belt = new THREE.Mesh(beltGeo, goldAccentMat);
    belt.position.y = 1.0;
    this.group.add(belt);

    const sashGeo = new THREE.BoxGeometry(0.08, 0.45, 0.02);
    const sash = new THREE.Mesh(sashGeo, goldAccentMat);
    sash.position.set(0.08, 0.78, 0.18);
    sash.rotation.z = -0.08;
    this.group.add(sash);

    const skirtGeo = new THREE.CylinderGeometry(0.19, 0.32, 0.55, 16, 1, true);
    const skirt = new THREE.Mesh(skirtGeo, robeMat);
    skirt.position.y = 0.72;
    this.group.add(skirt);

    // 3. FLOWING BACK CAPE
    const capeGeo = new THREE.PlaneGeometry(0.48, 1.05, 4, 8);
    this.capeMesh = new THREE.Mesh(capeGeo, mantleMat);
    this.capeMesh.position.set(0, 0.95, -0.19);
    this.capeMesh.rotation.x = 0.08;
    this.group.add(this.capeMesh);

    // 4. ARTICULATED ARMS
    const armMat = new THREE.MeshToonMaterial({ color: NOCTURNE_STYLE.palette.forestNight });
    const sleeveMat = new THREE.MeshToonMaterial({ color: NOCTURNE_STYLE.palette.viridian });

    // Left Arm
    this.leftUpperArm = new THREE.Group();
    this.leftUpperArm.position.set(-0.28, 1.4, 0);
    const leftSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.32, 8), sleeveMat);
    leftSleeve.position.y = -0.16;
    this.leftUpperArm.add(leftSleeve);

    this.leftForearm = new THREE.Group();
    this.leftForearm.position.set(0, -0.32, 0);
    const leftArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.32, 8), armMat);
    leftArmMesh.position.y = -0.16;
    this.leftForearm.add(leftArmMesh);
    this.leftUpperArm.add(this.leftForearm);
    this.group.add(this.leftUpperArm);

    // Right Arm
    this.rightUpperArm = new THREE.Group();
    this.rightUpperArm.position.set(0.28, 1.4, 0);
    const rightSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.32, 8), sleeveMat);
    rightSleeve.position.y = -0.16;
    this.rightUpperArm.add(rightSleeve);

    this.rightForearm = new THREE.Group();
    this.rightForearm.position.set(0, -0.32, 0);
    const rightArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.32, 8), armMat);
    rightArmMesh.position.y = -0.16;
    this.rightForearm.add(rightArmMesh);
    this.rightUpperArm.add(this.rightForearm);
    this.group.add(this.rightUpperArm);

    // 5. ARTICULATED LEGS & BOOTS
    // Left Leg
    this.leftThigh = new THREE.Group();
    this.leftThigh.position.set(-0.11, 0.65, 0);
    const leftThighMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.35, 8), robeMat);
    leftThighMesh.position.y = -0.175;
    this.leftThigh.add(leftThighMesh);

    this.leftShin = new THREE.Group();
    this.leftShin.position.set(0, -0.35, 0);
    const leftBootMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.32, 8), bootsMat);
    leftBootMesh.position.y = -0.16;
    this.leftShin.add(leftBootMesh);
    this.leftThigh.add(this.leftShin);
    this.group.add(this.leftThigh);

    // Right Leg
    this.rightThigh = new THREE.Group();
    this.rightThigh.position.set(0.11, 0.65, 0);
    const rightThighMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.35, 8), robeMat);
    rightThighMesh.position.y = -0.175;
    this.rightThigh.add(rightThighMesh);

    this.rightShin = new THREE.Group();
    this.rightShin.position.set(0, -0.35, 0);
    const rightBootMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.32, 8), bootsMat);
    rightBootMesh.position.y = -0.16;
    this.rightShin.add(rightBootMesh);
    this.rightThigh.add(this.rightShin);
    this.group.add(this.rightThigh);

    // 6. HOODED HEAD & VISIBILITY MASK
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.62, 0);

    const hoodGeo = new THREE.SphereGeometry(0.24, 16, 16);
    const hood = new THREE.Mesh(hoodGeo, mantleMat);
    hood.scale.set(0.9, 1.15, 1.15);
    hood.position.set(0, 0, -0.04);
    this.headGroup.add(hood);

    // Inner Shadow Cavity
    const innerShadowGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const innerShadow = new THREE.Mesh(innerShadowGeo, skinShadowMat);
    innerShadow.position.set(0, -0.02, 0.04);
    this.headGroup.add(innerShadow);

    // Shadow mask mesh for "shadowed" face_visibility
    const maskGeo = new THREE.PlaneGeometry(0.32, 0.32);
    const maskMat = new THREE.MeshBasicMaterial({
      color: 0x05080b,
      transparent: true,
      opacity: 0.92,
    });
    this.shadowMaskMesh = new THREE.Mesh(maskGeo, maskMat);
    this.shadowMaskMesh.position.set(0, -0.02, 0.16);
    this.headGroup.add(this.shadowMaskMesh);

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: NOCTURNE_STYLE.palette.lanternSoft });
    const eyeGeo = new THREE.SphereGeometry(0.025, 8, 8);
    this.leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    this.leftEye.position.set(-0.065, 0.02, 0.17);

    this.rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    this.rightEye.position.set(0.065, 0.02, 0.17);
    this.headGroup.add(this.leftEye, this.rightEye);

    // Viseme Mouth Flap
    const mouthGeo = new THREE.BoxGeometry(0.06, 0.02, 0.02);
    const mouthMat = new THREE.MeshBasicMaterial({ color: NOCTURNE_STYLE.palette.lantern });
    this.mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
    this.mouthMesh.position.set(0, -0.065, 0.16);
    this.headGroup.add(this.mouthMesh);

    this.group.add(this.headGroup);
    this.setFaceVisibility("shadowed");
  }

  public setFaceVisibility(visibility: FaceVisibility) {
    this.faceVisibility = visibility;
    if (visibility === "full") {
      this.shadowMaskMesh.visible = false;
      this.leftEye.visible = true;
      this.rightEye.visible = true;
      this.mouthMesh.visible = true;
    } else if (visibility === "shadowed") {
      this.shadowMaskMesh.visible = true;
      this.leftEye.visible = true;
      this.rightEye.visible = true;
      this.mouthMesh.visible = true;
    } else {
      // hidden
      this.shadowMaskMesh.visible = true;
      this.leftEye.visible = false;
      this.rightEye.visible = false;
      this.mouthMesh.visible = false;
    }
  }

  public setEmotion(emotion: AllowedEmotion) {
    this.currentEmotion = emotion;
    switch (emotion) {
      case "wonder":
        this.headGroup.rotation.x = -0.15; // gazing upward
        break;
      case "melancholic":
        this.headGroup.rotation.x = 0.18; // head bowed
        break;
      case "uneasy":
      case "fearful":
        this.headGroup.rotation.y = Math.sin(Date.now() * 0.005) * 0.12;
        break;
      case "curious":
        this.headGroup.rotation.z = -0.12; // head tilt
        break;
      default:
        this.headGroup.rotation.set(0, 0, 0);
    }
  }

  public setLookAt(target: THREE.Vector3) {
    const localTarget = this.group.worldToLocal(target.clone());
    const angleY = Math.atan2(localTarget.x, localTarget.z);
    const angleX = -Math.atan2(localTarget.y - this.headGroup.position.y, Math.hypot(localTarget.x, localTarget.z));
    this.headGroup.rotation.y = THREE.MathUtils.clamp(angleY, -0.8, 0.8);
    this.headGroup.rotation.x = THREE.MathUtils.clamp(angleX, -0.4, 0.4);
  }

  public setMouthOpen(openFactor: number, shape = "neutral") {
    const openClamped = THREE.MathUtils.clamp(openFactor, 0.0, 1.0);
    this.mouthMesh.scale.y = 1.0 + openClamped * 2.5;
    if (shape === "O") {
      this.mouthMesh.scale.x = 0.7;
    } else if (shape === "E") {
      this.mouthMesh.scale.x = 1.4;
    } else {
      this.mouthMesh.scale.x = 1.0;
    }
  }

  public applyIdle(timeSeconds: number) {
    const breathe = Math.sin(timeSeconds * 1.8) * 0.02;
    this.mantleGroup.position.y = breathe;

    this.leftUpperArm.rotation.x = Math.sin(timeSeconds * 1.2) * 0.04;
    this.rightUpperArm.rotation.x = -Math.sin(timeSeconds * 1.2) * 0.04;
    this.leftForearm.rotation.x = 0.1;
    this.rightForearm.rotation.x = 0.1;

    this.leftThigh.rotation.x = 0;
    this.rightThigh.rotation.x = 0;
    this.leftShin.rotation.x = 0;
    this.rightShin.rotation.x = 0;
  }

  public applyWalkCycle(timeSeconds: number, speedMultiplier = 1.0) {
    const freq = 6.0 * speedMultiplier;
    const legPhase = timeSeconds * freq;

    this.leftThigh.rotation.x = Math.sin(legPhase) * 0.55;
    this.rightThigh.rotation.x = -Math.sin(legPhase) * 0.55;

    this.leftShin.rotation.x = Math.max(0, -Math.sin(legPhase + 0.5) * 0.6);
    this.rightShin.rotation.x = Math.max(0, Math.sin(legPhase + 0.5) * 0.6);

    this.leftUpperArm.rotation.x = -Math.sin(legPhase) * 0.4;
    this.rightUpperArm.rotation.x = Math.sin(legPhase) * 0.4;

    this.capeMesh.rotation.x = 0.12 + Math.abs(Math.sin(legPhase)) * 0.18;
  }

  public applyWave(timeSeconds: number) {
    this.rightUpperArm.rotation.x = -Math.PI * 0.75;
    this.rightUpperArm.rotation.z = -0.4;
    this.rightForearm.rotation.z = Math.sin(timeSeconds * 8.0) * 0.35 - 0.2;

    this.leftUpperArm.rotation.x = 0;
    this.leftForearm.rotation.x = 0.1;
  }

  public applyPoint(_timeSeconds: number) {
    this.rightUpperArm.rotation.x = -Math.PI * 0.5;
    this.rightUpperArm.rotation.z = -0.1;
    this.rightForearm.rotation.x = 0;

    this.leftUpperArm.rotation.x = 0;
  }

  public applyShrug(timeSeconds: number) {
    this.leftUpperArm.rotation.z = 0.35 + Math.sin(timeSeconds * 2.0) * 0.05;
    this.rightUpperArm.rotation.z = -0.35 - Math.sin(timeSeconds * 2.0) * 0.05;
    this.leftForearm.rotation.x = 0.5;
    this.rightForearm.rotation.x = 0.5;
  }

  public applyLookAround(timeSeconds: number) {
    this.headGroup.rotation.y = Math.sin(timeSeconds * 1.5) * 0.55;
    this.headGroup.rotation.x = Math.cos(timeSeconds * 1.0) * 0.1;
  }

  public applyReach(timeSeconds: number) {
    const reachProgress = (Math.sin(timeSeconds * 2.0) + 1.0) * 0.5;
    this.rightUpperArm.rotation.x = -Math.PI * 0.45 * reachProgress;
    this.rightForearm.rotation.x = -0.2 * reachProgress;
  }

  public applyThink(timeSeconds: number) {
    this.rightUpperArm.rotation.x = -Math.PI * 0.65;
    this.rightForearm.rotation.x = -Math.PI * 0.4;
    this.headGroup.rotation.z = 0.12;
    this.headGroup.rotation.x = 0.08 + Math.sin(timeSeconds * 1.5) * 0.02;
  }

  public applySit() {
    this.group.position.y = -0.35;
    this.leftThigh.rotation.x = -Math.PI / 2;
    this.rightThigh.rotation.x = -Math.PI / 2;
    this.leftShin.rotation.x = Math.PI / 2;
    this.rightShin.rotation.x = Math.PI / 2;
  }

  public applyFall(progress: number) {
    this.group.rotation.x = -Math.PI * 0.45 * progress;
    this.group.position.y = -0.4 * progress;
  }
}
