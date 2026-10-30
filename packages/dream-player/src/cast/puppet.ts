import * as THREE from "three";
import { NOCTURNE_STYLE } from "../config-loader";

/**
 * CloakedTraveler: A proportioned, atmospheric humanoid wanderer
 * Inspired by Journey, Gris, and "The Traveler" motif from Design.md Section 16
 * Replaces the primitive capsule with an anatomical, hooded cloaked figure
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

  public faceVisibility: "full" | "shadowed" | "hidden" = "shadowed";

  constructor() {
    this.group = new THREE.Group();

    // Cel-shaded Materials in Nocturne Palette
    const robeMat = new THREE.MeshToonMaterial({
      color: NOCTURNE_STYLE.palette.viridian, // Rich viridian tunic
    });

    const mantleMat = new THREE.MeshToonMaterial({
      color: NOCTURNE_STYLE.palette.slate, // Deep slate-graphite cowl/mantle
    });

    const goldAccentMat = new THREE.MeshToonMaterial({
      color: NOCTURNE_STYLE.palette.lantern, // Warm lantern gold
    });

    const skinShadowMat = new THREE.MeshBasicMaterial({
      color: 0x070b0e, // Deep shadowy void interior
      transparent: true,
      opacity: 0.85,
    });

    const bootsMat = new THREE.MeshToonMaterial({
      color: NOCTURNE_STYLE.palette.forestNight,
    });

    // ──────────────────────────────────────────
    // 1. CHEST & UPPER TORSO (Anatomical Human Proportions)
    // ──────────────────────────────────────────
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

    // ──────────────────────────────────────────
    // 2. WAIST & FLOWING LOWER ROBE
    // ──────────────────────────────────────────
    // Golden Belt
    const beltGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.08, 16);
    const belt = new THREE.Mesh(beltGeo, goldAccentMat);
    belt.position.y = 1.0;
    this.group.add(belt);

    // Hanging Sash Ribbon
    const sashGeo = new THREE.BoxGeometry(0.08, 0.45, 0.02);
    const sash = new THREE.Mesh(sashGeo, goldAccentMat);
    sash.position.set(0.08, 0.78, 0.18);
    sash.rotation.z = -0.08;
    this.group.add(sash);

    // Tapered Lower Robe (Flaring down towards feet)
    const skirtGeo = new THREE.CylinderGeometry(0.19, 0.32, 0.55, 16, 1, true);
    const skirt = new THREE.Mesh(skirtGeo, robeMat);
    skirt.position.y = 0.72;
    this.group.add(skirt);

    // ──────────────────────────────────────────
    // 3. FLOWING BACK CAPE (Sways behind during walk)
    // ──────────────────────────────────────────
    const capeGeo = new THREE.PlaneGeometry(0.48, 1.05, 4, 8);
    const capeMat = new THREE.MeshToonMaterial({
      color: NOCTURNE_STYLE.palette.forestNight,
      side: THREE.DoubleSide,
    });
    this.capeMesh = new THREE.Mesh(capeGeo, capeMat);
    this.capeMesh.position.set(0, 0.85, -0.22);
    this.capeMesh.rotation.x = -0.05;
    this.group.add(this.capeMesh);

    // ──────────────────────────────────────────
    // 4. HEAD & HUMAN FACE (Eyes, Nose, Ears, Mouth, Hood/Hair)
    // ──────────────────────────────────────────
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.58, 0);

    // Warm human skin material
    const skinMat = new THREE.MeshToonMaterial({ color: 0xd8b598 });
    const hairMat = new THREE.MeshToonMaterial({ color: 0x221a16 });
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });
    const irisMat = new THREE.MeshBasicMaterial({ color: 0x1b2d35 });

    // Human Head Base
    const headBaseGeo = new THREE.SphereGeometry(0.17, 16, 16);
    const headMesh = new THREE.Mesh(headBaseGeo, skinMat);
    headMesh.position.set(0, 0.02, 0.04);
    this.headGroup.add(headMesh);

    // Outer Hood Shell / Cowl Drape (Framing the human face)
    const hoodGeo = new THREE.ConeGeometry(0.24, 0.42, 12);
    const hood = new THREE.Mesh(hoodGeo, mantleMat);
    hood.position.set(0, 0.12, -0.04);
    hood.rotation.x = -0.15;
    this.headGroup.add(hood);

    // Hair locks framing forehead
    const hairGeo = new THREE.BoxGeometry(0.18, 0.06, 0.08);
    const hairMesh = new THREE.Mesh(hairGeo, hairMat);
    hairMesh.position.set(0, 0.12, 0.16);
    this.headGroup.add(hairMesh);

    // Sculpted Nose
    const noseGeo = new THREE.ConeGeometry(0.022, 0.05, 8);
    const nose = new THREE.Mesh(noseGeo, skinMat);
    nose.position.set(0, 0.015, 0.21);
    nose.rotation.x = 1.35;
    this.headGroup.add(nose);

    // Left and Right Ears
    const earGeo = new THREE.SphereGeometry(0.035, 8, 8);
    const leftEar = new THREE.Mesh(earGeo, skinMat);
    leftEar.position.set(-0.17, 0.02, 0.04);
    leftEar.scale.set(0.4, 1.0, 0.7);
    const rightEar = new THREE.Mesh(earGeo, skinMat);
    rightEar.position.set(0.17, 0.02, 0.04);
    rightEar.scale.set(0.4, 1.0, 0.7);
    this.headGroup.add(leftEar, rightEar);

    // Human Eyes (Sclera + Iris + Ember Glow)
    const scleraGeo = new THREE.SphereGeometry(0.026, 8, 8);
    const pupilGeo = new THREE.SphereGeometry(0.015, 8, 8);

    const leftSclera = new THREE.Mesh(scleraGeo, eyeWhiteMat);
    leftSclera.position.set(-0.06, 0.045, 0.18);
    this.leftEye = new THREE.Mesh(pupilGeo, irisMat);
    this.leftEye.position.set(0, 0, 0.018);
    leftSclera.add(this.leftEye);

    const rightSclera = new THREE.Mesh(scleraGeo, eyeWhiteMat);
    rightSclera.position.set(0.06, 0.045, 0.18);
    this.rightEye = new THREE.Mesh(pupilGeo, irisMat);
    this.rightEye.position.set(0, 0, 0.018);
    rightSclera.add(this.rightEye);

    this.headGroup.add(leftSclera, rightSclera);

    // Eyebrows
    const browGeo = new THREE.BoxGeometry(0.05, 0.012, 0.01);
    const leftBrow = new THREE.Mesh(browGeo, hairMat);
    leftBrow.position.set(-0.06, 0.075, 0.19);
    leftBrow.rotation.z = 0.05;
    const rightBrow = new THREE.Mesh(browGeo, hairMat);
    rightBrow.position.set(0.06, 0.075, 0.19);
    rightBrow.rotation.z = -0.05;
    this.headGroup.add(leftBrow, rightBrow);

    // Articulated Human Mouth (Lips and mouth cavity)
    const mouthGeo = new THREE.BoxGeometry(0.065, 0.02, 0.02);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x241113 });
    this.mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
    this.mouthMesh.position.set(0, -0.05, 0.19);
    this.headGroup.add(this.mouthMesh);

    // Shadow Mask overlay (for mysterious shadowed effect in scene 1)
    const maskGeo = new THREE.SphereGeometry(0.20, 12, 12, 0, Math.PI);
    this.shadowMaskMesh = new THREE.Mesh(maskGeo, skinShadowMat);
    this.shadowMaskMesh.rotation.y = -Math.PI / 2;
    this.shadowMaskMesh.position.set(0, 0.02, 0.07);
    this.headGroup.add(this.shadowMaskMesh);

    this.group.add(this.headGroup);

    // ──────────────────────────────────────────
    // 5. ARTICULATED ARMS (Shoulder -> Bicep -> Elbow -> Forearm -> Hand)
    // ──────────────────────────────────────────
    const sleeveMat = new THREE.MeshToonMaterial({ color: NOCTURNE_STYLE.palette.slate });
    const handMat = new THREE.MeshToonMaterial({ color: NOCTURNE_STYLE.palette.mist });

    // LEFT ARM
    this.leftUpperArm = new THREE.Group();
    this.leftUpperArm.position.set(-0.32, 1.4, 0);

    const bicepGeo = new THREE.CylinderGeometry(0.06, 0.055, 0.3, 8);
    const leftBicep = new THREE.Mesh(bicepGeo, sleeveMat);
    leftBicep.position.y = -0.15;
    this.leftUpperArm.add(leftBicep);

    this.leftForearm = new THREE.Group();
    this.leftForearm.position.set(0, -0.3, 0);
    const forearmGeo = new THREE.CylinderGeometry(0.055, 0.05, 0.28, 8);
    const leftForearmMesh = new THREE.Mesh(forearmGeo, sleeveMat);
    leftForearmMesh.position.y = -0.14;

    const handGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const leftHand = new THREE.Mesh(handGeo, handMat);
    leftHand.position.set(0, -0.3, 0);

    this.leftForearm.add(leftForearmMesh, leftHand);
    this.leftUpperArm.add(this.leftForearm);
    this.group.add(this.leftUpperArm);

    // RIGHT ARM
    this.rightUpperArm = new THREE.Group();
    this.rightUpperArm.position.set(0.32, 1.4, 0);

    const rightBicep = new THREE.Mesh(bicepGeo, sleeveMat);
    rightBicep.position.y = -0.15;
    this.rightUpperArm.add(rightBicep);

    this.rightForearm = new THREE.Group();
    this.rightForearm.position.set(0, -0.3, 0);
    const rightForearmMesh = new THREE.Mesh(forearmGeo, sleeveMat);
    rightForearmMesh.position.y = -0.14;

    const rightHand = new THREE.Mesh(handGeo, handMat);
    rightHand.position.set(0, -0.3, 0);

    this.rightForearm.add(rightForearmMesh, rightHand);
    this.rightUpperArm.add(this.rightForearm);
    this.group.add(this.rightUpperArm);

    // ──────────────────────────────────────────
    // 6. ARTICULATED LEGS (Hip -> Thigh -> Knee -> Shin -> Boots)
    // ──────────────────────────────────────────
    const pantsMat = new THREE.MeshToonMaterial({ color: NOCTURNE_STYLE.palette.forestNight });

    // LEFT LEG
    this.leftThigh = new THREE.Group();
    this.leftThigh.position.set(-0.13, 0.65, 0);

    const thighGeo = new THREE.CylinderGeometry(0.075, 0.065, 0.35, 8);
    const leftThighMesh = new THREE.Mesh(thighGeo, pantsMat);
    leftThighMesh.position.y = -0.175;
    this.leftThigh.add(leftThighMesh);

    this.leftShin = new THREE.Group();
    this.leftShin.position.set(0, -0.35, 0);
    const shinGeo = new THREE.CylinderGeometry(0.065, 0.055, 0.32, 8);
    const leftShinMesh = new THREE.Mesh(shinGeo, pantsMat);
    leftShinMesh.position.y = -0.16;

    const bootGeo = new THREE.BoxGeometry(0.09, 0.08, 0.16);
    const leftBoot = new THREE.Mesh(bootGeo, bootsMat);
    leftBoot.position.set(0, -0.32, 0.03);

    this.leftShin.add(leftShinMesh, leftBoot);
    this.leftThigh.add(this.leftShin);
    this.group.add(this.leftThigh);

    // RIGHT LEG
    this.rightThigh = new THREE.Group();
    this.rightThigh.position.set(0.13, 0.65, 0);

    const rightThighMesh = new THREE.Mesh(thighGeo, pantsMat);
    rightThighMesh.position.y = -0.175;
    this.rightThigh.add(rightThighMesh);

    this.rightShin = new THREE.Group();
    this.rightShin.position.set(0, -0.35, 0);
    const rightShinMesh = new THREE.Mesh(shinGeo, pantsMat);
    rightShinMesh.position.y = -0.16;

    const rightBoot = new THREE.Mesh(bootGeo, bootsMat);
    rightBoot.position.set(0, -0.32, 0.03);

    this.rightShin.add(rightShinMesh, rightBoot);
    this.rightThigh.add(this.rightShin);
    this.group.add(this.rightThigh);

    this.setFaceVisibility("shadowed");
  }

  public setFaceVisibility(visibility: "full" | "shadowed" | "hidden") {
    this.faceVisibility = visibility;
    if (visibility === "full") {
      this.shadowMaskMesh.visible = false;
      this.leftEye.visible = true;
      this.rightEye.visible = true;
    } else if (visibility === "shadowed") {
      this.shadowMaskMesh.visible = true;
      (this.shadowMaskMesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
      this.leftEye.visible = true;
      this.rightEye.visible = true;
    } else {
      this.shadowMaskMesh.visible = true;
      (this.shadowMaskMesh.material as THREE.MeshBasicMaterial).opacity = 1.0;
      this.leftEye.visible = false;
      this.rightEye.visible = false;
    }
  }

  public updateLipSync(mouthOpenness: number, _visemeShape: string) {
    const height = Math.max(0.02, mouthOpenness * 0.08);
    const width = 0.07 + mouthOpenness * 0.04;
    this.mouthMesh.scale.set(width / 0.07, height / 0.02, 1.0);

    // Subtle eye glow pulse during speech
    const eyeIntensity = 0.8 + mouthOpenness * 0.35;
    this.leftEye.scale.setScalar(eyeIntensity);
    this.rightEye.scale.setScalar(eyeIntensity);
  }

  public applyWalkCycle(timeSeconds: number, speedMultiplier = 1.0) {
    const cycle = timeSeconds * 6.5 * speedMultiplier;

    // Natural hip and knee articulation:
    // Left leg stride
    const leftHipAngle = Math.sin(cycle) * 0.55;
    this.leftThigh.rotation.x = leftHipAngle;
    // Knee bends when leg swings back
    this.leftShin.rotation.x = Math.max(0.0, -Math.sin(cycle) * 0.65);

    // Right leg stride (antiphase)
    const rightHipAngle = -Math.sin(cycle) * 0.55;
    this.rightThigh.rotation.x = rightHipAngle;
    this.rightShin.rotation.x = Math.max(0.0, Math.sin(cycle) * 0.65);

    // Natural arm swinging with bent elbows
    this.leftUpperArm.rotation.x = -Math.sin(cycle) * 0.45;
    this.leftForearm.rotation.x = -0.25 - Math.abs(Math.sin(cycle)) * 0.2;

    this.rightUpperArm.rotation.x = Math.sin(cycle) * 0.45;
    this.rightForearm.rotation.x = -0.25 - Math.abs(Math.cos(cycle)) * 0.2;

    // Cape billows backward with stride
    this.capeMesh.rotation.x = -0.15 - Math.abs(Math.sin(cycle * 2)) * 0.12;

    // Gentle torso bob and pelvic roll
    this.group.position.y = Math.abs(Math.sin(cycle * 2)) * 0.04;
    this.group.rotation.z = Math.sin(cycle) * 0.02;
    this.group.rotation.y = Math.sin(cycle) * 0.04;
  }

  public applyIdle(timeSeconds: number) {
    const breathe = Math.sin(timeSeconds * 1.6);
    this.mantleGroup.position.y = breathe * 0.012;
    this.headGroup.position.y = 1.58 + breathe * 0.01;

    // Reset limbs to natural stance
    this.leftThigh.rotation.x = THREE.MathUtils.lerp(this.leftThigh.rotation.x, 0, 0.1);
    this.leftShin.rotation.x = THREE.MathUtils.lerp(this.leftShin.rotation.x, 0, 0.1);
    this.rightThigh.rotation.x = THREE.MathUtils.lerp(this.rightThigh.rotation.x, 0, 0.1);
    this.rightShin.rotation.x = THREE.MathUtils.lerp(this.rightShin.rotation.x, 0, 0.1);

    this.leftUpperArm.rotation.x = THREE.MathUtils.lerp(this.leftUpperArm.rotation.x, 0.05, 0.1);
    this.leftForearm.rotation.x = THREE.MathUtils.lerp(this.leftForearm.rotation.x, -0.15, 0.1);
    this.rightUpperArm.rotation.x = THREE.MathUtils.lerp(this.rightUpperArm.rotation.x, 0.05, 0.1);
    this.rightForearm.rotation.x = THREE.MathUtils.lerp(this.rightForearm.rotation.x, -0.15, 0.1);

    this.capeMesh.rotation.x = THREE.MathUtils.lerp(this.capeMesh.rotation.x, -0.05, 0.05);
    this.group.position.y = 0;
    this.group.rotation.z = 0;
  }

  public applyLookAround(timeSeconds: number) {
    this.applyIdle(timeSeconds);
    this.headGroup.rotation.y = Math.sin(timeSeconds * 2.0) * 0.42;
  }

  public applyReach(timeSeconds: number) {
    this.applyIdle(timeSeconds);
    // Reach upward and forward with right arm
    this.rightUpperArm.rotation.x = THREE.MathUtils.lerp(this.rightUpperArm.rotation.x, -1.4, 0.15);
    this.rightUpperArm.rotation.z = THREE.MathUtils.lerp(this.rightUpperArm.rotation.z, 0.35, 0.15);
    this.rightForearm.rotation.x = THREE.MathUtils.lerp(this.rightForearm.rotation.x, -0.1, 0.15);
  }
}
