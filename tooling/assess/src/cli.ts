#!/usr/bin/env node
/**
 * ds-assess — AI-readiness assessment scanner (AIR-DS Mandate v2 / M1).
 *
 * Usage:
 *   ds-assess <path-to-repo> [--out <dir>] [--json]
 *
 * Scans a LOCAL path only. No network, no credentials, no LLM — deterministic
 * scoring with file-level evidence. Prints the rendered ASSESSMENT.md to
 * stdout (or the raw JSON with --json); with --out, also writes
 * assessment.json and ASSESSMENT.md into the given directory.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { assess } from './assess.ts';
import { renderMarkdown } from './report.ts';

function fail(message: string): never {
  process.stderr.write(`ds-assess: ${message}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
let target: string | null = null;
let outDir: string | null = null;
let asJson = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i] as string;
  if (arg === '--json') {
    asJson = true;
  } else if (arg === '--out') {
    const v = args[++i];
    if (v === undefined) fail('--out requires a directory argument');
    outDir = v;
  } else if (arg === '--help' || arg === '-h') {
    process.stdout.write('Usage: ds-assess <path-to-repo> [--out <dir>] [--json]\n');
    process.exit(0);
  } else if (arg.startsWith('-')) {
    fail(`unknown flag ${arg}`);
  } else if (target === null) {
    target = arg;
  } else {
    fail('exactly one path argument expected');
  }
}

if (target === null) fail('usage: ds-assess <path-to-repo> [--out <dir>] [--json]');
const resolved = path.resolve(target);
let stat: fs.Stats;
try {
  stat = fs.statSync(resolved);
} catch {
  fail(`path does not exist: ${resolved}`);
}
if (!stat.isDirectory()) fail(`not a directory: ${resolved}`);

const result = assess(resolved);
const markdown = renderMarkdown(result);
const json = JSON.stringify(result, null, 2);

if (outDir !== null) {
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'assessment.json'), `${json}\n`);
  fs.writeFileSync(path.join(dir, 'ASSESSMENT.md'), `${markdown}\n`);
  process.stderr.write(
    `ds-assess: wrote ${path.join(dir, 'assessment.json')} and ${path.join(dir, 'ASSESSMENT.md')}\n`,
  );
}

process.stdout.write(asJson ? `${json}\n` : `${markdown}\n`);
