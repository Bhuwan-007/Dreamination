import * as THREE from "three";
import { NOCTURNE_STYLE } from "../config-loader";

export interface AnchorMap {
  [name: string]: THREE.Vector3;
}

export class DreamProps {
  public group: THREE.Group;
  public anchors: AnchorMap = {
    door_far: new THREE.Vector3(0, 0, -8),
    center: new THREE.Vector3(0, 0, 0),
    center_left: new THREE.Vector3(-2.8, 0, -1.2),
    left_sky: new THREE.Vector3(-3.5, 3.2, -4),
    right_sky: new THREE.Vector3(3.8, 3.6, -5),
    water_edge: new THREE.Vector3(0, 0, 2),
  };

  private floatingClocks: THREE.Group[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.buildStoneArch();
    this.buildLanternPillar();
    this.buildFloatingClocks();
  }

  /**
   * Stone Arch at door_far: Signature arched doorway frame with light fan
   */
  private buildStoneArch() {
    const archGroup = new THREE.Group();
    const pos = this.anchors.door_far;

    const stoneMat = new THREE.MeshToonMaterial({
      color: NOCTURNE_STYLE.palette.slate,
    });

    const goldOutlineMat = new THREE.MeshBasicMaterial({
      color: NOCTURNE_STYLE.palette.lantern,
    });

    // Left and right pillars
    const pillarGeo = new THREE.BoxGeometry(0.4, 3.2, 0.4);
    const leftPillar = new THREE.Mesh(pillarGeo, stoneMat);
    leftPillar.position.set(-1.1, 1.6, 0);
    const rightPillar = new THREE.Mesh(pillarGeo, stoneMat);
    rightPillar.position.set(1.1, 1.6, 0);

    // Arch top curve (Torus half)
    const archTopGeo = new THREE.TorusGeometry(1.1, 0.2, 16, 32, Math.PI);
    const archTop = new THREE.Mesh(archTopGeo, stoneMat);
    archTop.position.set(0, 3.2, 0);

    // Thin golden decorative frame inner border
    const innerFrameGeo = new THREE.BoxGeometry(0.04, 3.1, 0.04);
    const innerLeft = new THREE.Mesh(innerFrameGeo, goldOutlineMat);
    innerLeft.position.set(-0.95, 1.55, 0.05);
    const innerRight = new THREE.Mesh(innerFrameGeo, goldOutlineMat);
    innerRight.position.set(0.95, 1.55, 0.05);

    // Light fan spilling through arch
    const lightFanGeo = new THREE.PlaneGeometry(2.0, 3.8);
    const lightFanMat = new THREE.MeshBasicMaterial({
      color: NOCTURNE_STYLE.palette.lanternSoft,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    });
    const lightFan = new THREE.Mesh(lightFanGeo, lightFanMat);
    lightFan.position.set(0, 1.9, 0);

    // Doorway point light
    const doorLight = new THREE.PointLight(NOCTURNE_STYLE.palette.lantern, 1.8, 8);
    doorLight.position.set(0, 2.2, 0.5);

    archGroup.add(leftPillar, rightPillar, archTop, innerLeft, innerRight, lightFan, doorLight);
    archGroup.position.copy(pos);
    this.group.add(archGroup);
  }

  /**
   * Lantern Pillar at center_left: dark wooden post with glowing paper lantern
   */
  private buildLanternPillar() {
    const pillarGroup = new THREE.Group();
    const pos = this.anchors.center_left;

    const woodMat = new THREE.MeshToonMaterial({
      color: NOCTURNE_STYLE.palette.graphite,
    });

    const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 2.4, 8);
    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.y = 1.2;

    const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8);
    const arm = new THREE.Mesh(armGeo, woodMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(0.3, 2.3, 0);

    // Lantern body (octahedron / sphere)
    const lanternGeo = new THREE.OctahedronGeometry(0.24, 1);
    const lanternMat = new THREE.MeshBasicMaterial({
      color: NOCTURNE_STYLE.palette.lanternSoft,
    });
    const lantern = new THREE.Mesh(lanternGeo, lanternMat);
    lantern.position.set(0.55, 2.05, 0);

    // Warm lantern light
    const lanternLight = new THREE.PointLight(NOCTURNE_STYLE.palette.lantern, 2.2, 6);
    lanternLight.position.set(0.55, 2.05, 0);

    pillarGroup.add(post, arm, lantern, lanternLight);
    pillarGroup.position.copy(pos);
    this.group.add(pillarGroup);
  }

  /**
   * Floating Clocks in the air (without hands, per dream script)
   */
  private buildFloatingClocks() {
    const clockPositions = [this.anchors.left_sky, this.anchors.right_sky];

    const faceMat = new THREE.MeshBasicMaterial({
      color: NOCTURNE_STYLE.palette.cloud,
      transparent: true,
      opacity: 0.85,
    });

    const rimMat = new THREE.MeshBasicMaterial({
      color: NOCTURNE_STYLE.palette.lantern,
    });

    clockPositions.forEach((pos, idx) => {
      const clockGroup = new THREE.Group();

      // Outer bezel
      const rimGeo = new THREE.TorusGeometry(0.7, 0.06, 12, 32);
      const rim = new THREE.Mesh(rimGeo, rimMat);

      // Dial face
      const dialGeo = new THREE.CircleGeometry(0.68, 32);
      const dial = new THREE.Mesh(dialGeo, faceMat);

      // Subtle ticking hour marks (tiny dots along perimeter)
      const markGeo = new THREE.BoxGeometry(0.02, 0.08, 0.02);
      const markMat = new THREE.MeshBasicMaterial({ color: 0x282e31 });
      for (let h = 0; h < 12; h++) {
        const angle = (h / 12) * Math.PI * 2;
        const mark = new THREE.Mesh(markGeo, markMat);
        mark.position.set(Math.sin(angle) * 0.55, Math.cos(angle) * 0.55, 0.01);
        mark.rotation.z = -angle;
        clockGroup.add(mark);
      }

      clockGroup.add(rim, dial);
      clockGroup.position.copy(pos);
      clockGroup.userData = { initialY: pos.y, phase: idx * 2.0 };

      this.floatingClocks.push(clockGroup);
      this.group.add(clockGroup);
    });
  }

  public update(time: number, isFloatingActive = false) {
    // Clocks floating / bobbing in the dream air
    const amplitude = isFloatingActive ? 0.35 : 0.12;
    const speed = isFloatingActive ? 0.002 : 0.001;

    this.floatingClocks.forEach((clock) => {
      const initialY = clock.userData.initialY;
      const phase = clock.userData.phase;
      clock.position.y = initialY + Math.sin(time * speed + phase) * amplitude;
      clock.rotation.y = Math.sin(time * 0.0004 + phase) * 0.2;
    });
  }
}
