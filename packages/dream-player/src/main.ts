import * as THREE from "three";

class DreamPlayerSpike {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private cube: THREE.Mesh;
  private frameCount = 0;
  private lastFpsTime = performance.now();
  private fpsDisplay: HTMLElement | null;

  constructor() {
    this.canvas = document.getElementById("dream-canvas") as HTMLCanvasElement;
    this.fpsDisplay = document.getElementById("fps-counter");

    // Initialize Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Initialize Scene & Fog (Forest Night / Nocturne look)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090d11);
    this.scene.fog = new THREE.FogExp2(0x0c1c17, 0.04);

    // Initialize Camera
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 1.5, 4);

    // Lighting (Warm Lantern key light + cool ambient)
    const ambientLight = new THREE.AmbientLight(0x1b2a4a, 0.8);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xe2b866, 1.5);
    dirLight.position.set(3, 4, 2);
    this.scene.add(dirLight);

    // Cel-shaded preview cube
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshToonMaterial({
      color: 0x437666, // viridian
    });

    this.cube = new THREE.Mesh(geometry, material);
    this.cube.position.y = 0.5;
    this.scene.add(this.cube);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.MeshToonMaterial({ color: 0x0c1c17 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    // Event listeners
    window.addEventListener("resize", this.onWindowResize.bind(this));

    // Start loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  private onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private animate(currentTime: number) {
    requestAnimationFrame(this.animate);

    // Rotate placeholder cube
    this.cube.rotation.x += 0.008;
    this.cube.rotation.y += 0.012;

    // Gentle camera drift
    this.camera.position.x = Math.sin(currentTime * 0.0005) * 0.3;
    this.camera.lookAt(0, 0.5, 0);

    // FPS calculation
    this.frameCount++;
    if (currentTime - this.lastFpsTime >= 500) {
      const fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFpsTime));
      if (this.fpsDisplay) {
        this.fpsDisplay.innerText = fps.toString();
      }
      this.frameCount = 0;
      this.lastFpsTime = currentTime;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Boot up player
window.addEventListener("DOMContentLoaded", () => {
  new DreamPlayerSpike();
});
