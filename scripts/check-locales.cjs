const { readFileSync } = require("fs");
const { join, dirname } = require("path");

const localesDir = join(__dirname, "..", "apps", "desktop", "src", "renderer", "locales");

function deepKeys(obj, prefix) {
  prefix = prefix || "";
  if (!obj || typeof obj !== "object") return [prefix];
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...deepKeys(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function main() {
  const zhPath = join(localesDir, "zh.json");
  const enPath = join(localesDir, "en.json");

  const zh = JSON.parse(readFileSync(zhPath, "utf8"));
  const en = JSON.parse(readFileSync(enPath, "utf8"));

  const zhKeys = new Set(deepKeys(zh));
  const enKeys = new Set(deepKeys(en));

  let hasErrors = false;

  for (const key of zhKeys) {
    if (!enKeys.has(key)) {
      console.error(`[en.json] Missing key: ${key}`);
      hasErrors = true;
    }
  }

  for (const key of enKeys) {
    if (!zhKeys.has(key)) {
      console.error(`[zh.json] Missing key: ${key}`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error("\nLOCALE MISMATCH - please sync the files above.");
    process.exit(1);
  }

  console.log(`OK: ${zhKeys.size} keys in zh.json, ${enKeys.size} keys in en.json`);
}

main();
