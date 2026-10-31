/**
 * scripts/test-opacity-tokens.js
 * Verifies that all Tailwind color tokens map to valid rgb() channel variables with
 * opacity modifiers (/10, /40, /80), ensuring no token resolves to invalid CSS,
 * transparent, or unintentional pure white.
 */

const fs = require("fs");
const path = require("path");
const postcss = require("postcss");
const tailwindcss = require("tailwindcss");

const TOKENS = [
  "bg",
  "surface",
  "surface-raised",
  "border",
  "hairline",
  "text",
  "text-muted",
  "text-subtle",
  "accent",
  "accent-soft",
  "accent-deep",
  "link",
  "success",
  "danger",
  "focus",
  "void",
  "forest-night",
  "slate",
  "cloud",
  "mist",
  "sage",
  "lantern",
  "lake",
  "leaf",
  "dusk-rose",
  "graphite",
  "ash",
  "viridian",
  "pine",
  "moss",
  "cobalt",
  "deepsea",
  "skyblue",
];

const MODIFIERS = ["10", "40", "80"];

async function main() {
  console.log("Testing Tailwind opacity tokens at /10, /40, /80...");

  // 1. Verify globals.css defines channel variables
  const globalsPath = path.join(__dirname, "../src/app/globals.css");
  const globalsCss = fs.readFileSync(globalsPath, "utf8");

  const nightBlockMatch = globalsCss.match(/:root,\s*\[data-theme="night"\]\s*\{([^}]+)\}/);
  const dawnBlockMatch = globalsCss.match(/\[data-theme="dawn"\]\s*\{([^}]+)\}/);

  if (!nightBlockMatch || !dawnBlockMatch) {
    console.error("FAIL: Could not locate Night and Dawn blocks in globals.css");
    process.exit(1);
  }

  const nightBlock = nightBlockMatch[1];
  const dawnBlock = dawnBlockMatch[1];

  let missingChannels = 0;
  for (const token of TOKENS) {
    const varName = `--${token}-rgb`;
    if (!nightBlock.includes(varName)) {
      console.error(`FAIL: Missing ${varName} in Night block of globals.css`);
      missingChannels++;
    }
    if (!dawnBlock.includes(varName)) {
      console.error(`FAIL: Missing ${varName} in Dawn block of globals.css`);
      missingChannels++;
    }
  }

  if (missingChannels > 0) {
    console.error(`FAIL: ${missingChannels} channel variable(s) missing from globals.css`);
    process.exit(1);
  }
  console.log("✓ All channel variables (--*-rgb) present in both Night and Dawn themes.");

  // 2. Generate test CSS classes
  const classesToTest = [];
  for (const token of TOKENS) {
    for (const mod of MODIFIERS) {
      classesToTest.push(`bg-${token}/${mod}`);
      classesToTest.push(`text-${token}/${mod}`);
      classesToTest.push(`border-${token}/${mod}`);
    }
  }

  const mockHtml = `<div class="${classesToTest.join(" ")}"></div>`;
  const tailwindConfigPath = path.join(__dirname, "../tailwind.config.ts");

  const testCssInput = `
    @tailwind utilities;
  `;

  const result = await postcss([
    tailwindcss({
      content: [{ raw: mockHtml, extension: "html" }],
      darkMode: ["class", '[data-theme="night"]'],
      theme: {
        extend: require(tailwindConfigPath).default.theme.extend,
      },
    }),
  ]).process(testCssInput, { from: undefined });

  const css = result.css;

  // 3. Inspect generated rules
  let failures = 0;

  // Rule 1: No rgb(#...) invalid CSS syntax allowed
  const invalidHexInRgb = css.match(/rgb\(\s*#[0-9a-fA-F]+\s*\//g);
  if (invalidHexInRgb) {
    console.error("FAIL: Invalid hex inside rgb() with opacity modifier:", invalidHexInRgb);
    failures++;
  }

  // Rule 2: No transparent or pure white (#fff / #ffffff / white) generated for dark surface tokens
  for (const token of TOKENS) {
    for (const mod of MODIFIERS) {
      const escapedToken = token.replace(/[-]/g, "\\-");
      const bgRegex = new RegExp(`\\.bg-${escapedToken}\\\\/${mod}\\s*\\{([^}]+)\\}`, "g");
      const match = bgRegex.exec(css);

      if (!match) {
        console.error(`FAIL: Class bg-${token}/${mod} did not generate any CSS rule.`);
        failures++;
        continue;
      }

      const decl = match[1].trim();

      // Check if it's transparent or pure white
      if (decl.includes("transparent") || decl.includes("#fff") || decl.includes("rgb(255 255 255)")) {
        console.error(`FAIL: bg-${token}/${mod} resolved to transparent or white: ${decl}`);
        failures++;
      }

      // Check that it references rgb(var(--*-rgb) / ...)
      if (!decl.includes(`var(--${token}-rgb)`)) {
        console.error(`FAIL: bg-${token}/${mod} does not properly reference var(--${token}-rgb): ${decl}`);
        failures++;
      }
    }
  }

  if (failures > 0) {
    console.error(`FAIL: ${failures} token opacity verification failure(s).`);
    process.exit(1);
  }

  console.log(`Passed: Successfully verified all ${TOKENS.length} tokens at /10, /40, and /80!`);
}

main().catch((err) => {
  console.error("Error running token opacity verification:", err);
  process.exit(1);
});

