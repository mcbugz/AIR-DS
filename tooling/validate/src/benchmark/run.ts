#!/usr/bin/env node
/**
 * Benchmark harness SKELETON (ADR-005 nightly benchmark).
 *
 * Takes benchmark/scenarios.json, optionally invokes a pluggable generator
 * command per scenario (config {name, cmd} — e.g. a claude CLI invocation;
 * NEVER invoked by tests or --dry-run), and scores every output directory
 * deterministically:
 *
 *   tokenCompliance   valid --ds-* refs / (valid + fabricated + literal-discipline hits)
 *   fabricationCount  G1 + G5 violations (tokens/components not in the registries)
 *   gauntletPass      static rule engine finds zero violations
 *   axePass           null in the skeleton — needs a rendering harness; pluggable
 *
 * Results land in benchmark-results/<date>.json plus a markdown scoreboard,
 * alongside the committed baseline dir's scores (raw-Tailwind reference).
 *
 *   --dry-run      score the two committed fixture outputs (good + deliberately
 *                  bad) so the scorer itself is regression-tested in CI
 *   --report-only  always exit 0 (nightly mode: losses are logged, not fatal)
 *   --generator '{"name":"...","cmd":"..."}'   pluggable generator; cmd runs with
 *                  env SCENARIO_ID / SCENARIO_PROMPT / SCENARIO_OUT set
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRegistryContext, loadRegistryContext } from '../registry.ts';
import { validateSources } from '../validate.ts';
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
  violations: string[];
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
    axePass: null, // skeleton: needs a rendering harness (jsdom + vitest-axe); pluggable
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

function scoreboardMarkdown(scores: Score[], date: string): string {
  const lines = [
    `# Benchmark scoreboard — ${date}`,
    '',
    'Deterministic scoring only (ADR-005): token compliance, fabrication count, static gauntlet, axe (pluggable, not yet wired).',
    '',
    '| Scenario | Source | Files | Token compliance | Fabrications | Violations | Gauntlet | Axe |',
    '|---|---|---:|---:|---:|---:|---|---|',
  ];
  for (const s of scores) {
    lines.push(
      `| ${s.scenario} | ${s.source} | ${s.files} | ${(s.tokenCompliance * 100).toFixed(1)}% | ${s.fabricationCount} | ${s.violationCount} | ${s.gauntletPass ? 'PASS' : 'FAIL'} | ${s.axePass === null ? 'n/a' : s.axePass ? 'PASS' : 'FAIL'} |`,
    );
  }
  lines.push('', 'Losses are logged, not hidden — a baseline win is a finding, not an embarrassment.');
  return lines.join('\n');
}

interface GeneratorConfig {
  name: string;
  cmd: string;
}

export function runBenchmark(opts: {
  dryRun: boolean;
  reportOnly: boolean;
  generator?: GeneratorConfig | undefined;
  registry?: 'live' | 'fixture' | undefined;
}): { ok: boolean; scores: Score[] } {
  const scenarios = loadScenarios();
  const ctx = registryContext(opts.registry ?? 'live');
  const scores: Score[] = [];
  const date = new Date().toISOString().slice(0, 10);

  if (opts.dryRun) {
    // Score the committed good/bad fixtures — regression-tests the scorer.
    for (const kind of ['good', 'bad'] as const) {
      const base = join(BENCH_DIR, 'fixtures', kind);
      if (!existsSync(base)) continue;
      for (const scenarioId of readdirSync(base)) {
        const files = collectFiles(join(base, scenarioId));
        if (files.length > 0) scores.push(scoreOutput(scenarioId, `fixture:${kind}`, files, ctx));
      }
    }
  } else if (opts.generator) {
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
      scores.push(scoreOutput(scenario.id, `generator:${opts.generator.name}`, collectFiles(outDir), ctx));
    }
  }

  // Always score the committed baseline dir for comparison.
  const baselineBase = join(BENCH_DIR, 'baseline');
  if (existsSync(baselineBase)) {
    for (const scenarioId of readdirSync(baselineBase)) {
      const files = collectFiles(join(baselineBase, scenarioId));
      if (files.length > 0) scores.push(scoreOutput(scenarioId, 'baseline:raw-tailwind', files, ctx));
    }
  }

  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(
    join(RESULTS_DIR, `${date}.json`),
    JSON.stringify({ date, dryRun: opts.dryRun, scores }, null, 2),
  );
  writeFileSync(join(RESULTS_DIR, `${date}-scoreboard.md`), scoreboardMarkdown(scores, date));

  // Dry-run self-check: the good fixture must pass, the bad fixture must not.
  let ok = true;
  if (opts.dryRun) {
    const good = scores.filter((s) => s.source === 'fixture:good');
    const bad = scores.filter((s) => s.source === 'fixture:bad');
    ok =
      good.length > 0 &&
      bad.length > 0 &&
      good.every((s) => s.gauntletPass && s.tokenCompliance === 1 && s.fabricationCount === 0) &&
      bad.every((s) => !s.gauntletPass && s.fabricationCount > 0 && s.tokenCompliance < 1);
  }
  return { ok: opts.reportOnly ? true : ok, scores };
}

// CLI entry
const isMain = process.argv[1] && resolve(process.argv[1]).includes('benchmark');
if (isMain) {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const reportOnly = argv.includes('--report-only');
  const genIdx = argv.indexOf('--generator');
  const generator =
    genIdx !== -1 ? (JSON.parse(argv[genIdx + 1] ?? '{}') as GeneratorConfig) : undefined;

  if (!dryRun && !generator) {
    console.log(
      'benchmark: nothing to do — pass --dry-run (score committed fixtures) or --generator \'{"name":"...","cmd":"..."}\'.',
    );
    process.exit(reportOnly ? 0 : 2);
  }

  const { ok, scores } = runBenchmark({ dryRun, reportOnly, generator });
  console.log(scoreboardMarkdown(scores, new Date().toISOString().slice(0, 10)));
  console.log(`\nResults written to ${RESULTS_DIR}`);
  if (dryRun) console.log(ok ? 'DRY-RUN SCORER CHECK PASSED' : 'DRY-RUN SCORER CHECK FAILED');
  process.exit(ok ? 0 : 1);
}
