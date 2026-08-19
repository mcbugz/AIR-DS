import { groupBySha, type ShaGroup } from './history.ts';
import type {
  FleetDeltas,
  FleetHeadline,
  FleetRollup,
  MetricsLine,
  RepoDeltas,
  RepoLatest,
  RepoRates,
  RepoReport,
  RepoTrend,
} from './types.ts';

/**
 * Pure rollup math — no filesystem, no clock. Every formula here is
 * hand-checkable and covered by test/rollup.test.ts with hand-computed
 * expectations.
 */

const round = (n: number, places = 4): number => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

/* -------------------------------------------------------------- per repo */

export function repoLatest(lines: MetricsLine[]): RepoLatest | null {
  if (lines.length === 0) return null;
  const groups = groupBySha(lines);
  const latest = groups[groups.length - 1] as ShaGroup;
  // Sections fall back to the most recent group that recorded them, so a
  // release that only re-ran the gauntlet still shows the standing eval/axe
  // state — the dashboard reports current knowledge, not per-commit gaps.
  const lastWith = <K extends 'evals' | 'storiesAxe' | 'benchmark'>(key: K): ShaGroup[K] | null => {
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i] as ShaGroup;
      if (g[key] !== null) return g[key];
    }
    return null;
  };
  const bench = lastWith('benchmark');
  const system = bench?.sources['recorded:system'] ?? bench?.sources['fixture:good'] ?? null;
  const baseline = bench?.sources['baseline:raw-tailwind'] ?? null;
  return {
    sha: latest.sha,
    ts: latest.ts,
    gauntletPassed: latest.gauntletAllPassed,
    gauntletSteps: latest.gauntlet ? Object.keys(latest.gauntlet.durations) : null,
    evals: lastWith('evals'),
    storiesAxe: lastWith('storiesAxe'),
    benchmark: bench
      ? {
          systemCompliance: system ? system.avgTokenCompliance : null,
          baselineCompliance: baseline ? baseline.avgTokenCompliance : null,
          axe: bench.axe,
        }
      : null,
    fabrications: latest.fabrications,
    registry: latest.counts,
  };
}

export function repoRates(lines: MetricsLine[]): RepoRates {
  const gauntletLines = lines.filter((l) => l.gauntlet);
  const passed = gauntletLines.filter((l) => l.gauntlet?.passed).length;
  const total = gauntletLines.length;
  const latest = repoLatest(lines);
  const evals = latest?.evals ?? null;
  return {
    gauntletFirstPass: {
      passed,
      total,
      rate: total > 0 ? round(passed / total) : null,
    },
    evalCompliance: evals
      ? { passed: evals.passed, total: evals.total, rate: round(evals.total > 0 ? evals.passed / evals.total : 0) }
      : null,
    fabricationsTotal: lines.reduce((a, l) => a + l.fabrications, 0),
    runsTotal: lines.length,
  };
}

export function repoTrend(lines: MetricsLine[]): RepoTrend {
  const groups = groupBySha(lines);
  return {
    sha: groups.map((g) => g.sha),
    ts: groups.map((g) => g.ts),
    gauntletPass: groups.map((g) =>
      g.gauntletAllPassed === null ? null : g.gauntletAllPassed ? 1 : 0,
    ),
    evalOverall: groups.map((g) => (g.evals ? g.evals.overall : null)),
    fabrications: groups.map((g) => g.fabrications),
    tokens: groups.map((g) => g.counts.tokens),
    components: groups.map((g) => g.counts.components),
  };
}

/** Latest-vs-previous release deltas; null when either side is missing. */
export function repoDeltas(trend: RepoTrend): RepoDeltas {
  const last = <T>(arr: (T | null)[]): T | null =>
    arr.length >= 1 ? arr[arr.length - 1] ?? null : null;
  const prev = <T>(arr: (T | null)[]): T | null =>
    arr.length >= 2 ? arr[arr.length - 2] ?? null : null;
  const delta = (arr: (number | null)[]): number | null => {
    const a = last(arr);
    const b = prev(arr);
    return a !== null && b !== null ? round(a - b) : null;
  };
  return {
    evalOverall: delta(trend.evalOverall),
    fabrications: delta(trend.fabrications),
    tokens: delta(trend.tokens),
    components: delta(trend.components),
    gauntletPass: delta(trend.gauntletPass),
  };
}

/**
 * Composite health score in [0, 1]:
 *
 *   0.4 * first-pass gauntlet rate            (0 when never run)
 * + 0.3 * latest eval overall                 (0 when never run)
 * + 0.2 * fabrication score                   (1 when latest snapshot is
 *                                              fabrication-free, else
 *                                              max(0, 1 - fabrications/10))
 * + 0.1 * a11y score                          (1 gate passed, 0 gate failed,
 *                                              0.5 never recorded)
 */
export function healthScore(rates: RepoRates, latest: RepoLatest | null): number {
  const gauntlet = rates.gauntletFirstPass.rate ?? 0;
  const evals = latest?.evals ? latest.evals.overall : 0;
  const fabrications = latest ? latest.fabrications : 0;
  const fabricationScore = fabrications === 0 ? 1 : Math.max(0, 1 - fabrications / 10);
  const axe = latest?.storiesAxe ? (latest.storiesAxe.gatePassed ? 1 : 0) : 0.5;
  return round(0.4 * gauntlet + 0.3 * evals + 0.2 * fabricationScore + 0.1 * axe);
}

/* ----------------------------------------------------------------- fleet */

export function fleetHeadline(repos: RepoReport[]): FleetHeadline {
  const totalRuns = repos.reduce((a, r) => a + r.rates.runsTotal, 0);
  const totalFabrications = repos.reduce((a, r) => a + r.rates.fabricationsTotal, 0);
  const gPassed = repos.reduce((a, r) => a + r.rates.gauntletFirstPass.passed, 0);
  const gTotal = repos.reduce((a, r) => a + r.rates.gauntletFirstPass.total, 0);
  const ePassed = repos.reduce((a, r) => a + (r.rates.evalCompliance?.passed ?? 0), 0);
  const eTotal = repos.reduce((a, r) => a + (r.rates.evalCompliance?.total ?? 0), 0);
  const axeRepos = repos.filter((r) => r.latest?.storiesAxe);
  const stories = axeRepos.reduce((a, r) => a + (r.latest?.storiesAxe?.stories ?? 0), 0);
  const dirty = axeRepos.reduce((a, r) => a + (r.latest?.storiesAxe?.storiesWithViolations ?? 0), 0);
  const passingPolicies = repos.filter((r) => r.policy.present && r.policy.ok).length;
  return {
    hallucinationRate: totalRuns > 0 ? round(totalFabrications / totalRuns) : null,
    firstPassRate: gTotal > 0 ? round(gPassed / gTotal) : null,
    evalCompliance: eTotal > 0 ? round(ePassed / eTotal) : null,
    a11yCleanRate: stories > 0 ? round((stories - dirty) / stories) : null,
    policyCompliance: repos.length > 0 ? round(passingPolicies / repos.length) : null,
  };
}

export function fleetDeltas(repos: RepoReport[]): FleetDeltas {
  const mean = (values: (number | null)[]): number | null => {
    const xs = values.filter((v): v is number => v !== null);
    return xs.length > 0 ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
  };
  const sum = (values: (number | null)[]): number | null => {
    const xs = values.filter((v): v is number => v !== null);
    return xs.length > 0 ? round(xs.reduce((a, b) => a + b, 0)) : null;
  };
  return {
    evalOverall: mean(repos.map((r) => r.deltas.evalOverall)),
    fabrications: sum(repos.map((r) => r.deltas.fabrications)),
    gauntletPass: mean(repos.map((r) => r.deltas.gauntletPass)),
  };
}

export function fleetRollup(repos: RepoReport[], worstN = 3): FleetRollup {
  const ranked = [...repos].sort((a, b) => a.health - b.health || a.id.localeCompare(b.id));
  return {
    headline: fleetHeadline(repos),
    worst: ranked.slice(0, worstN).map((r) => ({ id: r.id, health: r.health })),
    deltas: fleetDeltas(repos),
    totals: {
      repos: repos.length,
      runs: repos.reduce((a, r) => a + r.rates.runsTotal, 0),
      fabrications: repos.reduce((a, r) => a + r.rates.fabricationsTotal, 0),
      tokens: repos.reduce((a, r) => a + (r.latest?.registry.tokens ?? 0), 0),
      components: repos.reduce((a, r) => a + (r.latest?.registry.components ?? 0), 0),
      policiesPresent: repos.filter((r) => r.policy.present).length,
      policiesPassing: repos.filter((r) => r.policy.present && r.policy.ok).length,
    },
  };
}
