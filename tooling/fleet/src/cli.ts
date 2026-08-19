#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectFleet, readManifest, refsFromPaths, type RepoRef } from './collect.ts';
import { checkPolicy } from './policy.ts';
import { buildDashboard } from './render/build.ts';
import type { FleetData } from './types.ts';

/**
 * ds-fleet — the AIR-DS fleet control plane CLI (Mandate v2 / M3).
 *
 *   ds-fleet collect <repoRoot...> [--manifest <file>] [-o fleet-data.json]
 *   ds-fleet render  [--data fleet-data.json] -o <dir>
 *   ds-fleet policy-check <repoRoot> [--policy <file>]
 *
 * Deterministic, credential-free, filesystem in / filesystem out. Exit codes:
 * 0 ok · 1 policy breach or bad usage · 2 collection/render failure.
 */

const USAGE = `ds-fleet — AIR-DS fleet control plane

Usage:
  ds-fleet collect <repoRoot...> [--manifest <file>] [-o <fleet-data.json>]
  ds-fleet render [--data <fleet-data.json>] -o <outDir>
  ds-fleet policy-check <repoRoot> [--policy <file>]
`;

function arg(argv: string[], flag: string): string | null {
  const i = argv.indexOf(flag);
  if (i === -1) return null;
  const v = argv[i + 1];
  if (v === undefined) throw new Error(`${flag} needs a value`);
  argv.splice(i, 2);
  return v;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const cmd = argv.shift();

  if (cmd === 'collect') {
    const manifest = arg(argv, '--manifest');
    const out = resolve(arg(argv, '-o') ?? arg(argv, '--out') ?? 'fleet-data.json');
    const refs: RepoRef[] = [
      ...(manifest ? readManifest(manifest) : []),
      ...refsFromPaths(argv.filter((a) => !a.startsWith('-'))),
    ];
    const data = collectFleet(refs);
    writeFileSync(out, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    const h = data.fleet.headline;
    const show = (v: number | null): string => (v === null ? '—' : `${(v * 100).toFixed(1)}%`);
    console.log(`fleet collected: ${data.repos.length} repo(s), ${data.fleet.totals.runs} run(s) -> ${out}`);
    console.log(
      `  hallucination/run ${h.hallucinationRate === null ? '—' : h.hallucinationRate} · first-pass ${show(h.firstPassRate)} · evals ${show(h.evalCompliance)} · a11y-clean ${show(h.a11yCleanRate)} · policy ${show(h.policyCompliance)}`,
    );
    return 0;
  }

  if (cmd === 'render') {
    const dataPath = resolve(arg(argv, '--data') ?? 'fleet-data.json');
    const outDir = arg(argv, '-o') ?? arg(argv, '--out');
    if (!outDir) {
      console.error('render needs -o <outDir>');
      return 1;
    }
    const data = JSON.parse(readFileSync(dataPath, 'utf8')) as FleetData;
    const out = await buildDashboard({ outDir: resolve(outDir), data });
    console.log(`fleet dashboard rendered: ${out}/index.html (${data.repos.length} repo(s))`);
    return 0;
  }

  if (cmd === 'policy-check') {
    const policyFile = arg(argv, '--policy');
    const root = argv.find((a) => !a.startsWith('-'));
    if (!root) {
      console.error('policy-check needs a <repoRoot>');
      return 1;
    }
    const verdict = checkPolicy(resolve(root), policyFile ? { policyFile: resolve(policyFile) } : {});
    // Machine-readable verdict on stdout, always.
    console.log(JSON.stringify(verdict, null, 2));
    return verdict.ok ? 0 : 1;
  }

  console.error(USAGE);
  return cmd === undefined || cmd === '--help' || cmd === '-h' ? 0 : 1;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(`ds-fleet: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 2;
  },
);
