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

const inputDir = path.join(rootDir, "apps/web/public/art");
const outputDir = path.join(inputDir, "ink");

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const imagesToProcess = [
  "portal-window.webp",
  "night-void.webp",
  "fragments.webp",
  "weave.webp",
  "scenery-color.webp",
  "scenery-color-tall.webp",
  "cta-door.webp",
];

async function convertToSilverpointInk(inputPath, outputPath, filename) {
  const isKeyFocal = filename.includes("portal-window") || filename.includes("night-void");

  // Step 1: Pre-process with CLAHE for local contrast (especially glowing interior & star ring)
  let pipeline = sharp(inputPath);
  if (isKeyFocal) {
    pipeline = pipeline.clahe({ width: 32, height: 32, maxSlope: 4 });
  } else {
    pipeline = pipeline.clahe({ width: 48, height: 48, maxSlope: 2 });
  }

  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const channels = info.channels;
  const pixelCount = w * h;

  // Step 2: Calculate luminance
  const rawLuminance = new Float32Array(pixelCount);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const srcIdx = idx * channels;
      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];
      rawLuminance[idx] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }

  // Step 3: Compute 2nd and 98th percentile for level stretching
  const sorted = Float32Array.from(rawLuminance).sort();
  const p2 = sorted[Math.floor(pixelCount * 0.02)];
  const p98 = sorted[Math.floor(pixelCount * 0.98)];
  const pRange = Math.max(1, p98 - p2);

  const stretchedL = new Float32Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const val = (rawLuminance[i] - p2) / pRange;
    stretchedL[i] = Math.min(255, Math.max(0, val * 255));
  }

  // Step 4: Sobel edge detection (strengthened slightly on portal-window & night-void)
  const edgeMultiplier = isKeyFocal ? 1.45 : 1.15;
  const edges = new Float32Array(pixelCount);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const gx =
        -stretchedL[idx - w - 1] + stretchedL[idx - w + 1] -
        2 * stretchedL[idx - 1] + 2 * stretchedL[idx + 1] -
        stretchedL[idx + w - 1] + stretchedL[idx + w + 1];

      const gy =
        -stretchedL[idx - w - 1] - 2 * stretchedL[idx - w] - stretchedL[idx - w + 1] +
        stretchedL[idx + w - 1] + 2 * stretchedL[idx + w] + stretchedL[idx + w + 1];

      edges[idx] = Math.min(255, Math.hypot(gx, gy) * edgeMultiplier);
    }
  }

  // Step 5: Silverpoint tone synthesis
  const initialV = new Float32Array(pixelCount);
  let totalV = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const L = stretchedL[idx];
      const lNorm = L / 255;
      const edge = edges[idx] / 255;

      // Faint hatching in midtones/shadows
      let hatch = 0;
      if ((x + y) % 6 === 0 && L < 170) {
        hatch += 16 * (1 - L / 170);
      }
      if ((x - y) % 6 === 0 && L < 90) {
        hatch += 12 * (1 - L / 90);
      }
      const hatchNorm = hatch / 255;

      const v = Math.min(
        1,
        Math.max(
          0,
          Math.pow(lNorm, 0.95) * 0.70 +
            edge * 0.52 +
            hatchNorm * 0.20
        )
      );
      initialV[idx] = v;
      totalV += v;
    }
  }

  // Step 6: Ensure mean luminance is at least ~0.28 across all images
  let meanLuminance = totalV / pixelCount;
  let gamma = 1.0;
  if (meanLuminance < 0.28) {
    // Adjust gamma to bring mean luminance up to target (~0.30)
    gamma = Math.log(meanLuminance) / Math.log(0.30);
  }

  const out = Buffer.alloc(pixelCount * 3);
  let finalTotalL = 0;

  for (let i = 0; i < pixelCount; i++) {
    let v = initialV[i];
    if (gamma !== 1.0) {
      v = Math.pow(v, 1 / gamma);
    }
    v = Math.min(1, Math.max(0, v));
    finalTotalL += v;

    // Palette mapping: Base Forest Night (#0C1C17: 12, 28, 23) -> Silverpoint (#BDCEBC: 189, 206, 188)
    const outIdx = i * 3;
    out[outIdx] = Math.round(12 + v * (192 - 12));
    out[outIdx + 1] = Math.round(28 + v * (210 - 28));
    out[outIdx + 2] = Math.round(23 + v * (192 - 23));
  }

  const finalMeanLuminance = finalTotalL / pixelCount;

  await sharp(out, { raw: { width: w, height: h, channels: 3 } })
    .webp({ quality: 90 })
    .toFile(outputPath);

  console.log(
    `✓ Generated: ${filename.padEnd(24)} (${w}x${h}) | Mean Luminance: ${finalMeanLuminance.toFixed(3)} (p2=${p2.toFixed(1)}, p98=${p98.toFixed(1)})`
  );
}

async function generateContactSheet() {
  const thumbWidth = 460;
  const previewItems = [
    "portal-window.webp",
    "night-void.webp",
    "fragments.webp",
    "weave.webp",
    "scenery-color.webp",
  ];

  const rows = [];
  for (const name of previewItems) {
    const colPath = path.join(inputDir, name);
    const inkPath = path.join(outputDir, name);

    const colThumb = await sharp(colPath).resize({ width: thumbWidth }).png().toBuffer();
    const inkThumb = await sharp(inkPath).resize({ width: thumbWidth }).png().toBuffer();

    const meta = await sharp(colThumb).metadata();
    const rowHeight = meta.height;

    // Combine left (color) and right (ink) into one row
    const rowBuf = await sharp({
      create: {
        width: thumbWidth * 2 + 20,
        height: rowHeight,
        channels: 4,
        background: { r: 9, g: 13, b: 17, alpha: 1 },
      },
    })
      .composite([
        { input: colThumb, left: 0, top: 0 },
        { input: inkThumb, left: thumbWidth + 20, top: 0 },
      ])
      .png()
      .toBuffer();

    rows.push({ buf: rowBuf, height: rowHeight });
  }

  const totalWidth = thumbWidth * 2 + 20;
  const totalHeight = rows.reduce((acc, r) => acc + r.height + 16, 0) + 60;

  const composites = [];
  let currentY = 50;
  for (const r of rows) {
    composites.push({ input: r.buf, left: 0, top: currentY });
    currentY += r.height + 16;
  }

  const docsDir = path.join(rootDir, "docs");
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const previewPath = path.join(docsDir, "ink-preview.png");

  // Create final contact sheet
  await sharp({
    create: {
      width: totalWidth,
      height: totalHeight,
      channels: 4,
      background: { r: 9, g: 13, b: 17, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(previewPath);

  console.log(`✓ Created contact sheet: ${previewPath} (${totalWidth}x${totalHeight})`);
}

async function main() {
  console.log("Transforming paintings into tuned silverpoint ink sketches...");
  for (const filename of imagesToProcess) {
    const src = path.join(inputDir, filename);
    const dst = path.join(outputDir, filename);
    if (fs.existsSync(src)) {
      await convertToSilverpointInk(src, dst, filename);
    } else {
      console.warn(`! Missing source file: ${src}`);
    }
  }

  console.log("Generating docs/ink-preview.png contact sheet...");
  await generateContactSheet();
  console.log("Done make-ink.mjs!");
}

main().catch((err) => {
  console.error("make-ink error:", err);
  process.exit(1);
});
