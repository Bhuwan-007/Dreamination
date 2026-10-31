const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (((crc ^ byte) & 1) ? 0xedb88320 : 0);
      byte >>>= 1;
    }
  }
  return (crc ^ (-1)) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPng(width, height, getPixel) {
  const rowLen = width * 4 + 1;
  const raw = Buffer.alloc(height * rowLen);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLen;
    raw[rowOffset] = 0; // filter None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y);
      const pxOffset = rowOffset + 1 + x * 4;
      raw[pxOffset] = Math.min(255, Math.max(0, r));
      raw[pxOffset + 1] = Math.min(255, Math.max(0, g));
      raw[pxOffset + 2] = Math.min(255, Math.max(0, b));
      raw[pxOffset + 3] = a !== undefined ? Math.min(255, Math.max(0, a)) : 255;
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

// 1. Generate seamless tileable paper texture per Design.md §21 A9
// Off-white #EEF2EF (238, 242, 239) with subtle organic cotton fiber noise
function generatePaperTexture() {
  const size = 256;
  // Deterministic PRNG
  let seed = 42;
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }
  const noiseGrid = [];
  for (let y = 0; y < size; y++) {
    noiseGrid[y] = [];
    for (let x = 0; x < size; x++) {
      noiseGrid[y][x] = (rand() - 0.5) * 8; // subtle +/- 4 intensity
    }
  }
  // Soft 3x3 gaussian-ish blur to simulate cotton paper fibers
  return createPng(size, size, (x, y) => {
    let sum = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = (x + dx + size) % size;
        const ny = (y + dy + size) % size;
        sum += noiseGrid[ny][nx];
      }
    }
    const val = Math.round(sum / 9);
    // Base color #EEF2EF
    return [238 + val, 242 + val, 239 + val, 255];
  });
}

// 2. Generate A5 / A10 Traveler logo icon on rounded #090D11 square
function generateTravelerIcon(size) {
  const rBg = 9, gBg = 13, bBg = 17; // #090D11
  const rGold = 226, gGold = 184, bGold = 102; // #E2B866
  const rLight = 243, gLight = 221, bLight = 166; // #F3DDA6

  const cornerRadius = size * 0.22;
  const cx = size / 2;

  return createPng(size, size, (x, y) => {
    // Check rounded rect boundary
    let inCorner = false;
    let distCorner = 0;
    if (x < cornerRadius && y < cornerRadius) {
      distCorner = Math.hypot(x - cornerRadius, y - cornerRadius);
      inCorner = distCorner > cornerRadius;
    } else if (x > size - cornerRadius && y < cornerRadius) {
      distCorner = Math.hypot(x - (size - cornerRadius), y - cornerRadius);
      inCorner = distCorner > cornerRadius;
    } else if (x < cornerRadius && y > size - cornerRadius) {
      distCorner = Math.hypot(x - cornerRadius, y - (size - cornerRadius));
      inCorner = distCorner > cornerRadius;
    } else if (x > size - cornerRadius && y > size - cornerRadius) {
      distCorner = Math.hypot(x - (size - cornerRadius), y - (size - cornerRadius));
      inCorner = distCorner > cornerRadius;
    }

    if (inCorner) return [0, 0, 0, 0]; // Transparent outside icon corner

    // Normalize coordinates 0..64 to match SVG
    const sx = (x / size) * 64;
    const sy = (y / size) * 64;

    // Arch portal light: path d="M16 54V27a16 16 0 0 1 32 0v27z"
    const inArchRect = sx >= 16 && sx <= 48 && sy >= 27 && sy <= 54;
    const distArchTop = Math.hypot(sx - 32, sy - 27);
    const inArchTop = distArchTop <= 16 && sy < 27;

    let inArch = inArchRect || inArchTop;

    // Traveler silhouette: circle cx="32" cy="43" r="2.6", body M27.5 54...
    const inHead = Math.hypot(sx - 32, sy - 43) <= 2.6;
    const inBody = sx >= 28 && sx <= 36 && sy >= 44 && sy <= 54;
    if (inHead || inBody) {
      return [rBg, gBg, bBg, 255]; // Dark silhouette inside golden doorway
    }

    // Sun ring: circle cx="34" cy="24" r="6" stroke-width 1.5
    const distSun = Math.hypot(sx - 34, sy - 24);
    if (Math.abs(distSun - 6) <= 0.9) {
      return [rGold, gGold, bGold, 255];
    }

    // Floating island: M26 33h16l-3 3h-10z
    if (sy >= 32.5 && sy <= 36.5 && sx >= 26 && sx <= 42) {
      return [rGold, gGold, bGold, 230];
    }

    // Arch outline stroke
    const onArchLeft = Math.abs(sx - 16) <= 1 && sy >= 27 && sy <= 54;
    const onArchRight = Math.abs(sx - 48) <= 1 && sy >= 27 && sy <= 54;
    const onArchCurve = Math.abs(distArchTop - 16) <= 1 && sy <= 27;
    const onThreshold = Math.abs(sy - 54) <= 1 && sx >= 10 && sx <= 54;

    if (onArchLeft || onArchRight || onArchCurve || onThreshold) {
      return [rGold, gGold, bGold, 255];
    }

    if (inArch) {
      // Light gradient from #F3DDA6 to #E2B866
      const t = (sy - 11) / 43;
      const r = Math.round(rLight * (1 - t) + rGold * t);
      const g = Math.round(gLight * (1 - t) + gGold * t);
      const b = Math.round(bLight * (1 - t) + bGold * t);
      return [r, g, b, 235];
    }

    // Default rounded square background
    return [rBg, gBg, bBg, 255];
  });
}

const artDir = path.join(__dirname, '../public/art');
const pubDir = path.join(__dirname, '../public');

// Write paper.webp & paper.png
const paperBuffer = generatePaperTexture();
fs.writeFileSync(path.join(artDir, 'paper.webp'), paperBuffer);
fs.writeFileSync(path.join(artDir, 'paper.png'), paperBuffer);
console.log('Generated paper.webp:', paperBuffer.length, 'bytes');

// Write logo-concept.png (A5)
const logoBuffer = generateTravelerIcon(512);
fs.writeFileSync(path.join(artDir, 'logo-concept.png'), logoBuffer);
fs.writeFileSync(path.join(pubDir, 'icon-512.png'), logoBuffer);
console.log('Generated logo-concept.png & icon-512.png:', logoBuffer.length, 'bytes');

// Write icon-192.png (A10)
const icon192 = generateTravelerIcon(192);
fs.writeFileSync(path.join(pubDir, 'icon-192.png'), icon192);
fs.writeFileSync(path.join(artDir, 'icon-192.png'), icon192);
console.log('Generated icon-192.png:', icon192.length, 'bytes');

// Simple 32x32 ICO container for favicon.ico
const icon32 = generateTravelerIcon(32);
const icoHeader = Buffer.from([0, 0, 1, 0, 1, 0]); // type 1 (ICO), 1 image
const icoDirEntry = Buffer.alloc(16);
icoDirEntry[0] = 32; // width
icoDirEntry[1] = 32; // height
icoDirEntry[2] = 0;  // colors (0 = no palette)
icoDirEntry[3] = 0;  // reserved
icoDirEntry.writeUInt16LE(1, 4); // color planes
icoDirEntry.writeUInt16LE(32, 6); // bpp
icoDirEntry.writeUInt32LE(icon32.length, 8); // size of image data
icoDirEntry.writeUInt32LE(22, 12); // offset (6 + 16 = 22)
const faviconIco = Buffer.concat([icoHeader, icoDirEntry, icon32]);
fs.writeFileSync(path.join(pubDir, 'favicon.ico'), faviconIco);
fs.writeFileSync(path.join(__dirname, '../src/app/favicon.ico'), faviconIco);
console.log('Generated favicon.ico:', faviconIco.length, 'bytes');

