import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  appendMetricsLine,
  buildMetricsLine,
  countFabrications,
  gauntletMetricsFromReport,
  readHistory,
  type MetricsLine,
} from '../src/metrics/record.ts';
import { groupBySha, renderReport } from '../src/metrics/report.ts';
import type { GauntletReport, Violation } from '../src/types.ts';

const tmp = mkdtempSync(join(tmpdir(), 'air-ds-metrics-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const violation = (rule: Violation['rule']): Violation => ({
  rule,
  nr: null,
  file: 'x.tsx',
  line: 1,
  message: 'test',
});

const sampleReport: GauntletReport = {
  ok: true,
  root: '/repo',
  startedAt: '2026-08-12T00:00:00Z',
  durationMs: 1234,
  steps: [
    { step: 'typecheck', status: 'pass', durationMs: 500 },
    { step: 'lint', status: 'pass', durationMs: 120 },
    { step: 'build', status: 'skip', durationMs: 0 },
    { step: 'test', status: 'pass', durationMs: 600 },
  ],
};

describe('metrics writer (per-release history lines, brief §8)', () => {
  it('counts only G1/G5 closed-world hits as fabrications', () => {
    expect(countFabrications([violation('G1'), violation('G5'), violation('G2'), violation('G8')])).toBe(2);
  });

  it('derives gauntlet metrics from a report (skipped steps excluded)', () => {
    const { gauntlet, fabrications } = gauntletMetricsFromReport(sampleReport);
    expect(gauntlet.passed).toBe(true);
    expect(gauntlet.steps).toBe(3);
    expect(gauntlet.durations).toEqual({ typecheck: 500, lint: 120, test: 600 });
    expect(fabrications).toBe(0);
  });

  it('builds a deterministic line when ts/sha/counts are pinned (--now semantics)', () => {
    const opts = {
      root: tmp,
      source: 'gauntlet' as const,
      gauntlet: gauntletMetricsFromReport(sampleReport).gauntlet,
      fabrications: 0,
      now: '2026-08-12T09:00:00Z',
      sha: 'abc1234',
      counts: { tokens: 232, components: 21 },
    };
    const a = buildMetricsLine(opts);
    const b = buildMetricsLine(opts);
    expect(a).toEqual(b);
    expect(a.ts).toBe('2026-08-12T09:00:00Z');
    expect(a.git_sha).toBe('abc1234');
    expect(a.registry_counts).toEqual({ tokens: 232, components: 21 });
    expect(a.gauntlet?.durations['typecheck']).toBe(500);
  });

  it('appends JSONL lines and reads them back', () => {
    const path = join(tmp, 'history.jsonl');
    const line = buildMetricsLine({
      root: tmp,
      source: 'evals',
      evals: { overall: 1, critical: 1, passed: 16, total: 16 },
      fabrications: 0,
      now: '2026-08-12T09:00:00Z',
      sha: 'abc1234',
      counts: { tokens: 232, components: 21 },
    });
    appendMetricsLine(tmp, line, path);
    appendMetricsLine(tmp, { ...line, source: 'gauntlet' }, path);
    const history = readHistory(path);
    expect(history).toHaveLength(2);
    expect(history[0]?.evals?.overall).toBe(1);
    expect(readFileSync(path, 'utf8').trim().split('\n')).toHaveLength(2);
  });
});

describe('metrics reporter (trend table + latest snapshot)', () => {
  const lines: MetricsLine[] = [
    {
      ts: '2026-08-11T10:00:00Z',
      git_sha: 'aaa1111',
      source: 'gauntlet',
      gauntlet: { passed: true, steps: 5, durations: { typecheck: 100 } },
      fabrications: 0,
      registry_counts: { tokens: 230, components: 21 },
    },
    {
      ts: '2026-08-12T09:00:00Z',
      git_sha: 'bbb2222',
      source: 'gauntlet',
      gauntlet: { passed: true, steps: 5, durations: { typecheck: 90, lint: 40 } },
      fabrications: 0,
      registry_counts: { tokens: 232, components: 21 },
    },
    {
      ts: '2026-08-12T09:01:00Z',
      git_sha: 'bbb2222',
      source: 'evals',
      evals: { overall: 1, critical: 1, passed: 16, total: 16 },
      fabrications: 0,
      registry_counts: { tokens: 232, components: 21 },
    },
    {
      ts: '2026-08-12T09:02:00Z',
      git_sha: 'bbb2222',
      source: 'benchmark',
      benchmark: {
        mode: 'replay',
        scenarios: 3,
        sources: {
          'recorded:system': { avgTokenCompliance: 1, fabrications: 0, gauntletPassRate: 1 },
          'baseline:raw-tailwind': { avgTokenCompliance: 0, fabrications: 0, gauntletPassRate: 0 },
        },
        axe: 'skipped',
      },
      fabrications: 0,
      registry_counts: { tokens: 232, components: 21 },
    },
  ];

  it('merges lines per git sha (one trend row per release)', () => {
    const groups = groupBySha(lines);
    expect(groups).toHaveLength(2);
    expect(groups[1]?.sha).toBe('bbb2222');
    expect(groups[1]?.gauntlet?.passed).toBe(true);
    expect(groups[1]?.evals?.overall).toBe(1);
    expect(groups[1]?.benchmark?.mode).toBe('replay');
  });

  it('renders a markdown report with snapshot and trend table', () => {
    const md = renderReport(lines);
    expect(md).toContain('## Latest snapshot');
    expect(md).toContain('## Trend (per release)');
    expect(md).toContain('`bbb2222`');
    expect(md).toContain('100.0%');
    expect(md).toContain('232 tokens, 21 components');
    expect(md).toContain('100.0% vs 0.0% (axe skipped)');
  });

  it('renders a friendly empty state', () => {
    expect(renderReport([])).toContain('No metrics recorded yet');
  });
});
