import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { historyPath, readHistory } from './history.ts';
import { checkPolicy } from './policy.ts';
import {
  fleetRollup,
  healthScore,
  repoDeltas,
  repoLatest,
  repoRates,
  repoTrend,
} from './rollup.ts';
import type { FleetData, PolicyVerdict, RepoPolicySummary, RepoReport } from './types.ts';

/**
 * Fleet collector: N repo roots in, one normalized fleet-data.json out.
 * Inputs are local paths only (credential-free, no network): either repo
 * roots passed directly or a manifest file listing them.
 */

export interface RepoRef {
  id: string;
  root: string;
}

interface ManifestShape {
  $schema?: string;
  repos: { id?: string; root: string }[];
}

/** Read a fleet manifest; roots resolve relative to the manifest file. */
export function readManifest(manifestPath: string): RepoRef[] {
  const abs = resolve(manifestPath);
  const parsed = JSON.parse(readFileSync(abs, 'utf8')) as ManifestShape;
  if (!Array.isArray(parsed.repos)) {
    throw new Error(`manifest ${abs} has no "repos" array`);
  }
  const base = dirname(abs);
  return parsed.repos.map((r) => {
    const root = isAbsolute(r.root) ? r.root : resolve(base, r.root);
    return { id: r.id ?? basename(root), root };
  });
}

/** Normalize direct path arguments into repo refs (id = directory basename). */
export function refsFromPaths(paths: string[]): RepoRef[] {
  return paths.map((p) => {
    const root = resolve(p);
    return { id: basename(root), root };
  });
}

function policySummary(verdict: PolicyVerdict): RepoPolicySummary {
  return {
    present: verdict.policyPresent,
    ok: verdict.ok,
    failing: verdict.checks.filter((c) => !c.ok).map((c) => c.id),
    checks: verdict.checks,
  };
}

/** Normalize one repo's history + policy into its fleet report. */
export function collectRepo(ref: RepoRef): RepoReport {
  if (!existsSync(ref.root) || !statSync(ref.root).isDirectory()) {
    throw new Error(`repo root not found: ${ref.root}`);
  }
  const lines = readHistory(historyPath(ref.root));
  const latest = repoLatest(lines);
  const rates = repoRates(lines);
  const trend = repoTrend(lines);
  return {
    id: ref.id,
    root: ref.root,
    lines: lines.length,
    latest,
    rates,
    trend,
    deltas: repoDeltas(trend),
    health: healthScore(rates, latest),
    policy: policySummary(checkPolicy(ref.root, { lines })),
  };
}

/** Collect the whole fleet. Deterministic: generatedAt = max line ts observed. */
export function collectFleet(refs: RepoRef[]): FleetData {
  if (refs.length === 0) throw new Error('no repos to collect (pass paths or --manifest)');
  const ids = new Set<string>();
  for (const ref of refs) {
    if (ids.has(ref.id)) throw new Error(`duplicate repo id "${ref.id}" — give manifest entries unique ids`);
    ids.add(ref.id);
  }
  const repos = refs.map(collectRepo);
  const maxTs = repos
    .flatMap((r) => r.trend.ts)
    .reduce((a, b) => (b > a ? b : a), '');
  return {
    $schema: 'ds-fleet/fleet-data.v1',
    generatedAt: maxTs || 'unknown',
    repos,
    fleet: fleetRollup(repos),
  };
}
