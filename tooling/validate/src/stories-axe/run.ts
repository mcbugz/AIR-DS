#!/usr/bin/env node
/**
 * G6 stories-axe runner — `pnpm --filter @ds/validate run stories-axe`.
 *
 *   stories-axe [--rebuild] [--json] [--no-metrics] [--now <iso>] [--allowlist <path>]
 *
 * 1. Ensures a fresh static Storybook build (packages/react/storybook-static):
 *    builds when absent or stale (any source newer than the built index.json);
 *    `--rebuild` forces.
 * 2. Loads EVERY story from index.json in headless chromium (served from an
 *    ephemeral loopback server — no network beyond localhost) and runs
 *    axe-core with WCAG 2.x A/AA tags, scoped to the story root.
 * 3. Writes stories-axe-results/<date>.json + <date>-summary.md, appends a
 *    metrics/history.jsonl line (source: "stories-axe"), and exits non-zero
 *    on any serious/critical violation (or render error) not covered by
 *    config/stories-axe-allowlist.json (empty by default).
 *
 * Credential-free rule: the ONE optional local dependency is the chromium
 * binary (`npx playwright install chromium`). When it is missing the run
 * SKIPS gracefully with exit 0 — CI provides the browser in the dedicated
 * stories-axe job; the core gauntlet never needs it.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAxeAvailability } from '../benchmark/axe.ts';
import { appendMetricsLine, buildMetricsLine } from '../metrics/record.ts';
import {
  gateFailures,
  loadAllowlist,
  resultsMarkdown,
  runStoriesAxe,
  storybookBuildState,
  summarize,
} from './harness.ts';

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO_ROOT = resolve(PKG_ROOT, '..', '..');
const STATIC_DIR = join(REPO_ROOT, 'packages', 'react', 'storybook-static');
const RESULTS_DIR = join(PKG_ROOT, 'stories-axe-results');
const DEFAULT_ALLOWLIST = join(PKG_ROOT, 'config', 'stories-axe-allowlist.json');

/** Sources whose changes invalidate the static build. */
const STALENESS_INPUTS = [
  join(REPO_ROOT, 'packages', 'react', 'src'),
  join(REPO_ROOT, 'packages', 'react', '.storybook'),
  join(REPO_ROOT, 'packages', 'tokens', 'src'),
];

function ensureStorybookBuild(force: boolean): { built: boolean; reason: string } {
  const state = storybookBuildState(STATIC_DIR, STALENESS_INPUTS);
  if (!force && !state.needsBuild) return { built: false, reason: state.reason };
  const reason = force ? 'forced by --rebuild' : state.reason;
  console.log(`stories-axe: building Storybook static (${reason})...`);
  const res = spawnSync('pnpm', ['--filter', '@ds/react', 'build-storybook'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
    shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.status !== 0) {
    const tail = `${res.stdout ?? ''}${res.stderr ?? ''}`.trimEnd().split('\n').slice(-40).join('\n');
    throw new Error(`build-storybook failed:\n${tail}`);
  }
  return { built: true, reason };
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const rebuild = argv.includes('--rebuild');
  const json = argv.includes('--json');
  const noMetrics = argv.includes('--no-metrics');
  const nowIdx = argv.indexOf('--now');
  const now = nowIdx !== -1 ? argv[nowIdx + 1] : undefined;
  const allowIdx = argv.indexOf('--allowlist');
  const allowlistPath = allowIdx !== -1 ? resolve(argv[allowIdx + 1] ?? '.') : DEFAULT_ALLOWLIST;

  // Credential-free rule: no local chromium -> graceful skip, exit 0.
  const availability = checkAxeAvailability();
  if (!availability.available) {
    console.log(
      `stories-axe: SKIPPED (${availability.reason ?? 'no browser'}) — the browser is optional locally; CI runs this in the dedicated stories-axe job.`,
    );
    return 0;
  }

  const build = ensureStorybookBuild(rebuild);
  console.log(
    build.built
      ? `stories-axe: Storybook static rebuilt (${build.reason})`
      : `stories-axe: reusing Storybook static (${build.reason})`,
  );

  const t0 = Date.now();
  const results = await runStoriesAxe({
    staticDir: STATIC_DIR,
    onStory: (r, i, total) => {
      if (json) return;
      const badge =
        r.status === 'clean' ? 'clean' : r.status === 'violations' ? `${r.violations.length} violation(s)` : `RENDER ERROR: ${r.error}`;
      console.log(`  [${i + 1}/${total}] ${r.id} — ${badge} (${r.durationMs}ms)`);
    },
  });
  const durationMs = Date.now() - t0;

  const allowlist = loadAllowlist(allowlistPath);
  const failures = gateFailures(results, allowlist);
  const allowlisted = results.reduce(
    (acc, r) =>
      acc +
      r.violations.filter(
        (v) =>
          (v.impact === 'serious' || v.impact === 'critical') &&
          !failures.some((f) => f.story === r.id && f.rule === v.rule),
      ).length,
    0,
  );
  const summary = summarize(results);
  const date = new Date().toISOString().slice(0, 10);

  mkdirSync(RESULTS_DIR, { recursive: true });
  const jsonPath = join(RESULTS_DIR, `${date}.json`);
  const mdPath = join(RESULTS_DIR, `${date}-summary.md`);
  writeFileSync(
    jsonPath,
    JSON.stringify({ date, durationMs, summary, gate: failures, allowlisted, results }, null, 2),
  );
  writeFileSync(mdPath, resultsMarkdown(results, { date, gateFailures: failures, allowlisted }));

  if (json) {
    console.log(JSON.stringify({ date, durationMs, summary, gate: failures, results }, null, 2));
  } else {
    console.log(
      `\nstories-axe: ${summary.stories} stories in ${durationMs}ms — ${summary.clean} clean, ${summary.withViolations} with violations, ${summary.renderErrors} render errors; ${summary.violations} violation(s)${
        Object.keys(summary.byImpact).length > 0
          ? ` (${Object.entries(summary.byImpact).map(([k, v]) => `${k} ${v}`).join(', ')})`
          : ''
      }`,
    );
    console.log(`results: ${jsonPath}\nsummary: ${mdPath}`);
  }

  // Metrics per release (brief §8) — best-effort, never masks the verdict.
  if (!noMetrics) {
    try {
      const line = buildMetricsLine({
        root: REPO_ROOT,
        source: 'stories-axe',
        storiesAxe: {
          stories: summary.stories,
          storiesWithViolations: summary.withViolations,
          violations: summary.violations,
          serious: summary.byImpact['serious'] ?? 0,
          critical: summary.byImpact['critical'] ?? 0,
          gatePassed: failures.length === 0,
        },
        fabrications: 0,
        ...(now ? { now } : {}),
      });
      const target = appendMetricsLine(REPO_ROOT, line);
      if (!json) console.log(`metrics: appended stories-axe line to ${target}`);
    } catch (error) {
      console.error(
        `metrics: append failed (non-fatal): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (failures.length > 0) {
    console.error(`\nSTORIES-AXE GATE FAILED — ${failures.length} serious/critical finding(s):`);
    for (const f of failures) {
      console.error(`  ${f.story}: ${f.rule} (${f.impact}, ${f.nodes} node(s))`);
    }
    console.error(
      `Fix the component, or (temporarily, with a reason) allowlist in ${allowlistPath}`,
    );
    return 1;
  }
  console.log('STORIES-AXE GATE PASSED — no serious/critical violations.');
  return 0;
}

// CLI entry
const isMain = process.argv[1] && resolve(process.argv[1]).includes('stories-axe');
if (isMain) {
  main()
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}

export { main as runStoriesAxeCli };
