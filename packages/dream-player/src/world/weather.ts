import * as THREE from "three";
import { WeatherType } from "../types/director";
import { NOCTURNE_STYLE } from "../config-loader";

export class DreamWeatherSystem {
  public group: THREE.Group;
  public currentWeather: WeatherType = "none";

  private particleCount = 600;
  private particlesMesh: THREE.Points | null = null;
  private particlePositions: Float32Array;
  private particleVelocities: Float32Array;

  constructor() {
    this.group = new THREE.Group();
    this.particlePositions = new Float32Array(this.particleCount * 3);
    this.particleVelocities = new Float32Array(this.particleCount * 3);

    this.initParticles();
    this.setWeather("none");
  }

  private initParticles() {
    const geometry = new THREE.BufferGeometry();

    for (let i = 0; i < this.particleCount; i++) {
      this.resetParticle(i, true);
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(this.particlePositions, 3));

    const material = new THREE.PointsMaterial({
      size: 0.12,
      color: NOCTURNE_STYLE.palette.mist,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particlesMesh = new THREE.Points(geometry, material);
    this.group.add(this.particlesMesh);
  }

  private resetParticle(index: number, randomY = false) {
    const idx = index * 3;
    // Bound particles within a cylinder around the camera/scene
    this.particlePositions[idx] = (Math.random() - 0.5) * 24.0;
    this.particlePositions[idx + 1] = randomY ? Math.random() * 12.0 : 12.0;
    this.particlePositions[idx + 2] = (Math.random() - 0.5) * 24.0;

    // Velocities depend on weather type
    if (this.currentWeather === "rain") {
      this.particleVelocities[idx] = -0.05 + Math.random() * 0.02;
      this.particleVelocities[idx + 1] = -0.5 - Math.random() * 0.3; // fast down
      this.particleVelocities[idx + 2] = -0.05;
    } else if (this.currentWeather === "snow") {
      this.particleVelocities[idx] = (Math.random() - 0.5) * 0.05;
      this.particleVelocities[idx + 1] = -0.08 - Math.random() * 0.06; // gentle down
      this.particleVelocities[idx + 2] = (Math.random() - 0.5) * 0.05;
    } else if (this.currentWeather === "ash") {
      // Rising glowing embers
      this.particleVelocities[idx] = (Math.random() - 0.5) * 0.04;
      this.particleVelocities[idx + 1] = 0.04 + Math.random() * 0.08; // upward float
      this.particleVelocities[idx + 2] = (Math.random() - 0.5) * 0.04;
      if (!randomY) {
        this.particlePositions[idx + 1] = -0.2; // spawn near ground
      }
    }
  }

  public setWeather(weather: WeatherType) {
    this.currentWeather = weather;
    if (!this.particlesMesh) return;

    if (weather === "none") {
      this.particlesMesh.visible = false;
      return;
    }

    this.particlesMesh.visible = true;
    const mat = this.particlesMesh.material as THREE.PointsMaterial;

    if (weather === "rain") {
      mat.color.setHex(NOCTURNE_STYLE.palette.water);
      mat.size = 0.08;
      mat.opacity = 0.55;
    } else if (weather === "snow") {
      mat.color.setHex(NOCTURNE_STYLE.palette.cloud);
      mat.size = 0.16;
      mat.opacity = 0.75;
    } else if (weather === "ash") {
      mat.color.setHex(NOCTURNE_STYLE.palette.lantern);
      mat.size = 0.14;
      mat.opacity = 0.85;
    }

    // Re-seed particles for new weather
    for (let i = 0; i < this.particleCount; i++) {
      this.resetParticle(i, true);
    }
  }

  public update(deltaSeconds: number, timeSeconds: number) {
    if (this.currentWeather === "none" || !this.particlesMesh) return;

    const pos = this.particlesMesh.geometry.attributes.position as THREE.BufferAttribute;

    for (let i = 0; i < this.particleCount; i++) {
      const idx = i * 3;
      // Add wind turbulence
      const windX = Math.sin(timeSeconds * 0.8 + i) * 0.02;

      this.particlePositions[idx] += (this.particleVelocities[idx] + windX) * (deltaSeconds * 30);
      this.particlePositions[idx + 1] += this.particleVelocities[idx + 1] * (deltaSeconds * 30);
      this.particlePositions[idx + 2] += this.particleVelocities[idx + 2] * (deltaSeconds * 30);

      // Boundary wraps
      if (this.currentWeather === "ash") {
        if (this.particlePositions[idx + 1] > 14.0) {
          this.resetParticle(i, false);
        }
      } else {
        if (this.particlePositions[idx + 1] < -0.5) {
          this.resetParticle(i, false);
        }
      }
    }

    pos.needsUpdate = true;
  }
}

