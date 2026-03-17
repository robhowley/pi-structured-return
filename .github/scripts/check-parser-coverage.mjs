#!/usr/bin/env node
/**
 * Checks that every user-facing built-in parser has a row in the README token reduction table.
 * Exits 1 if any are missing.
 */

import fs from "node:fs";

const INTERNAL_PARSERS = new Set(["tail-fallback"]);

const registry = fs.readFileSync("extensions/structured-return/src/config/registry.ts", "utf8");
const readme = fs.readFileSync("README.md", "utf8");

// Extract keys from the builtIns object literal
const builtInsMatch = registry.match(/const builtIns[^=]+=\s*\{([^}]+)\}/s);
if (!builtInsMatch) {
  console.error("Could not locate builtIns object in registry.ts");
  process.exit(1);
}

const parserIds = [...builtInsMatch[1].matchAll(/"([\w-]+)"\s*:/g)].map((m) => m[1]);

const missing = parserIds.filter(
  (id) => !INTERNAL_PARSERS.has(id) && !readme.includes(`| \`${id}\` |`) && !readme.includes(`| ${id} |`)
);

if (missing.length > 0) {
  console.error("The following parsers are missing from the README token reduction table:");
  for (const id of missing) console.error(`  - ${id}`);
  process.exit(1);
}

console.log(`All ${parserIds.length - INTERNAL_PARSERS.size} parsers accounted for in README.`);
