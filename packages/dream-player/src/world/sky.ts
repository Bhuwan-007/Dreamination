import * as THREE from "three";
import { NOCTURNE_STYLE } from "../config-loader";

export class DreamSky {
  public group: THREE.Group;
  private haloMesh: THREE.Mesh;
  private stars: THREE.Points;

  constructor() {
    this.group = new THREE.Group();

    // 1. Starfield Particles
    const starCount = NOCTURNE_STYLE.sky.starCount;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    const baseColor = new THREE.Color(NOCTURNE_STYLE.sky.starColor);
    const accentColor = new THREE.Color(NOCTURNE_STYLE.palette.lantern);

    for (let i = 0; i < starCount; i++) {
      // Distribute on an upper hemisphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.85 + 0.15); // upper dome
      const radius = 45 + Math.random() * 5;

      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.cos(phi);
      starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      const color = Math.random() > 0.3 ? baseColor : accentColor;
      starColors[i * 3] = color.r;
      starColors[i * 3 + 1] = color.g;
      starColors[i * 3 + 2] = color.b;
    }

    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });

    this.stars = new THREE.Points(starGeo, starMat);
    this.group.add(this.stars);

    // 2. The Golden Halo Ring (Signature Motif from Design.md)
    const haloGeo = new THREE.TorusGeometry(8.5, 0.08, 16, 64);
    const haloMat = new THREE.MeshBasicMaterial({
      color: NOCTURNE_STYLE.palette.lantern,
      transparent: true,
      opacity: 0.65,
    });

    this.haloMesh = new THREE.Mesh(haloGeo, haloMat);
    this.haloMesh.position.set(0, 16, -18);
    this.haloMesh.rotation.x = 0.35;
    this.group.add(this.haloMesh);

    // 3. Subtle Crescent Moon
    const moonGeo = new THREE.RingGeometry(1.6, 2.0, 32, 1, 0.4, Math.PI * 1.2);
    const moonMat = new THREE.MeshBasicMaterial({
      color: NOCTURNE_STYLE.palette.lanternSoft,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(-6, 20, -22);
    moon.rotation.z = -0.4;
    this.group.add(moon);
  }

  public update(time: number) {
    // Gentle rotation of the halo ring
    this.haloMesh.rotation.z = time * 0.00015;
    this.stars.rotation.y = time * 0.00005;
  }
}

