import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  BenchmarkMetrics,
  EvalMetrics,
  GauntletMetrics,
  MetricsLine,
  StoriesAxeMetrics,
} from './types.ts';

/** metrics/history.jsonl location inside a repo root (same contract as @ds/validate). */
export function historyPath(repoRoot: string): string {
  return join(repoRoot, 'metrics', 'history.jsonl');
}

/**
 * Read a history.jsonl file. Missing file -> []. Unparseable lines are
 * dropped (a fleet collector must survive one bad repo without failing the
 * other N); lines missing the required envelope fields are dropped too.
 */
export function readHistory(path: string): MetricsLine[] {
  if (!existsSync(path)) return [];
  const out: MetricsLine[] = [];
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    if (raw.trim().length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!isMetricsLine(parsed)) continue;
    out.push(parsed);
  }
  return out;
}

function isMetricsLine(v: unknown): v is MetricsLine {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.ts === 'string' &&
    typeof o.git_sha === 'string' &&
    typeof o.source === 'string' &&
    typeof o.fabrications === 'number' &&
    typeof o.registry_counts === 'object' &&
    o.registry_counts !== null
  );
}

/** One release = one git sha; lines merged in append order, newest section wins. */
export interface ShaGroup {
  sha: string;
  ts: string;
  gauntlet: GauntletMetrics | null;
  evals: EvalMetrics | null;
  benchmark: BenchmarkMetrics | null;
  storiesAxe: StoriesAxeMetrics | null;
  /** Max fabrications across the group's lines (a single bad run counts). */
  fabrications: number;
  counts: MetricsLine['registry_counts'];
  /** Whether ALL gauntlet lines in this group passed (null if none). */
  gauntletAllPassed: boolean | null;
  /**
   * Whether the FIRST gauntlet run at this release passed (null if none).
   * This is the brief §8 "first-pass" semantics: later red/green runs at the
   * same sha are the dev loop doing its job, not new verdicts on the release
   * (FB-16 — the all-runs metric created a doom loop inside the merge gate).
   */
  gauntletFirstRunPassed: boolean | null;
}

/** Group history lines per git sha, preserving first-seen (chronological) order. */
export function groupBySha(lines: MetricsLine[]): ShaGroup[] {
  const groups = new Map<string, ShaGroup>();
  const order: string[] = [];
  for (const line of lines) {
    let g = groups.get(line.git_sha);
    if (!g) {
      g = {
        sha: line.git_sha,
        ts: line.ts,
        gauntlet: null,
        evals: null,
        benchmark: null,
        storiesAxe: null,
        fabrications: 0,
        counts: line.registry_counts,
        gauntletAllPassed: null,
        gauntletFirstRunPassed: null,
      };
      groups.set(line.git_sha, g);
      order.push(line.git_sha);
    }
    g.ts = line.ts;
    g.counts = line.registry_counts;
    if (line.gauntlet) {
      if (g.gauntlet === null) g.gauntletFirstRunPassed = line.gauntlet.passed;
      g.gauntlet = line.gauntlet;
      g.gauntletAllPassed =
        (g.gauntletAllPassed ?? true) && line.gauntlet.passed;
    }
    if (line.evals) g.evals = line.evals;
    if (line.benchmark) g.benchmark = line.benchmark;
    if (line.storiesAxe) g.storiesAxe = line.storiesAxe;
    g.fabrications = Math.max(g.fabrications, line.fabrications);
  }
  return order.map((sha) => groups.get(sha) as ShaGroup);
}
