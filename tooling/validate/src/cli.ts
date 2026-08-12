#!/usr/bin/env node
/**
 * ds-validate — the AIR-DS validation gauntlet CLI.
 *
 * Usage:
 *   ds-validate [--json] [--root <dir>] [--skip step,step] [--only step,step] [--verbose]
 *   ds-validate files <path...> [--json] [--root <dir>]
 *
 * Exit code is non-zero on any failure (merge-blocking, ADR-005).
 */

import { resolve } from 'node:path';
import { runGauntlet, STEP_ORDER } from './gauntlet.ts';
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
  mode: 'gauntlet' | 'files';
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
  };
  let i = 0;
  if (argv[0] === 'files') {
    args.mode = 'files';
    i = 1;
  }
  for (; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === '--json') args.json = true;
    else if (a === '--verbose') args.verbose = true;
    else if (a === '--root') args.root = resolve(argv[++i] ?? '.');
    else if (a === '--skip') args.skip = (argv[++i] ?? '').split(',').filter(Boolean);
    else if (a === '--only') args.only = (argv[++i] ?? '').split(',').filter(Boolean);
    else if (a === '--help' || a === '-h') {
      console.log(
        `ds-validate — AIR-DS validation gauntlet\n\n` +
          `  ds-validate [--json] [--root <dir>] [--skip s1,s2] [--only s1,s2] [--verbose]\n` +
          `  ds-validate files <path...> [--json] [--root <dir>]\n\n` +
          `Steps (fixed order, fail-fast): ${STEP_ORDER.join(' -> ')}`,
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

if (args.mode === 'files') {
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
  });
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else printReport(report);
  process.exit(report.ok ? 0 : 1);
}
