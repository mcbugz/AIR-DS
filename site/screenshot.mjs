// Local verification for the demo site: render site/dist/index.html from
// file:// in the Playwright Chromium already used by stories-axe, screenshot
// BOTH brand states (the acme state via the page's own window.__setBrand),
// and report any console errors. Never part of the merge gauntlet.
//
//   node site/build.mjs && node site/screenshot.mjs
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const require = createRequire(join(repo, 'tooling/validate/package.json'));
const pw = await import(pathToFileURL(require.resolve('playwright')).href);
const chromium = pw.chromium ?? pw.default.chromium;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

await page.goto(pathToFileURL(join(here, 'dist/index.html')).href);
await page.waitForSelector('.gallery-grid');
await page.waitForTimeout(300);
await page.screenshot({ path: join(here, 'preview-default.png') });

// Flip the brand exactly the way the hero buttons do, then wait for the
// swapped stylesheet to apply (accent flips from blue to acme green).
await page.evaluate(() => window.__setBrand('acme'));
await page.waitForFunction(() => {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue('--ds-color-accent-default')
    .trim();
  return v === '#28825a';
});
await page.waitForTimeout(300);
await page.screenshot({ path: join(here, 'preview-acme.png') });

await browser.close();

console.log('screenshots written:');
console.log(' ', join(here, 'preview-default.png'));
console.log(' ', join(here, 'preview-acme.png'));
if (consoleErrors.length === 0) {
  console.log('console errors: none');
} else {
  console.log(`console errors (${consoleErrors.length}):`);
  for (const e of consoleErrors) console.log(' -', e);
  process.exitCode = 1;
}
