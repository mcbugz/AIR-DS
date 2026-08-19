import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { FleetData } from '../types.ts';

/**
 * `ds-fleet render`: bundle the dashboard app (real @ds/react components,
 * real @ds/tokens variables — the control plane dogfoods the system it
 * governs) into a static single page. Same proven esbuild pattern as
 * site/build.mjs: local files only, no CDNs, no network at runtime.
 *
 * fleet-data.json is emitted as data.js (a window global loaded before the
 * bundle) so the page opens from file:// without fetch().
 */

export interface RenderOptions {
  outDir: string;
  data: FleetData;
}

/** Package root = nearest ancestor of this file holding our package.json. */
function packageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const p = join(dir, 'package.json');
    if (existsSync(p)) {
      try {
        if ((JSON.parse(readFileSync(p, 'utf8')) as { name?: string }).name === '@ds/fleet') return dir;
      } catch {
        /* keep walking */
      }
    }
    dir = dirname(dir);
  }
  throw new Error('could not locate @ds/fleet package root');
}

export async function buildDashboard(opts: RenderOptions): Promise<string> {
  const pkg = packageRoot();
  const require = createRequire(join(pkg, 'package.json'));
  const { build } = (await import(pathToFileURL(require.resolve('esbuild')).href)) as typeof import('esbuild');

  const out = opts.outDir;
  mkdirSync(out, { recursive: true });

  await build({
    // The dashboard is always bundled from the src tree (tsc output holds no
    // .css assets); esbuild strips the types itself.
    entryPoints: [join(pkg, 'src/dashboard/main.tsx')],
    bundle: true,
    outfile: join(out, 'bundle.js'),
    format: 'iife',
    jsx: 'automatic',
    minify: true,
    loader: { '.module.css': 'local-css' },
    logLevel: 'silent',
  });

  writeFileSync(
    join(out, 'data.js'),
    `window.__FLEET_DATA__ = ${JSON.stringify(opts.data)};\n`,
    'utf8',
  );

  writeFileSync(
    join(out, 'index.html'),
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AIR-DS fleet control plane</title>
<meta name="description" content="Fleet observability for AI-generated UI: hallucination rate, first-pass gauntlet rate, eval compliance, accessibility status, and policy compliance across every governed repo.">
<link rel="stylesheet" href="./bundle.css">
<style>:root{color-scheme:light}body{margin:0;background:var(--ds-color-surface-default)}</style>
</head>
<body><div id="root"></div><script src="./data.js"></script><script src="./bundle.js"></script></body>
</html>
`,
    'utf8',
  );

  return out;
}
