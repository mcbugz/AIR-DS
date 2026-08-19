// Informational dogfood check: run @ds/validate's validateFiles over the
// site's own source (TSX + CSS) against the live workspace registries. The
// site is not a component package, so this is not merge-blocking — but the
// page claims to be built from the system, so it should hold to the rules.
//
//   node site/validate-site.mjs
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const { validateFiles } = await import(
  pathToFileURL(join(repo, 'tooling/validate/dist/validate.js')).href
);

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx|ts|css)$/.test(name)) files.push(p);
  }
})(join(here, 'src'));

const result = validateFiles(files, { root: repo });
console.log(`validateFiles over ${files.length} site source files:`);
if (result.violations.length === 0) {
  console.log('  verdict: CLEAN — 0 violations');
} else {
  console.log(`  verdict: ${result.violations.length} violation(s)`);
  for (const v of result.violations) {
    console.log(`  - [${v.rule}${v.nr ? `/${v.nr}` : ''}] ${v.file}:${v.line} ${v.message}`);
  }
  process.exitCode = 1;
}
