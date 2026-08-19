import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { collectFleet } from '../src/collect.ts';
import { buildDashboard } from '../src/render/build.ts';

/**
 * Render smoke: bundle the real dashboard (real @ds/react components, real
 * @ds/tokens variables) from the fixture fleet into a scratch dir. Requires
 * the workspace to be built (@ds/react dist + @ds/tokens dist), same
 * precondition as site/build.mjs.
 */

const here = join(fileURLToPath(import.meta.url), '..');
const repoDir = (id: string) => join(here, '..', 'fixtures', 'repos', id);

const tmp = mkdtempSync(join(tmpdir(), 'ds-fleet-render-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('buildDashboard', () => {
  it('emits a self-contained static page from fleet data', { timeout: 60_000 }, async () => {
    const data = collectFleet([
      { id: 'atlas-checkout', root: repoDir('atlas-checkout') },
      { id: 'comet-storefront', root: repoDir('comet-storefront') },
    ]);
    const out = await buildDashboard({ outDir: join(tmp, 'dash'), data });

    for (const f of ['index.html', 'bundle.js', 'bundle.css', 'data.js']) {
      expect(existsSync(join(out, f)), `${f} should exist`).toBe(true);
    }

    const html = readFileSync(join(out, 'index.html'), 'utf8');
    expect(html).toContain('<title>AIR-DS fleet control plane</title>');
    expect(html).toContain('./data.js'); // data loads before the bundle
    expect(html.indexOf('data.js')).toBeLessThan(html.indexOf('bundle.js'));
    // Self-contained: no external URLs in the page skeleton.
    expect(html).not.toMatch(/https?:\/\//);

    const dataJs = readFileSync(join(out, 'data.js'), 'utf8');
    expect(dataJs).toContain('window.__FLEET_DATA__');
    expect(dataJs).toContain('"comet-storefront"');

    // Dogfood proof: the design system's tokens are inside the bundled CSS.
    const css = readFileSync(join(out, 'bundle.css'), 'utf8');
    expect(css).toContain('--ds-color-surface-default');
    expect(css).toContain('.fleet-scorecard');
  });
});
