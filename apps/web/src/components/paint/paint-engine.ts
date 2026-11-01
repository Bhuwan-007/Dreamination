/**
 * Pure PaintEngine class for The Paint Theatre.
 * Manages arc trajectories, splash mask mathematics, coverage sampling,
 * dirty-flag layer caching, and Kintsugi shard geometry.
 *
 * Strictly adheres to project semantic palette:
 * Lantern gold #E2B866, Lake teal #559CA9, Leaf green #909653,
 * Dusk rose #C9747C, Mist #BDCEBC.
 */

export type PigmentMode = "true" | "lantern" | "lake" | "leaf" | "dusk_rose" | "mist";

export interface PigmentDef {
  key: PigmentMode;
  name: string;
  hex: string;
  label: string;
}

export const PALETTE_PIGMENTS: PigmentDef[] = [
  { key: "true", name: "True Memory", hex: "#E2B866", label: "Reveals true colours" },
  { key: "lantern", name: "Lantern Gold", hex: "#E2B866", label: "Gold pigment" },
  { key: "lake", name: "Lake Teal", hex: "#559CA9", label: "Deep lake pigment" },
  { key: "leaf", name: "Leaf Green", hex: "#909653", label: "Verdant leaf pigment" },
  { key: "dusk_rose", name: "Dusk Rose", hex: "#C9747C", label: "Subtle rose pigment" },
  { key: "mist", name: "Mist Silver", hex: "#BDCEBC", label: "Silverpoint mist pigment" },
];

export interface BalloonTrajectory {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  arcHeight: number;
  duration: number; // in seconds (0.3 - 0.55s)
  pigment: PigmentMode;
  color: string;
  wobblePhase: number;
}

export interface FlyingBalloon extends BalloonTrajectory {
  id: string;
  elapsed: number;
  chapterIndex: number;
  splashRadius: number;
}

export interface WetSplash {
  id: string;
  chapterIndex: number;
  x: number;
  y: number;
  radius: number;
  color: string;
  pigment: PigmentMode;
  elapsed: number;
  duration: number; // ~0.9s
  isDry: boolean;
}

export interface SatelliteDroplet {
  x: number;
  y: number;
  radius: number;
}

export interface RippleRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

export interface DropletParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
}

export interface ChapterState {
  index: number;
  name: string;
  isDirty: boolean;
  coverage: number; // 0.0 to 1.0
  isFullyRevealed: boolean;
  lastCoverageSampleTime: number;
}

export interface ShardPolygon {
  id: number;
  ox: number; // normalized origin offset
  oy: number;
  dx: number; // scatter vector
  dy: number;
  points: [number, number][]; // relative polygon points
}

export interface CoverTransform {
  stageWidth: number;
  stageHeight: number;
  imageWidth: number;
  imageHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  renderedWidth: number;
  renderedHeight: number;
}

export interface AnchorDef {
  id: string;
  label: string;
  x: number; // normalized [0, 1] in image space
  y: number;
  r: number; // normalized radius
}

export interface HotspotDef {
  id: string;
  label: string;
  x: number; // normalized [0, 1] in image space
  y: number;
  r: number; // normalized radius
  whisper?: string;
}

export interface CalmZoneDef {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ChapterConfig {
  index: number;
  key: string;
  name: string;
  headline: string;
  poeticCopy: string;
  artSrc: string;
  inkSrc: string;
  artSrcTall?: string;
  inkSrcTall?: string;
  aspect: "16:9" | "3:2" | "9:16";
  maskWidth: number;
  maskHeight: number;
  calmZone: CalmZoneDef;
  calmZoneTall?: CalmZoneDef;
  hotspots: HotspotDef[];
  anchors?: AnchorDef[];
}

export const CHAPTER_CONFIGS: ChapterConfig[] = [
  {
    index: 0,
    key: "portal-window",
    name: "I. The Awakening Archway",
    headline: "Step through the dream.",
    poeticCopy: "Tell us the fragments. We'll find the way back.",
    artSrc: "/art/portal-window.webp",
    inkSrc: "/art/ink/portal-window.webp",
    aspect: "16:9",
    maskWidth: 960,
    maskHeight: 540,
    calmZone: { x: 0.0603, y: 0.0794, width: 0.40, height: 0.30 },
    hotspots: [
      { id: "lantern", label: "The Traveler's Lantern", x: 0.52, y: 0.56, r: 0.12 },
      { id: "threshold", label: "The Portal Arch", x: 0.50, y: 0.42, r: 0.14 },
      { id: "sky", label: "The Pale Horizon", x: 0.50, y: 0.22, r: 0.10 },
    ],
    anchors: [
      { id: "arch", label: "Arch interior", x: 0.50, y: 0.42, r: 0.14 },
    ],
  },
  {
    index: 1,
    key: "night-void",
    name: "II. Sea of Doors",
    headline: "The night between.",
    poeticCopy: "Where doors drift, waiting to be remembered.",
    artSrc: "/art/night-void.webp",
    inkSrc: "/art/ink/night-void.webp",
    aspect: "16:9",
    maskWidth: 960,
    maskHeight: 540,
    calmZone: { x: 0.0603, y: 0.0794, width: 0.40, height: 0.30 },
    hotspots: [
      { id: "star-halo", label: "The Star Halo", x: 0.50, y: 0.30, r: 0.14 },
      { id: "door", label: "The Floating Door", x: 0.50, y: 0.55, r: 0.13 },
      { id: "water", label: "The Night Tide", x: 0.35, y: 0.72, r: 0.12 },
    ],
    anchors: [
      { id: "door", label: "Central glowing doorway", x: 0.50, y: 0.54, r: 0.14 },
      { id: "floating-frame", label: "Large floating frame", x: 0.76, y: 0.48, r: 0.15 },
    ],
  },
  {
    index: 2,
    key: "fragments",
    name: "III. Constellation of Fragments",
    headline: "You wake with only pieces.",
    poeticCopy: "A door, a tide, a face you almost knew.",
    artSrc: "/art/fragments.webp",
    inkSrc: "/art/ink/fragments.webp",
    aspect: "3:2",
    maskWidth: 960,
    maskHeight: 640,
    calmZone: { x: 0.0601, y: 0.0802, width: 0.40, height: 0.30 },
    hotspots: [
      { id: "mirror", label: "The Floating Frame", x: 0.42, y: 0.35, r: 0.14 },
      { id: "pool", label: "The Ink Water", x: 0.65, y: 0.62, r: 0.13 },
      { id: "stars", label: "The Fragment Stars", x: 0.24, y: 0.22, r: 0.10 },
    ],
    anchors: [
      { id: "mirror", label: "The Floating Frame", x: 0.42, y: 0.35, r: 0.14 },
    ],
  },
  {
    index: 3,
    key: "weave",
    name: "IV. Kintsugi Weave",
    headline: "We stitch without flattening the strange.",
    poeticCopy: "Every splash closes a seam in gold.",
    artSrc: "/art/weave.webp",
    inkSrc: "/art/ink/weave.webp",
    aspect: "3:2",
    maskWidth: 960,
    maskHeight: 640,
    calmZone: { x: 0.0601, y: 0.6014, width: 0.40, height: 0.30 },
    hotspots: [
      { id: "gold-seam", label: "The Golden Seam", x: 0.50, y: 0.48, r: 0.15 },
      { id: "left-shard", label: "The Memory Shard", x: 0.28, y: 0.42, r: 0.13 },
      { id: "light", label: "The Weaving Light", x: 0.72, y: 0.54, r: 0.12 },
    ],
    anchors: [
      { id: "castle", label: "Golden castle", x: 0.52, y: 0.44, r: 0.16 },
    ],
  },
  {
    index: 4,
    key: "scenery-color",
    name: "V. Living Dream Sanctum",
    headline: "A world coloured by your own hand.",
    poeticCopy: "Now tell us the dream.",
    artSrc: "/art/scenery-color.webp",
    inkSrc: "/art/ink/scenery-color.webp",
    artSrcTall: "/art/scenery-color-tall.webp",
    inkSrcTall: "/art/ink/scenery-color-tall.webp",
    aspect: "16:9",
    maskWidth: 960,
    maskHeight: 540,
    calmZone: { x: 0.3401, y: 0.0794, width: 0.40, height: 0.30 },
    calmZoneTall: { x: 0.5039, y: 0.3198, width: 0.40, height: 0.30 },
    hotspots: [
      { id: "tree", label: "The Old Tree", x: 0.20, y: 0.40, r: 0.14 },
      { id: "arch", label: "The Waterfall Arch", x: 0.50, y: 0.58, r: 0.15 },
      { id: "island", label: "The Floating Castle", x: 0.80, y: 0.25, r: 0.13 },
      { id: "lantern", label: "The Sanctuary Lantern", x: 0.12, y: 0.72, r: 0.10 },
    ],
    anchors: [
      { id: "castle", label: "Floating castle", x: 0.80, y: 0.25, r: 0.13 },
      { id: "arch", label: "Stone waterfall arch", x: 0.50, y: 0.58, r: 0.15 },
    ],
  },
];

export class PaintEngine {
  public static readonly GRID_COLS = 32;
  public static readonly GRID_ROWS = 18;
  public static readonly TOTAL_GRID_CELLS = 32 * 18; // 576
  public static readonly MAX_THROWS_PER_SEC = 8;
  public static readonly MIN_THROW_INTERVAL_MS = 1000 / 8; // 125ms

  // Kintsugi Shards (7 irregular shards for Chapter IV weave.webp)
  public static readonly KINTSUGI_SHARDS: ShardPolygon[] = [
    {
      id: 0,
      ox: -0.22,
      oy: -0.16,
      dx: -1.1,
      dy: -0.9,
      points: [[-80, -65], [55, -80], [75, 35], [-55, 65]],
    },
    {
      id: 1,
      ox: -0.08,
      oy: -0.12,
      dx: -0.5,
      dy: -0.6,
      points: [[-65, -55], [75, -70], [60, 50], [-75, 45]],
    },
    {
      id: 2,
      ox: 0.12,
      oy: -0.06,
      dx: 0.3,
      dy: -0.3,
      points: [[-130, -120], [160, -150], [145, 120], [-105, 105]],
    },
    {
      id: 3,
      ox: -0.14,
      oy: 0.12,
      dx: -0.7,
      dy: 0.6,
      points: [[-105, -55], [85, -65], [105, 75], [-85, 85]],
    },
    {
      id: 4,
      ox: 0.04,
      oy: 0.14,
      dx: 0.1,
      dy: 0.7,
      points: [[-120, -75], [95, -55], [75, 85], [-145, 70]],
    },
    {
      id: 5,
      ox: 0.24,
      oy: 0.16,
      dx: 1.1,
      dy: 0.8,
      points: [[-65, -75], [85, -105], [55, 85], [-95, 105]],
    },
    {
      id: 6,
      ox: -0.02,
      oy: 0.02,
      dx: -0.1,
      dy: -0.2,
      points: [[-50, -45], [45, -50], [50, 45], [-45, 50]],
    },
  ];

  private chapterStates: ChapterState[];
  private lastThrowTimestamp = 0;

  constructor() {
    this.chapterStates = Array.from({ length: 5 }, (_, i) => ({
      index: i,
      name: `Chapter ${i + 1}`,
      isDirty: true,
      coverage: 0,
      isFullyRevealed: false,
      lastCoverageSampleTime: 0,
    }));
  }

  // =========================================================================
  // 1. ARC & BALLOON MATHEMATICS
  // =========================================================================

  /**
   * Calculates flight duration for parabolic arc: clamped between 0.30s and 0.55s.
   */
  public static calculateFlightDuration(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number
  ): number {
    const dist = Math.hypot(targetX - startX, targetY - startY);
    return Math.max(0.3, Math.min(0.55, dist / 1350));
  }

  /**
   * Calculates parabolic arc height based on distance.
   */
  public static calculateArcHeight(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number
  ): number {
    const dist = Math.hypot(targetX - startX, targetY - startY);
    return 100 + dist * 0.18;
  }

  /**
   * Computes the 2D balloon position at progress t in [0, 1].
   * Uses sinusoidal parabolic arc formula:
   * x(t) = startX + (targetX - startX) * t
   * y(t) = startY + (targetY - startY) * t - sin(t * PI) * arcHeight
   */
  public static computeBalloonPosition(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    arcHeight: number,
    t: number
  ): { x: number; y: number } {
    const clampedT = Math.max(0, Math.min(1, t));
    const x = startX + (targetX - startX) * clampedT;
    const linearY = startY + (targetY - startY) * clampedT;
    const arcOffset = Math.sin(clampedT * Math.PI) * arcHeight;
    return {
      x,
      y: linearY - arcOffset,
    };
  }

  /**
   * Computes perspective scale as the balloon travels into the scene.
   * Starts near viewer at ~1.6x, shrinks to ~0.85x at impact.
   */
  public static computeBalloonScale(t: number): number {
    const clampedT = Math.max(0, Math.min(1, t));
    return 1.6 - clampedT * 0.75;
  }

  /**
   * Computes ground shadow below flying balloon.
   */
  public static computeGroundShadow(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    t: number
  ): { x: number; y: number; alpha: number; scaleX: number; scaleY: number } {
    const clampedT = Math.max(0, Math.min(1, t));
    const x = startX + (targetX - startX) * clampedT;
    const y = startY + (targetY - startY) * clampedT;
    const heightFactor = Math.sin(clampedT * Math.PI);
    const alpha = 0.28 * (1 - heightFactor * 0.45);
    const scaleX = 1 + heightFactor * 0.4;
    const scaleY = 0.35 + heightFactor * 0.15;
    return { x, y, alpha, scaleX, scaleY };
  }

  /**
   * Computes balloon wobble rotation angle in radians.
   */
  public static computeBalloonWobble(
    time: number,
    wobblePhase: number,
    t: number
  ): number {
    const clampedT = Math.max(0, Math.min(1, t));
    return Math.sin(time * 16 + wobblePhase) * 0.16 * (1 - clampedT * 0.5);
  }

  // =========================================================================
  // 2. SPLASH PHYSICS & SHAPE GENERATION
  // =========================================================================

  /**
   * Generates a multi-lobed irregular ragged splash contour.
   */
  public static generateLobedContour(
    baseRadius: number,
    seedX: number,
    seedY: number,
    lobeCount = 18
  ): [number, number][] {
    const points: [number, number][] = [];
    for (let i = 0; i <= lobeCount; i++) {
      const angle = (i / lobeCount) * Math.PI * 2;
      // Multi-frequency harmonic variation
      const rVar =
        baseRadius *
        (0.82 +
          0.26 * Math.sin(i * 3.7 + seedX) +
          0.18 * Math.cos(i * 5.3 + seedY) +
          0.06 * Math.sin(i * 11.3));
      const px = Math.cos(angle) * rVar;
      const py = Math.sin(angle) * rVar;
      points.push([px, py]);
    }
    return points;
  }

  /**
   * Generates 12-16 satellite droplets around splash impact.
   */
  public static generateSatelliteDroplets(
    baseRadius: number,
    count = 14
  ): SatelliteDroplet[] {
    const droplets: SatelliteDroplet[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + ((i * 17) % 7) * 0.2;
      const dist = baseRadius * (0.8 + 0.65 * ((i * 31) % 11) / 11);
      const rad = 3.5 + 8.5 * ((i * 23) % 7) / 7;
      droplets.push({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        radius: rad,
      });
    }
    return droplets;
  }

  /**
   * Calculates wet edge easing outward over ~0.9s.
   * Uses cubic ease-out.
   */
  public static computeWetSplashRadius(
    maxRadius: number,
    elapsed: number,
    duration = 0.9
  ): { currentRadius: number; isDry: boolean; rimDarkness: number } {
    const progress = Math.min(1, Math.max(0, elapsed / duration));
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const currentRadius = maxRadius * easeOut;
    const isDry = progress >= 1;
    // Darker pooled-pigment rim active while wet
    const rimDarkness = (1 - progress) * 0.35;
    return { currentRadius, isDry, rimDarkness };
  }

  // =========================================================================
  // 3. MASK COVERAGE GRID SAMPLING (32x18)
  // =========================================================================

  /**
   * Samples mask coverage across a 32x18 uniform grid.
   * Can accept a 1-channel or 4-channel image buffer or pixel array.
   */
  public static sampleCoverage(
    maskAlphaArray: Uint8ClampedArray | number[],
    width: number,
    height: number,
    cols = PaintEngine.GRID_COLS,
    rows = PaintEngine.GRID_ROWS,
    alphaThreshold = 30,
    channels = 1
  ): number {
    if (!maskAlphaArray || maskAlphaArray.length === 0 || width <= 0 || height <= 0) {
      return 0;
    }

    let coveredCount = 0;
    const totalCells = cols * rows;

    for (let r = 0; r < rows; r++) {
      const py = Math.floor(((r + 0.5) / rows) * height);
      for (let c = 0; c < cols; c++) {
        const px = Math.floor(((c + 0.5) / cols) * width);
        const index = (py * width + px) * channels;
        const alpha = channels === 1 ? maskAlphaArray[index] : maskAlphaArray[index + 3];

        if (alpha !== undefined && alpha >= alphaThreshold) {
          coveredCount++;
        }
      }
    }

    return coveredCount / totalCells;
  }

  // =========================================================================
  // 4. DIRTY-FLAG CACHING & CHAPTER STATE
  // =========================================================================

  public isDirty(chapterIndex: number): boolean {
    const state = this.chapterStates[chapterIndex];
    return state ? state.isDirty : false;
  }

  public markDirty(chapterIndex: number): void {
    const state = this.chapterStates[chapterIndex];
    if (state) {
      state.isDirty = true;
    }
  }

  public clearDirty(chapterIndex: number): void {
    const state = this.chapterStates[chapterIndex];
    if (state) {
      state.isDirty = false;
    }
  }

  public getCoverage(chapterIndex: number): number {
    const state = this.chapterStates[chapterIndex];
    return state ? state.coverage : 0;
  }

  public setCoverage(chapterIndex: number, coverage: number): void {
    const state = this.chapterStates[chapterIndex];
    if (state) {
      state.coverage = Math.min(1, Math.max(0, coverage));
      if (state.coverage >= 0.98) {
        state.isFullyRevealed = true;
      }
    }
  }

  public areAllChaptersComplete(): boolean {
    return this.chapterStates.every((s) => s.coverage >= 0.7 || s.isFullyRevealed);
  }

  public getChapterState(chapterIndex: number): ChapterState | undefined {
    return this.chapterStates[chapterIndex];
  }

  // =========================================================================
  // 5. THROTTLING BALLOON THROWS (MAX 8 PER SECOND)
  // =========================================================================

  /**
   * Validates if a throw is allowed according to the 8 throws/sec rate limit.
   */
  public canThrow(timestamp: number): boolean {
    if (timestamp - this.lastThrowTimestamp >= PaintEngine.MIN_THROW_INTERVAL_MS) {
      this.lastThrowTimestamp = timestamp;
      return true;
    }
    return false;
  }

  public recordThrow(timestamp: number): void {
    this.lastThrowTimestamp = timestamp;
  }

  // =========================================================================
  // 6. CHAPTER IV KINTSUGI SHARDS MATH
  // =========================================================================

  /**
   * Computes shard center position based on kintsugiFactor [0, 1].
   * At 0: Shards are scattered far apart.
   * At 1: Shards are stitched tight.
   */
  public static computeShardOffset(
    shard: ShardPolygon,
    kintsugiFactor: number,
    viewportWidth: number,
    viewportHeight: number
  ): { x: number; y: number } {
    const spread = (1 - Math.min(1, Math.max(0, kintsugiFactor))) * 140;
    const cx = viewportWidth * 0.5 + shard.ox * viewportWidth;
    const cy = viewportHeight * 0.5 + shard.oy * viewportHeight;
    return {
      x: cx + shard.dx * spread,
      y: cy + shard.dy * spread,
    };
  }

  /**
   * Increases kintsugiFactor by 8% per hit.
   */
  public static healWeave(currentFactor: number, increment = 0.08): number {
    return Math.min(1.0, currentFactor + increment);
  }

  // =========================================================================
  // 7. IMAGE-SPACE COVER TRANSFORM & COORDINATE MAPPING
  // =========================================================================

  /**
   * Computes the uniform scale and centering offsets used by CSS object-fit: cover.
   */
  public static computeCoverTransform(
    stageWidth: number,
    stageHeight: number,
    imageWidth: number,
    imageHeight: number
  ): CoverTransform {
    const scale = Math.max(stageWidth / imageWidth, stageHeight / imageHeight);
    const renderedWidth = imageWidth * scale;
    const renderedHeight = imageHeight * scale;
    const offsetX = (stageWidth - renderedWidth) / 2;
    const offsetY = (stageHeight - renderedHeight) / 2;
    return {
      stageWidth,
      stageHeight,
      imageWidth,
      imageHeight,
      scale,
      offsetX,
      offsetY,
      renderedWidth,
      renderedHeight,
    };
  }

  /**
   * Maps a viewport/stage point (e.g. click or touch) into image coordinate space.
   */
  public static mapStageToImage(
    stageX: number,
    stageY: number,
    transform: CoverTransform
  ): { x: number; y: number } {
    const imgX = (stageX - transform.offsetX) / transform.scale;
    const imgY = (stageY - transform.offsetY) / transform.scale;
    return {
      x: Math.max(0, Math.min(transform.imageWidth, imgX)),
      y: Math.max(0, Math.min(transform.imageHeight, imgY)),
    };
  }

  /**
   * Maps an image-space point back to stage coordinates.
   */
  public static mapImageToStage(
    imageX: number,
    imageY: number,
    transform: CoverTransform
  ): { x: number; y: number } {
    return {
      x: transform.offsetX + imageX * transform.scale,
      y: transform.offsetY + imageY * transform.scale,
    };
  }

  /**
   * Scales a splash radius from stage pixels to image space pixels.
   */
  public static mapStageRadiusToImage(
    stageRadius: number,
    transform: CoverTransform
  ): number {
    return stageRadius / transform.scale;
  }

  // =========================================================================
  // 8. OBJECT-BASED SCROLL TRANSITIONS & SAMPLER
  // =========================================================================

  /**
   * Computes scale, circular aperture radius, gold flash, and scene offsets for "Enter" transitions.
   * As p goes 0 to 1:
   * - Scene A scales from 1.0 to 3.2 around Anchor A (ease-in-out)
   * - Circular aperture opens at Anchor A stage position
   * - Scene B scales from 0.35 to 1.0 with Anchor B aligned to Anchor A stage position
   * - Brief warm gold flash peaks at p = 0.5
   */
  public static computeApertureTransform(
    p: number,
    anchorAStage: { x: number; y: number },
    anchorBStage: { x: number; y: number },
    stageWidth: number,
    stageHeight: number
  ): {
    scaleA: number;
    scaleB: number;
    apertureRadius: number;
    goldFlashAlpha: number;
    offsetBX: number;
    offsetBY: number;
  } {
    const clampedP = Math.max(0, Math.min(1, p));
    const ease = clampedP * clampedP * (3 - 2 * clampedP); // smoothstep ease-in-out

    // Scale A: 1.0 -> 3.2
    const scaleA = 1.0 + ease * 2.2;
    // Scale B: 0.35 -> 1.0
    const scaleB = 0.35 + ease * 0.65;

    // Corner distances from Anchor A
    const d1 = Math.hypot(anchorAStage.x, anchorAStage.y);
    const d2 = Math.hypot(stageWidth - anchorAStage.x, anchorAStage.y);
    const d3 = Math.hypot(anchorAStage.x, stageHeight - anchorAStage.y);
    const d4 = Math.hypot(stageWidth - anchorAStage.x, stageHeight - anchorAStage.y);
    const maxRadius = Math.max(d1, d2, d3, d4) * 1.05;

    // Circular aperture expands
    const apertureRadius = ease * maxRadius;

    // Brief warm gold flash centered at p = 0.5
    const dist50 = Math.abs(clampedP - 0.5);
    const goldFlashAlpha = dist50 < 0.15 ? (1 - dist50 / 0.15) * 0.65 : 0;

    // Align Anchor B to Anchor A during zoom, easing to 0 at p = 1
    const alignX = anchorAStage.x - anchorBStage.x;
    const alignY = anchorAStage.y - anchorBStage.y;
    const offsetBX = Math.abs(alignX * (1 - ease)) < 1e-6 ? 0 : alignX * (1 - ease);
    const offsetBY = Math.abs(alignY * (1 - ease)) < 1e-6 ? 0 : alignY * (1 - ease);

    return {
      scaleA,
      scaleB,
      apertureRadius,
      goldFlashAlpha,
      offsetBX,
      offsetBY,
    };
  }

  /**
   * Computes normalized radial delay [0, 1] for a tile in a grid based on its
   * Euclidean distance from an anchor point (e.g. 12x7 shard grid).
   * Shards closer to the anchor move earliest (delay near 0).
   */
  public static computeRadialTileDelay(
    col: number,
    row: number,
    cols: number,
    rows: number,
    anchorCol: number,
    anchorRow: number
  ): number {
    const dx = col - anchorCol;
    const dy = row - anchorRow;
    const dist = Math.hypot(dx, dy);

    // Max potential distance from anchor point to any boundary corner
    const c1 = Math.hypot(anchorCol, anchorRow);
    const c2 = Math.hypot(cols - 1 - anchorCol, anchorRow);
    const c3 = Math.hypot(anchorCol, rows - 1 - anchorRow);
    const c4 = Math.hypot(cols - 1 - anchorCol, rows - 1 - anchorRow);
    const maxDist = Math.max(c1, c2, c3, c4) || 1;

    return Math.max(0, Math.min(1, dist / maxDist));
  }

  /**
   * Computes exact translation and crossfade for Transition 3 "Match cut".
   * At p = 0.5: Scene B is translated so its castle sits exactly on Scene A's castle.
   * Crossfades through 0.35 to 0.65.
   * Eases Scene B to its normal cover-fit (offset = 0) as p goes 0.5 -> 1.0.
   * Gold seam glow peaks at p = 0.5.
   */
  public static computeMatchCutTranslation(
    p: number,
    anchorAStage: { x: number; y: number },
    anchorBStage: { x: number; y: number }
  ): {
    offsetX: number;
    offsetY: number;
    crossfadeA: number;
    crossfadeB: number;
    goldSeamGlow: number;
  } {
    const clampedP = Math.max(0, Math.min(1, p));

    const deltaX = anchorAStage.x - anchorBStage.x;
    const deltaY = anchorAStage.y - anchorBStage.y;

    let offsetX = deltaX;
    let offsetY = deltaY;

    if (clampedP >= 0.5) {
      const u = (clampedP - 0.5) / 0.5;
      const ease = u * u * (3 - 2 * u);
      offsetX = Math.abs(deltaX * (1 - ease)) < 1e-6 ? 0 : deltaX * (1 - ease);
      offsetY = Math.abs(deltaY * (1 - ease)) < 1e-6 ? 0 : deltaY * (1 - ease);
    }

    let crossfadeA = 1.0;
    let crossfadeB = 0.0;
    if (clampedP <= 0.35) {
      crossfadeA = 1.0;
      crossfadeB = 0.0;
    } else if (clampedP >= 0.65) {
      crossfadeA = 0.0;
      crossfadeB = 1.0;
    } else {
      const t = (clampedP - 0.35) / 0.30;
      crossfadeA = 1.0 - t;
      crossfadeB = t;
    }

    const goldSeamGlow = Math.sin(Math.PI * clampedP);

    return {
      offsetX,
      offsetY,
      crossfadeA,
      crossfadeB,
      goldSeamGlow,
    };
  }

  /**
   * Computes lower-third caption positioning and bounds.
   * Anchored bottom-left on desktop / landscape, and bottom-center on portrait,
   * positioned safely above the bottom 38% gradient.
   */
  public static computeCaptionLayout(
    stageWidth: number,
    stageHeight: number,
    isPortrait: boolean
  ): {
    align: "left" | "center";
    left: number;
    bottom: number;
    maxWidth: number;
    isAboveGradient: boolean;
  } {
    const bottomGradientHeight = stageHeight * 0.38;

    if (isPortrait) {
      const bottom = Math.max(36, Math.min(stageHeight * 0.16, 120));
      const maxWidth = Math.min(stageWidth - 40, 360);
      return {
        align: "center",
        left: stageWidth * 0.5,
        bottom,
        maxWidth,
        isAboveGradient: bottom >= 0 && bottom < bottomGradientHeight,
      };
    } else {
      const left = Math.max(32, Math.min(stageWidth * 0.06, 80));
      const bottom = Math.max(48, Math.min(stageHeight * 0.14, 110));
      const maxWidth = Math.min(stageWidth * 0.40, 440);
      return {
        align: "left",
        left,
        bottom,
        maxWidth,
        isAboveGradient: bottom >= 0 && bottom < bottomGradientHeight,
      };
    }
  }

  /**
   * Fast mask coverage sampler operating on a downscaled 32x18 buffer (576 cells).
   * Operates on RGBA Uint8ClampedArray / Uint8Array from a 32x18 canvas.
   * Matches the old 32x18 grid coverage calculation within 2%.
   */
  public static sampleDownscaledCoverage(
    data: Uint8ClampedArray | Uint8Array,
    threshold = 30
  ): number {
    const totalCells = PaintEngine.TOTAL_GRID_CELLS; // 576
    if (data.length < totalCells) return 0;

    let coveredCount = 0;
    const isRGBA = data.length >= totalCells * 4;

    for (let i = 0; i < totalCells; i++) {
      const val = isRGBA ? data[i * 4 + 3] : data[i];
      if (val >= threshold) {
        coveredCount++;
      }
    }

    return coveredCount / totalCells;
  }
}

