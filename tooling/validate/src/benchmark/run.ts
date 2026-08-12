#!/usr/bin/env node
/**
 * Benchmark harness (ADR-005 nightly benchmark) — credential-free by default.
 *
 * Modes:
 *   (default: fixture replay)  score the committed RECORDED generations in
 *                  benchmark/recordings/<scenario>/{system,baseline-style}/ —
 *                  two hand-recorded plausible agent outputs per scenario —
 *                  so a full scoreboard is produced offline in any clean
 *                  environment, no API keys, no accounts, no network.
 *   --dry-run      score the two committed fixture outputs (good + deliberately
 *                  bad) so the scorer itself is regression-tested in CI
 *   --generator '{"name":"...","cmd":"..."}'   pluggable LOCAL-CLI generator
 *                  (clients wire their own agent CLI + credentials); cmd runs
 *                  with env SCENARIO_ID / SCENARIO_PROMPT / SCENARIO_OUT set.
 *                  Example (client-provided CLI, never invoked by tests/CI):
 *                    --generator '{"name":"my-agent","cmd":"my-agent-cli --prompt \"$SCENARIO_PROMPT\" --out \"$SCENARIO_OUT\""}'
 *   --report-only  always exit 0 (nightly mode: losses are logged, not fatal)
 *   --no-axe       skip the browser-run axe column
 *
 * Deterministic scores per output directory:
 *   tokenCompliance   valid --ds-* refs / (valid + fabricated + literal-discipline hits)
 *   fabricationCount  G1 + G5 violations (tokens/components not in the registries)
 *   gauntletPass      static rule engine finds zero violations
 *   axePass           browser-run axe-core (Playwright + locally-installed
 *                     chromium, `npx playwright install chromium`); the column
 *                     auto-skips ("skipped (no browser)") when unavailable —
 *                     the demo NEVER fails for lack of a browser.
 *
 * Results land in benchmark-results/<date>.json plus a markdown scoreboard,
 * alongside the committed baseline dir's scores (raw-Tailwind reference).
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendMetricsLine, buildMetricsLine, type BenchmarkMetrics } from '../metrics/record.ts';
import { buildRegistryContext, loadRegistryContext } from '../registry.ts';
import { validateSources } from '../validate.ts';
import { axeWorkDir, checkAxeAvailability, runAxeScoring } from './axe.ts';
import type { RegistryContext, SourceFile } from '../types.ts';

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO_ROOT = resolve(PKG_ROOT, '..', '..');
const BENCH_DIR = join(PKG_ROOT, 'benchmark');
const RESULTS_DIR = join(PKG_ROOT, 'benchmark-results');

interface Scenario {
  id: string;
  title: string;
  prompt: string;
  expects: string[];
}

export interface Score {
  scenario: string;
  source: string;
  files: number;
  tokenCompliance: number;
  fabricationCount: number;
  violationCount: number;
  gauntletPass: boolean;
  axePass: null | boolean;
  axeDetail?: string;
  violations: string[];
  /** Directory the scored files came from (used by the axe harness). */
  dir?: string;
}

function collectFiles(dir: string): SourceFile[] {
  const out: SourceFile[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(tsx|ts|css)$/.test(entry)) out.push({ path: full, content: readFileSync(full, 'utf8') });
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

export function scoreOutput(
  scenario: string,
  source: string,
  files: SourceFile[],
  ctx: RegistryContext,
): Score {
  const result = validateSources(files, ctx);

  // Token compliance: every --ds-* reference in the output, valid vs not,
  // plus literal-discipline violations counted as non-compliant slots.
  let totalRefs = 0;
  let validRefs = 0;
  for (const f of files) {
    const re = /--ds-[a-z0-9]+(?:-[a-z0-9]+)*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(f.content)) !== null) {
      totalRefs++;
      if (ctx.tokenVars.has(m[0])) validRefs++;
    }
  }
  const literalHits = result.violations.filter((v) => v.rule === 'G2' || v.rule === 'NR-004').length;
  const denominator = totalRefs + literalHits;
  const tokenCompliance = denominator === 0 ? 0 : validRefs / denominator;

  const fabricationCount = result.violations.filter((v) => v.rule === 'G1' || v.rule === 'G5').length;

  return {
    scenario,
    source,
    files: files.length,
    tokenCompliance: Math.round(tokenCompliance * 1000) / 1000,
    fabricationCount,
    violationCount: result.violations.length,
    gauntletPass: result.ok,
    axePass: null, // filled by the axe harness when a local browser is available
    violations: result.violations.map((v) => `${v.rule}${v.nr ? `/${v.nr}` : ''} ${v.file}:${v.line} ${v.message}`),
  };
}

function loadScenarios(): Scenario[] {
  const parsed = JSON.parse(readFileSync(join(BENCH_DIR, 'scenarios.json'), 'utf8')) as {
    scenarios: Scenario[];
  };
  return parsed.scenarios;
}

function registryContext(prefer: 'live' | 'fixture' = 'live'): RegistryContext {
  // Prefer live registries; fall back to the hermetic eval fixture. Tests pass
  // 'fixture' so they never race sibling registry regeneration.
  const live = join(REPO_ROOT, 'registries', 'tokens-index.json');
  if (prefer === 'live' && existsSync(live)) return loadRegistryContext(REPO_ROOT);
  const fixture = JSON.parse(
    readFileSync(join(REPO_ROOT, 'evals', 'registry-fixture.json'), 'utf8'),
  ) as { 'tokens-index': { tokens: never[] }; 'components-index': { components: never[] } };
  return buildRegistryContext(fixture['tokens-index'], fixture['components-index']);
}

function axeCell(s: Score): string {
  if (s.axePass === true) return 'PASS';
  if (s.axePass === false) return 'FAIL';
  return s.axeDetail ?? 'skipped (no browser)';
}

export function scoreboardMarkdown(scores: Score[], date: string, mode: string): string {
  const lines = [
    `# Benchmark scoreboard — ${date} (${mode})`,
    '',
    'Deterministic scoring (ADR-005): token compliance, fabrication count, static gauntlet, browser-run axe (auto-skips without a local chromium — never required).',
    '',
    '| Scenario | Source | Files | Token compliance | Fabrications | Violations | Gauntlet | Axe |',
    '|---|---|---:|---:|---:|---:|---|---|',
  ];
  for (const s of scores) {
    lines.push(
      `| ${s.scenario} | ${s.source} | ${s.files} | ${(s.tokenCompliance * 100).toFixed(1)}% | ${s.fabricationCount} | ${s.violationCount} | ${s.gauntletPass ? 'PASS' : 'FAIL'} | ${axeCell(s)} |`,
    );
  }
  lines.push('', 'Losses are logged, not hidden — a baseline win is a finding, not an embarrassment.');
  return lines.join('\n');
}

interface GeneratorConfig {
  name: string;
  cmd: string;
}

export type BenchmarkMode = 'replay' | 'dry-run' | 'generator';

export function benchmarkMetricsFromScores(mode: string, scores: Score[], axeRan: boolean): BenchmarkMetrics {
  const bySource = new Map<string, Score[]>();
  for (const s of scores) {
    const list = bySource.get(s.source) ?? [];
    list.push(s);
    bySource.set(s.source, list);
  }
  const sources: BenchmarkMetrics['sources'] = {};
  for (const [source, list] of bySource) {
    sources[source] = {
      avgTokenCompliance:
        Math.round((list.reduce((a, s) => a + s.tokenCompliance, 0) / list.length) * 1000) / 1000,
      fabrications: list.reduce((a, s) => a + s.fabricationCount, 0),
      gauntletPassRate:
        Math.round((list.filter((s) => s.gauntletPass).length / list.length) * 1000) / 1000,
    };
  }
  const scenarios = new Set(scores.map((s) => s.scenario)).size;
  return { mode, scenarios, sources, axe: axeRan ? 'ran' : 'skipped' };
}

export async function runBenchmark(opts: {
  mode?: BenchmarkMode;
  reportOnly?: boolean;
  generator?: GeneratorConfig | undefined;
  registry?: 'live' | 'fixture' | undefined;
  /** Attempt the browser-run axe column (default: true except dry-run). Auto-skips gracefully. */
  axe?: boolean;
}): Promise<{ ok: boolean; scores: Score[]; mode: BenchmarkMode; axeRan: boolean }> {
  const mode: BenchmarkMode = opts.mode ?? (opts.generator ? 'generator' : 'replay');
  const reportOnly = opts.reportOnly ?? false;
  const scenarios = loadScenarios();
  const ctx = registryContext(opts.registry ?? 'live');
  const scores: Score[] = [];
  const date = new Date().toISOString().slice(0, 10);

  const pushDir = (scenario: string, source: string, dir: string): void => {
    const files = collectFiles(dir);
    if (files.length > 0) {
      const score = scoreOutput(scenario, source, files, ctx);
      score.dir = dir;
      scores.push(score);
    }
  };

  if (mode === 'dry-run') {
    // Score the committed good/bad fixtures — regression-tests the scorer.
    for (const kind of ['good', 'bad'] as const) {
      const base = join(BENCH_DIR, 'fixtures', kind);
      if (!existsSync(base)) continue;
      for (const scenarioId of readdirSync(base)) {
        pushDir(scenarioId, `fixture:${kind}`, join(base, scenarioId));
      }
    }
  } else if (mode === 'generator' && opts.generator) {
    for (const scenario of scenarios) {
      const outDir = join(RESULTS_DIR, 'outputs', date, opts.generator.name, scenario.id);
      mkdirSync(outDir, { recursive: true });
      execSync(opts.generator.cmd, {
        cwd: REPO_ROOT,
        stdio: 'inherit',
        env: {
          ...process.env,
          SCENARIO_ID: scenario.id,
          SCENARIO_PROMPT: scenario.prompt,
          SCENARIO_OUT: outDir,
        },
      });
      pushDir(scenario.id, `generator:${opts.generator.name}`, outDir);
    }
  } else {
    // DEFAULT: fixture replay — committed recorded generations, fully offline.
    const base = join(BENCH_DIR, 'recordings');
    for (const scenario of scenarios) {
      for (const variant of ['system', 'baseline-style'] as const) {
        pushDir(scenario.id, `recorded:${variant}`, join(base, scenario.id, variant));
      }
    }
  }

  // Always score the committed baseline dir for comparison.
  const baselineBase = join(BENCH_DIR, 'baseline');
  if (existsSync(baselineBase)) {
    for (const scenarioId of readdirSync(baselineBase)) {
      pushDir(scenarioId, 'baseline:raw-tailwind', join(baselineBase, scenarioId));
    }
  }

  // Axe column: browser-run scoring when a local chromium is available.
  let axeRan = false;
  const wantAxe = opts.axe ?? mode !== 'dry-run';
  if (wantAxe) {
    const availability = checkAxeAvailability();
    if (!availability.available) {
      for (const s of scores) s.axeDetail = `skipped (${availability.reason ?? 'no browser'})`;
    } else {
      try {
        const outputs = scores
          .filter((s) => s.dir)
          .map((s, i) => ({ key: `${i}-${s.scenario}-${s.source}`, dir: s.dir as string, score: s }));
        const results = await runAxeScoring(
          outputs.map(({ key, dir }) => ({ key, dir })),
          { repoRoot: REPO_ROOT, workDir: axeWorkDir(PKG_ROOT) },
        );
        for (const output of outputs) {
          const r = results.get(output.key);
          if (r) {
            output.score.axePass = r.pass;
            output.score.axeDetail = r.detail;
          }
        }
        axeRan = true;
      } catch (error) {
        const msg = error instanceof Error ? error.message.split('\n')[0] : String(error);
        for (const s of scores) if (s.axePass === null) s.axeDetail = `skipped (harness error: ${msg})`;
      }
    }
  } else {
    for (const s of scores) s.axeDetail = 'skipped (disabled)';
  }

  mkdirSync(RESULTS_DIR, { recursive: true });
  const serializable = scores.map(({ dir: _dir, ...rest }) => rest);
  writeFileSync(
    join(RESULTS_DIR, `${date}.json`),
    JSON.stringify({ date, mode, scores: serializable }, null, 2),
  );
  writeFileSync(join(RESULTS_DIR, `${date}-scoreboard.md`), scoreboardMarkdown(scores, date, mode));

  // Self-checks (axe never participates — it is report-only information).
  let ok = true;
  if (mode === 'dry-run') {
    const good = scores.filter((s) => s.source === 'fixture:good');
    const bad = scores.filter((s) => s.source === 'fixture:bad');
    ok =
      good.length > 0 &&
      bad.length > 0 &&
      good.every((s) => s.gauntletPass && s.tokenCompliance === 1 && s.fabricationCount === 0) &&
      bad.every((s) => !s.gauntletPass && s.fabricationCount > 0 && s.tokenCompliance < 1);
  } else if (mode === 'replay') {
    // Replay self-check: system recordings must be clean, baseline-style must
    // be caught, and every scenario must have both recordings committed.
    const system = scores.filter((s) => s.source === 'recorded:system');
    const baselineStyle = scores.filter((s) => s.source === 'recorded:baseline-style');
    ok =
      system.length === scenarios.length &&
      baselineStyle.length === scenarios.length &&
      system.every((s) => s.gauntletPass && s.tokenCompliance === 1 && s.fabricationCount === 0) &&
      baselineStyle.every((s) => !s.gauntletPass && s.fabricationCount > 0 && s.tokenCompliance < 1);
  }
  return { ok: reportOnly ? true : ok, scores, mode, axeRan };
}

// CLI entry
const isMain = process.argv[1] && resolve(process.argv[1]).includes('benchmark');
if (isMain) {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const reportOnly = argv.includes('--report-only');
  const noAxe = argv.includes('--no-axe');
  const noMetrics = argv.includes('--no-metrics');
  const nowIdx = argv.indexOf('--now');
  const now = nowIdx !== -1 ? argv[nowIdx + 1] : undefined;
  const genIdx = argv.indexOf('--generator');
  const generator =
    genIdx !== -1 ? (JSON.parse(argv[genIdx + 1] ?? '{}') as GeneratorConfig) : undefined;

  const mode: BenchmarkMode = dryRun ? 'dry-run' : generator ? 'generator' : 'replay';

  runBenchmark({ mode, reportOnly, generator, ...(noAxe ? { axe: false } : {}) })
    .then(({ ok, scores, axeRan }) => {
      console.log(scoreboardMarkdown(scores, new Date().toISOString().slice(0, 10), mode));
      console.log(`\nResults written to ${RESULTS_DIR}`);
      if (mode === 'dry-run') console.log(ok ? 'DRY-RUN SCORER CHECK PASSED' : 'DRY-RUN SCORER CHECK FAILED');
      if (mode === 'replay') console.log(ok ? 'REPLAY SELF-CHECK PASSED (system recordings clean, baseline-style caught)' : 'REPLAY SELF-CHECK FAILED');

      // Metrics per release (brief §8): append one structured line per CLI run
      // (skipped for dry-run — that is a scorer self-test, not a benchmark).
      if (!noMetrics && mode !== 'dry-run') {
        try {
          const line = buildMetricsLine({
            root: REPO_ROOT,
            source: 'benchmark',
            benchmark: benchmarkMetricsFromScores(mode, scores, axeRan),
            fabrications: scores
              .filter((s) => s.source === 'recorded:system' || s.source.startsWith('generator:'))
              .reduce((a, s) => a + s.fabricationCount, 0),
            ...(now ? { now } : {}),
          });
          const target = appendMetricsLine(REPO_ROOT, line);
          console.log(`metrics: appended benchmark line to ${target}`);
        } catch (error) {
          console.error(`metrics: append failed (non-fatal): ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      process.exit(ok ? 0 : 1);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
