import { describe, expect, it } from 'vitest';
import { benchmarkMetricsFromScores, runBenchmark } from '../src/benchmark/run.ts';

// Axe is explicitly disabled in tests: the column depends on an optionally
// installed local browser and must never make the deterministic suite flaky.

describe('benchmark scorer (dry-run over committed fixtures — never invokes a generator/LLM)', async () => {
  const { ok, scores } = await runBenchmark({
    mode: 'dry-run',
    reportOnly: false,
    registry: 'fixture',
    axe: false,
  });

  it('dry-run self-check passes', () => {
    expect(ok).toBe(true);
  });

  it('good fixture: full token compliance, zero fabrications, static gauntlet pass', () => {
    const good = scores.filter((s) => s.source === 'fixture:good');
    expect(good.length).toBeGreaterThan(0);
    for (const s of good) {
      expect(s.tokenCompliance).toBe(1);
      expect(s.fabricationCount).toBe(0);
      expect(s.gauntletPass).toBe(true);
    }
  });

  it('bad fixture: fabrications detected, compliance degraded, gauntlet fail', () => {
    const bad = scores.filter((s) => s.source === 'fixture:bad');
    expect(bad.length).toBeGreaterThan(0);
    for (const s of bad) {
      expect(s.fabricationCount).toBeGreaterThan(0);
      expect(s.tokenCompliance).toBeLessThan(1);
      expect(s.gauntletPass).toBe(false);
    }
  });

  it('baseline is scored for comparison and loses on token compliance', () => {
    const baseline = scores.filter((s) => s.source === 'baseline:raw-tailwind');
    expect(baseline.length).toBeGreaterThan(0);
    for (const s of baseline) expect(s.tokenCompliance).toBe(0);
  });
});

describe('benchmark fixture replay (default mode — committed recordings, fully offline)', async () => {
  const { ok, scores, mode } = await runBenchmark({
    mode: 'replay',
    reportOnly: false,
    registry: 'fixture',
    axe: false,
  });

  it('replay self-check passes and reports replay mode', () => {
    expect(mode).toBe('replay');
    expect(ok).toBe(true);
  });

  it('every scenario has both a system and a baseline-style recording', () => {
    const scenarios = ['settings-form', 'confirmation-dialog-flow', 'status-dashboard-card-grid'];
    for (const scenario of scenarios) {
      expect(
        scores.some((s) => s.scenario === scenario && s.source === 'recorded:system'),
        `${scenario} system recording`,
      ).toBe(true);
      expect(
        scores.some((s) => s.scenario === scenario && s.source === 'recorded:baseline-style'),
        `${scenario} baseline-style recording`,
      ).toBe(true);
    }
  });

  it('system recordings: full compliance, zero fabrications, gauntlet pass', () => {
    const system = scores.filter((s) => s.source === 'recorded:system');
    expect(system).toHaveLength(3);
    for (const s of system) {
      expect(s.tokenCompliance, `${s.scenario}: ${s.violations.join('; ')}`).toBe(1);
      expect(s.fabricationCount, `${s.scenario}: ${s.violations.join('; ')}`).toBe(0);
      expect(s.gauntletPass, `${s.scenario}: ${s.violations.join('; ')}`).toBe(true);
    }
  });

  it('baseline-style recordings: caught by the closed world (fabrications, degraded compliance)', () => {
    const baselineStyle = scores.filter((s) => s.source === 'recorded:baseline-style');
    expect(baselineStyle).toHaveLength(3);
    for (const s of baselineStyle) {
      expect(s.fabricationCount, s.scenario).toBeGreaterThan(0);
      expect(s.tokenCompliance, s.scenario).toBeLessThan(1);
      expect(s.gauntletPass, s.scenario).toBe(false);
    }
  });

  it('axe column reports a skip reason when disabled, never a silent null', () => {
    for (const s of scores) {
      expect(s.axePass).toBeNull();
      expect(s.axeDetail).toMatch(/^skipped/);
    }
  });

  it('aggregates per-source benchmark metrics for the history line', () => {
    const metrics = benchmarkMetricsFromScores('replay', scores, false);
    expect(metrics.scenarios).toBe(3);
    expect(metrics.axe).toBe('skipped');
    expect(metrics.sources['recorded:system']?.avgTokenCompliance).toBe(1);
    expect(metrics.sources['recorded:system']?.gauntletPassRate).toBe(1);
    expect(metrics.sources['recorded:system']?.fabrications).toBe(0);
    expect(metrics.sources['recorded:baseline-style']?.fabrications).toBeGreaterThan(0);
    expect(metrics.sources['baseline:raw-tailwind']?.avgTokenCompliance).toBe(0);
  });
});
