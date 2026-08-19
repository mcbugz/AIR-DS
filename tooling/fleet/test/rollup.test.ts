import { describe, expect, it } from 'vitest';
import { groupBySha } from '../src/history.ts';
import {
  fleetDeltas,
  fleetHeadline,
  healthScore,
  repoDeltas,
  repoLatest,
  repoRates,
  repoTrend,
} from '../src/rollup.ts';
import type { MetricsLine, RepoReport } from '../src/types.ts';

/**
 * Hand-computed expectations over tiny synthetic inputs — every number in
 * this file was derived on paper from the formulas documented in rollup.ts,
 * never by running the code first.
 */

const counts = { tokens: 100, components: 10 };

const gauntletLine = (sha: string, passed: boolean, fabrications = 0, steps?: string[]): MetricsLine => ({
  ts: `2026-08-01T00:00:00-05:00`,
  git_sha: sha,
  source: 'gauntlet',
  fabrications,
  registry_counts: counts,
  gauntlet: {
    passed,
    steps: (steps ?? ['typecheck', 'lint', 'build', 'test', 'registry-check']).length,
    durations: Object.fromEntries((steps ?? ['typecheck', 'lint', 'build', 'test', 'registry-check']).map((s) => [s, 100])),
  },
});

const evalsLine = (sha: string, passed: number, total: number, critical = 1): MetricsLine => ({
  ts: `2026-08-02T00:00:00-05:00`,
  git_sha: sha,
  source: 'evals',
  fabrications: 0,
  registry_counts: counts,
  evals: { overall: passed / total, critical, passed, total },
});

const axeLine = (sha: string, stories: number, dirty: number, gatePassed: boolean): MetricsLine => ({
  ts: `2026-08-03T00:00:00-05:00`,
  git_sha: sha,
  source: 'stories-axe',
  fabrications: 0,
  registry_counts: counts,
  storiesAxe: {
    stories,
    storiesWithViolations: dirty,
    violations: dirty,
    serious: 0,
    critical: 0,
    gatePassed,
  },
});

describe('groupBySha', () => {
  it('merges lines per sha in first-seen order, all-gauntlet-passed semantics', () => {
    const lines = [
      gauntletLine('s1', true),
      gauntletLine('s2', true),
      gauntletLine('s2', false),
      evalsLine('s2', 9, 10),
    ];
    const groups = groupBySha(lines);
    expect(groups.map((g) => g.sha)).toEqual(['s1', 's2']);
    expect(groups[0]?.gauntletAllPassed).toBe(true);
    // one failing run inside the sha makes the release non-first-pass
    expect(groups[1]?.gauntletAllPassed).toBe(false);
    expect(groups[1]?.evals?.passed).toBe(9);
  });

  it('takes max fabrications within a group', () => {
    const groups = groupBySha([gauntletLine('s1', false, 4), gauntletLine('s1', true, 0)]);
    expect(groups[0]?.fabrications).toBe(4);
  });
});

describe('repoRates', () => {
  it('first-pass rate = passed gauntlet runs / total gauntlet runs', () => {
    // 3 gauntlet runs across 2 releases; first run per release: 1/2 = 0.5 (FB-16 semantics)
    const lines = [gauntletLine('s1', true), gauntletLine('s2', false), gauntletLine('s2', true), evalsLine('s2', 8, 10)];
    const rates = repoRates(lines);
    expect(rates.gauntletFirstPass).toEqual({ passed: 1, total: 2, rate: 0.5 });
    expect(rates.evalCompliance).toEqual({ passed: 8, total: 10, rate: 0.8 });
    expect(rates.runsTotal).toBe(4);
  });

  it('null rate and null compliance when nothing recorded', () => {
    const rates = repoRates([]);
    expect(rates.gauntletFirstPass.rate).toBeNull();
    expect(rates.evalCompliance).toBeNull();
    expect(rates.runsTotal).toBe(0);
  });

  it('fabricationsTotal sums every line', () => {
    expect(repoRates([gauntletLine('s1', true, 2), gauntletLine('s2', true, 3)]).fabricationsTotal).toBe(5);
  });
});

describe('repoLatest', () => {
  it('falls back to the most recent group that recorded each section', () => {
    const lines = [
      gauntletLine('s1', true),
      evalsLine('s1', 10, 10),
      axeLine('s1', 50, 0, true),
      gauntletLine('s2', true), // s2 re-ran only the gauntlet
    ];
    const latest = repoLatest(lines);
    expect(latest?.sha).toBe('s2');
    expect(latest?.evals?.passed).toBe(10); // carried from s1
    expect(latest?.storiesAxe?.stories).toBe(50); // carried from s1
    expect(latest?.gauntletPassed).toBe(true);
  });

  it('is null for an empty history', () => {
    expect(repoLatest([])).toBeNull();
  });
});

describe('repoTrend + repoDeltas', () => {
  it('builds per-release series and latest-vs-previous deltas', () => {
    const lines = [
      gauntletLine('s1', true),
      evalsLine('s1', 10, 10),
      gauntletLine('s2', false, 2),
      evalsLine('s2', 9, 10),
    ];
    const trend = repoTrend(lines);
    expect(trend.gauntletPass).toEqual([1, 0]);
    expect(trend.evalOverall).toEqual([1, 0.9]);
    expect(trend.fabrications).toEqual([0, 2]);
    const deltas = repoDeltas(trend);
    // 0.9 - 1 = -0.1; 2 - 0 = 2; 0 - 1 = -1
    expect(deltas.evalOverall).toBe(-0.1);
    expect(deltas.fabrications).toBe(2);
    expect(deltas.gauntletPass).toBe(-1);
  });

  it('deltas are null with fewer than two releases or missing sides', () => {
    const deltas = repoDeltas(repoTrend([gauntletLine('s1', true)]));
    expect(deltas.evalOverall).toBeNull();
    expect(deltas.fabrications).toBeNull();
  });
});

describe('healthScore (0.4 gauntlet + 0.3 evals + 0.2 fabrications + 0.1 axe)', () => {
  it('perfect repo scores 1.0', () => {
    const lines = [gauntletLine('s1', true), evalsLine('s1', 10, 10), axeLine('s1', 40, 0, true)];
    expect(healthScore(repoRates(lines), repoLatest(lines))).toBe(1);
  });

  it('hand-computed mixed repo', () => {
    // gauntlet 1/2 = 0.5 -> 0.2; evals 0.9 -> 0.27; latest fabrications 2 ->
    // fabScore 0.8 -> 0.16; axe never recorded -> 0.5 -> 0.05. Total 0.68.
    const lines = [gauntletLine('s1', true), gauntletLine('s2', false, 2), evalsLine('s2', 9, 10)];
    expect(healthScore(repoRates(lines), repoLatest(lines))).toBe(0.68);
  });

  it('failed axe gate zeroes the a11y term', () => {
    // gauntlet 1 -> 0.4; evals 1 -> 0.3; fabrications 0 -> 0.2; axe failed -> 0. Total 0.9.
    const lines = [gauntletLine('s1', true), evalsLine('s1', 5, 5), axeLine('s1', 40, 3, false)];
    expect(healthScore(repoRates(lines), repoLatest(lines))).toBe(0.9);
  });
});

/* ------------------------------------------------------------- fleet math */

function fakeRepo(partial: {
  id: string;
  gauntlet: { passed: number; total: number };
  evals?: { passed: number; total: number };
  axe?: { stories: number; dirty: number };
  fabricationsTotal?: number;
  runsTotal: number;
  policy?: { present: boolean; ok: boolean };
  health?: number;
  deltas?: Partial<RepoReport['deltas']>;
}): RepoReport {
  const { gauntlet } = partial;
  return {
    id: partial.id,
    root: `/fake/${partial.id}`,
    lines: partial.runsTotal,
    latest: {
      sha: 'x',
      ts: '2026-08-18T00:00:00-05:00',
      gauntletPassed: true,
      gauntletSteps: null,
      evals: partial.evals
        ? { overall: partial.evals.passed / partial.evals.total, critical: 1, ...partial.evals }
        : null,
      storiesAxe: partial.axe
        ? {
            stories: partial.axe.stories,
            storiesWithViolations: partial.axe.dirty,
            violations: partial.axe.dirty,
            serious: 0,
            critical: 0,
            gatePassed: true,
          }
        : null,
      benchmark: null,
      fabrications: 0,
      registry: counts,
    },
    rates: {
      gauntletFirstPass: { ...gauntlet, rate: gauntlet.total > 0 ? gauntlet.passed / gauntlet.total : null },
      evalCompliance: partial.evals ? { ...partial.evals, rate: partial.evals.passed / partial.evals.total } : null,
      fabricationsTotal: partial.fabricationsTotal ?? 0,
      runsTotal: partial.runsTotal,
    },
    trend: { sha: [], ts: [], gauntletPass: [], evalOverall: [], fabrications: [], tokens: [], components: [] },
    deltas: {
      evalOverall: null,
      fabrications: null,
      tokens: null,
      components: null,
      gauntletPass: null,
      ...partial.deltas,
    },
    health: partial.health ?? 1,
    policy: { present: partial.policy?.present ?? false, ok: partial.policy?.ok ?? true, failing: [], checks: [] },
  };
}

describe('fleetHeadline (weighted, hand-computed)', () => {
  const repos = [
    fakeRepo({
      id: 'a',
      gauntlet: { passed: 9, total: 10 },
      evals: { passed: 20, total: 20 },
      axe: { stories: 60, dirty: 0 },
      fabricationsTotal: 0,
      runsTotal: 20,
      policy: { present: true, ok: true },
    }),
    fakeRepo({
      id: 'b',
      gauntlet: { passed: 3, total: 10 },
      evals: { passed: 15, total: 20 },
      axe: { stories: 40, dirty: 5 },
      fabricationsTotal: 6,
      runsTotal: 30,
      policy: { present: true, ok: false },
    }),
  ];
  const h = fleetHeadline(repos);

  it('first-pass = (9+3)/(10+10) = 0.6', () => {
    expect(h.firstPassRate).toBe(0.6);
  });
  it('hallucination = (0+6)/(20+30) = 0.12 fabrications per run', () => {
    expect(h.hallucinationRate).toBe(0.12);
  });
  it('eval compliance = (20+15)/(20+20) = 0.875', () => {
    expect(h.evalCompliance).toBe(0.875);
  });
  it('a11y clean = (60+35)/(60+40) = 0.95', () => {
    expect(h.a11yCleanRate).toBe(0.95);
  });
  it('policy compliance = 1 passing / 2 repos = 0.5', () => {
    expect(h.policyCompliance).toBe(0.5);
  });
});

describe('fleetDeltas', () => {
  it('mean of eval/gauntlet deltas, sum of fabrication deltas, nulls skipped', () => {
    const repos = [
      fakeRepo({ id: 'a', gauntlet: { passed: 1, total: 1 }, runsTotal: 1, deltas: { evalOverall: -0.1, fabrications: 2, gauntletPass: 0 } }),
      fakeRepo({ id: 'b', gauntlet: { passed: 1, total: 1 }, runsTotal: 1, deltas: { evalOverall: 0.3, fabrications: 1, gauntletPass: 1 } }),
      fakeRepo({ id: 'c', gauntlet: { passed: 1, total: 1 }, runsTotal: 1 }), // all-null deltas
    ];
    const d = fleetDeltas(repos);
    expect(d.evalOverall).toBe(0.1); // (-0.1 + 0.3) / 2
    expect(d.fabrications).toBe(3); // 2 + 1
    expect(d.gauntletPass).toBe(0.5); // (0 + 1) / 2
  });
});
