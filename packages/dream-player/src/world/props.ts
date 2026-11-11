import * as THREE from "three";
import { NOCTURNE_STYLE } from "../config-loader";

export interface AnchorMap {
  [name: string]: THREE.Vector3;
}

export const WORLD_KIT_ANCHORS: Record<string, AnchorMap> = {
  field: {
    origin: new THREE.Vector3(0, 0, 0),
    center: new THREE.Vector3(0, 0, 0),
    tree_hill: new THREE.Vector3(4.5, 0.8, -6.0),
    fence_edge: new THREE.Vector3(-4.0, 0, -2.0),
    path_start: new THREE.Vector3(0, 0, 6.0),
    path_end: new THREE.Vector3(1.5, 0, -8.0),
    horizon_rock: new THREE.Vector3(-6.0, 1.2, -10.0),
  },
  corridor: {
    origin: new THREE.Vector3(0, 0, 0),
    door_near: new THREE.Vector3(0, 0, 4.0),
    door_far: new THREE.Vector3(0, 0, -10.0),
    center: new THREE.Vector3(0, 0, 0),
    left_wall: new THREE.Vector3(-2.0, 0, -2.0),
    right_wall: new THREE.Vector3(2.0, 0, -2.0),
    threshold: new THREE.Vector3(0, 0, -5.0),
    alcove: new THREE.Vector3(-2.5, 0, 1.0),
  },
  water: {
    origin: new THREE.Vector3(0, 0, 0),
    shore_near: new THREE.Vector3(0, 0, 4.0),
    deep_water: new THREE.Vector3(0, -0.4, -9.0),
    center: new THREE.Vector3(0, 0, 0),
    submerged_pillar: new THREE.Vector3(-3.2, -0.2, -4.5),
    distant_dock: new THREE.Vector3(2.5, 0.2, -7.0),
    reflection_edge: new THREE.Vector3(0, 0, 1.5),
  },
  city: {
    origin: new THREE.Vector3(0, 0, 0),
    center: new THREE.Vector3(0, 0, 0),
    crossroads: new THREE.Vector3(0, 0, 0),
    street_corner: new THREE.Vector3(-3.5, 0, -2.5),
    alley_entrance: new THREE.Vector3(3.0, 0, -5.0),
    high_balcony: new THREE.Vector3(-2.5, 3.5, -4.0),
    under_lantern: new THREE.Vector3(1.8, 0, 1.0),
    rooftop_edge: new THREE.Vector3(0, 4.5, -8.0),
  },
  void: {
    origin: new THREE.Vector3(0, 0, 0),
    center: new THREE.Vector3(0, 0, 0),
    door_far: new THREE.Vector3(0, 0, -8.0),
    door_near: new THREE.Vector3(0, 0, 4.0),
    left_sky: new THREE.Vector3(-2.8, 3.6, -4.5),
    right_sky: new THREE.Vector3(2.8, 3.6, -4.5),
    center_left: new THREE.Vector3(-2.4, 0, -1.8),
    center_right: new THREE.Vector3(2.4, 0, -1.8),
    floating_frame: new THREE.Vector3(2.5, 2.5, -4.0),
    star_threshold: new THREE.Vector3(0, 0, -8.0),
    periphery_left: new THREE.Vector3(-4.5, 0, -2.0),
    periphery_right: new THREE.Vector3(4.5, 0, -2.0),
    deep_abyss: new THREE.Vector3(0, -2.0, -12.0),
  },
  void_meadow: {
    origin: new THREE.Vector3(0, 0, 0),
    center: new THREE.Vector3(0, 0, 0),
    door_far: new THREE.Vector3(0, 0, -8.0),
    door_near: new THREE.Vector3(0, 0, 4.0),
    left_sky: new THREE.Vector3(-2.8, 3.6, -4.5),
    right_sky: new THREE.Vector3(2.8, 3.6, -4.5),
    center_left: new THREE.Vector3(-2.4, 0, -1.8),
    center_right: new THREE.Vector3(2.4, 0, -1.8),
    floating_frame: new THREE.Vector3(2.5, 2.5, -4.0),
    star_threshold: new THREE.Vector3(0, 0, -8.0),
    periphery_left: new THREE.Vector3(-4.5, 0, -2.0),
    periphery_right: new THREE.Vector3(4.5, 0, -2.0),
    deep_abyss: new THREE.Vector3(0, -2.0, -12.0),
  },
  forest: {
    origin: new THREE.Vector3(0, 0, 0),
    ancient_trunk: new THREE.Vector3(3.5, 0, -4.0),
    moss_clearing: new THREE.Vector3(0, 0, 0),
    center: new THREE.Vector3(0, 0, 0),
    shadow_brambles: new THREE.Vector3(-4.0, 0, -2.5),
    winding_trail: new THREE.Vector3(0.5, 0, 4.5),
    canopy_gap: new THREE.Vector3(0, 5.0, -3.0),
  },
  interior: {
    origin: new THREE.Vector3(0, 0, 0),
    doorway: new THREE.Vector3(0, 0, 5.0),
    center_rug: new THREE.Vector3(0, 0, 0),
    center: new THREE.Vector3(0, 0, 0),
    hearth: new THREE.Vector3(0, 0, -5.0),
    window_ledge: new THREE.Vector3(-3.5, 1.2, -1.0),
    alcove_bookshelf: new THREE.Vector3(3.5, 0, -1.5),
    stair_base: new THREE.Vector3(-2.8, 0, 3.0),
  },
};

export class DreamProps {
  public group: THREE.Group;
  public currentKit = "void";
  public anchors: AnchorMap = WORLD_KIT_ANCHORS.void;

  private activePropMeshes: THREE.Object3D[] = [];
  private floatingObjects: THREE.Object3D[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.setWorldKit("void");
  }

  public setWorldKit(kitName: string, placements?: Array<{ id: string; anchor: string }>) {
    this.currentKit = kitName;
    this.anchors = WORLD_KIT_ANCHORS[kitName] || WORLD_KIT_ANCHORS.void;

    // Clear previous props
    for (const p of this.activePropMeshes) {
      this.group.remove(p);
    }
    this.activePropMeshes = [];
    this.floatingObjects = [];

    // If explicit placements provided from director script
    if (placements && placements.length > 0) {
      for (const place of placements) {
        let anchorPos = this.anchors[place.anchor];
        if (!anchorPos) {
          if (place.anchor.includes("left")) {
            anchorPos = new THREE.Vector3(-3.2, 2.5, -4.0);
          } else if (place.anchor.includes("right")) {
            anchorPos = new THREE.Vector3(3.2, 2.5, -4.0);
          } else if (place.anchor.includes("far")) {
            anchorPos = new THREE.Vector3(0, 0, -8.0);
          } else {
            anchorPos = new THREE.Vector3(-2.0, 0, -2.5);
          }
        }
        const propMesh = this.createPropById(place.id, anchorPos.clone());
        if (propMesh) {
          this.group.add(propMesh);
          this.activePropMeshes.push(propMesh);
        }
      }
    } else {
      // Default kit props
      this.buildDefaultKitProps(kitName);
    }
  }

  private buildDefaultKitProps(kit: string) {
    switch (kit) {
      case "corridor": {
        const arch = this.createStoneArch(this.anchors.door_far || new THREE.Vector3(0, 0, -10));
        const lockers = this.createLockerRow(this.anchors.left_wall || new THREE.Vector3(-2, 0, -2));
        this.group.add(arch, lockers);
        this.activePropMeshes.push(arch, lockers);
        break;
      }
      case "water": {
        const dock = this.createDock(this.anchors.distant_dock || new THREE.Vector3(2, 0, -6));
        const pillar = this.createPillar(this.anchors.submerged_pillar || new THREE.Vector3(-3, 0, -4));
        this.group.add(dock, pillar);
        this.activePropMeshes.push(dock, pillar);
        break;
      }
      case "field": {
        const tree = this.createTree(this.anchors.tree_hill || new THREE.Vector3(4, 0, -6));
        const boulder = this.createBoulder(this.anchors.horizon_rock || new THREE.Vector3(-5, 0, -8));
        this.group.add(tree, boulder);
        this.activePropMeshes.push(tree, boulder);
        break;
      }
      case "city": {
        const lamp = this.createStreetlamp(this.anchors.under_lantern || new THREE.Vector3(2, 0, 1));
        this.group.add(lamp);
        this.activePropMeshes.push(lamp);
        break;
      }
      case "forest": {
        const tree1 = this.createTree(this.anchors.ancient_trunk || new THREE.Vector3(3.5, 0, -4));
        const tree2 = this.createTree(new THREE.Vector3(-4, 0, -5));
        this.group.add(tree1, tree2);
        this.activePropMeshes.push(tree1, tree2);
        break;
      }
      case "interior": {
        const hearth = this.createHearth(this.anchors.hearth || new THREE.Vector3(0, 0, -5));
        const shelf = this.createBookshelf(this.anchors.alcove_bookshelf || new THREE.Vector3(3.5, 0, -1.5));
        this.group.add(hearth, shelf);
        this.activePropMeshes.push(hearth, shelf);
        break;
      }
      default: {
        // Void kit
        const arch = this.createStoneArch(this.anchors.star_threshold || new THREE.Vector3(0, 0, -8));
        const frame = this.createFloatingFrame(this.anchors.floating_frame || new THREE.Vector3(2.5, 1.8, -4));
        this.group.add(arch, frame);
        this.activePropMeshes.push(arch, frame);
        this.floatingObjects.push(frame);
      }
    }
  }

  private createPropById(id: string, pos: THREE.Vector3): THREE.Object3D | null {
    let obj: THREE.Object3D | null = null;
    if (id.includes("clock")) {
      obj = this.createFloatingClock(pos);
      this.floatingObjects.push(obj);
    } else if (id.includes("door") || id.includes("arch")) {
      obj = this.createStoneArch(pos);
    } else if (id.includes("locker")) {
      obj = this.createLockerRow(pos);
    } else if (id.includes("tree")) {
      obj = this.createTree(pos);
    } else if (id.includes("lamp") || id.includes("lantern")) {
      obj = this.createStreetlamp(pos);
    } else if (id.includes("dock")) {
      obj = this.createDock(pos);
    } else if (id.includes("hearth") || id.includes("fireplace")) {
      obj = this.createHearth(pos);
    } else if (id.includes("shelf") || id.includes("book")) {
      obj = this.createBookshelf(pos);
    } else if (id.includes("frame") || id.includes("mirror")) {
      obj = this.createFloatingFrame(pos);
      this.floatingObjects.push(obj);
    } else {
      obj = this.createPillar(pos);
    }
    return obj;
  }

  public createFloatingClock(pos: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();
    const goldMat = new THREE.MeshBasicMaterial({ color: NOCTURNE_STYLE.palette.lantern });
    const faceMat = new THREE.MeshBasicMaterial({
      color: NOCTURNE_STYLE.palette.forestNight,
      transparent: true,
      opacity: 0.65,
    });

    const ringGeo = new THREE.TorusGeometry(0.85, 0.045, 16, 32);
    const ring = new THREE.Mesh(ringGeo, goldMat);
    group.add(ring);

    const faceGeo = new THREE.CircleGeometry(0.82, 24);
    const face = new THREE.Mesh(faceGeo, faceMat);
    group.add(face);

    const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 0.02), goldMat);
    hourHand.position.set(0, 0.18, 0.02);
    group.add(hourHand);

    const minHand = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.65, 0.02), goldMat);
    minHand.position.set(0.18, 0.22, 0.02);
    minHand.rotation.z = -0.7;
    group.add(minHand);

    const y = Math.max(3.2, pos.y);
    group.position.set(pos.x, y, pos.z);
    group.userData.baseY = y;
    return group;
  }

  public createStoneArch(pos: THREE.Vector3): THREE.Group {
    const archGroup = new THREE.Group();
    const stoneMat = new THREE.MeshToonMaterial({ color: NOCTURNE_STYLE.palette.slate });
    const goldMat = new THREE.MeshBasicMaterial({ color: NOCTURNE_STYLE.palette.lantern });

    const pillarGeo = new THREE.BoxGeometry(0.4, 3.2, 0.4);
    const left = new THREE.Mesh(pillarGeo, stoneMat);
    left.position.set(-1.1, 1.6, 0);
    const right = new THREE.Mesh(pillarGeo, stoneMat);
    right.position.set(1.1, 1.6, 0);

    const archTopGeo = new THREE.TorusGeometry(1.1, 0.2, 16, 32, Math.PI);
    const archTop = new THREE.Mesh(archTopGeo, stoneMat);
    archTop.position.set(0, 3.2, 0);

    const innerLeft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 3.1, 0.04), goldMat);
    innerLeft.position.set(-0.95, 1.55, 0.05);
    const innerRight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 3.1, 0.04), goldMat);
    innerRight.position.set(0.95, 1.55, 0.05);

    const lightFanGeo = new THREE.PlaneGeometry(2.0, 3.8);
    const lightFanMat = new THREE.MeshBasicMaterial({
      color: NOCTURNE_STYLE.palette.lanternSoft,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    });
    const lightFan = new THREE.Mesh(lightFanGeo, lightFanMat);
    lightFan.position.set(0, 1.9, 0);

    archGroup.add(left, right, archTop, innerLeft, innerRight, lightFan);
    archGroup.position.copy(pos);
    return archGroup;
  }

  public createFloatingFrame(pos: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();
    const frameMat = new THREE.MeshBasicMaterial({ color: NOCTURNE_STYLE.palette.lantern });
    const mirrorMat = new THREE.MeshBasicMaterial({
      color: NOCTURNE_STYLE.palette.water,
      transparent: true,
      opacity: 0.45,
    });

    const frameOuter = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.08), frameMat);
    const frameInner = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.0, 0.1), mirrorMat);
    group.add(frameOuter, frameInner);
    group.position.copy(pos);
    return group;
  }

  public createStreetlamp(pos: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();
    const ironMat = new THREE.MeshToonMaterial({ color: NOCTURNE_STYLE.palette.graphite });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.0, 8), ironMat);
    post.position.y = 1.5;

    const lanternMat = new THREE.MeshBasicMaterial({ color: NOCTURNE_STYLE.palette.lanternSoft });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.35), lanternMat);
    lamp.position.set(0.3, 2.9, 0);

    group.add(post, lamp);
    group.position.copy(pos);
    return group;
  }

  public createLockerRow(pos: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();
    const metalMat = new THREE.MeshToonMaterial({ color: NOCTURNE_STYLE.palette.ash });
    for (let i = 0; i < 4; i++) {
      const locker = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.5), metalMat);
      locker.position.set(i * 0.55, 1.1, 0);
      group.add(locker);
    }
    group.position.copy(pos);
    return group;
  }

  public createTree(pos: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshToonMaterial({ color: NOCTURNE_STYLE.palette.graphite });
    const leavesMat = new THREE.MeshToonMaterial({ color: NOCTURNE_STYLE.palette.forestNight });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 3.5, 8), trunkMat);
    trunk.position.y = 1.75;
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(2.0, 1), leavesMat);
    crown.position.y = 4.2;

    group.add(trunk, crown);
    group.position.copy(pos);
    return group;
  }

  public createDock(pos: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshToonMaterial({ color: NOCTURNE_STYLE.palette.graphite });
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.15, 5.0), woodMat);
    plank.position.y = 0.2;
    group.add(plank);
    group.position.copy(pos);
    return group;
  }

  public createPillar(pos: THREE.Vector3): THREE.Mesh {
    const stoneMat = new THREE.MeshToonMaterial({ color: NOCTURNE_STYLE.palette.slate });
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 2.4, 12), stoneMat);
    // Never place pillar on top of center actor origin
    const posX = Math.abs(pos.x) < 0.6 && Math.abs(pos.z) < 0.6 ? -2.8 : pos.x;
    const posZ = Math.abs(pos.x) < 0.6 && Math.abs(pos.z) < 0.6 ? -3.5 : pos.z;
    pillar.position.set(posX, pos.y + 1.2, posZ);
    return pillar;
  }

  public createBoulder(pos: THREE.Vector3): THREE.Mesh {
    const stoneMat = new THREE.MeshToonMaterial({ color: NOCTURNE_STYLE.palette.ash });
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 1), stoneMat);
    boulder.position.set(pos.x, pos.y + 0.6, pos.z);
    return boulder;
  }

  public createHearth(pos: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();
    const brickMat = new THREE.MeshToonMaterial({ color: NOCTURNE_STYLE.palette.slate });
    const glowMat = new THREE.MeshBasicMaterial({ color: NOCTURNE_STYLE.palette.lantern });

    const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 0.8), brickMat);
    chimney.position.y = 1.2;
    const fire = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), glowMat);
    fire.position.set(0, 0.4, 0.2);

    group.add(chimney, fire);
    group.position.copy(pos);
    return group;
  }

  public createBookshelf(pos: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshToonMaterial({ color: NOCTURNE_STYLE.palette.graphite });
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.5), woodMat);
    shelf.position.y = 1.3;
    group.add(shelf);
    group.position.copy(pos);
    return group;
  }

  public update(timeSeconds: number) {
    // Subtle float oscillation on designated floating items without drift
    for (let i = 0; i < this.floatingObjects.length; i++) {
      const obj = this.floatingObjects[i];
      const baseY = typeof obj.userData.baseY === "number" ? obj.userData.baseY : obj.position.y;
      obj.position.y = baseY + Math.sin(timeSeconds * 1.5 + i) * 0.18;
      obj.rotation.y = Math.sin(timeSeconds * 0.4 + i) * 0.08;
    }
  }
}
