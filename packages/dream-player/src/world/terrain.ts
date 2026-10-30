import * as THREE from "three";
import { NOCTURNE_STYLE } from "../config-loader";

export class DreamTerrain {
  public mesh: THREE.Mesh;

  constructor() {
    const width = 60;
    const depth = 60;
    const segments = 64;

    const geometry = new THREE.PlaneGeometry(width, depth, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    // Apply gentle organic hills using harmonic sines
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);

      // Flatter central path for actor walking, undulating periphery
      const distFromCenter = Math.sqrt(x * x + z * z);
      const flattenFactor = Math.min(1.0, Math.max(0.0, (distFromCenter - 2.5) / 8.0));

      const elevation =
        (Math.sin(x * 0.18) * Math.cos(z * 0.15) * 0.8 +
          Math.sin(x * 0.35 + z * 0.2) * 0.4 +
          Math.cos(x * 0.08 - z * 0.1) * 1.2) *
        flattenFactor;

      positions.setY(i, elevation);
    }

    geometry.computeVertexNormals();

    const material = new THREE.MeshToonMaterial({
      color: NOCTURNE_STYLE.palette.forestNight,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.receiveShadow = true;
  }
}
