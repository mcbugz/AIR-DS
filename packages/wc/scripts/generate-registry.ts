/**
 * Compile registries/wc-index.json FROM packages/wc/src/manifest.ts.
 *
 * Direction of truth (CLAUDE.md rule 1): the manifest is the hand-written
 * source; the registry is the generated machine contract. Never edit the
 * JSON — change the manifest and re-run `pnpm --filter @ds/wc generate`
 * (also part of `pnpm --filter @ds/wc build`).
 *
 * Usage: node scripts/generate-registry.ts [--out <path>]
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { WC_MANIFEST } from "../src/manifest.ts";
import { buildWcRegistry } from "./registry-shape.ts";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(PKG_ROOT, "..", "..");

let outPath = join(REPO_ROOT, "registries", "wc-index.json");
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === "--out") {
    const value = argv[i + 1];
    if (value === undefined) throw new Error("--out requires a path argument");
    outPath = resolve(process.cwd(), value);
    i += 1;
  } else {
    throw new Error(`Unknown argument: ${String(argv[i])}`);
  }
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, buildWcRegistry(WC_MANIFEST), "utf8");
console.log(`@ds/wc registry OK: ${outPath} (${WC_MANIFEST.length} component${WC_MANIFEST.length === 1 ? "" : "s"})`);
