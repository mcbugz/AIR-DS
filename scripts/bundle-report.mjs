// Bundle-size report: dist sizes per publishable package + the compiled
// context artifacts. Credential-free, offline. Writes metrics/bundle-report.json
// and prints a table. Run after `pnpm build`.
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function dirSize(dir) {
  let bytes = 0, files = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else { bytes += statSync(p).size; files += 1; }
    }
  };
  try { walk(dir); } catch { return null; }
  return { bytes, files };
}

const targets = {
  '@ds/tokens dist': 'packages/tokens/dist',
  '@ds/react dist': 'packages/react/dist',
  '@ds/mcp dist': 'packages/mcp/dist',
  '@ds/context compiler src (runs via node type-stripping, no dist)': 'packages/context/src',
  'context artifacts (default brand)': 'packages/context/dist/default',
  'registries/': 'registries',
};

const report = { generatedFrom: 'scripts/bundle-report.mjs', entries: {} };
const rows = [];
for (const [label, rel] of Object.entries(targets)) {
  const s = dirSize(join(repo, rel));
  report.entries[label] = s ? { path: rel, ...s } : { path: rel, missing: true };
  rows.push([label, s ? `${(s.bytes / 1024).toFixed(1)} KB` : 'missing', s ? `${s.files} files` : '—']);
}
writeFileSync(join(repo, 'metrics', 'bundle-report.json'), JSON.stringify(report, null, 2) + '\n');
const w = Math.max(...rows.map(r => r[0].length));
for (const [a, b, c] of rows) console.log(a.padEnd(w + 2) + b.padStart(10) + '  ' + c);
console.log('\nwritten: metrics/bundle-report.json');
