/**
 * Axe column for the benchmark scoreboard (feedback-backlog: "Benchmark axe
 * column needs a rendering harness").
 *
 * Each scored output directory is rendered in a minimal static harness:
 * esbuild bundles the recorded .tsx screens together with @ds/react (dist)
 * and the compiled token CSS into one self-contained page, then a locally
 * installed Playwright chromium loads it from file:// and runs axe-core
 * (WCAG 2.x A/AA tags) against the live DOM.
 *
 * Credential-free by design:
 *   - no network at runtime: the page is a local file, axe-core is injected
 *     from node_modules, the browser is a local binary
 *   - the ONE optional local dependency is the chromium binary
 *     (`npx playwright install chromium`); when it is missing — or bundling
 *     fails (e.g. fabricated imports cannot resolve) — the column reports
 *     "skipped (…)" and NEVER fails the run.
 */

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

export interface AxeResult {
  pass: boolean | null;
  /** Human-readable detail: violation rule ids, or the skip reason. */
  detail: string;
}

export interface AxeAvailability {
  available: boolean;
  reason?: string;
}

interface ChromiumLike {
  executablePath(): string;
  launch(opts?: { headless?: boolean }): Promise<{
    newPage(): Promise<{
      goto(url: string): Promise<unknown>;
      addScriptTag(opts: { content: string }): Promise<unknown>;
      evaluate<T>(fn: string): Promise<T>;
      waitForTimeout(ms: number): Promise<void>;
      close(): Promise<void>;
    }>;
    close(): Promise<void>;
  }>;
}

function loadChromium(): ChromiumLike | null {
  try {
    return (require('playwright') as { chromium: ChromiumLike }).chromium;
  } catch {
    return null;
  }
}

/** Is browser-run axe scoring possible in this environment? Never throws. */
export function checkAxeAvailability(): AxeAvailability {
  const chromium = loadChromium();
  if (!chromium) {
    return { available: false, reason: 'no browser (playwright not installed)' };
  }
  try {
    const exe = chromium.executablePath();
    if (!exe || !existsSync(exe)) {
      return {
        available: false,
        reason: 'no browser (run: npx playwright install chromium)',
      };
    }
  } catch {
    return { available: false, reason: 'no browser (run: npx playwright install chromium)' };
  }
  try {
    require.resolve('esbuild');
    require.resolve('axe-core');
  } catch {
    return { available: false, reason: 'harness deps missing (esbuild/axe-core) — run pnpm install' };
  }
  return { available: true };
}

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.tsx')) out.push(full);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

/** Generate the harness entry: render every uppercase function export of every screen module. */
function entrySource(files: string[], repoRoot: string): string {
  const tokensCss = join(repoRoot, 'packages', 'tokens', 'dist', 'css', 'tokens.css');
  const reactCss = join(repoRoot, 'packages', 'react', 'dist', 'index.css');
  const cssImports = [tokensCss, reactCss]
    .filter((p) => existsSync(p))
    .map((p) => `import ${JSON.stringify(p)};`)
    .join('\n');
  const modImports = files.map((f, i) => `import * as M${i} from ${JSON.stringify(f)};`).join('\n');
  const modList = files.map((_, i) => `M${i}`).join(', ');
  return `
import React from 'react';
import { createRoot } from 'react-dom/client';
${cssImports}
${modImports}
const mods = [${modList}];
const children = [];
for (const mod of mods) {
  for (const key of Object.keys(mod)) {
    const value = mod[key];
    if (typeof value === 'function' && /^[A-Z]/.test(key)) {
      children.push(React.createElement(value, { key: key + children.length }));
    }
  }
}
createRoot(document.getElementById('root')).render(
  React.createElement(React.Fragment, null, children),
);
`;
}

const HARNESS_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>AIR-DS benchmark axe harness</title>
    <link rel="stylesheet" href="./bundle.css" />
  </head>
  <body>
    <main><div id="root"></div></main>
    <script src="./bundle.js"></script>
  </body>
</html>
`;

/**
 * Bundle + render + axe-score each output dir. Returns one AxeResult per
 * input key. Per-directory failures degrade to skip results; only truly
 * unexpected harness errors reject (callers catch and skip the column).
 */
export async function runAxeScoring(
  outputs: { key: string; dir: string }[],
  opts: { repoRoot: string; workDir: string },
): Promise<Map<string, AxeResult>> {
  const results = new Map<string, AxeResult>();
  const esbuild = (await import('esbuild')) as typeof import('esbuild');
  const chromium = loadChromium();
  if (!chromium) throw new Error('playwright unavailable');
  const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

  rmSync(opts.workDir, { recursive: true, force: true });
  mkdirSync(opts.workDir, { recursive: true });

  // 1. Bundle every output dir first (cheap, no browser needed).
  const pages = new Map<string, string>(); // key -> harness dir
  for (const output of outputs) {
    const files = tsxFiles(output.dir);
    if (files.length === 0) {
      results.set(output.key, { pass: null, detail: 'skipped (no .tsx screens)' });
      continue;
    }
    const harnessDir = join(opts.workDir, output.key.replace(/[^a-z0-9-]+/gi, '_'));
    mkdirSync(harnessDir, { recursive: true });
    const entryPath = join(harnessDir, 'entry.jsx');
    writeFileSync(entryPath, entrySource(files, opts.repoRoot), 'utf8');
    try {
      await esbuild.build({
        entryPoints: [entryPath],
        bundle: true,
        outfile: join(harnessDir, 'bundle.js'),
        format: 'iife',
        jsx: 'automatic',
        logLevel: 'silent',
        alias: {
          '@ds/react': join(opts.repoRoot, 'packages', 'react', 'dist', 'index.js'),
          '@ds/tokens/css': join(opts.repoRoot, 'packages', 'tokens', 'dist', 'css', 'tokens.css'),
          '@ds/tokens': join(opts.repoRoot, 'packages', 'tokens', 'dist', 'index.js'),
        },
        loader: { '.js': 'jsx' },
        define: { 'process.env.NODE_ENV': '"production"' },
      });
      writeFileSync(join(harnessDir, 'index.html'), HARNESS_HTML, 'utf8');
      pages.set(output.key, harnessDir);
    } catch (error) {
      const msg = error instanceof Error ? error.message.split('\n')[0] : String(error);
      results.set(output.key, { pass: null, detail: `skipped (bundle failed: ${msg})` });
    }
  }

  if (pages.size === 0) return results;

  // 2. One browser for all pages.
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [key, harnessDir] of pages) {
      const page = await browser.newPage();
      try {
        await page.goto(pathToFileURL(join(harnessDir, 'index.html')).href);
        await page.waitForTimeout(250); // allow React to mount
        await page.addScriptTag({ content: axeSource });
        const violations = await page.evaluate<{ id: string; impact: string | null; nodes: number }[]>(
          `axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag21a', 'wcag2aa', 'wcag21aa'] } })
             .then(r => r.violations.map(v => ({ id: v.id, impact: v.impact ?? null, nodes: v.nodes.length })))`,
        );
        results.set(
          key,
          violations.length === 0
            ? { pass: true, detail: 'axe clean (WCAG 2.x A/AA tags)' }
            : {
                pass: false,
                detail: violations.map((v) => `${v.id} (${v.impact ?? 'n/a'}, ${v.nodes} node(s))`).join('; '),
              },
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message.split('\n')[0] : String(error);
        results.set(key, { pass: null, detail: `skipped (render failed: ${msg})` });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  return results;
}

export function axeWorkDir(pkgRoot: string): string {
  return resolve(pkgRoot, 'benchmark-results', '.axe-harness');
}
