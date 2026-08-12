import { describe, expect, it } from 'vitest';
import { runBenchmark } from '../src/benchmark/run.ts';

describe('benchmark scorer (dry-run over committed fixtures — never invokes a generator/LLM)', () => {
  const { ok, scores } = runBenchmark({ dryRun: true, reportOnly: false, registry: 'fixture' });

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
