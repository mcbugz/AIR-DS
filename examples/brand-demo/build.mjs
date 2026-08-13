// White-label visual proof: the same compiled screen bundle rendered under two
// brands. The ONLY difference between the two pages is which brand's compiled
// tokens.css is linked — zero component or bundle changes (ADR-006).
//
//   node examples/brand-demo/build.mjs   →  examples/brand-demo/dist/index.html
//
// Credential-free: local files only. Requires pnpm install + pnpm build
// (plus customer-builds/acme from `ds-ingest run`, already committed).
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
// esbuild is a devDependency of @ds/validate — resolve it from there so this
// script needs no node_modules of its own.
const require = createRequire(join(repo, 'tooling/validate/package.json'));
const { build } = await import(pathToFileURL(require.resolve('esbuild')).href);
const out = join(here, 'dist');
mkdirSync(out, { recursive: true });

const entry = `
import { createRoot } from 'react-dom/client';
import { SettingsScreen } from '${join(repo, 'examples/reference-screen/SettingsScreen.tsx').replace(/\\/g, '/')}';
createRoot(document.getElementById('root')).render(<SettingsScreen />);
`;
writeFileSync(join(out, 'entry.tsx'), entry);

await build({
  entryPoints: [join(out, 'entry.tsx')],
  bundle: true,
  outfile: join(out, 'bundle.js'),
  format: 'iife',
  jsx: 'automatic',
  loader: { '.module.css': 'local-css' },
  alias: (() => {
    // pnpm isolates node_modules per package; resolve react/react-dom from
    // @ds/react's own dependency graph so the standalone entry can bundle.
    const rr = createRequire(join(repo, 'packages/react/package.json'));
    return {
      '@ds/react': join(repo, 'packages/react/dist/index.js'),
      react: dirname(rr.resolve('react/package.json')),
      'react-dom': dirname(rr.resolve('react-dom/package.json')),
    };
  })(),
  plugins: [{
    // Tokens must NOT be baked into the bundle — each page links its own
    // brand's tokens.css; that swap being sufficient is the proof itself.
    name: 'tokens-external',
    setup(b) {
      b.onResolve({ filter: /^@ds\/tokens\/css$/ }, () => ({ path: 'ds-tokens-stub', namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: '', loader: 'css' }));
    },
  }],
  logLevel: 'silent',
});

cpSync(join(repo, 'packages/tokens/dist/css/tokens.css'), join(out, 'tokens-default.css'));
cpSync(join(repo, 'customer-builds/acme/tokens/css/tokens.css'), join(out, 'tokens-acme.css'));

const page = (brand) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>AIR-DS · ${brand}</title>
<link rel="stylesheet" href="./tokens-${brand}.css">
<link rel="stylesheet" href="./bundle.css">
<style>:root{color-scheme:light}body{margin:0;background:var(--ds-color-surface-default)}</style>
</head><body><div id="root"></div><script src="./bundle.js"></script></body></html>`;
writeFileSync(join(out, 'default.html'), page('default'));
writeFileSync(join(out, 'acme.html'), page('acme'));

writeFileSync(join(out, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>AIR-DS white-label proof</title>
<style>
  :root{color-scheme:light}
  body{margin:0;font-family:system-ui;display:grid;grid-template-rows:auto 1fr;height:100vh}
  header{padding:10px 16px;border-bottom:1px solid #ddd;font-size:14px;background:#fff}
  main{display:grid;grid-template-columns:1fr 1fr;height:100%}
  section{display:grid;grid-template-rows:auto 1fr;border-right:1px solid #ddd}
  h2{margin:0;padding:8px 16px;font-size:13px;font-weight:600;color:#555;background:#fafafa;border-bottom:1px solid #eee}
  iframe{width:100%;height:100%;border:0}
</style></head><body>
<header><strong>AIR-DS white-label proof</strong> — identical component bundle; each pane links a different brand's compiled tokens.css. Customer = theme file (ADR-006).</header>
<main>
  <section><h2>brands/default.json — neutral core</h2><iframe src="./default.html" title="Default brand"></iframe></section>
  <section><h2>brands/acme.json — generated from acme-intake.json in 260ms</h2><iframe src="./acme.html" title="Acme brand"></iframe></section>
</main></body></html>`);
console.log('brand demo built:', out);
