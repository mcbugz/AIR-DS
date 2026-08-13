#!/usr/bin/env node
/**
 * Build-time sync of the shared allowed-literal ruleset (F5).
 *
 * Source of truth: tooling/validate/src/rules/allowlist.ts (@ds/validate).
 * @ds/mcp ships standalone (runtime deps: MCP SDK + zod only), so instead of
 * a runtime workspace dependency on the whole gauntlet package it carries a
 * VERBATIM generated copy of the (import-free) allowlist module. Divergence
 * cannot go unnoticed: tests/allowlist-parity.test.ts byte-compares the copy
 * against the source and replays the shared verdict corpus
 * (tooling/validate/config/allowlist-corpus.json) through validate_usage.
 *
 * Runs as the first step of `pnpm --filter @ds/mcp build`; rerun any time the
 * source module changes. Outside the monorepo (shipped tarball) the source is
 * absent and the committed copy is used as-is.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, '..', '..', '..', 'tooling', 'validate', 'src', 'rules', 'allowlist.ts');
const target = join(here, '..', 'src', 'generated', 'allowlist.ts');

const HEADER = `/* GENERATED FILE — DO NOT EDIT.
 * Verbatim copy of tooling/validate/src/rules/allowlist.ts, produced by
 * packages/mcp/scripts/sync-allowlist.mjs (runs in the @ds/mcp build).
 * Parity is enforced by tests/allowlist-parity.test.ts. */

`;

if (!existsSync(source)) {
  if (existsSync(target)) {
    console.log('[sync-allowlist] source not present (standalone build) — keeping committed copy');
    process.exit(0);
  }
  console.error(`[sync-allowlist] neither source (${source}) nor existing copy (${target}) found`);
  process.exit(1);
}

const body = readFileSync(source, 'utf8');
const next = HEADER + body;
mkdirSync(dirname(target), { recursive: true });
if (existsSync(target) && readFileSync(target, 'utf8') === next) {
  console.log('[sync-allowlist] up to date');
} else {
  writeFileSync(target, next);
  console.log(`[sync-allowlist] wrote ${target}`);
}
