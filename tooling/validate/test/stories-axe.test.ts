import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { checkAxeAvailability } from '../src/benchmark/axe.ts';
import {
  gateFailures,
  loadAllowlist,
  readStoryIndex,
  resultsMarkdown,
  runStoriesAxe,
  startStaticServer,
  storybookBuildState,
  summarize,
  type StoryAxeResult,
} from '../src/stories-axe/harness.ts';

const FIXTURE_STATIC = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'stories-axe', 'static');

const tmp = mkdtempSync(join(tmpdir(), 'air-ds-stories-axe-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const result = (over: Partial<StoryAxeResult>): StoryAxeResult => ({
  id: 'x--y',
  title: 'X',
  name: 'Y',
  status: 'clean',
  violations: [],
  durationMs: 1,
  ...over,
});

describe('stories-axe harness logic (no browser needed)', () => {
  it('reads index.json entries and filters out docs pages', () => {
    const stories = readStoryIndex(FIXTURE_STATIC);
    expect(stories.map((s) => s.id)).toEqual(['fixture-button--clean', 'fixture-button--nameless']);
  });

  it('storybookBuildState: absent build needs building', () => {
    const state = storybookBuildState(join(tmp, 'nope'), []);
    expect(state.needsBuild).toBe(true);
    expect(state.reason).toContain('absent');
  });

  it('storybookBuildState: stale when a source is newer than index.json, fresh otherwise', () => {
    const staticDir = join(tmp, 'static');
    const srcDir = join(tmp, 'src');
    mkdirSync(staticDir, { recursive: true });
    mkdirSync(srcDir, { recursive: true });
    const indexPath = join(staticDir, 'index.json');
    const srcPath = join(srcDir, 'Button.tsx');
    writeFileSync(indexPath, '{}');
    writeFileSync(srcPath, 'export {}');
    // Source older than the build -> up to date (the directory mtime counts
    // too — file adds/removes touch it — so age it alongside the file).
    const past = new Date(Date.now() - 60_000);
    utimesSync(srcPath, past, past);
    utimesSync(srcDir, past, past);
    expect(storybookBuildState(staticDir, [srcDir]).needsBuild).toBe(false);
    // Source newer than the build -> stale.
    const future = new Date(Date.now() + 60_000);
    utimesSync(srcPath, future, future);
    const state = storybookBuildState(staticDir, [srcDir]);
    expect(state.needsBuild).toBe(true);
    expect(state.reason).toContain('stale');
  });

  it('gateFailures: only serious/critical gate; allowlist (exact id and *) exempts', () => {
    const results: StoryAxeResult[] = [
      result({
        id: 'a--one',
        status: 'violations',
        violations: [
          { rule: 'button-name', impact: 'critical', help: 'Buttons must have discernible text', nodes: [{ target: 'button', html: '<button></button>' }] },
          { rule: 'color-contrast', impact: 'serious', help: 'contrast', nodes: [{ target: 'span', html: '<span>x</span>' }] },
          { rule: 'region', impact: 'moderate', help: 'landmarks', nodes: [] },
        ],
      }),
      result({ id: 'b--two', status: 'clean' }),
    ];
    expect(gateFailures(results, []).map((f) => `${f.story}:${f.rule}`)).toEqual([
      'a--one:button-name',
      'a--one:color-contrast',
    ]);
    // Exact-id allowlist entry exempts one rule.
    expect(
      gateFailures(results, [{ story: 'a--one', rule: 'button-name', reason: 'test' }]).map((f) => f.rule),
    ).toEqual(['color-contrast']);
    // Wildcard story allowlists the rule everywhere.
    expect(
      gateFailures(results, [
        { story: '*', rule: 'button-name', reason: 'test' },
        { story: '*', rule: 'color-contrast', reason: 'test' },
      ]),
    ).toEqual([]);
  });

  it('gateFailures: render errors gate (a story that cannot render cannot pass silently)', () => {
    const failures = gateFailures([result({ id: 'c--broken', status: 'render-error', error: 'boom' })], []);
    expect(failures).toEqual([{ story: 'c--broken', rule: 'story-render', impact: 'error', nodes: 0 }]);
  });

  it('loadAllowlist: missing file -> empty; committed default allowlist is empty', () => {
    expect(loadAllowlist(join(tmp, 'missing.json'))).toEqual([]);
    const committed = loadAllowlist(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'config', 'stories-axe-allowlist.json'),
    );
    expect(committed).toEqual([]);
  });

  it('summarize + resultsMarkdown: counts by impact and renders per-story rows', () => {
    const results: StoryAxeResult[] = [
      result({ id: 'a--one', status: 'clean' }),
      result({
        id: 'b--two',
        status: 'violations',
        violations: [{ rule: 'button-name', impact: 'critical', help: 'Buttons must have discernible text', nodes: [] }],
      }),
    ];
    const summary = summarize(results);
    expect(summary).toMatchObject({ stories: 2, clean: 1, withViolations: 1, violations: 1, byImpact: { critical: 1 } });
    const md = resultsMarkdown(results, { date: '2026-08-12', gateFailures: gateFailures(results, []), allowlisted: 0 });
    expect(md).toContain('| a--one | clean |');
    expect(md).toContain('| b--two | violations | button-name | critical |');
    expect(md).toContain('FAIL — 1 serious/critical finding(s)');
  });

  it('static server serves the fixture index.json over loopback (no browser involved)', async () => {
    const server = await startStaticServer(FIXTURE_STATIC);
    try {
      const res = await fetch(`${server.origin}/index.json`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { v: number };
      expect(body.v).toBe(5);
      const missing = await fetch(`${server.origin}/nope.js`);
      expect(missing.status).toBe(404);
    } finally {
      await server.close();
    }
  });
});

// Browser-dependent smoke over the committed fixture pages. Requires the
// optionally installed local chromium (credential-free rule) — skipped, not
// failed, when it is absent so the deterministic suite never goes flaky.
const axeAvailable = checkAxeAvailability().available;

describe.skipIf(!axeAvailable)('stories-axe harness in a real browser (fixture pages)', () => {
  it('clean fixture story passes; seeded button-name violation is caught as critical', async () => {
    const results = await runStoriesAxe({ staticDir: FIXTURE_STATIC, renderTimeoutMs: 5000 });
    expect(results).toHaveLength(2);

    const clean = results.find((r) => r.id === 'fixture-button--clean');
    expect(clean?.status).toBe('clean');
    expect(clean?.violations).toEqual([]);

    const nameless = results.find((r) => r.id === 'fixture-button--nameless');
    expect(nameless?.status).toBe('violations');
    const buttonName = nameless?.violations.find((v) => v.rule === 'button-name');
    expect(buttonName?.impact).toBe('critical');
    expect(gateFailures(results, []).map((f) => f.rule)).toEqual(['button-name']);
  }, 60_000);
});
