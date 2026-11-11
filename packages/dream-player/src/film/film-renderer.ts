/**
 * 2.5D living-ink renderer.
 *
 * Each scene is a THREE.Scene of textured planes at real depths (sky, mist, far objects,
 * characters, near objects, foreground) seen through one perspective camera, so camera
 * moves produce genuine parallax. Every scene renders into its own target; a composite
 * pass blends scenes for transitions and adds blackout, submerge tint, vignette, grain
 * and a caption/title overlay — so preview and export look identical.
 */
import * as THREE from "three";
import type { FilmManifest, FilmScene, FilmCast, FilmEffect } from "./types";
import {
  blackoutAt,
  cameraAt,
  captionAt,
  characterStateAt,
  clamp01,
  effectLevel,
  sceneIndexAt,
  smooth,
  speechAt,
  transitionAt,
} from "./film-timeline";

const FOV = 40;
const D = { sky: 60, mist: 34, far: 30, objMid: 18, chars: 16, objNear: 9, fg: 7, flood: 13.5, particles: 11 };
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const visH = (d: number) => 2 * d * TAN;

interface CharRig {
  cast: FilmCast;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  halo: THREE.Mesh;
  haloMat: THREE.MeshBasicMaterial;
  shadow: THREE.Mesh;
  shadowMat: THREE.MeshBasicMaterial;
  w: number;
  h: number;
  phase: number;
}

interface ObjRig {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  baseY: number;
  floating: boolean;
  phase: number;
}

interface ParticleRig {
  effect: FilmEffect;
  points: THREE.Points;
  mat: THREE.PointsMaterial;
  base: Float32Array;
  vel: Float32Array;
}

interface SceneRig {
  scene: FilmScene;
  three: THREE.Scene;
  fades: { mat: THREE.Material & { opacity: number }; base: number }[];
  chars: CharRig[];
  objects: ObjRig[];
  mist?: THREE.Mesh;
  flood?: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; effect: FilmEffect };
  glow?: { mat: THREE.MeshBasicMaterial; effect: FilmEffect };
  particles: ParticleRig[];
  floatEffect?: FilmEffect;
}

function radialTexture(inner: string, outer: string, size = 256): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const COMPOSITE_FRAG = /* glsl */ `
  uniform sampler2D tA;
  uniform sampler2D tB;
  uniform sampler2D tOverlay;
  uniform float uMix;
  uniform float uBlack;
  uniform float uTint;
  uniform vec3 uTintColor;
  uniform float uTime;
  uniform float uHasA;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec2 uv = vUv;
    // gentle underwater wobble during submerge transitions
    uv.x += sin(uv.y * 40.0 + uTime * 3.0) * 0.004 * uTint;
    vec3 b = texture2D(tB, uv).rgb;
    vec3 a = uHasA > 0.5 ? texture2D(tA, uv).rgb : b;
    vec3 col = mix(a, b, uMix);
    col = mix(col, col * uTintColor * 1.6, uTint * 0.55);
    float d = distance(vUv, vec2(0.5));
    col *= smoothstep(0.85, 0.32, d) * 0.25 + 0.75;            // vignette
    col += (hash(vUv * 1000.0 + uTime) - 0.5) * 0.035;          // film grain
    col = mix(col, vec3(0.0), uBlack);
    vec4 o = texture2D(tOverlay, vUv);
    col = mix(col, o.rgb, o.a);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const FLOOD_FRAG = /* glsl */ `
  uniform float uLevel;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float surface = uLevel + sin(vUv.x * 18.0 + uTime * 1.4) * 0.008 + sin(vUv.x * 7.0 - uTime * 0.9) * 0.012;
    if (vUv.y > surface) discard;
    float depth = clamp((surface - vUv.y) / 0.5, 0.0, 1.0);
    float rim = smoothstep(0.012, 0.0, surface - vUv.y);
    vec3 col = mix(uColor * 1.25, uColor * 0.45, depth) + rim * 0.35;
    gl_FragColor = vec4(col, (0.55 + depth * 0.35) * uOpacity);
  }
`;

const PASS_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const PLANE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

export class FilmRenderer {
  public readonly renderer: THREE.WebGLRenderer;
  private camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 200);
  private rigs: SceneRig[] = [];
  private textures = new Map<string, THREE.Texture>();
  private rtA: THREE.WebGLRenderTarget;
  private rtB: THREE.WebGLRenderTarget;
  private composite: THREE.ShaderMaterial;
  private compositeScene = new THREE.Scene();
  private compositeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private overlayCanvas = document.createElement("canvas");
  private overlayCtx: CanvasRenderingContext2D;
  private overlayTex: THREE.CanvasTexture;
  private overlayKey = "";
  private manifest: FilmManifest | null = null;
  private shadowTex = radialTexture("rgba(0,0,0,0.55)", "rgba(0,0,0,0)");
  private haloTex = radialTexture("rgba(255,236,190,0.9)", "rgba(255,236,190,0)");

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.rtA = new THREE.WebGLRenderTarget(16, 16, { colorSpace: THREE.SRGBColorSpace });
    this.rtB = new THREE.WebGLRenderTarget(16, 16, { colorSpace: THREE.SRGBColorSpace });
    this.overlayCanvas.width = 1920;
    this.overlayCanvas.height = 1080;
    this.overlayCtx = this.overlayCanvas.getContext("2d")!;
    this.overlayTex = new THREE.CanvasTexture(this.overlayCanvas);
    this.overlayTex.colorSpace = THREE.SRGBColorSpace;
    this.composite = new THREE.ShaderMaterial({
      vertexShader: PASS_VERT,
      fragmentShader: COMPOSITE_FRAG,
      uniforms: {
        tA: { value: this.rtA.texture },
        tB: { value: this.rtB.texture },
        tOverlay: { value: this.overlayTex },
        uMix: { value: 1 },
        uBlack: { value: 0 },
        uTint: { value: 0 },
        uTintColor: { value: new THREE.Color("#3f7f8c") },
        uTime: { value: 0 },
        uHasA: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.compositeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.composite));
  }

  setSize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    const px = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.rtA.setSize(px.x, px.y);
    this.rtB.setSize(px.x, px.y);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private loadTexture(url: string): Promise<THREE.Texture | null> {
    if (this.textures.has(url)) return Promise.resolve(this.textures.get(url)!);
    return new Promise((resolve) => {
      new THREE.TextureLoader().load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          this.textures.set(url, tex);
          resolve(tex);
        },
        undefined,
        () => resolve(null)
      );
    });
  }

  async load(m: FilmManifest, onProgress?: (k: number) => void): Promise<void> {
    this.dispose();
    this.manifest = m;
    const urls = new Set<string>();
    m.cast.forEach((c) => urls.add(c.figureUrl));
    m.scenes.forEach((s) => {
      s.layers.forEach((l) => urls.add(l.url));
      s.objects.forEach((o) => urls.add(o.url));
    });
    let done = 0;
    await Promise.all(
      [...urls].map(async (u) => {
        await this.loadTexture(u);
        done += 1;
        onProgress?.(done / Math.max(1, urls.size));
      })
    );
    this.rigs = m.scenes.map((s) => this.buildRig(m, s));
  }

  private plane(tex: THREE.Texture | null, w: number, h: number, opacity = 1, extra: Partial<THREE.MeshBasicMaterialParameters> = {}) {
    const mat = new THREE.MeshBasicMaterial({
      map: tex ?? undefined,
      color: tex ? 0xffffff : 0x10161b,
      transparent: true,
      opacity,
      depthWrite: false,
      ...extra,
    });
    return { mesh: new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat), mat };
  }

  private buildRig(m: FilmManifest, s: FilmScene): SceneRig {
    const three = new THREE.Scene();
    three.background = new THREE.Color(m.palette.ink || "#0b1014");
    const rig: SceneRig = { scene: s, three, fades: [], chars: [], objects: [], particles: [] };
    const aspect = 16 / 9;
    let order = 0;
    const add = (mesh: THREE.Mesh, mat: THREE.Material & { opacity: number }, z: number) => {
      mesh.position.z = -z;
      mesh.renderOrder = order++;
      three.add(mesh);
      rig.fades.push({ mat, base: mat.opacity });
    };

    // Sky / backdrop (opaque painting), mist band.
    const sky = s.layers.find((l) => l.depth === "sky");
    const skyH = visH(D.sky) * 1.22;
    const skyP = this.plane(sky ? this.textures.get(sky.url) ?? null : null, skyH * aspect, skyH);
    add(skyP.mesh, skyP.mat, D.sky);

    const mist = s.layers.find((l) => l.depth === "mist");
    if (mist) {
      const h = visH(D.mist) * 1.3;
      const p = this.plane(this.textures.get(mist.url) ?? null, h * aspect * 1.4, h, 0.85);
      add(p.mesh, p.mat, D.mist);
      rig.mist = p.mesh;
    }

    // Glow wash (effect)
    const glowFx = s.effects.find((e) => e.type === "glow");
    if (glowFx) {
      const h = visH(40) * 1.2;
      const p = this.plane(this.haloTex, h * aspect, h, 0, { blending: THREE.AdditiveBlending, color: new THREE.Color(m.palette.accent || "#E2B866") });
      add(p.mesh, p.mat, 40);
      rig.glow = { mat: p.mat, effect: glowFx };
    }

    const groundY = (d: number) => -visH(d) / 2 * 0.56;
    const stageX = (x: number, d: number) => x * (visH(d) * aspect) / 2 * 0.72;

    const CELESTIAL = /\b(star|stars|moon|sun|planet|comet|balloon|kite)\b|star trail/i;
    const addObject = (o: FilmScene["objects"][number], d: number, sizeK: number) => {
      const tex = this.textures.get(o.url) ?? null;
      const sky = CELESTIAL.test(o.name);
      const h = visH(d) * sizeK * (o.scale || 1) * (sky ? 0.7 : 1);
      const w = h * (o.aspect || 1);
      const p = this.plane(tex, w, h);
      // Celestial things hang in the sky; floating things hover; everything else stands on the ground.
      const baseY = sky ? visH(d) * 0.27 : groundY(d) + h / 2 + (o.floating ? visH(d) * 0.22 : 0);
      p.mesh.position.set(stageX(o.x, d), baseY, 0);
      add(p.mesh, p.mat, d);
      rig.objects.push({ mesh: p.mesh, mat: p.mat, baseY, floating: o.floating, phase: Math.random() * 6 });
    };

    s.objects.filter((o) => o.depth === "far").forEach((o) => addObject(o, D.far, 0.3));
    s.objects.filter((o) => o.depth === "mid").forEach((o) => addObject(o, D.objMid, 0.22));

    // Characters
    s.characters.forEach((sc, i) => {
      const cast = m.cast.find((c) => c.castId === sc.castId);
      if (!cast) return;
      const tex = this.textures.get(cast.figureUrl) ?? null;
      const h = visH(D.chars) * 0.42 * Math.min(1.25, Math.max(0.6, cast.height || 1)) * (cast.kind === "human" ? 1 : 0.85);
      const w = h * (cast.aspect || 0.45);
      const shadow = this.plane(this.shadowTex, w * 1.6, h * 0.08, 0.8);
      shadow.mesh.position.y = groundY(D.chars);
      add(shadow.mesh, shadow.mat, D.chars + 0.05);
      const halo = this.plane(this.haloTex, w * 2.2, h * 1.25, 0, { blending: THREE.AdditiveBlending });
      add(halo.mesh, halo.mat, D.chars + 0.02);
      const body = this.plane(tex, w, h);
      add(body.mesh, body.mat, D.chars - i * 0.01);
      rig.chars.push({
        cast, mesh: body.mesh, mat: body.mat, halo: halo.mesh, haloMat: halo.mat,
        shadow: shadow.mesh, shadowMat: shadow.mat, w, h, phase: i * 1.7,
      });
    });

    // Flood water (in front of characters so it can submerge them)
    const flood = s.effects.find((e) => e.type === "flood");
    if (flood) {
      const h = visH(D.flood) * 1.3;
      const mat = new THREE.ShaderMaterial({
        vertexShader: PLANE_VERT,
        fragmentShader: FLOOD_FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uLevel: { value: 0 },
          uTime: { value: 0 },
          uColor: { value: new THREE.Color("#2f6f7c") },
          uOpacity: { value: 1 },
        },
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect * 1.4, h), mat);
      mesh.position.z = -D.flood;
      mesh.renderOrder = order++;
      three.add(mesh);
      rig.flood = { mesh, mat, effect: flood };
    }

    s.objects.filter((o) => o.depth === "near").forEach((o) => addObject(o, D.objNear, 0.2));

    // Particles
    for (const fx of s.effects.filter((e) => ["rain", "snow", "ash", "fireflies"].includes(e.type))) {
      const n = fx.type === "rain" ? 700 : fx.type === "fireflies" ? 90 : 420;
      const base = new Float32Array(n * 3);
      const vel = new Float32Array(n * 3);
      const span = visH(D.particles) * aspect * 1.4;
      for (let i = 0; i < n; i++) {
        base[i * 3] = (Math.random() - 0.5) * span;
        base[i * 3 + 1] = (Math.random() - 0.5) * visH(D.particles) * 1.3;
        base[i * 3 + 2] = -D.particles + (Math.random() - 0.5) * 6;
        const vy = fx.type === "rain" ? -9 - Math.random() * 3 : fx.type === "snow" ? -0.7 - Math.random() * 0.4 : fx.type === "ash" ? -0.35 : 0;
        vel[i * 3] = fx.type === "rain" ? -1.2 : (Math.random() - 0.5) * 0.4;
        vel[i * 3 + 1] = vy;
        vel[i * 3 + 2] = Math.random() * 6.283;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(base.slice(), 3));
      const color = fx.type === "fireflies" ? m.palette.glow || "#F3D998" : fx.type === "ash" ? "#8a7f78" : "#cfd9d6";
      const mat = new THREE.PointsMaterial({
        color: new THREE.Color(color),
        size: fx.type === "rain" ? 0.05 : fx.type === "fireflies" ? 0.14 : 0.09,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: fx.type === "fireflies" ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const points = new THREE.Points(geo, mat);
      points.renderOrder = order++;
      three.add(points);
      rig.particles.push({ effect: fx, points, mat, base, vel });
    }

    // Foreground framing silhouettes (nearest)
    const near = s.layers.find((l) => l.depth === "near");
    if (near) {
      const h = visH(D.fg) * 1.5;
      const p = this.plane(this.textures.get(near.url) ?? null, h * aspect, h);
      p.mesh.position.y = -visH(D.fg) * 0.06;
      add(p.mesh, p.mat, D.fg);
    }

    rig.floatEffect = s.effects.find((e) => e.type === "float");
    return rig;
  }

  private updateRig(rig: SceneRig, t: number, opacity: number) {
    const s = rig.scene;
    const lt = t - s.startTime;
    for (const f of rig.fades) f.mat.opacity = f.base * opacity;

    if (rig.mist) rig.mist.position.x = Math.sin(lt * 0.05) * 2.0;
    const floatK = rig.floatEffect ? effectLevel(rig.floatEffect, s, t) : 0;

    const speech = speechAt(s, t);
    const aspect = 16 / 9;
    const stageX = (x: number) => x * (visH(D.chars) * aspect) / 2 * 0.72;
    const ground = -visH(D.chars) / 2 * 0.56;
    let focusX = 0;
    let focusW = 0;

    for (const c of rig.chars) {
      const st = characterStateAt(s, c.cast.castId, t);
      const x = stageX(st.x);
      const walkBob = st.walking ? Math.abs(Math.sin((lt + c.phase) * Math.PI * 1.9)) * c.h * 0.025 : 0;
      const breathe = 1 + Math.sin(lt * 1.6 + c.phase) * 0.006;
      const lift = floatK * c.h * (0.12 + 0.04 * Math.sin(lt * 1.3 + c.phase));
      c.mesh.position.x = x; // z (depth) is fixed at build time
      c.mesh.position.y = ground + c.h / 2 + walkBob + lift;
      c.mesh.scale.set(st.facing, breathe, 1);
      c.mesh.rotation.z = (st.walking ? Math.sin((lt + c.phase) * Math.PI * 1.9) * 0.025 : 0) + st.gesture * 0.07 * st.facing;
      const dim = speech && speech.castId !== "narrator" && !st.speaking ? 0.72 : 1;
      c.mat.color.setScalar(dim);
      c.mat.opacity = st.opacity * opacity;
      c.halo.position.x = x;
      c.halo.position.y = ground + c.h * 0.55 + lift;
      const pulse = st.speaking ? 0.32 + 0.08 * Math.sin(lt * 9) : 0.06;
      c.haloMat.opacity = pulse * st.opacity * opacity;
      c.shadow.position.x = x;
      c.shadowMat.opacity = 0.8 * st.opacity * opacity * (1 - floatK * 0.6);
      if (st.speaking && speech) {
        const w = smooth((t - speech.startTime) / 0.6) * smooth((speech.startTime + speech.duration - t) / 0.6);
        focusX = x;
        focusW = w;
      }
    }

    for (const o of rig.objects) {
      const bob = o.floating || floatK > 0 ? Math.sin(lt * 0.9 + o.phase) * 0.18 + floatK * 0.8 : 0;
      o.mesh.position.y = o.baseY + bob;
      o.mesh.rotation.z = floatK * Math.sin(lt * 0.5 + o.phase) * 0.12;
    }

    if (rig.flood) {
      const k = effectLevel(rig.flood.effect, s, t);
      rig.flood.mat.uniforms.uLevel.value = 0.02 + k * 0.42;
      rig.flood.mat.uniforms.uTime.value = lt;
      rig.flood.mat.uniforms.uOpacity.value = opacity;
    }
    if (rig.glow) rig.glow.mat.opacity = effectLevel(rig.glow.effect, s, t) * (0.35 + 0.1 * Math.sin(lt * 1.5)) * opacity;

    for (const p of rig.particles) {
      const k = effectLevel(p.effect, s, t);
      p.mat.opacity = k * opacity * (p.effect.type === "fireflies" ? 0.9 : 0.7);
      const pos = p.points.geometry.getAttribute("position") as THREE.BufferAttribute;
      const span = visH(D.particles) * aspect * 1.4;
      const hh = visH(D.particles) * 1.3;
      for (let i = 0; i < pos.count; i++) {
        let x = p.base[i * 3] + p.vel[i * 3] * lt;
        let y = p.base[i * 3 + 1] + p.vel[i * 3 + 1] * lt;
        if (p.effect.type === "fireflies") {
          x += Math.sin(lt * 0.7 + p.vel[i * 3 + 2]) * 0.8;
          y += Math.cos(lt * 0.5 + p.vel[i * 3 + 2]) * 0.5;
        } else if (p.effect.type === "snow" || p.effect.type === "ash") {
          x += Math.sin(lt * 0.8 + p.vel[i * 3 + 2]) * 0.3;
        }
        x = ((((x + span / 2) % span) + span) % span) - span / 2;
        y = ((((y + hh / 2) % hh) + hh) % hh) - hh / 2;
        pos.setXY(i, x, y);
      }
      pos.needsUpdate = true;
    }

    const cam = cameraAt(s, t);
    this.camera.position.set(cam.x + focusX * 0.12 * focusW, cam.y, cam.z);
  }

  private drawOverlay(m: FilmManifest, t: number) {
    const cap = captionAt(m, t);
    const i = sceneIndexAt(m, t);
    const s = m.scenes[i];
    const titleA = clamp01(1 - (t - 3.2) / 1.2) * clamp01(t / 0.8);
    const headA = s ? clamp01((t - s.startTime - 0.6) / 0.6) * clamp01(1 - (t - s.startTime - 3.6) / 0.8) : 0;
    const key = `${cap?.text}|${cap?.activeWord}|${titleA.toFixed(2)}|${headA.toFixed(2)}|${i}`;
    if (key === this.overlayKey) return;
    this.overlayKey = key;
    const g = this.overlayCtx;
    const W = this.overlayCanvas.width;
    const H = this.overlayCanvas.height;
    g.clearRect(0, 0, W, H);

    if (titleA > 0.01) {
      g.globalAlpha = titleA;
      g.fillStyle = "rgba(6,9,12,0.35)";
      g.fillRect(0, H * 0.38, W, H * 0.24);
      g.textAlign = "center";
      g.fillStyle = "#f1e6c8";
      g.font = "italic 300 76px 'Fraunces', Georgia, serif";
      g.fillText(m.title, W / 2, H * 0.5);
      g.font = "400 26px 'Instrument Sans', system-ui, sans-serif";
      g.fillStyle = "rgba(226,184,102,0.9)";
      g.fillText("a dream, remembered", W / 2, H * 0.56);
    }
    if (headA > 0.01 && s && t > 4.4) {
      g.globalAlpha = headA * 0.9;
      g.textAlign = "left";
      g.font = "italic 400 34px 'Fraunces', Georgia, serif";
      g.fillStyle = "#e9dfc4";
      g.fillText(s.heading, 72, 92);
    }
    if (cap) {
      g.globalAlpha = 1;
      g.textAlign = "center";
      g.font = "400 40px 'Newsreader', Georgia, serif";
      const words = cap.words;
      const spaced = words.join(" ");
      const maxW = W * 0.72;
      // wrap into lines
      const lines: { text: string; from: number }[] = [];
      let line = "";
      let from = 0;
      words.forEach((w, idx) => {
        const test = line ? `${line} ${w}` : w;
        if (g.measureText(test).width > maxW && line) {
          lines.push({ text: line, from });
          line = w;
          from = idx;
        } else line = test;
      });
      if (line) lines.push({ text: line, from });
      const lh = 52;
      const baseY = H - 70 - (lines.length - 1) * lh;
      const boxW = Math.min(maxW + 80, g.measureText(spaced).width + 80);
      g.fillStyle = "rgba(6,9,12,0.62)";
      g.fillRect(W / 2 - boxW / 2, baseY - 56 - (cap.name ? 38 : 0), boxW, lines.length * lh + 34 + (cap.name ? 38 : 0));
      if (cap.name) {
        g.font = "600 24px 'Instrument Sans', system-ui, sans-serif";
        const col = m.cast.find((c) => c.castId === cap.castId)?.color || "#E2B866";
        g.fillStyle = col;
        g.fillText(cap.name.toUpperCase(), W / 2, baseY - 44);
        g.font = "400 40px 'Newsreader', Georgia, serif";
      } else {
        g.font = "italic 400 40px 'Newsreader', Georgia, serif";
      }
      lines.forEach((ln, li) => {
        const lineWords = ln.text.split(" ");
        let x = W / 2 - g.measureText(ln.text).width / 2;
        g.textAlign = "left";
        lineWords.forEach((w, wi) => {
          const idx = ln.from + wi;
          g.fillStyle = idx <= cap.activeWord ? "#f6ecd2" : "rgba(246,236,210,0.5)";
          g.fillText(w, x, baseY + li * lh);
          x += g.measureText(`${w} `).width;
        });
      });
    }
    g.globalAlpha = 1;
    this.overlayTex.needsUpdate = true;
  }

  render(t: number) {
    const m = this.manifest;
    if (!m || !this.rigs.length) {
      this.renderer.setRenderTarget(null);
      this.renderer.clear();
      return;
    }
    const tt = Math.max(0, Math.min(t, m.totalDuration - 0.001));
    const idx = sceneIndexAt(m, tt);
    const tr = transitionAt(m, tt);
    const cur = this.rigs[idx];

    let mix = 1;
    let hasA = 0;
    if (tr && tr.from >= 0 && (tr.kind === "dissolve" || tr.kind === "submerge")) {
      const prev = this.rigs[tr.from];
      this.updateRig(prev, Math.min(tt, prev.scene.endTime - 0.001), 1);
      this.renderer.setRenderTarget(this.rtA);
      this.renderer.render(prev.three, this.camera);
      mix = tr.k;
      hasA = 1;
    }
    this.updateRig(cur, tt, 1);
    this.renderer.setRenderTarget(this.rtB);
    this.renderer.render(cur.three, this.camera);

    this.drawOverlay(m, tt);
    const u = this.composite.uniforms;
    u.uMix.value = mix;
    u.uHasA.value = hasA;
    u.uBlack.value = blackoutAt(m, tt);
    u.uTint.value = tr && tr.kind === "submerge" ? Math.sin(tr.k * Math.PI) : 0;
    u.uTime.value = tt;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.compositeScene, this.compositeCam);
  }

  dispose() {
    for (const rig of this.rigs) {
      rig.three.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | undefined;
        if (mat) mat.dispose();
      });
    }
    this.rigs = [];
  }
}
