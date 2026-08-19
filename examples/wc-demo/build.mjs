// M5 portability proof, web-component half: the SAME <ds-button> custom
// element rendered under two brands. The only difference between the panes is
// which brand's Shadow-DOM token build (dist/wc/tokens.css) is fed to
// provideTokenStyles() — the stylesheet-swap trick from examples/brand-demo,
// one shadow boundary deeper (tokens are adopted INTO each component's shadow
// root via adoptedStyleSheets; the file's :root fallback would work for a
// plain <link> too).
//
//   node examples/wc-demo/build.mjs   →  examples/wc-demo/dist/index.html
//
// Credential-free: local files only; requires nothing beyond pnpm install
// (both brands' token builds run hermetically in here, and the element is
// bundled straight from packages/wc/src — no prior package build needed).
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
// esbuild is a devDependency of @ds/validate — resolve it from there so this
// script needs no node_modules of its own (brand-demo pattern).
const require = createRequire(join(repo, 'tooling/validate/package.json'));
const { build } = await import(pathToFileURL(require.resolve('esbuild')).href);
const out = join(here, 'dist');
mkdirSync(out, { recursive: true });

// 1. Hermetic token builds for both brands — same resolver, --brand swapped.
//    dist/registries land INSIDE the demo dir; the workspace registries and
//    packages/tokens/dist are never written.
const { buildTokens } = await import(
  pathToFileURL(join(repo, 'packages/tokens/src/build/build.ts')).href
);
for (const brand of ['default', 'acme']) {
  buildTokens({
    brandPath: join(repo, 'brands', `${brand}.json`),
    distDir: join(out, 'tokens', brand),
    registriesDir: join(out, 'tokens', brand, 'registries'),
  });
}

// 2. One bundle per brand: identical element code, different adopted tokens.
for (const brand of ['default', 'acme']) {
  const entry = `
import { provideTokenStyles } from '${join(repo, 'packages/wc/src/index.ts').replace(/\\/g, '/')}';
// The Shadow-DOM token build, inlined as text and adopted into every
// component shadow root (constructable stylesheet; <style> fallback).
import tokensCss from '${join(out, 'tokens', brand, 'wc/tokens.css').replace(/\\/g, '/')}';
provideTokenStyles(tokensCss);
`;
  writeFileSync(join(out, `entry-${brand}.ts`), entry);
  await build({
    entryPoints: [join(out, `entry-${brand}.ts`)],
    bundle: true,
    outfile: join(out, `bundle-${brand}.js`),
    format: 'iife',
    loader: { '.css': 'text' },
    logLevel: 'silent',
  });
}

// 3. Identical showcase markup for both panes — brand is ONLY the bundle.
const showcase = `
  <section>
    <h3>Variants</h3>
    <ds-button variant="primary">Primary</ds-button>
    <ds-button variant="secondary">Secondary</ds-button>
    <ds-button variant="ghost">Ghost</ds-button>
    <ds-button variant="danger">Danger</ds-button>
  </section>
  <section>
    <h3>Sizes</h3>
    <ds-button size="sm">Small</ds-button>
    <ds-button size="md">Medium</ds-button>
    <ds-button size="lg">Large</ds-button>
  </section>
  <section>
    <h3>States</h3>
    <ds-button loading>Saving…</ds-button>
    <ds-button disabled>Disabled</ds-button>
    <ds-button variant="secondary" loading>Loading</ds-button>
    <ds-button variant="danger" disabled>Disabled</ds-button>
  </section>
  <section>
    <h3>Events (native click, suppressed while disabled/loading)</h3>
    <ds-button id="counter" variant="secondary">Clicked 0 times</ds-button>
  </section>
  <script>
    const counter = document.getElementById('counter');
    let n = 0;
    counter.addEventListener('click', () => { counter.textContent = 'Clicked ' + (++n) + ' times'; });
  </script>`;

const page = (brand) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>ds-button · ${brand}</title>
<style>
  :root{color-scheme:light}
  body{margin:0;padding:16px;font-family:system-ui;background:#fff}
  h3{font-size:12px;font-weight:600;color:#555;margin:16px 0 8px}
  section ds-button{margin-inline-end:8px}
</style>
</head><body>
${showcase}
<script src="./bundle-${brand}.js"></script>
</body></html>`;
writeFileSync(join(out, 'default.html'), page('default'));
writeFileSync(join(out, 'acme.html'), page('acme'));

writeFileSync(join(out, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>AIR-DS web-component portability proof</title>
<style>
  :root{color-scheme:light}
  body{margin:0;font-family:system-ui;display:grid;grid-template-rows:auto 1fr;height:100vh}
  header{padding:10px 16px;border-bottom:1px solid #ddd;font-size:14px;background:#fff}
  main{display:grid;grid-template-columns:1fr 1fr;height:100%}
  section{display:grid;grid-template-rows:auto 1fr;border-right:1px solid #ddd}
  h2{margin:0;padding:8px 16px;font-size:13px;font-weight:600;color:#555;background:#fafafa;border-bottom:1px solid #eee}
  iframe{width:100%;height:100%;border:0}
</style></head><body>
<header><strong>AIR-DS portability proof (M5)</strong> — the same framework-free &lt;ds-button&gt; in both panes; each adopts a different brand's Shadow-DOM token build (dist/wc/tokens.css) via adoptedStyleSheets. Same DTCG graph, same registry discipline, new render target.</header>
<main>
  <section><h2>brands/default.json — neutral core</h2><iframe src="./default.html" title="Default brand"></iframe></section>
  <section><h2>brands/acme.json — customer brand, zero component changes</h2><iframe src="./acme.html" title="Acme brand"></iframe></section>
</main></body></html>`);
console.log('wc demo built:', out);
