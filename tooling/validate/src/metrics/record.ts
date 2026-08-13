import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { GauntletReport, Violation } from '../types.ts';

/**
 * Per-release metrics writer (brief §8 success metrics, made trackable).
 *
 * Every CLI run of the gauntlet, the eval runner, and the benchmark harness
 * appends one structured JSON line to metrics/history.jsonl. The line is
 * self-describing (`source` says which runner wrote it); the reporter
 * (src/metrics/report.ts) merges lines per git_sha into a trend table.
 *
 * Determinism: `ts` defaults to the HEAD commit time (stable across re-runs
 * of the same tree) and can be pinned with --now for byte-reproducible runs.
 * No network, no credentials — git is the only external tool, and it is
 * optional (falls back to "unknown" sha / wall-clock ts outside a repo).
 */

export interface GauntletMetrics {
  passed: boolean;
  /** Steps attempted (skipped steps excluded). */
  steps: number;
  /** Per-step wall-clock durations in ms, e.g. { typecheck: 1200, ... }. */
  durations: Record<string, number>;
}

export interface EvalMetrics {
  /** Overall pass rate 0..1. */
  overall: number;
  /** Critical pass rate 0..1 (gate: must be 1). */
  critical: number;
  passed: number;
  total: number;
}

export interface BenchmarkMetrics {
  mode: string;
  scenarios: number;
  /** Per-source aggregates, keyed by score source (recorded:system, baseline:raw-tailwind, ...). */
  sources: Record<
    string,
    { avgTokenCompliance: number; fabrications: number; gauntletPassRate: number }
  >;
  axe: 'ran' | 'skipped';
}

export interface StoriesAxeMetrics {
  /** Stories scanned (every entry in storybook-static/index.json). */
  stories: number;
  storiesWithViolations: number;
  /** Total axe violations across all stories (all impacts). */
  violations: number;
  serious: number;
  critical: number;
  /** Serious/critical gate (after allowlist) passed. */
  gatePassed: boolean;
}

export interface RegistryCounts {
  tokens: number;
  components: number;
}

export interface MetricsLine {
  ts: string;
  git_sha: string;
  source: 'gauntlet' | 'evals' | 'benchmark' | 'stories-axe';
  gauntlet?: GauntletMetrics;
  evals?: EvalMetrics;
  benchmark?: BenchmarkMetrics;
  storiesAxe?: StoriesAxeMetrics;
  /** Fabricated tokens/components detected in this run (G1 + G5). Target: 0. */
  fabrications: number;
  registry_counts: RegistryCounts;
}

function git(root: string, args: string[]): string | null {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

export function gitSha(root: string): string {
  return git(root, ['rev-parse', '--short', 'HEAD']) ?? 'unknown';
}

/** HEAD commit time (ISO 8601) — deterministic for a given tree; wall clock as fallback. */
export function gitCommitTs(root: string): string {
  return git(root, ['show', '-s', '--format=%cI', 'HEAD']) ?? new Date().toISOString();
}

export function registryCounts(root: string): RegistryCounts {
  const count = (file: string, key: string): number => {
    const p = join(root, 'registries', file);
    if (!existsSync(p)) return 0;
    try {
      const parsed = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown[]>;
      return Array.isArray(parsed[key]) ? parsed[key].length : 0;
    } catch {
      return 0;
    }
  };
  return {
    tokens: count('tokens-index.json', 'tokens'),
    components: count('components-index.json', 'components'),
  };
}

/** Count fabrications (G1 token / G5 component closed-world hits) in a violation list. */
export function countFabrications(violations: Violation[]): number {
  return violations.filter((v) => v.rule === 'G1' || v.rule === 'G5').length;
}

export function gauntletMetricsFromReport(report: GauntletReport): {
  gauntlet: GauntletMetrics;
  fabrications: number;
} {
  const attempted = report.steps.filter((s) => s.status !== 'skip');
  const durations: Record<string, number> = {};
  for (const s of attempted) durations[s.step] = s.durationMs;
  const violations = report.steps.flatMap((s) => s.violations ?? []);
  return {
    gauntlet: { passed: report.ok, steps: attempted.length, durations },
    fabrications: countFabrications(violations),
  };
}

export interface BuildMetricsLineOptions {
  root: string;
  source: MetricsLine['source'];
  gauntlet?: GauntletMetrics;
  evals?: EvalMetrics;
  benchmark?: BenchmarkMetrics;
  storiesAxe?: StoriesAxeMetrics;
  fabrications?: number;
  /** Pin the timestamp (--now flag); defaults to the HEAD commit time. */
  now?: string;
  /** Override the sha (tests); defaults to `git rev-parse --short HEAD`. */
  sha?: string;
  /** Override registry counts (tests); defaults to reading registries/. */
  counts?: RegistryCounts;
}

export function buildMetricsLine(opts: BuildMetricsLineOptions): MetricsLine {
  const line: MetricsLine = {
    ts: opts.now ?? gitCommitTs(opts.root),
    git_sha: opts.sha ?? gitSha(opts.root),
    source: opts.source,
    fabrications: opts.fabrications ?? 0,
    registry_counts: opts.counts ?? registryCounts(opts.root),
  };
  if (opts.gauntlet) line.gauntlet = opts.gauntlet;
  if (opts.evals) line.evals = opts.evals;
  if (opts.benchmark) line.benchmark = opts.benchmark;
  if (opts.storiesAxe) line.storiesAxe = opts.storiesAxe;
  return line;
}

export function historyPath(root: string): string {
  return join(root, 'metrics', 'history.jsonl');
}

export function appendMetricsLine(root: string, line: MetricsLine, path?: string): string {
  const target = path ?? historyPath(root);
  mkdirSync(dirname(target), { recursive: true });
  appendFileSync(target, `${JSON.stringify(line)}\n`, 'utf8');
  return target;
}

export function readHistory(path: string): MetricsLine[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as MetricsLine);
}
