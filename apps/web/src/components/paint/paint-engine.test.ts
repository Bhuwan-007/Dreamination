import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PaintEngine,
  PALETTE_PIGMENTS,
} from "./paint-engine.ts";

describe("PaintEngine - Arc Math & Ballistics", () => {
  it("clamps flight duration between 0.30s and 0.55s", () => {
    // Zero / very close distance
    const shortDuration = PaintEngine.calculateFlightDuration(100, 100, 105, 105);
    assert.equal(shortDuration, 0.3);

    // Far distance
    const longDuration = PaintEngine.calculateFlightDuration(0, 0, 2000, 2000);
    assert.equal(longDuration, 0.55);

    // Mid distance
    const midDuration = PaintEngine.calculateFlightDuration(0, 0, 600, 0);
    assert.ok(midDuration >= 0.3 && midDuration <= 0.55);
  });

  it("calculates arc height proportional to distance", () => {
    const arcH1 = PaintEngine.calculateArcHeight(0, 0, 100, 0);
    const arcH2 = PaintEngine.calculateArcHeight(0, 0, 500, 0);
    assert.ok(arcH2 > arcH1);
    assert.equal(arcH1, 100 + 100 * 0.18);
  });

  it("computes parabolic balloon trajectory", () => {
    const startX = 100;
    const startY = 800;
    const targetX = 500;
    const targetY = 300;
    const arcHeight = 150;

    // t = 0 (start)
    const posStart = PaintEngine.computeBalloonPosition(
      startX,
      startY,
      targetX,
      targetY,
      arcHeight,
      0
    );
    assert.equal(posStart.x, startX);
    assert.equal(posStart.y, startY);

    // t = 1 (target impact)
    const posEnd = PaintEngine.computeBalloonPosition(
      startX,
      startY,
      targetX,
      targetY,
      arcHeight,
      1
    );
    assert.equal(posEnd.x, targetX);
    assert.equal(posEnd.y, targetY);

    // t = 0.5 (peak of parabolic arc)
    const posMid = PaintEngine.computeBalloonPosition(
      startX,
      startY,
      targetX,
      targetY,
      arcHeight,
      0.5
    );
    assert.equal(posMid.x, (startX + targetX) / 2);
    // Linear Y would be 550, minus arcHeight (150 * sin(pi/2) = 150) -> 400
    assert.equal(posMid.y, 550 - 150);
  });

  it("shrinks balloon perspective scale from 1.6x down to 0.85x", () => {
    const scaleStart = PaintEngine.computeBalloonScale(0);
    const scaleEnd = PaintEngine.computeBalloonScale(1);
    assert.equal(scaleStart, 1.6);
    assert.ok(Math.abs(scaleEnd - 0.85) < 0.0001);
  });

  it("computes ground shadow tracking beneath the balloon", () => {
    const shadowStart = PaintEngine.computeGroundShadow(0, 1000, 500, 500, 0);
    assert.equal(shadowStart.x, 0);
    assert.equal(shadowStart.y, 1000);
    assert.ok(shadowStart.alpha > 0);

    const shadowMid = PaintEngine.computeGroundShadow(0, 1000, 500, 500, 0.5);
    assert.equal(shadowMid.x, 250);
    assert.equal(shadowMid.y, 750);
    assert.ok(shadowMid.scaleX > 1.0); // Spreads wider as balloon is high
  });
});

describe("PaintEngine - Splash Physics & Easing", () => {
  it("generates lobed contour points with expected count", () => {
    const points = PaintEngine.generateLobedContour(60, 12, 34, 18);
    assert.equal(points.length, 19); // 0 to 18 inclusive
    // All points should be within 2x radius
    for (const [px, py] of points) {
      const dist = Math.hypot(px, py);
      assert.ok(dist > 0 && dist < 120);
    }
  });

  it("generates satellite droplets scattered around the rim", () => {
    const droplets = PaintEngine.generateSatelliteDroplets(60, 14);
    assert.equal(droplets.length, 14);
    for (const drop of droplets) {
      assert.ok(drop.radius >= 3.5);
      const dist = Math.hypot(drop.x, drop.y);
      assert.ok(dist >= 40);
    }
  });

  it("computes wet splash radius easing outward over ~0.9s", () => {
    const maxRadius = 100;
    // t = 0
    const wet0 = PaintEngine.computeWetSplashRadius(maxRadius, 0, 0.9);
    assert.equal(wet0.currentRadius, 0);
    assert.equal(wet0.isDry, false);
    assert.ok(wet0.rimDarkness > 0);

    // t = 0.45s (halfway)
    const wetMid = PaintEngine.computeWetSplashRadius(maxRadius, 0.45, 0.9);
    assert.ok(wetMid.currentRadius > 50 && wetMid.currentRadius < 100);
    assert.equal(wetMid.isDry, false);

    // t = 0.9s (dried)
    const wetDry = PaintEngine.computeWetSplashRadius(maxRadius, 0.9, 0.9);
    assert.equal(wetDry.currentRadius, maxRadius);
    assert.equal(wetDry.isDry, true);
    assert.equal(wetDry.rimDarkness, 0);
  });
});

describe("PaintEngine - Mask Coverage Sampling (32x18 Grid)", () => {
  const width = 320;
  const height = 180;
  const totalPixels = width * height;

  it("returns 0 coverage for blank mask", () => {
    const emptyMask = new Uint8ClampedArray(totalPixels);
    const coverage = PaintEngine.sampleCoverage(emptyMask, width, height, 32, 18, 30, 1);
    assert.equal(coverage, 0);
  });

  it("returns 1.0 coverage for fully covered mask", () => {
    const fullMask = new Uint8ClampedArray(totalPixels);
    fullMask.fill(255);
    const coverage = PaintEngine.sampleCoverage(fullMask, width, height, 32, 18, 30, 1);
    assert.equal(coverage, 1.0);
  });

  it("returns ~0.5 coverage when top half is covered", () => {
    const halfMask = new Uint8ClampedArray(totalPixels);
    // Fill top half (rows 0 to height/2 - 1)
    for (let y = 0; y < height / 2; y++) {
      for (let x = 0; x < width; x++) {
        halfMask[y * width + x] = 255;
      }
    }
    const coverage = PaintEngine.sampleCoverage(halfMask, width, height, 32, 18, 30, 1);
    assert.equal(coverage, 0.5);
  });

  it("handles 4-channel RGBA mask buffer", () => {
    const rgbaMask = new Uint8ClampedArray(totalPixels * 4);
    // Fill all alpha channels
    for (let i = 0; i < totalPixels; i++) {
      rgbaMask[i * 4 + 3] = 255;
    }
    const coverage = PaintEngine.sampleCoverage(rgbaMask, width, height, 32, 18, 30, 4);
    assert.equal(coverage, 1.0);
  });
});

describe("PaintEngine - Dirty Flags, Throttling & Chapter State", () => {
  it("tracks dirty flags and coverage milestones", () => {
    const engine = new PaintEngine();
    assert.equal(engine.isDirty(0), true);

    engine.clearDirty(0);
    assert.equal(engine.isDirty(0), false);

    engine.markDirty(0);
    assert.equal(engine.isDirty(0), true);

    assert.equal(engine.getCoverage(0), 0);
    engine.setCoverage(0, 0.75);
    assert.equal(engine.getCoverage(0), 0.75);

    // Check all chapters completion logic
    assert.equal(engine.areAllChaptersComplete(), false);
    for (let c = 0; c < 5; c++) {
      engine.setCoverage(c, 0.85);
    }
    assert.equal(engine.areAllChaptersComplete(), true);
  });

  it("throttles throws to <= 8 throws/second", () => {
    const engine = new PaintEngine();
    const t0 = 1000;
    assert.equal(engine.canThrow(t0), true);

    // Immediately after (50ms later) should be blocked (min interval is 125ms)
    assert.equal(engine.canThrow(t0 + 50), false);

    // 100ms later still blocked
    assert.equal(engine.canThrow(t0 + 100), false);

    // 130ms later should be allowed
    assert.equal(engine.canThrow(t0 + 130), true);
  });
});

describe("PaintEngine - Chapter IV Kintsugi Weave", () => {
  it("has exactly 7 irregular shards", () => {
    assert.equal(PaintEngine.KINTSUGI_SHARDS.length, 7);
  });

  it("spreads shards apart when kintsugiFactor is 0 and joins them at 1", () => {
    const shard = PaintEngine.KINTSUGI_SHARDS[0];
    const joined = PaintEngine.computeShardOffset(shard, 1.0, 1000, 800);
    const scattered = PaintEngine.computeShardOffset(shard, 0.0, 1000, 800);

    // When joined, offset should be at origin
    assert.equal(joined.x, 1000 * 0.5 + shard.ox * 1000);
    assert.equal(joined.y, 800 * 0.5 + shard.oy * 800);

    // When scattered, offset moves by dx * 140
    assert.equal(scattered.x, joined.x + shard.dx * 140);
    assert.equal(scattered.y, joined.y + shard.dy * 140);
  });

  it("heals weave by 8% per hit up to 1.0", () => {
    let factor = 0.5;
    factor = PaintEngine.healWeave(factor);
    assert.equal(Math.round(factor * 100) / 100, 0.58);

    factor = PaintEngine.healWeave(0.96);
    assert.equal(factor, 1.0); // Clamped at 1.0
  });
});

describe("PaintEngine - Palette Pigments Strictness", () => {
  it("does not include off-palette violet or purple pigments", () => {
    for (const pigment of PALETTE_PIGMENTS) {
      const lower = pigment.name.toLowerCase() + pigment.key.toLowerCase();
      assert.ok(!lower.includes("violet"), "Must not contain violet");
      assert.ok(!lower.includes("purple"), "Must not contain purple");
    }
  });
});

describe("PaintEngine - Image Space & Cover-Crop Coordinate Mapping", () => {
  it("correctly maps 3:2 art onto a 16:9 stage with vertical cropping", () => {
    // 3:2 art fixed mask: 960x640
    // 16:9 stage: 1920x1080
    const stageW = 1920;
    const stageH = 1080;
    const imgW = 960;
    const imgH = 640;

    const transform = PaintEngine.computeCoverTransform(stageW, stageH, imgW, imgH);

    // Scale must be max(1920/960 = 2.0, 1080/640 = 1.6875) => 2.0
    assert.equal(transform.scale, 2.0);
    assert.equal(transform.renderedWidth, 1920);
    assert.equal(transform.renderedHeight, 1280);
    assert.equal(transform.offsetX, 0);
    assert.equal(transform.offsetY, (1080 - 1280) / 2); // -100px

    // Center click on stage (960, 540) must map exactly to center of 3:2 art (480, 320)
    const centerImg = PaintEngine.mapStageToImage(stageW / 2, stageH / 2, transform);
    assert.equal(centerImg.x, 480);
    assert.equal(centerImg.y, 320);

    // Round-trip check
    const centerStage = PaintEngine.mapImageToStage(centerImg.x, centerImg.y, transform);
    assert.equal(centerStage.x, stageW / 2);
    assert.equal(centerStage.y, stageH / 2);

    // Top-left visible click on stage (0, 0)
    const topVisibleImg = PaintEngine.mapStageToImage(0, 0, transform);
    assert.equal(topVisibleImg.x, 0);
    // (0 - (-100)) / 2.0 = 50px into image
    assert.equal(topVisibleImg.y, 50);
  });

  it("correctly maps 16:9 art onto a 9:16 portrait mobile stage with horizontal cropping", () => {
    // 16:9 art: 960x540
    // Portrait phone: 400x800
    const stageW = 400;
    const stageH = 800;
    const imgW = 960;
    const imgH = 540;

    const transform = PaintEngine.computeCoverTransform(stageW, stageH, imgW, imgH);

    // Scale: max(400/960 = 0.41667, 800/540 = 1.48148) => ~1.4815
    assert.ok(transform.scale > 1.48 && transform.scale < 1.49);
    assert.equal(transform.offsetY, 0); // Height fits exactly
    assert.ok(transform.offsetX < 0); // Cropped horizontally

    // Center stage maps to center image
    const center = PaintEngine.mapStageToImage(stageW / 2, stageH / 2, transform);
    assert.ok(Math.abs(center.x - 480) < 0.01);
    assert.ok(Math.abs(center.y - 270) < 0.01);
  });

  it("scales splash radius between stage and image coordinates", () => {
    const transform = PaintEngine.computeCoverTransform(1920, 1080, 960, 540);
    assert.equal(transform.scale, 2.0);
    // 60px stage radius should be 30px in image space
    const imgRadius = PaintEngine.mapStageRadiusToImage(60, transform);
    assert.equal(imgRadius, 30);
  });
});

describe("PaintEngine - Enter Transition Scale & Aperture Math", () => {
  const stageW = 1920;
  const stageH = 1080;
  const anchorA = { x: 960, y: 450 };
  const anchorB = { x: 960, y: 580 };

  it("calculates exact scales and aperture progression as p goes 0 to 1", () => {
    // p = 0
    const t0 = PaintEngine.computeApertureTransform(0, anchorA, anchorB, stageW, stageH);
    assert.equal(t0.scaleA, 1.0);
    assert.equal(t0.scaleB, 0.35);
    assert.equal(t0.apertureRadius, 0);
    assert.equal(t0.goldFlashAlpha, 0);

    // p = 0.5 (peak flash, aperture midway, scales midway)
    const tMid = PaintEngine.computeApertureTransform(0.5, anchorA, anchorB, stageW, stageH);
    assert.ok(Math.abs(tMid.scaleA - 2.1) < 0.001);
    assert.ok(Math.abs(tMid.scaleB - 0.675) < 0.001);
    assert.ok(tMid.apertureRadius > 500);
    assert.ok(Math.abs(tMid.goldFlashAlpha - 0.65) < 0.001);

    // p = 1.0 (fully open, scene B fills screen)
    const t1 = PaintEngine.computeApertureTransform(1.0, anchorA, anchorB, stageW, stageH);
    assert.equal(t1.scaleA, 3.2);
    assert.equal(t1.scaleB, 1.0);
    assert.equal(t1.goldFlashAlpha, 0);
    assert.ok(t1.apertureRadius >= Math.hypot(anchorA.x, anchorA.y));
    assert.equal(t1.offsetBX, 0);
    assert.equal(t1.offsetBY, 0);
  });
});

describe("PaintEngine - Radial Stagger Ordering From Anchor", () => {
  it("orders tile delays strictly by distance from the anchor tile", () => {
    const cols = 12;
    const rows = 7;
    const anchorCol = 9;
    const anchorRow = 3;

    const delayAnchor = PaintEngine.computeRadialTileDelay(anchorCol, anchorRow, cols, rows, anchorCol, anchorRow);
    assert.equal(delayAnchor, 0);

    const delayNeighbor = PaintEngine.computeRadialTileDelay(anchorCol - 1, anchorRow, cols, rows, anchorCol, anchorRow);
    const delayFar = PaintEngine.computeRadialTileDelay(0, 0, cols, rows, anchorCol, anchorRow);

    assert.ok(delayNeighbor > 0);
    assert.ok(delayFar > delayNeighbor);
    assert.ok(delayFar <= 1.0);
  });
});

describe("PaintEngine - Anchor-Aligned Match-Cut Translation", () => {
  it("aligns Anchor B exactly to Anchor A at p = 0.5, crossfades 0.35-0.65, and eases to 0 offset at p = 1.0", () => {
    const anchorA = { x: 800, y: 400 };
    const anchorB = { x: 1200, y: 300 };

    // p = 0.5: Exact match cut alignment
    const t50 = PaintEngine.computeMatchCutTranslation(0.5, anchorA, anchorB);
    assert.equal(t50.offsetX, anchorA.x - anchorB.x); // -400
    assert.equal(t50.offsetY, anchorA.y - anchorB.y); // +100
    assert.ok(Math.abs(t50.crossfadeA - 0.5) < 0.0001);
    assert.ok(Math.abs(t50.crossfadeB - 0.5) < 0.0001);
    assert.equal(t50.goldSeamGlow, 1.0); // sin(pi * 0.5) = 1

    // p <= 0.35: Pure Scene A
    const t30 = PaintEngine.computeMatchCutTranslation(0.3, anchorA, anchorB);
    assert.equal(t30.crossfadeA, 1.0);
    assert.equal(t30.crossfadeB, 0.0);

    // p >= 0.65: Pure Scene B
    const t70 = PaintEngine.computeMatchCutTranslation(0.7, anchorA, anchorB);
    assert.equal(t70.crossfadeA, 0.0);
    assert.equal(t70.crossfadeB, 1.0);

    // p = 1.0: Offset is 0 (normal cover-fit)
    const t100 = PaintEngine.computeMatchCutTranslation(1.0, anchorA, anchorB);
    assert.equal(t100.offsetX, 0);
    assert.equal(t100.offsetY, 0);
    assert.ok(Math.abs(t100.goldSeamGlow) < 0.001);
  });
});

describe("PaintEngine - Caption Anchoring on Landscape and Portrait", () => {
  it("anchors bottom-left on landscape and bottom-center on portrait", () => {
    // Landscape
    const landscape = PaintEngine.computeCaptionLayout(1920, 1080, false);
    assert.equal(landscape.align, "left");
    assert.ok(landscape.left >= 32 && landscape.left <= 80);
    assert.ok(landscape.bottom >= 48 && landscape.bottom <= 110);
    assert.ok(landscape.maxWidth <= 440);
    assert.equal(landscape.isAboveGradient, true);

    // Portrait
    const portrait = PaintEngine.computeCaptionLayout(400, 800, true);
    assert.equal(portrait.align, "center");
    assert.equal(portrait.left, 200);
    assert.ok(portrait.bottom >= 36 && portrait.bottom <= 120);
    assert.ok(portrait.maxWidth <= 360);
    assert.equal(portrait.isAboveGradient, true);
  });
});

describe("PaintEngine - 32x18 Coverage Sampler Parity", () => {
  it("matches the old 32x18 grid coverage calculation within 2%", () => {
    const width = 960;
    const height = 540;
    const oldBuffer = new Uint8ClampedArray(width * height * 4);
    const downscaledBuffer = new Uint8ClampedArray(32 * 18 * 4);

    // 1. Blank mask
    const old0 = PaintEngine.sampleCoverage(oldBuffer, width, height, 32, 18, 30, 4);
    const new0 = PaintEngine.sampleDownscaledCoverage(downscaledBuffer, 30);
    assert.equal(old0, 0);
    assert.equal(new0, 0);
    assert.ok(Math.abs(old0 - new0) <= 0.02);

    // 2. Full mask
    oldBuffer.fill(255);
    downscaledBuffer.fill(255);
    const oldFull = PaintEngine.sampleCoverage(oldBuffer, width, height, 32, 18, 30, 4);
    const newFull = PaintEngine.sampleDownscaledCoverage(downscaledBuffer, 30);
    assert.equal(oldFull, 1.0);
    assert.equal(newFull, 1.0);
    assert.ok(Math.abs(oldFull - newFull) <= 0.02);

    // 3. Top-half covered mask
    oldBuffer.fill(0);
    downscaledBuffer.fill(0);
    for (let y = 0; y < height / 2; y++) {
      for (let x = 0; x < width; x++) {
        oldBuffer[(y * width + x) * 4 + 3] = 255;
      }
    }
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 32; x++) {
        downscaledBuffer[(y * 32 + x) * 4 + 3] = 255;
      }
    }
    const oldHalf = PaintEngine.sampleCoverage(oldBuffer, width, height, 32, 18, 30, 4);
    const newHalf = PaintEngine.sampleDownscaledCoverage(downscaledBuffer, 30);
    assert.equal(oldHalf, 0.5);
    assert.equal(newHalf, 0.5);
    assert.ok(Math.abs(oldHalf - newHalf) <= 0.02);

    // 4. Random splash clusters
    oldBuffer.fill(0);
    downscaledBuffer.fill(0);
    for (let row = 0; row < 18; row++) {
      for (let col = 0; col < 32; col++) {
        const isCovered = (row * 31 + col * 17) % 3 === 0;
        if (isCovered) {
          downscaledBuffer[(row * 32 + col) * 4 + 3] = 255;
          const startY = Math.floor((row / 18) * height);
          const endY = Math.floor(((row + 1) / 18) * height);
          const startX = Math.floor((col / 32) * width);
          const endX = Math.floor(((col + 1) / 32) * width);
          for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
              oldBuffer[(y * width + x) * 4 + 3] = 255;
            }
          }
        }
      }
    }
    const oldCluster = PaintEngine.sampleCoverage(oldBuffer, width, height, 32, 18, 30, 4);
    const newCluster = PaintEngine.sampleDownscaledCoverage(downscaledBuffer, 30);
    assert.ok(Math.abs(oldCluster - newCluster) <= 0.02);
  });
});

