import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findRepoRoot, loadRegistryContext, registriesPresent } from './registry.ts';
import { validateFiles } from './validate.ts';
import {
  checkComponentCoverage,
  checkDeadHooks,
  diffHashes,
  generatedFilePaths,
  hashFiles,
  loadWaivers,
  reactSourceFiles,
} from './workspace.ts';
import type { GauntletOptions, GauntletReport, StepResult, Violation } from './types.ts';

/**
 * The validation gauntlet (ADR-005): one fixed, mandatory, fail-fast sequence.
 *   1. typecheck       pnpm -r typecheck
 *   2. lint            custom deterministic rules (G1 G2 G3 G5 G6 G8, NR-004/005/010)
 *   3. build           tokens -> react -> generate -> context -> mcp (skip-if-absent, warn)
 *   4. test            pnpm -r test
 *   5. registry-check  G4 dead hooks, G7 generator drift, registry coverage, G1 re-scan
 * No LLM anywhere in this path.
 */

const STEP_ORDER = ['typecheck', 'lint', 'build', 'test', 'registry-check'] as const;

function run(
  cmd: string,
  args: string[],
  cwd: string,
  verbose: boolean,
): { ok: boolean; output: string } {
  const res = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    stdio: verbose ? 'inherit' : 'pipe',
    shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = verbose ? '' : `${res.stdout ?? ''}${res.stderr ?? ''}`;
  return { ok: res.status === 0, output };
}

function tail(output: string, lines = 40): string {
  const all = output.trimEnd().split('\n');
  return all.slice(-lines).join('\n');
}

export function runGauntlet(opts: GauntletOptions = {}): GauntletReport {
  const root = opts.root ?? findRepoRoot(process.cwd());
  const verbose = opts.verbose ?? false;
  const skip = new Set(opts.skip ?? []);
  const only = opts.only && opts.only.length > 0 ? new Set(opts.only) : null;
  const steps: StepResult[] = [];
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  let failed = false;

  const record = (step: string, fn: () => Omit<StepResult, 'step' | 'durationMs'>): void => {
    if (failed) return; // fail-fast: later steps are not attempted
    if (skip.has(step) || (only && !only.has(step))) {
      steps.push({ step, status: 'skip', durationMs: 0, detail: 'skipped by request' });
      return;
    }
    const s0 = Date.now();
    const result = fn();
    steps.push({ step, durationMs: Date.now() - s0, ...result });
    if (result.status === 'fail') failed = true;
  };

  // 1. typecheck
  record('typecheck', () => {
    const r = run('pnpm', ['-r', 'typecheck'], root, verbose);
    return r.ok
      ? { status: 'pass' }
      : { status: 'fail', detail: tail(r.output) };
  });

  // 2. lint — custom deterministic rules over packages/react/src.
  record('lint', () => {
    const files = reactSourceFiles(root);
    if (files.length === 0) {
      return { status: 'warn', detail: 'packages/react/src not found — nothing to lint' };
    }
    const result = validateFiles(files, { root });
    return result.ok
      ? { status: 'pass', detail: `${files.length} files clean` }
      : { status: 'fail', detail: `${result.violations.length} violation(s) in ${files.length} files`, violations: result.violations };
  });

  // 3. build — fixed order, skip-if-absent with warning.
  record('build', () => {
    const buildSteps: { label: string; dir: string; args: string[] }[] = [
      { label: '@ds/tokens build', dir: 'packages/tokens', args: ['--filter', '@ds/tokens', 'build'] },
      { label: '@ds/react build', dir: 'packages/react', args: ['--filter', '@ds/react', 'build'] },
      { label: '@ds/react generate', dir: 'packages/react', args: ['--filter', '@ds/react', 'generate'] },
      { label: '@ds/context build', dir: 'packages/context', args: ['--filter', '@ds/context', 'build'] },
      { label: '@ds/mcp build', dir: 'packages/mcp', args: ['--filter', '@ds/mcp', 'build'] },
    ];
    const warnings: string[] = [];
    for (const b of buildSteps) {
      if (!existsSync(join(root, b.dir, 'package.json'))) {
        warnings.push(`SKIPPED ${b.label}: ${b.dir}/ not present yet`);
        continue;
      }
      const r = run('pnpm', b.args, root, verbose);
      if (!r.ok) {
        return { status: 'fail', detail: `${b.label} failed:\n${tail(r.output)}` };
      }
    }
    return warnings.length > 0
      ? { status: 'warn', detail: warnings.join('\n') }
      : { status: 'pass' };
  });

  // 4. test
  record('test', () => {
    const r = run('pnpm', ['-r', 'test'], root, verbose);
    return r.ok ? { status: 'pass' } : { status: 'fail', detail: tail(r.output) };
  });

  // 5. registry-check — fabrication detector.
  record('registry-check', () => {
    const present = registriesPresent(root);
    if (!present.tokens || !present.components) {
      return {
        status: 'fail',
        detail: `Missing registr${present.tokens ? 'y: components-index.json' : present.components ? 'y: tokens-index.json' : 'ies: tokens-index.json and components-index.json'} — the closed world has no contract to check against.`,
      };
    }

    const violations: Violation[] = [];

    // G7: generator drift (hash-compare survives dirty sibling worktrees).
    const genPaths = generatedFilePaths(root);
    const before = hashFiles(genPaths);
    const gen = run('pnpm', ['--filter', '@ds/react', 'generate'], root, verbose);
    if (!gen.ok) {
      return { status: 'fail', detail: `@ds/react generate failed during drift check:\n${tail(gen.output)}` };
    }
    const after = hashFiles(generatedFilePaths(root));
    for (const changed of diffHashes(before, after)) {
      violations.push({
        rule: 'G7',
        nr: null,
        file: changed,
        line: 0,
        message: `Generator drift: "${changed}" did not match generator output — generated files must be committed in sync with their sources.`,
      });
    }

    // Fresh registry context AFTER regeneration.
    const ctx = loadRegistryContext(root);
    violations.push(...checkDeadHooks(root, ctx, loadWaivers()));
    violations.push(...checkComponentCoverage(root, ctx));

    // G1/G5 re-scan of source against the regenerated registries.
    const files = reactSourceFiles(root);
    if (files.length > 0) {
      const rescan = validateFiles(files, { registry: ctx });
      violations.push(
        ...rescan.violations.filter((v) => v.rule === 'G1' || v.rule === 'G5'),
      );
    }

    return violations.length === 0
      ? { status: 'pass' }
      : { status: 'fail', detail: `${violations.length} violation(s)`, violations };
  });

  return {
    ok: !failed,
    root,
    startedAt,
    durationMs: Date.now() - t0,
    steps,
  };
}

export { STEP_ORDER };
