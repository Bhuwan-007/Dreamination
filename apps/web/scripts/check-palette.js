/**
 * check-palette.js
 * Scans apps/web/src for forbidden off-palette Tailwind colors and unknown utility classes.
 * Enforces Design.md §3 tokens (Night & Dawn).
 */

const fs = require("fs");
const path = require("path");

const FORBIDDEN_PATTERNS = [
  { regex: /\b(text|bg|border|ring|from|to|via)-indigo-[0-9]+\b/g, name: "indigo" },
  { regex: /\b(text|bg|border|ring|from|to|via)-amber-[0-9]+\b/g, name: "amber" },
  { regex: /\b(text|bg|border|ring|from|to|via)-cyan-[0-9]+\b/g, name: "cyan" },
  { regex: /\b(text|bg|border|ring|from|to|via)-emerald-[0-9]+\b/g, name: "emerald" },
  { regex: /\b(text|bg|border|ring|from|to|via)-orange-[0-9]+\b/g, name: "orange" },
  { regex: /\b(text|bg|border|ring|from|to|via)-purple-[0-9]+\b/g, name: "purple" },
  { regex: /\b(text|bg|border|ring|from|to|via)-red-[0-9]+\b/g, name: "red" },
  { regex: /\b(text|bg|border|ring|from|to|via)-green-[0-9]+\b/g, name: "green" },
  { regex: /\b(text|bg|border|ring|from|to|via)-blue-[0-9]+\b/g, name: "blue" },
  { regex: /\bbg-radial-gradient\b/g, name: "bg-radial-gradient" },
  { regex: /\bbg-slate-raised\b/g, name: "bg-slate-raised" },
  { regex: /\btext-danger\b/g, name: "text-danger" },
];

const SRC_DIR = path.join(__dirname, "..", "src");

let violations = 0;

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (/\.(tsx|ts|jsx|js|css)$/.test(entry.name)) {
      scanFile(fullPath);
    }
  }
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    // Skip comments or test mock data if marked
    if (line.includes("palette-ignore")) return;

    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.regex.test(line)) {
        console.error(
          `\x1b[31m[Palette Error]\x1b[0m ${path.relative(SRC_DIR, filePath)}:${index + 1} - forbidden token '${pattern.name}' found:`
        );
        console.error(`  > ${line.trim()}`);
        violations++;
      }
    }
  });
}

console.log("Checking apps/web/src for off-palette tokens...");
scanDir(SRC_DIR);

if (violations > 0) {
  console.error(`\n\x1b[31mFailed: ${violations} off-palette token(s) found in apps/web/src.\x1b[0m`);
  console.error("Allowed palette: void, forest-night, slate, graphite, ash, cloud, mist, sage, lantern, viridian, pine, moss, leaf, lake, dusk-rose.");
  process.exit(1);
} else {
  console.log("\x1b[32mPassed: All tokens are strictly on-palette!\x1b[0m");
}

