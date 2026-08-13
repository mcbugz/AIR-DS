/**
 * G6 stories-axe harness — browser-run axe-core over EVERY Storybook story.
 *
 * The static Storybook build (packages/react/storybook-static) is the input:
 * index.json enumerates every story, and each one is loaded as
 * `iframe.html?id=<story>&viewMode=story` in a locally installed Playwright
 * chromium, then scanned with axe-core (WCAG 2.x A/AA tags) scoped to the
 * story root (#storybook-root) — same scope as @storybook/addon-a11y, so the
 * Storybook shell itself is not what gets scored.
 *
 * Serving: a Vite-built Storybook uses `<script type="module">` and fetches
 * (index.json, story chunks), both of which break on file:// (CORS). The
 * harness therefore serves storybook-static from an ephemeral 127.0.0.1 http
 * server — loopback only, no network beyond localhost (credential-free rule).
 *
 * Availability mirrors src/benchmark/axe.ts: when the local chromium binary
 * is absent the caller skips gracefully; nothing here downloads anything.
 */

import { createRequire } from 'node:module';
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const require = createRequire(import.meta.url);

/* ---------------------------------------------------------------- types -- */

export interface StoryEntry {
  id: string;
  title: string;
  name: string;
}

export interface AxeNodeDetail {
  /** CSS selector path axe reported for the offending node. */
  target: string;
  /** Offending element HTML (truncated). */
  html: string;
}

export interface StoryViolation {
  rule: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical' | null;
  help: string;
  nodes: AxeNodeDetail[];
}

export interface StoryAxeResult {
  id: string;
  title: string;
  name: string;
  status: 'clean' | 'violations' | 'render-error';
  violations: StoryViolation[];
  error?: string;
  durationMs: number;
}

export interface AllowlistEntry {
  /** Exact story id, or "*" to allow the rule everywhere. */
  story: string;
  /** axe rule id, e.g. "button-name". */
  rule: string;
  reason?: string;
}

export interface GateFailure {
  story: string;
  rule: string;
  impact: string;
  nodes: number;
}

/* ----------------------------------------------------------- index.json -- */

/** Parse storybook-static/index.json into the list of story (not docs) entries. */
export function readStoryIndex(staticDir: string): StoryEntry[] {
  const indexPath = join(staticDir, 'index.json');
  const parsed = JSON.parse(readFileSync(indexPath, 'utf8')) as {
    entries?: Record<string, { id: string; title: string; name: string; type?: string }>;
    stories?: Record<string, { id: string; title: string; name: string }>;
  };
  // index v4/v5 (`entries`, typed story/docs); v3 fallback (`stories`).
  const raw = parsed.entries ?? parsed.stories ?? {};
  const out: StoryEntry[] = [];
  for (const entry of Object.values(raw)) {
    if ('type' in entry && entry.type !== 'story') continue; // skip docs pages
    out.push({ id: entry.id, title: entry.title, name: entry.name });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/* ------------------------------------------------------------ staleness -- */

function newestMtimeMs(path: string): number {
  if (!existsSync(path)) return 0;
  const stat = statSync(path);
  if (!stat.isDirectory()) return stat.mtimeMs;
  let newest = stat.mtimeMs;
  for (const entry of readdirSync(path)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    newest = Math.max(newest, newestMtimeMs(join(path, entry)));
  }
  return newest;
}

/**
 * Is the static Storybook build absent or older than any of its sources?
 * `srcDirs` are the directories whose content feeds the build (react src,
 * .storybook config, token sources).
 */
export function storybookBuildState(
  staticDir: string,
  srcDirs: string[],
): { needsBuild: boolean; reason: string } {
  const indexPath = join(staticDir, 'index.json');
  if (!existsSync(indexPath)) {
    return { needsBuild: true, reason: 'storybook-static/index.json absent' };
  }
  const builtAt = statSync(indexPath).mtimeMs;
  for (const dir of srcDirs) {
    const newest = newestMtimeMs(dir);
    if (newest > builtAt) {
      return { needsBuild: true, reason: `stale (newer sources in ${dir})` };
    }
  }
  return { needsBuild: false, reason: 'up to date' };
}

/* -------------------------------------------------------- static server -- */

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

export interface StaticServer {
  port: number;
  origin: string;
  close(): Promise<void>;
}

/** Loopback-only static file server over `dir` on an ephemeral port. */
export function startStaticServer(dir: string): Promise<StaticServer> {
  const rootDir = resolve(dir);
  const server: Server = createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
      const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const full = normalize(join(rootDir, rel));
      if (full !== rootDir && !full.startsWith(rootDir + sep)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      if (!existsSync(full) || statSync(full).isDirectory()) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': MIME[extname(full).toLowerCase()] ?? 'application/octet-stream' });
      res.end(readFileSync(full));
    } catch {
      res.writeHead(500).end('error');
    }
  });
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolvePromise({
        port,
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}

/* ------------------------------------------------------------ axe sweep -- */

/** Waits inside the page until the story mounted, errored, or timed out. */
const RENDER_WAIT_SCRIPT = (timeoutMs: number): string => `(async () => {
  const deadline = Date.now() + ${timeoutMs};
  const check = () => {
    const body = document.body;
    if (!body) return null;
    if (body.classList.contains('sb-show-errordisplay')) {
      const msg = document.querySelector('#error-message');
      return { state: 'error', message: (msg && msg.textContent || 'storybook error display').trim().slice(0, 300) };
    }
    const root = document.getElementById('storybook-root') || document.getElementById('root');
    if (root && root.innerHTML.trim().length > 0) return { state: 'ready' };
    return null;
  };
  while (Date.now() < deadline) {
    const result = check();
    if (result) return result;
    await new Promise((r) => setTimeout(r, 100));
  }
  return { state: 'timeout' };
})()`;

/**
 * The static build ships @storybook/addon-a11y, which auto-runs its own axe
 * after each story render. Injecting axe.min.js merges onto the same
 * window.axe object, so an in-flight addon run holds the shared _running
 * lock — wait for idle before injecting, and retry the one collision error.
 */
const AXE_IDLE_SCRIPT = (timeoutMs: number): string => `(async () => {
  const deadline = Date.now() + ${timeoutMs};
  while (window.axe && window.axe._running && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }
  return !(window.axe && window.axe._running);
})()`;

/** axe scoped to the story root — same scope as @storybook/addon-a11y. */
const AXE_RUN_SCRIPT = `(async () => {
  const root = document.getElementById('storybook-root') || document.getElementById('root') || document.body;
  const options = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag21a', 'wcag2aa', 'wcag21aa'] } };
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const r = await axe.run(root, options);
      return r.violations.map((v) => ({
        rule: v.id,
        impact: v.impact ?? null,
        help: v.help,
        nodes: v.nodes.slice(0, 10).map((n) => ({
          target: n.target.join(' '),
          html: String(n.html).slice(0, 200),
        })),
      }));
    } catch (error) {
      if (String(error).includes('already running')) {
        await new Promise((r) => setTimeout(r, 100));
        continue;
      }
      throw error;
    }
  }
  throw new Error('axe stayed busy (addon-a11y run never finished)');
})()`;

interface PageLike {
  goto(url: string): Promise<unknown>;
  addScriptTag(opts: { content: string }): Promise<unknown>;
  evaluate<T>(fn: string): Promise<T>;
  waitForTimeout(ms: number): Promise<void>;
  close(): Promise<void>;
}

interface ChromiumLike {
  launch(opts?: { headless?: boolean }): Promise<{
    newPage(): Promise<PageLike>;
    close(): Promise<void>;
  }>;
}

export interface RunStoriesAxeOptions {
  staticDir: string;
  /** Subset of story ids to scan (default: everything in index.json). */
  storyIds?: string[];
  /** Per-story render timeout (default 15000ms). */
  renderTimeoutMs?: number;
  /** Progress callback, called after each story completes. */
  onStory?: (result: StoryAxeResult, index: number, total: number) => void;
}

/**
 * Load every story from the static build in headless chromium and run axe.
 * Assumes availability was checked by the caller (see checkAxeAvailability
 * in src/benchmark/axe.ts) — throws if playwright/chromium cannot launch.
 */
export async function runStoriesAxe(opts: RunStoriesAxeOptions): Promise<StoryAxeResult[]> {
  const stories = readStoryIndex(opts.staticDir).filter(
    (s) => !opts.storyIds || opts.storyIds.includes(s.id),
  );
  const timeoutMs = opts.renderTimeoutMs ?? 15_000;
  const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  const chromium = (require('playwright') as { chromium: ChromiumLike }).chromium;

  const server = await startStaticServer(opts.staticDir);
  const results: StoryAxeResult[] = [];
  try {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      for (let i = 0; i < stories.length; i++) {
        const story = stories[i] as StoryEntry;
        const t0 = Date.now();
        let result: StoryAxeResult;
        try {
          await page.goto(`${server.origin}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`);
          const render = await page.evaluate<{ state: string; message?: string }>(
            RENDER_WAIT_SCRIPT(timeoutMs),
          );
          if (render.state !== 'ready') {
            result = {
              ...story,
              status: 'render-error',
              violations: [],
              error:
                render.state === 'error'
                  ? render.message ?? 'storybook error display'
                  : `render timeout after ${timeoutMs}ms`,
              durationMs: Date.now() - t0,
            } satisfies StoryAxeResult;
          } else {
            await page.waitForTimeout(100); // settle animations/play fns
            await page.evaluate(AXE_IDLE_SCRIPT(timeoutMs)); // let addon-a11y's own axe finish
            await page.addScriptTag({ content: axeSource });
            const violations = await page.evaluate<StoryViolation[]>(AXE_RUN_SCRIPT);
            result = {
              ...story,
              status: violations.length === 0 ? 'clean' : 'violations',
              violations,
              durationMs: Date.now() - t0,
            };
          }
        } catch (error) {
          result = {
            ...story,
            status: 'render-error',
            violations: [],
            error: error instanceof Error ? error.message.split('\n')[0] ?? error.message : String(error),
            durationMs: Date.now() - t0,
          };
        }
        results.push(result);
        opts.onStory?.(result, i, stories.length);
      }
      await page.close();
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
  return results;
}

/* ------------------------------------------------------ gate + reporting -- */

/** Allowlist file shape: { "allow": [{ "story": "...", "rule": "...", "reason": "..." }] }. */
export function loadAllowlist(path: string): AllowlistEntry[] {
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { allow?: AllowlistEntry[] };
  return parsed.allow ?? [];
}

function allowed(storyId: string, rule: string, allowlist: AllowlistEntry[]): boolean {
  return allowlist.some((a) => a.rule === rule && (a.story === '*' || a.story === storyId));
}

/**
 * The merge gate: serious/critical violations not covered by the allowlist.
 * Render errors also gate — a story that cannot render cannot be scanned,
 * and silently passing it would hide regressions.
 */
export function gateFailures(
  results: StoryAxeResult[],
  allowlist: AllowlistEntry[],
): GateFailure[] {
  const failures: GateFailure[] = [];
  for (const r of results) {
    if (r.status === 'render-error') {
      failures.push({ story: r.id, rule: 'story-render', impact: 'error', nodes: 0 });
      continue;
    }
    for (const v of r.violations) {
      if ((v.impact === 'serious' || v.impact === 'critical') && !allowed(r.id, v.rule, allowlist)) {
        failures.push({ story: r.id, rule: v.rule, impact: v.impact, nodes: v.nodes.length });
      }
    }
  }
  return failures;
}

export interface StoriesAxeSummary {
  stories: number;
  clean: number;
  withViolations: number;
  renderErrors: number;
  violations: number;
  byImpact: Record<string, number>;
}

export function summarize(results: StoryAxeResult[]): StoriesAxeSummary {
  const byImpact: Record<string, number> = {};
  let violations = 0;
  for (const r of results) {
    for (const v of r.violations) {
      violations++;
      const key = v.impact ?? 'unknown';
      byImpact[key] = (byImpact[key] ?? 0) + 1;
    }
  }
  return {
    stories: results.length,
    clean: results.filter((r) => r.status === 'clean').length,
    withViolations: results.filter((r) => r.status === 'violations').length,
    renderErrors: results.filter((r) => r.status === 'render-error').length,
    violations,
    byImpact,
  };
}

export function resultsMarkdown(
  results: StoryAxeResult[],
  meta: { date: string; gateFailures: GateFailure[]; allowlisted: number },
): string {
  const summary = summarize(results);
  const lines = [
    `# Stories axe report — ${meta.date}`,
    '',
    'Browser-run axe-core (WCAG 2.x A/AA tags) over every Storybook story, scoped to the story root (G6).',
    'Gate: any serious/critical violation (or render error) not covered by config/stories-axe-allowlist.json fails the run.',
    '',
    `- **Stories scanned:** ${summary.stories} (${summary.clean} clean, ${summary.withViolations} with violations, ${summary.renderErrors} render errors)`,
    `- **Violations:** ${summary.violations}${
      Object.keys(summary.byImpact).length > 0
        ? ` (${Object.entries(summary.byImpact)
            .map(([k, v]) => `${k} ${v}`)
            .join(', ')})`
        : ''
    }`,
    `- **Gate:** ${meta.gateFailures.length === 0 ? 'PASS' : `FAIL — ${meta.gateFailures.length} serious/critical finding(s)`}${
      meta.allowlisted > 0 ? ` (${meta.allowlisted} allowlisted)` : ''
    }`,
    '',
    '| Story | Status | Rule | Impact | Nodes | Detail |',
    '|---|---|---|---|---:|---|',
  ];
  for (const r of results) {
    if (r.status === 'clean') {
      lines.push(`| ${r.id} | clean | — | — | — | — |`);
    } else if (r.status === 'render-error') {
      lines.push(`| ${r.id} | RENDER ERROR | — | — | — | ${(r.error ?? '').replace(/\|/g, '\\|')} |`);
    } else {
      for (const v of r.violations) {
        lines.push(
          `| ${r.id} | violations | ${v.rule} | ${v.impact ?? 'n/a'} | ${v.nodes.length} | ${v.help.replace(/\|/g, '\\|')} |`,
        );
      }
    }
  }
  lines.push('');
  return lines.join('\n');
}
