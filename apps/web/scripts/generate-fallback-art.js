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
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y);
      const pxOffset = rowOffset + 1 + x * 4;
      raw[pxOffset] = Math.min(255, Math.max(0, Math.round(r)));
      raw[pxOffset + 1] = Math.min(255, Math.max(0, Math.round(g)));
      raw[pxOffset + 2] = Math.min(255, Math.max(0, Math.round(b)));
      raw[pxOffset + 3] = a !== undefined ? Math.min(255, Math.max(0, Math.round(a))) : 255;
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

const artDir = path.join(__dirname, '../public/art');

// Palette
const VOID = [9, 13, 17];
const SURFACE = [12, 28, 23];
const GOLD = [226, 184, 102];
const GOLD_SOFT = [243, 221, 166];
const LAKE = [85, 156, 169];
const SAGE = [119, 145, 127];
const MIST = [189, 206, 188];

// A4c: reflect.webp (3:2 = 450x300) - Paper lanterns floating over still dark lake at dawn
function generateReflectArt() {
  const w = 450, h = 300;
  return createPng(w, h, (x, y) => {
    const ny = y / h;
    const nx = x / w;
    // Dark sky transitioning to faint dawn mist at horizon (ny ~ 0.6)
    let r = VOID[0], g = VOID[1], b = VOID[2];
    if (ny < 0.6) {
      const t = ny / 0.6;
      r = Math.round(VOID[0] * (1 - t) + SURFACE[0] * t);
      g = Math.round(VOID[1] * (1 - t) + SURFACE[1] * t + 8 * t);
      b = Math.round(VOID[2] * (1 - t) + LAKE[2] * 0.2 * t);
    } else {
      // Dark reflective water
      const t = (ny - 0.6) / 0.4;
      r = Math.round(SURFACE[0] * (1 - t) + VOID[0] * t);
      g = Math.round(SURFACE[1] * (1 - t) + VOID[1] * t);
      b = Math.round(LAKE[2] * 0.15 * (1 - t) + VOID[2] * t);
    }
    // 3 Floating golden lanterns with soft water reflections
    const lanterns = [[0.3, 0.55], [0.5, 0.52], [0.72, 0.58]];
    for (const [lx, ly] of lanterns) {
      const dx = (nx - lx) * (w / h);
      const dy = ny - ly;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.08) {
        const glow = Math.max(0, 1 - dist / 0.08);
        r += GOLD[0] * glow * 0.8;
        g += GOLD[1] * glow * 0.8;
        b += GOLD[2] * glow * 0.8;
      }
      // Water reflection
      const rdy = (ny - (ly + 0.1));
      if (rdy > 0 && rdy < 0.15 && Math.abs(dx) < 0.06) {
        const refl = (1 - rdy / 0.15) * (1 - Math.abs(dx) / 0.06) * 0.35;
        r += GOLD[0] * refl;
        g += GOLD[1] * refl;
        b += GOLD[2] * refl;
      }
    }
    return [r, g, b, 255];
  });
}

// A4d: remember.webp (3:2) - Constellation of tiny symbols in forest-night sky
function generateRememberArt() {
  const w = 450, h = 300;
  return createPng(w, h, (x, y) => {
    const ny = y / h;
    let r = Math.round(VOID[0] + (SURFACE[0] - VOID[0]) * ny);
    let g = Math.round(VOID[1] + (SURFACE[1] - VOID[1]) * ny);
    let b = Math.round(VOID[2] + (SURFACE[2] - VOID[2]) * ny);

    // Constellation points (star nodes)
    const stars = [[120, 80], [200, 140], [280, 100], [350, 160], [220, 220], [150, 200]];
    for (const [sx, sy] of stars) {
      const d = Math.hypot(x - sx, y - sy);
      if (d < 18) {
        const glow = (1 - d / 18);
        r += GOLD_SOFT[0] * glow * 0.7;
        g += GOLD_SOFT[1] * glow * 0.7;
        b += GOLD_SOFT[2] * glow * 0.7;
      }
    }
    return [r, g, b, 255];
  });
}

// A4e: watch-frame.webp (16:9 = 480x270) - Ornate thin-line double frame showing dream valley inside
function generateWatchFrameArt() {
  const w = 480, h = 270;
  return createPng(w, h, (x, y) => {
    const inOuter = x >= 40 && x <= w - 40 && y >= 25 && y <= h - 25;
    const inInner = x >= 46 && x <= w - 46 && y >= 31 && y <= h - 31;
    const isOuterFrame = inOuter && !inInner;
    if (isOuterFrame) {
      return [GOLD[0], GOLD[1], GOLD[2], 220];
    }
    if (inInner) {
      // Valley inside cinema screen: celestial blue/teal hills
      const t = y / h;
      return [
        Math.round(SURFACE[0] * (1 - t) + LAKE[0] * 0.3 * t),
        Math.round(SURFACE[1] * (1 - t) + LAKE[1] * 0.4 * t),
        Math.round(SURFACE[2] * (1 - t) + LAKE[2] * 0.6 * t),
        255
      ];
    }
    // Deep void surround
    return [VOID[0], VOID[1], VOID[2], 255];
  });
}

// A4f: vault.webp (3:2) - Sealed round stone door at bottom of dark pool
function generateVaultArt() {
  const w = 450, h = 300;
  return createPng(w, h, (x, y) => {
    const cx = w / 2, cy = h / 2;
    const d = Math.hypot(x - cx, y - cy);
    if (d < 70) {
      // Vault door
      if (Math.abs(d - 70) < 3 || Math.abs(d - 60) < 2) {
        return [GOLD[0], GOLD[1], GOLD[2], 240];
      }
      if (d < 12) {
        // Glowing keyhole
        return [GOLD_SOFT[0], GOLD_SOFT[1], GOLD_SOFT[2], 255];
      }
      return [SURFACE[0] + 10, SURFACE[1] + 15, SURFACE[2] + 10, 255];
    }
    // Water ripples
    if (Math.abs(d - 100) < 1.5 || Math.abs(d - 130) < 1.5) {
      return [LAKE[0], LAKE[1], LAKE[2], 120];
    }
    return [VOID[0], VOID[1], VOID[2], 255];
  });
}

// A4g: cta-door.webp (16:9) - Solitary traveler standing before great open doorway at dawn
function generateCtaDoorArt() {
  const w = 480, h = 270;
  return createPng(w, h, (x, y) => {
    const cx = w / 2;
    // Arch doorway in center
    const inDoor = Math.abs(x - cx) < 35 && y > 60 && y < 220;
    const inArch = Math.hypot(x - cx, y - 60) < 35 && y <= 60;
    if (inDoor || inArch) {
      // Light pouring out
      const t = y / 220;
      return [
        Math.round(GOLD_SOFT[0] * (1 - t * 0.3)),
        Math.round(GOLD_SOFT[1] * (1 - t * 0.3)),
        Math.round(GOLD_SOFT[2] * (1 - t * 0.3)),
        245
      ];
    }
    // Traveler silhouette near bottom
    if (Math.abs(x - cx) < 8 && y >= 200 && y <= 228) {
      return [VOID[0], VOID[1], VOID[2], 255];
    }
    // Ambient dusk landscape
    const t = y / h;
    return [
      Math.round(VOID[0] * (1 - t) + SURFACE[0] * t),
      Math.round(VOID[1] * (1 - t) + SURFACE[1] * t),
      Math.round(VOID[2] * (1 - t) + SURFACE[2] * t),
      255
    ];
  });
}

// Empty states (1:1 = 256x256)
function generateEmptyBalcony() {
  return createPng(256, 256, (x, y) => {
    const d = Math.hypot(x - 128, y - 110);
    if (d < 30) {
      const glow = (1 - d / 30);
      return [GOLD[0] * glow, GOLD[1] * glow, GOLD[2] * glow, 255];
    }
    return [SURFACE[0], SURFACE[1], SURFACE[2], 255];
  });
}

function generateEmptyDoorway() {
  return createPng(256, 256, (x, y) => {
    const inDoor = Math.abs(x - 128) < 25 && y > 70 && y < 200;
    if (inDoor) return [GOLD_SOFT[0], GOLD_SOFT[1], GOLD_SOFT[2], 230];
    return [VOID[0], VOID[1], VOID[2], 255];
  });
}

function generateEmptyPool() {
  return createPng(256, 256, (x, y) => {
    const d = Math.hypot(x - 128, y - 140);
    if (Math.abs(d - 40) < 2 || Math.abs(d - 65) < 2) {
      return [LAKE[0], LAKE[1], LAKE[2], 180];
    }
    return [VOID[0], VOID[1], VOID[2], 255];
  });
}

function generateEmptyBook() {
  return createPng(256, 256, (x, y) => {
    const inBook = Math.abs(x - 128) < 60 && y > 100 && y < 170;
    if (inBook) return [238, 242, 239, 230]; // glowing paper
    return [SURFACE[0], SURFACE[1], SURFACE[2], 255];
  });
}

// A7: og.webp (1200x630 or 600x315)
function generateOgImage() {
  const w = 600, h = 315;
  return createPng(w, h, (x, y) => {
    const inDoor = Math.abs(x - 420) < 40 && y > 80 && y < 250;
    if (inDoor) return [GOLD_SOFT[0], GOLD_SOFT[1], GOLD_SOFT[2], 230];
    return [VOID[0], VOID[1], VOID[2], 255];
  });
}

const assets = [
  { name: 'reflect.webp', buf: generateReflectArt() },
  { name: 'remember.webp', buf: generateRememberArt() },
  { name: 'watch-frame.webp', buf: generateWatchFrameArt() },
  { name: 'vault.webp', buf: generateVaultArt() },
  { name: 'cta-door.webp', buf: generateCtaDoorArt() },
  { name: 'empty-balcony.webp', buf: generateEmptyBalcony() },
  { name: 'empty-doorway.webp', buf: generateEmptyDoorway() },
  { name: 'empty-pool.webp', buf: generateEmptyPool() },
  { name: 'empty-book.webp', buf: generateEmptyBook() },
  { name: 'og.webp', buf: generateOgImage() },
];

for (const a of assets) {
  const target = path.join(artDir, a.name);
  fs.writeFileSync(target, a.buf);
  console.log('Saved ' + a.name + ' (' + a.buf.length + ' bytes)');
}

