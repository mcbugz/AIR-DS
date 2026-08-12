import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { sha256 } from '../src/hash.ts';
import { buildBundle, readOut } from './helpers.ts';
import type { ComponentsIndex, Manifest } from '../src/types.ts';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');

/** Fixture registries dir: real registries + optional files + enrichment fields. */
function makeFixtureRegistries(opts: { enrich: boolean; iconCount: number }): string {
  const dir = mkdtempSync(join(tmpdir(), 'ds-context-fixture-reg-'));
  copyFileSync(join(REPO_ROOT, 'registries/tokens-index.json'), join(dir, 'tokens-index.json'));
  copyFileSync(join(REPO_ROOT, 'registries/contrast-report.json'), join(dir, 'contrast-report.json'));

  const components = JSON.parse(
    readFileSync(join(REPO_ROOT, 'registries/components-index.json'), 'utf8'),
  ) as ComponentsIndex;
  if (opts.enrich) {
    for (const comp of components.components) {
      if (comp.name === 'TextField') {
        comp.racProps = [
          { name: 'value', type: 'string' },
          { name: 'onChange', type: '(value: string) => void' },
          'autoFocus',
        ];
        comp.tokenPrefix = 'field';
      }
      if (comp.name === 'Button') {
        comp.tokenPrefix = 'button';
        comp.storyFile = 'packages/react/src/components/Button/Button.stories.tsx';
      }
      if (comp.name === 'Alert') comp.tokenPrefix = null;
    }
  }
  writeFileSync(join(dir, 'components-index.json'), JSON.stringify(components, null, 2) + '\n');

  const icons = Array.from({ length: opts.iconCount }, (_, i) => ({
    name: `icon-${String(i).padStart(4, '0')}`,
    description: `Fixture icon number ${i} for slice-budget tests`,
    keywords: ['fixture', `k${i % 7}`],
  }));
  writeFileSync(
    join(dir, 'icons-metadata.json'),
    JSON.stringify({ $description: 'fixture icons', icons }, null, 2) + '\n',
  );
  writeFileSync(
    join(dir, 'patterns-index.json'),
    JSON.stringify(
      {
        $description: 'fixture patterns',
        patterns: [
          {
            name: 'settings-form',
            description: 'Stacked labelled fields inside a Card, primary action in the CardFooter.',
            components: ['Card', 'CardBody', 'CardFooter', 'TextField', 'Button'],
          },
          { name: 'confirm-dialog', description: 'Dialog with a danger action.', components: ['Dialog', 'Button'] },
        ],
      },
      null,
      2,
    ) + '\n',
  );
  return dir;
}

describe('native brand inputs (--registries-dir / --brand-path)', () => {
  const fixtureDir = makeFixtureRegistries({ enrich: true, iconCount: 3 });
  const brandDir = mkdtempSync(join(tmpdir(), 'ds-context-fixture-brand-'));
  const brandPath = join(brandDir, 'acme-custom.json');
  copyFileSync(join(REPO_ROOT, 'brands/default.json'), brandPath);

  const bundle = buildBundle('acme-custom', { registriesDir: fixtureDir, brandPath });
  afterAll(() => {
    bundle.cleanup();
    rmSync(fixtureDir, { recursive: true, force: true });
    rmSync(brandDir, { recursive: true, force: true });
  });

  it('compiles from an external registries dir and brand file (no swap/restore)', () => {
    expect(bundle.report.brand).toBe('acme-custom');
    expect(existsSync(join(bundle.outDir, 'llms.txt'))).toBe(true);
  });

  it('manifest input paths record the ACTUAL read locations and verify against them', () => {
    const manifest = JSON.parse(readOut(bundle.outDir, 'manifest.json')) as Manifest;
    const paths = manifest.inputs.map((i) => i.path);
    expect(paths).toContain(join(fixtureDir, 'components-index.json'));
    expect(paths).toContain(join(fixtureDir, 'icons-metadata.json'));
    expect(paths).toContain(join(fixtureDir, 'patterns-index.json'));
    expect(paths).toContain(brandPath);
    for (const input of manifest.inputs) {
      const abs = input.path.startsWith('/') ? input.path : join(REPO_ROOT, input.path);
      expect(sha256(readFileSync(abs)), input.path).toBe(input.sha256);
    }
  });

  it('warns that the registry brand does not match the custom brand input (still green)', () => {
    expect(bundle.report.warnings.some((w) => w.includes(brandPath))).toBe(true);
  });

  it('ships byte-copies of the optional registries and drops the absence warnings', () => {
    expect(readOut(bundle.outDir, 'registries/icons-metadata.json')).toBe(
      readFileSync(join(fixtureDir, 'icons-metadata.json'), 'utf8'),
    );
    expect(readOut(bundle.outDir, 'registries/patterns-index.json')).toBe(
      readFileSync(join(fixtureDir, 'patterns-index.json'), 'utf8'),
    );
    expect(bundle.report.warnings.some((w) => w.includes('icons-metadata.json'))).toBe(false);
    expect(bundle.report.warnings.some((w) => w.includes('patterns-index.json'))).toBe(false);
    expect(bundle.report.warnings.some((w) => w.includes('older registry generation'))).toBe(false);
  });

  it('surfaces icons in llms-components.txt and the llms.txt index (small set rides inline)', () => {
    const slice = readOut(bundle.outDir, 'llms-components.txt');
    expect(slice).toContain('## Icons (3)');
    expect(slice).toContain('`icon-0000`');
    const index = readOut(bundle.outDir, 'llms.txt');
    expect(index).toContain('## Icons');
    expect(index).toContain('icons-metadata.json');
    expect(existsSync(join(bundle.outDir, 'llms-icons.txt'))).toBe(false);
  });

  it('surfaces patterns in the build-screen skill references and llms.txt', () => {
    const ref = readOut(bundle.outDir, 'skills/build-screen/references/patterns.md');
    expect(ref).toContain('**settings-form**');
    expect(ref).toContain('`CardFooter`');
    expect(readOut(bundle.outDir, 'skills/build-screen/SKILL.md')).toContain('references/patterns.md');
    expect(readOut(bundle.outDir, 'llms.txt')).toContain('## Patterns');
  });

  it('extension-points.json picks up the fixture patterns', () => {
    const contract = JSON.parse(readOut(bundle.outDir, 'extension-points.json')) as {
      composition: { patterns: { name: string }[] };
    };
    expect(contract.composition.patterns.map((p) => p.name)).toEqual(['confirm-dialog', 'settings-form']);
  });

  it('renders racProps / tokenPrefix enrichment in the docs twin and components slice', () => {
    const twin = readOut(bundle.outDir, 'docs/TextField.md');
    expect(twin).toContain('Inherited-but-legal');
    expect(twin).toContain('`onChange: (value: string) => void`');
    expect(twin).toContain('`autoFocus`');
    expect(twin).toContain('--ds-field-*');
    const slice = readOut(bundle.outDir, 'llms-components.txt');
    expect(slice).toContain('Inherited-but-legal');
    expect(readOut(bundle.outDir, 'docs/Button.md')).toContain('--ds-button-*');
    // tokenPrefix: null must NOT render a hooks line.
    expect(readOut(bundle.outDir, 'docs/Alert.md')).not.toContain('Theming hooks:');
  });

  it('a byte-identical external registry set reproduces the default sourceHash (swap/restore parity)', () => {
    const plainDir = mkdtempSync(join(tmpdir(), 'ds-context-fixture-plain-'));
    for (const f of ['tokens-index.json', 'components-index.json', 'contrast-report.json']) {
      copyFileSync(join(REPO_ROOT, 'registries', f), join(plainDir, f));
    }
    for (const f of ['icons-metadata.json', 'patterns-index.json']) {
      if (existsSync(join(REPO_ROOT, 'registries', f))) {
        copyFileSync(join(REPO_ROOT, 'registries', f), join(plainDir, f));
      }
    }
    const native = buildBundle('default', { registriesDir: plainDir });
    const defaults = buildBundle('default');
    try {
      expect(native.report.sourceHash).toBe(defaults.report.sourceHash);
    } finally {
      native.cleanup();
      defaults.cleanup();
      rmSync(plainDir, { recursive: true, force: true });
    }
  });
});

describe('icon slice budget fallback', () => {
  it('splits a large icon set into llms-icons.txt instead of blowing the components budget', () => {
    const bigDir = makeFixtureRegistries({ enrich: false, iconCount: 900 });
    const bundle = buildBundle('default', { registriesDir: bigDir });
    try {
      expect(existsSync(join(bundle.outDir, 'llms-icons.txt'))).toBe(true);
      const iconsSlice = readOut(bundle.outDir, 'llms-icons.txt');
      expect(iconsSlice).toContain('## Icons (900)');
      expect(readOut(bundle.outDir, 'llms-components.txt')).not.toContain('## Icons');
      expect(readOut(bundle.outDir, 'llms.txt')).toContain('llms-icons.txt');
      expect(readOut(bundle.outDir, 'llms-full.txt')).toContain('## Icons (900)');
    } finally {
      bundle.cleanup();
      rmSync(bigDir, { recursive: true, force: true });
    }
  });
});

describe('optional-registry degradation (adaptive to current workspace state)', () => {
  const hasIcons = existsSync(join(REPO_ROOT, 'registries/icons-metadata.json'));
  const hasPatterns = existsSync(join(REPO_ROOT, 'registries/patterns-index.json'));
  const bundle = buildBundle();
  afterAll(() => bundle.cleanup());

  it('build stays green and each absent optional registry produces a manifest warning', () => {
    const manifest = JSON.parse(readOut(bundle.outDir, 'manifest.json')) as Manifest;
    if (!hasIcons) {
      expect(manifest.warnings.some((w) => w.includes('icons-metadata.json'))).toBe(true);
      expect(readOut(bundle.outDir, 'llms.txt')).not.toContain('## Icons');
      expect(existsSync(join(bundle.outDir, 'registries/icons-metadata.json'))).toBe(false);
    } else {
      expect(readOut(bundle.outDir, 'llms.txt')).toContain('## Icons');
    }
    if (!hasPatterns) {
      expect(manifest.warnings.some((w) => w.includes('patterns-index.json'))).toBe(true);
      expect(readOut(bundle.outDir, 'llms.txt')).not.toContain('## Patterns');
      expect(existsSync(join(bundle.outDir, 'skills/build-screen/references/patterns.md'))).toBe(false);
    } else {
      expect(readOut(bundle.outDir, 'llms.txt')).toContain('## Patterns');
      expect(existsSync(join(bundle.outDir, 'skills/build-screen/references/patterns.md'))).toBe(true);
    }
  });
});
