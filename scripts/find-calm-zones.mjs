import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

let sharp;
try {
  sharp = require(path.join(rootDir, "apps/web/node_modules/sharp"));
} catch {
  sharp = require("sharp");
}

const artDir = path.join(rootDir, "apps/web/public/art");
const outputFile = path.join(artDir, "scenes.json");

const targetImages = [
  "portal-window.webp",
  "night-void.webp",
  "fragments.webp",
  "weave.webp",
  "scenery-color.webp",
  "scenery-color-tall.webp",
  "reflect.webp",
  "remember.webp",
  "watch-frame.webp",
  "vault.webp",
  "cta-door.webp",
];

async function analyzeCalmZones(filename) {
  const filePath = path.join(artDir, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`Skipping missing file: ${filename}`);
    return null;
  }

  const { data, info } = await sharp(filePath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const channels = info.channels;
  const pixelCount = w * h;

  // 1. Luminance
  const lum = new Float32Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const idx = i * channels;
    lum[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  // 2. Sobel edge magnitude
  const edges = new Float32Array(pixelCount);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const gx =
        -lum[idx - w - 1] + lum[idx - w + 1] -
        2 * lum[idx - 1] + 2 * lum[idx + 1] -
        lum[idx + w - 1] + lum[idx + w + 1];

      const gy =
        -lum[idx - w - 1] - 2 * lum[idx - w] - lum[idx - w + 1] +
        lum[idx + w - 1] + 2 * lum[idx + w] + lum[idx + w + 1];

      edges[idx] = Math.hypot(gx, gy);
    }
  }

  // 3. Scan candidate rectangles of ~40% width and ~30% height
  const rectW = Math.round(w * 0.40);
  const rectH = Math.round(h * 0.30);

  const stepX = Math.max(16, Math.round(w * 0.04));
  const stepY = Math.max(16, Math.round(h * 0.04));

  const candidates = [];

  // Exclude extreme screen boundaries to leave natural breathing margin
  const minX = Math.round(w * 0.06);
  const maxX = Math.round(w * 0.54); // Leaves room for 40% width
  const minY = Math.round(h * 0.08);
  const maxY = Math.round(h * 0.62);

  for (let rx = minX; rx <= maxX; rx += stepX) {
    for (let ry = minY; ry <= maxY; ry += stepY) {
      let edgeSum = 0;
      let lumSum = 0;
      let lumSqSum = 0;
      const totalPixelsInRect = rectW * rectH;

      for (let dy = 0; dy < rectH; dy++) {
        const rowOffset = (ry + dy) * w;
        for (let dx = 0; dx < rectW; dx++) {
          const idx = rowOffset + (rx + dx);
          const l = lum[idx];
          edgeSum += edges[idx];
          lumSum += l;
          lumSqSum += l * l;
        }
      }

      const meanEdge = edgeSum / totalPixelsInRect;
      const meanLum = lumSum / totalPixelsInRect;
      const varianceLum = Math.max(0, lumSqSum / totalPixelsInRect - meanLum * meanLum);
      const stdLum = Math.sqrt(varianceLum);

      // Score: lower is calmer / less busy
      // Penalize excessively bright areas (text is light so dark/mid calm zones are best)
      const brightnessPenalty = meanLum > 180 ? (meanLum - 180) * 0.3 : 0;
      const score = meanEdge * 0.60 + stdLum * 0.40 + brightnessPenalty;

      candidates.push({
        x: Number((rx / w).toFixed(4)),
        y: Number((ry / h).toFixed(4)),
        width: Number((rectW / w).toFixed(4)),
        height: Number((rectH / h).toFixed(4)),
        px: rx,
        py: ry,
        pw: rectW,
        ph: rectH,
        score: Number(score.toFixed(2)),
        meanLum: Number(meanLum.toFixed(1)),
        stdLum: Number(stdLum.toFixed(1)),
      });
    }
  }

  candidates.sort((a, b) => a.score - b.score);

  // Pick top 3 with non-maximum suppression (IoU < 0.3)
  const chosen = [];
  function computeIoU(r1, r2) {
    const xA = Math.max(r1.px, r2.px);
    const yA = Math.max(r1.py, r2.py);
    const xB = Math.min(r1.px + r1.pw, r2.px + r2.pw);
    const yB = Math.min(r1.py + r1.ph, r2.py + r2.ph);
    const interW = Math.max(0, xB - xA);
    const interH = Math.max(0, yB - yA);
    const interArea = interW * interH;
    const area1 = r1.pw * r1.ph;
    const area2 = r2.pw * r2.ph;
    return interArea / (area1 + area2 - interArea);
  }

  for (const cand of candidates) {
    let overlaps = false;
    for (const c of chosen) {
      if (computeIoU(cand, c) > 0.30) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) {
      chosen.push(cand);
      if (chosen.length >= 3) break;
    }
  }

  return {
    key: filename.replace(/\.(webp|jpg|png)$/, ""),
    filename,
    dimensions: { width: w, height: h },
    calmZones: chosen.map((c, idx) => ({
      rank: idx + 1,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
      score: c.score,
      meanLuminance: c.meanLum,
    })),
    best: {
      x: chosen[0].x,
      y: chosen[0].y,
      width: chosen[0].width,
      height: chosen[0].height,
    },
  };
}

async function main() {
  console.log("Analyzing art images for optimal calm text zones...");
  const scenes = {};

  for (const filename of targetImages) {
    const res = await analyzeCalmZones(filename);
    if (res) {
      scenes[res.key] = res;
      console.log(
        `✓ ${res.key.padEnd(20)} | Best Calm Zone: x=${res.best.x}, y=${res.best.y}, w=${res.best.width}, h=${res.best.height} (score=${res.calmZones[0].score})`
      );
    }
  }

  fs.writeFileSync(outputFile, JSON.stringify(scenes, null, 2), "utf8");
  console.log(`\n✓ Successfully wrote calm zones to: ${outputFile}`);
}

main().catch((err) => {
  console.error("Error in find-calm-zones:", err);
  process.exit(1);
});

