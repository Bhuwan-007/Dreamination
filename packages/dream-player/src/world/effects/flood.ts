import * as THREE from "three";
import { NOCTURNE_STYLE } from "../../config-loader";

export class DreamFloodEffect {
  public mesh: THREE.Mesh;
  private initialY = -1.5;
  private currentY = -1.5;
  private targetY = 1.1;
  private startTime = -1;
  private duration = 5.0;
  private isFlooding = false;

  constructor() {
    const geometry = new THREE.PlaneGeometry(80, 80, 48, 48);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshToonMaterial({
      color: NOCTURNE_STYLE.palette.water,
      transparent: true,
      opacity: 0.72,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.y = this.initialY;
    this.mesh.receiveShadow = true;
  }

  public trigger(currentTimeSeconds: number, durationSeconds: number, targetLevel = 1.1) {
    this.startTime = currentTimeSeconds;
    this.duration = durationSeconds;
    this.targetY = targetLevel;
    this.isFlooding = true;
  }

  public reset() {
    this.isFlooding = false;
    this.startTime = -1;
    this.currentY = this.initialY;
    this.mesh.position.y = this.initialY;
  }

  public setProgress(progress: number) {
    // Direct scrubbing support
    const eased = Math.sin((progress * Math.PI) / 2);
    this.currentY = THREE.MathUtils.lerp(this.initialY, this.targetY, Math.min(1.0, Math.max(0.0, eased)));
    this.mesh.position.y = this.currentY;
  }

  public update(timeSeconds: number) {
    if (this.isFlooding && this.startTime >= 0) {
      const elapsed = timeSeconds - this.startTime;
      const progress = Math.min(1.0, Math.max(0.0, elapsed / this.duration));
      // Ease-out cubic for realistic water crest
      const eased = 1.0 - Math.pow(1.0 - progress, 3.0);
      this.currentY = THREE.MathUtils.lerp(this.initialY, this.targetY, eased);
      this.mesh.position.y = this.currentY;
    }

    // Animated surface ripple
    const positions = this.mesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const ripple = Math.sin(x * 0.4 + timeSeconds * 1.8) * Math.cos(z * 0.35 + timeSeconds * 1.5) * 0.04;
      positions.setY(i, ripple);
    }
    positions.needsUpdate = true;
  }
}
