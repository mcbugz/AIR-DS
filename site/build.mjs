// AIR-DS public demo site — single static page built from the system itself.
//
//   node site/build.mjs   →  site/dist/index.html (+ bundle.js/css, tokens, assets)
//
// Same proven pattern as examples/brand-demo/build.mjs (ADR-006): real
// @ds/react components bundled once; BOTH brands' compiled tokens.css are
// copied next to the page and swapped live via a single <link> — the whole
// page re-themes because the page is built from the system.
//
// Credential-free: local files only, no CDNs, no network at runtime.
// Requires: pnpm install + pnpm build (customer-builds/acme is committed).
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
// esbuild is a devDependency of @ds/validate — resolve it from there so this
// script needs no node_modules of its own.
const require = createRequire(join(repo, 'tooling/validate/package.json'));
const { build } = await import(pathToFileURL(require.resolve('esbuild')).href);
const out = join(here, 'dist');
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [join(here, 'src/main.tsx')],
  bundle: true,
  outfile: join(out, 'bundle.js'),
  format: 'iife',
  jsx: 'automatic',
  minify: true,
  loader: { '.module.css': 'local-css' },
  alias: (() => {
    // pnpm isolates node_modules per package; resolve react/react-dom from
    // @ds/react's own dependency graph so the standalone entry can bundle.
    // Longest alias key wins, so the /icons subpath maps before the root.
    const rr = createRequire(join(repo, 'packages/react/package.json'));
    return {
      '@ds/react/icons': join(repo, 'packages/react/dist/icons/index.js'),
      '@ds/react': join(repo, 'packages/react/dist/index.js'),
      react: dirname(rr.resolve('react/package.json')),
      'react-dom': dirname(rr.resolve('react-dom/package.json')),
    };
  })(),
  plugins: [{
    // Tokens must NOT be baked into the bundle — the page links one brand's
    // tokens.css at a time; that swap being sufficient is the demo itself.
    name: 'tokens-external',
    setup(b) {
      b.onResolve({ filter: /^@ds\/tokens\/css$/ }, () => ({ path: 'ds-tokens-stub', namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: '', loader: 'css' }));
    },
  }],
  logLevel: 'silent',
});

// Both brands' compiled tokens, side by side; the page swaps the <link> href.
cpSync(join(repo, 'packages/tokens/dist/css/tokens.css'), join(out, 'tokens-default.css'));
cpSync(join(repo, 'customer-builds/acme/tokens/css/tokens.css'), join(out, 'tokens-acme.css'));
// The wordmark, reused verbatim from the repo docs.
cpSync(join(repo, 'docs/assets/air-ds-wordmark.svg'), join(out, 'air-ds-wordmark.svg'));
cpSync(join(repo, 'docs/AIR-DS-overview.pptx'), join(out, 'AIR-DS-overview.pptx'));
cpSync(join(repo, 'docs/assets/air-ds-banner.svg'), join(out, 'air-ds-banner.svg'));

// All references relative so the page works at https://<user>.github.io/AIR-DS/
// and from file://.
writeFileSync(join(out, 'index.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AIR-DS — the AI-ready, white-label design system</title>
<meta name="description" content="One neutral, token-driven design system with a complete AI consumption layer — MCP, llms.txt, skills, editor rules, closed-world registries — compiled from one source of truth and re-emitted per customer.">
<link rel="icon" href="./air-ds-banner.svg" type="image/svg+xml">
<link id="ds-tokens" rel="stylesheet" href="./tokens-default.css">
<link rel="stylesheet" href="./bundle.css">
<style>:root{color-scheme:light}body{margin:0;background:var(--ds-color-surface-default)}</style>
</head>
<body><div id="root"></div><script src="./bundle.js"></script></body>
</html>
`);

console.log('demo site built:', out);
