#!/usr/bin/env node
/**
 * Eval regression runner (ADR-005: "evals as regression tests").
 *
 * Executes every prompt->expectation pair in evals/evals.json through the
 * deterministic validateSources() rule engine against the hermetic registry
 * snapshot in evals/registry-fixture.json (frozen on purpose — evals must not
 * race live registry regeneration).
 *
 *   wrong_output  must produce >= 1 violation whose rule OR nr id matches `rule`
 *   right_output  must produce zero violations
 *
 * Gates: critical pairs 1.0, overall >= 0.95 (ADR-005 success metrics).
 * No LLM anywhere in this path.
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { appendMetricsLine, buildMetricsLine } from '../metrics/record.ts';
import { buildRegistryContext, findRepoRoot } from '../registry.ts';
import { validateSources } from '../validate.ts';
import type { SourceFile, Violation } from '../types.ts';

interface EvalOutput {
  files: SourceFile[];
}

interface EvalCase {
  id: string;
  rule: string;
  critical: boolean;
  prompt: string;
  wrong_output: EvalOutput;
  right_output: EvalOutput;
}

interface EvalFile {
  evals: EvalCase[];
}

export interface EvalCaseResult {
  id: string;
  rule: string;
  critical: boolean;
  passed: boolean;
  wrongFailedAsExpected: boolean;
  rightPassedClean: boolean;
  wrongViolations: string[];
  rightViolations: string[];
}

export interface EvalRunResult {
  total: number;
  passed: number;
  overallRate: number;
  criticalTotal: number;
  criticalPassed: number;
  criticalRate: number;
  ok: boolean;
  cases: EvalCaseResult[];
}

export function runEvals(root?: string): EvalRunResult {
  const repoRoot = root ?? findRepoRoot(process.cwd());
  const evalsPath = join(repoRoot, 'evals', 'evals.json');
  const fixturePath = join(repoRoot, 'evals', 'registry-fixture.json');

  const evalFile = JSON.parse(readFileSync(evalsPath, 'utf8')) as EvalFile;
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
    'tokens-index': { tokens: never[] };
    'components-index': { components: never[] };
  };
  const ctx = buildRegistryContext(fixture['tokens-index'], fixture['components-index']);

  const matches = (v: Violation, rule: string): boolean => v.rule === rule || v.nr === rule;

  const cases: EvalCaseResult[] = evalFile.evals.map((ev) => {
    const wrong = validateSources(ev.wrong_output.files, ctx);
    const right = validateSources(ev.right_output.files, ctx);
    const wrongFailedAsExpected = wrong.violations.some((v) => matches(v, ev.rule));
    const rightPassedClean = right.ok;
    return {
      id: ev.id,
      rule: ev.rule,
      critical: ev.critical,
      passed: wrongFailedAsExpected && rightPassedClean,
      wrongFailedAsExpected,
      rightPassedClean,
      wrongViolations: wrong.violations.map((v) => `${v.rule}${v.nr ? `/${v.nr}` : ''}@${v.file}:${v.line}`),
      rightViolations: right.violations.map(
        (v) => `${v.rule}${v.nr ? `/${v.nr}` : ''}@${v.file}:${v.line} ${v.message}`,
      ),
    };
  });

  const total = cases.length;
  const passed = cases.filter((c) => c.passed).length;
  const criticalCases = cases.filter((c) => c.critical);
  const criticalPassed = criticalCases.filter((c) => c.passed).length;
  const overallRate = total === 0 ? 0 : passed / total;
  const criticalRate = criticalCases.length === 0 ? 1 : criticalPassed / criticalCases.length;

  return {
    total,
    passed,
    overallRate,
    criticalTotal: criticalCases.length,
    criticalPassed,
    criticalRate,
    ok: criticalRate === 1 && overallRate >= 0.95,
    cases,
  };
}

// CLI entry
const isMain = process.argv[1] && resolve(process.argv[1]).includes('run-evals');
if (isMain) {
  const json = process.argv.includes('--json');
  const noMetrics = process.argv.includes('--no-metrics');
  const nowFlag = process.argv.indexOf('--now');
  const now = nowFlag !== -1 ? process.argv[nowFlag + 1] : undefined;
  const rootFlag = process.argv.indexOf('--root');
  const root = rootFlag !== -1 ? resolve(process.argv[rootFlag + 1] ?? '.') : undefined;
  const result = runEvals(root);

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('\nEVAL REGRESSION RUN (deterministic, no LLM)\n');
    for (const c of result.cases) {
      const badge = c.passed ? 'PASS' : 'FAIL';
      console.log(`[${badge}] ${c.id} (${c.rule}${c.critical ? ', critical' : ''})`);
      if (!c.wrongFailedAsExpected) {
        console.log(`   wrong_output was NOT caught by ${c.rule}; violations seen: ${c.wrongViolations.join(', ') || 'none'}`);
      }
      if (!c.rightPassedClean) {
        console.log(`   right_output did not pass clean:\n     ${c.rightViolations.join('\n     ')}`);
      }
    }
    console.log(
      `\noverall ${result.passed}/${result.total} (${(result.overallRate * 100).toFixed(1)}%)  ` +
        `critical ${result.criticalPassed}/${result.criticalTotal} (${(result.criticalRate * 100).toFixed(1)}%)`,
    );
    console.log(result.ok ? 'EVALS PASSED (critical 1.0, overall >= 0.95)\n' : 'EVALS FAILED\n');
  }

  // Metrics per release (brief §8): append one structured line per CLI run.
  if (!noMetrics) {
    try {
      const repoRoot = root ?? findRepoRoot(process.cwd());
      const line = buildMetricsLine({
        root: repoRoot,
        source: 'evals',
        evals: {
          overall: result.overallRate,
          critical: result.criticalRate,
          passed: result.passed,
          total: result.total,
        },
        fabrications: 0,
        ...(now ? { now } : {}),
      });
      const target = appendMetricsLine(repoRoot, line);
      if (!json) console.log(`metrics: appended evals line to ${target}`);
    } catch (error) {
      console.error(`metrics: append failed (non-fatal): ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  process.exit(result.ok ? 0 : 1);
}
