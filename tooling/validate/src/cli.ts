#!/usr/bin/env node
/**
 * ds-validate — the AIR-DS validation gauntlet CLI.
 *
 * Usage:
 *   ds-validate [--json] [--root <dir>] [--skip step,step] [--only step,step] [--verbose] [--browser]
 *   ds-validate files <path...> [--json] [--root <dir>]
 *   ds-validate evidence [-o <dir>] [--now <iso>] [--json] [--no-browser] [--root <dir>]
 *
 * --browser appends the opt-in stories-axe step (browser-run axe over every
 * Storybook story, G6); default off so the core gauntlet stays browser-free.
 *
 * `evidence` (M6) executes the gauntlet + evals FRESH and emits the
 * auditor-ready compliance evidence pack (default: <root>/evidence-pack/).
 *
 * Exit code is non-zero on any failure (merge-blocking, ADR-005).
 */

import { resolve } from 'node:path';
import { EvidenceError, generateEvidence } from './evidence/pack.ts';
import { runGauntlet, STEP_ORDER } from './gauntlet.ts';
import {
  appendMetricsLine,
  buildMetricsLine,
  gauntletMetricsFromReport,
} from './metrics/record.ts';
import { findRepoRoot } from './registry.ts';
import { validateFiles } from './validate.ts';
import type { GauntletReport, Violation } from './types.ts';

interface Args {
  json: boolean;
  verbose: boolean;
  root: string;
  skip: string[];
  only: string[];
  files: string[];
  mode: 'gauntlet' | 'files' | 'evidence';
  /** Opt-in stories-axe browser step (G6) — default off, core gauntlet stays browser-free. */
  browser: boolean;
  /** Skip the metrics/history.jsonl append for this run. */
  noMetrics: boolean;
  /** Pin the metrics timestamp (default: HEAD commit time). */
  now: string | null;
  /** evidence mode: output directory (default <root>/evidence-pack). */
  out: string | null;
  /** evidence mode: never launch a browser for stories-axe. */
  noBrowser: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    json: false,
    verbose: false,
    // `pnpm validate` runs with cwd tooling/validate — resolve the workspace
    // root by walking up to pnpm-workspace.yaml unless --root overrides it.
    root: findRepoRoot(process.cwd()),
    skip: [],
    only: [],
    files: [],
    mode: 'gauntlet',
    browser: false,
    noMetrics: false,
    now: null,
    out: null,
    noBrowser: false,
  };
  let i = 0;
  if (argv[0] === 'files') {
    args.mode = 'files';
    i = 1;
  } else if (argv[0] === 'evidence') {
    args.mode = 'evidence';
    i = 1;
  }
  for (; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === '--json') args.json = true;
    else if (a === '--verbose') args.verbose = true;
    else if (a === '--root') args.root = resolve(argv[++i] ?? '.');
    else if (a === '--skip') args.skip = (argv[++i] ?? '').split(',').filter(Boolean);
    else if (a === '--only') args.only = (argv[++i] ?? '').split(',').filter(Boolean);
    else if (a === '--browser') args.browser = true;
    else if (a === '--no-metrics') args.noMetrics = true;
    else if (a === '--now') args.now = argv[++i] ?? null;
    else if (a === '-o' || a === '--out') args.out = resolve(argv[++i] ?? 'evidence-pack');
    else if (a === '--no-browser') args.noBrowser = true;
    else if (a === '--') continue; // pnpm run forwards the literal `--` separator
    else if (a === '--help' || a === '-h') {
      console.log(
        `ds-validate — AIR-DS validation gauntlet\n\n` +
          `  ds-validate [--json] [--root <dir>] [--skip s1,s2] [--only s1,s2] [--verbose] [--no-metrics] [--now <iso>] [--browser]\n` +
          `  ds-validate files <path...> [--json] [--root <dir>]\n` +
          `  ds-validate evidence [-o <dir>] [--now <iso>] [--json] [--no-browser] [--root <dir>]\n\n` +
          `Steps (fixed order, fail-fast): ${STEP_ORDER.join(' -> ')}\n` +
          `--browser adds the opt-in stories-axe step (browser-run axe over every Storybook story; needs a local chromium, warn-skips without one)\n` +
          `evidence executes the gauntlet + evals FRESH and writes the auditor-ready compliance pack (default <root>/evidence-pack/, self-gitignoring); aborts if either fails`,
      );
      process.exit(0);
    } else if (!a.startsWith('--')) args.files.push(a);
    else {
      console.error(`Unknown flag: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

function printViolations(violations: Violation[]): void {
  for (const v of violations) {
    const nr = v.nr ? ` [${v.nr}]` : '';
    const loc = v.line > 0 ? `${v.file}:${v.line}` : v.file;
    console.log(`  ${v.rule}${nr}  ${loc}\n      ${v.message}`);
  }
}

function printReport(report: GauntletReport): void {
  console.log(`\nVALIDATION GAUNTLET  root=${report.root}`);
  for (const s of report.steps) {
    const badge =
      s.status === 'pass' ? 'PASS' : s.status === 'fail' ? 'FAIL' : s.status === 'warn' ? 'WARN' : 'SKIP';
    console.log(`\n[${badge}] ${s.step} (${s.durationMs}ms)`);
    if (s.detail) console.log(`  ${s.detail.split('\n').join('\n  ')}`);
    if (s.violations && s.violations.length > 0) printViolations(s.violations);
  }
  const attempted = report.steps.filter((s) => s.status !== 'skip').length;
  console.log(
    `\n${report.ok ? 'GAUNTLET PASSED' : 'GAUNTLET FAILED'} — ${attempted} step(s) attempted in ${report.durationMs}ms\n`,
  );
}

const args = parseArgs(process.argv.slice(2));

if (args.mode === 'evidence') {
  try {
    const result = generateEvidence({
      root: args.root,
      ...(args.out ? { outDir: args.out } : {}),
      ...(args.now ? { now: args.now } : {}),
      browser: args.noBrowser ? 'off' : 'auto',
      log: args.json ? () => {} : (msg) => console.log(msg),
    });
    if (args.json) {
      console.log(JSON.stringify({ outDir: result.outDir, files: result.files, evidence: result.doc }, null, 2));
    } else {
      const sa = result.doc.wcag.storiesAxe;
      console.log(
        `\nEVIDENCE PACK WRITTEN — ${result.outDir}\n` +
          `  gauntlet: PASS (fresh, ${result.doc.gauntlet.steps.length} steps, ${result.doc.gauntlet.fabrications} fabrications)\n` +
          `  evals: ${result.doc.evals.passed}/${result.doc.evals.total} (fresh)\n` +
          `  contrast: ${result.doc.wcag.contrast.pairCount} pairs, ${result.doc.wcag.contrast.failures} failures\n` +
          `  stories-axe: ${sa ? `${sa.stories} stories, ${sa.violations} violations (${sa.source}${sa.staleness.stale ? `, stale ${sa.staleness.ageDays}d` : ''})` : 'not available'}\n` +
          `  vitest-axe: ${result.doc.wcag.vitestAxe.componentsWithAxe}/${result.doc.wcag.vitestAxe.componentsTotal} components, ${result.doc.wcag.vitestAxe.totalAssertions} assertions\n` +
          `  dependencies: ${result.doc.dependencies.entries.length} unique packages (${result.doc.dependencies.licenses.unknown} unknown licenses)\n` +
          `  files: ${result.files.length} (see SHA256SUMS)`,
      );
    }
    process.exit(0);
  } catch (error) {
    if (error instanceof EvidenceError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
} else if (args.mode === 'files') {
  if (args.files.length === 0) {
    console.error('ds-validate files: no paths given');
    process.exit(2);
  }
  const result = validateFiles(args.files.map((f) => resolve(f)), { root: args.root });
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.ok) console.log(`OK — ${result.filesChecked} file(s), no violations`);
    else {
      console.log(`${result.violations.length} violation(s) in ${result.filesChecked} file(s):`);
      printViolations(result.violations);
    }
  }
  process.exit(result.ok ? 0 : 1);
} else {
  const report = runGauntlet({
    root: args.root,
    skip: args.skip,
    only: args.only,
    verbose: args.verbose && !args.json,
    browser: args.browser,
  });
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else printReport(report);

  // Metrics per release (brief §8): append one structured line per CLI run.
  // Best-effort — a metrics write failure never masks the gauntlet verdict.
  if (!args.noMetrics) {
    try {
      const { gauntlet, fabrications } = gauntletMetricsFromReport(report);
      const line = buildMetricsLine({
        root: args.root,
        source: 'gauntlet',
        gauntlet,
        fabrications,
        ...(args.now ? { now: args.now } : {}),
      });
      const target = appendMetricsLine(args.root, line);
      if (!args.json) console.log(`metrics: appended gauntlet line to ${target}`);
    } catch (error) {
      console.error(`metrics: append failed (non-fatal): ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  process.exit(report.ok ? 0 : 1);
}
