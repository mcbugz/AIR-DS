import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runEvals } from '../src/evals/run-evals.ts';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('committed evals are green (regression gate, no LLM)', () => {
  const result = runEvals(REPO_ROOT);

  it('every committed eval passes (wrong fails with its rule id, right passes clean)', () => {
    const failing = result.cases.filter((c) => !c.passed);
    expect(
      failing,
      failing
        .map(
          (c) =>
            `${c.id}: wrongCaught=${c.wrongFailedAsExpected} rightClean=${c.rightPassedClean} rightViolations=${c.rightViolations.join('; ')}`,
        )
        .join('\n'),
    ).toHaveLength(0);
  });

  it('critical pass rate is 1.0 and overall >= 0.95 (ADR-005 gates)', () => {
    expect(result.criticalRate).toBe(1);
    expect(result.overallRate).toBeGreaterThanOrEqual(0.95);
    expect(result.ok).toBe(true);
  });

  it('covers every negative rule NR-001..NR-010', () => {
    const rules = new Set(result.cases.map((c) => c.rule));
    for (let i = 1; i <= 10; i++) {
      expect(rules.has(`NR-${String(i).padStart(3, '0')}`)).toBe(true);
    }
  });

  it('covers the core canon rules beyond the NR catalog', () => {
    const rules = new Set(result.cases.map((c) => c.rule));
    for (const g of ['G1', 'G2', 'G3', 'G5', 'G8']) expect(rules.has(g)).toBe(true);
  });
});
