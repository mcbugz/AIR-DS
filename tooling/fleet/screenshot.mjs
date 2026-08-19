// Local verification for the fleet dashboard (same pattern as
// site/screenshot.mjs): collect the fixture fleet, render, open the page
// from file:// in the Playwright Chromium already used by stories-axe,
// screenshot to preview.png (gitignored), and fail on any console error.
// Never part of the merge gauntlet.
//
//   pnpm --filter @ds/fleet run render:fixtures && node screenshot.mjs
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
// Playwright (and its installed chromium) is a devDependency of @ds/validate;
// borrow it so this package needs no second browser install (credential-free,
// single local browser — same trick as site/screenshot.mjs).
const require = createRequire(join(repo, 'tooling/validate/package.json'));
const pw = await import(pathToFileURL(require.resolve('playwright')).href);
const chromium = pw.chromium ?? pw.default.chromium;

const page404 = join(here, 'dist-dashboard/index.html');
if (!existsSync(page404)) {
  console.error('dist-dashboard/index.html missing — run: pnpm --filter @ds/fleet run render:fixtures');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1900 } });

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

await page.goto(pathToFileURL(page404).href);
await page.waitForSelector('.fleet-scorecard');
await page.waitForTimeout(300);
await page.screenshot({ path: join(here, 'preview.png'), fullPage: true });

await browser.close();

console.log('screenshot written:', join(here, 'preview.png'));
if (consoleErrors.length === 0) {
  console.log('console errors: none');
} else {
  console.log(`console errors (${consoleErrors.length}):`);
  for (const e of consoleErrors) console.log(' -', e);
  process.exitCode = 1;
}
