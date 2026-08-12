/**
 * Registry contract tests: the committed registries/icons-metadata.json and
 * registries/patterns-index.json are exactly what the compiler
 * (scripts/generate-icons.ts) produces from the sources in this repo —
 * deterministic, in sync, and closed-world (every pattern citation exists
 * in the component/token registries).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildIconsMetadata,
  buildPatternsIndex,
} from '../../scripts/generate-icons';
import * as icons from './index';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..', '..');
const registriesDir = path.join(repoRoot, 'registries');

function committed(file: string): string {
  return readFileSync(path.join(registriesDir, file), 'utf8');
}

function emitted(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

describe('registries/icons-metadata.json', () => {
  it('matches a fresh regeneration exactly (committed file is current)', () => {
    expect(committed('icons-metadata.json')).toBe(emitted(buildIconsMetadata()));
  });

  it('regenerates deterministically', () => {
    expect(emitted(buildIconsMetadata())).toBe(emitted(buildIconsMetadata()));
  });

  it('keeps the format contract: $description, count, icons[]', () => {
    const metadata = buildIconsMetadata();
    expect(Object.keys(metadata)).toEqual(['$description', 'count', 'icons']);
    expect(metadata.count).toBe(metadata.icons.length);
    for (const icon of metadata.icons) {
      expect(Object.keys(icon)).toEqual([
        'name',
        'export',
        'keywords',
        'sizes',
        'since',
      ]);
      expect(icon.keywords.length).toBeGreaterThan(0);
      expect(icon.sizes).toEqual(['sm', 'md', 'lg']);
      expect(icon.since).toBe('0.1.0');
    }
  });

  it('is closed-world against the barrel: every entry is exported, every export listed', () => {
    const metadata = buildIconsMetadata();
    const runtimeExports = Object.entries(icons)
      .filter(([, value]) => typeof value === 'function')
      .map(([name]) => name)
      .sort();
    expect(metadata.icons.map((i) => i.export).sort()).toEqual(runtimeExports);
  });

  it('lists icons sorted by name with sorted keywords', () => {
    const { icons: entries } = buildIconsMetadata();
    const names = entries.map((i) => i.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
    for (const icon of entries) {
      expect(icon.keywords).toEqual(
        [...icon.keywords].sort((a, b) => a.localeCompare(b, 'en')),
      );
    }
  });
});

describe('registries/patterns-index.json', () => {
  it('matches a fresh regeneration exactly (committed file is current)', () => {
    expect(committed('patterns-index.json')).toBe(emitted(buildPatternsIndex()));
  });

  it('regenerates deterministically', () => {
    expect(emitted(buildPatternsIndex())).toBe(emitted(buildPatternsIndex()));
  });

  it('keeps the format contract: $description, count, patterns[]', () => {
    const index = buildPatternsIndex();
    expect(Object.keys(index)).toEqual(['$description', 'count', 'patterns']);
    expect(index.count).toBe(index.patterns.length);
    for (const pattern of index.patterns) {
      expect(Object.keys(pattern)).toEqual([
        'id',
        'title',
        'components',
        'tokensUsed',
        'docFile',
        'keywords',
      ]);
      expect(pattern.components.length).toBeGreaterThan(0);
      expect(pattern.keywords.length).toBeGreaterThan(0);
    }
  });

  it('covers the six v1 patterns', () => {
    expect(buildPatternsIndex().patterns.map((p) => p.id)).toEqual([
      'choice-group',
      'destructive-confirmation',
      'form-section',
      'inline-validation',
      'settings-toggle-group',
      'status-banner',
    ]);
  });

  it("every pattern's components exist in components-index.json", () => {
    const componentsIndex = JSON.parse(committed('components-index.json')) as {
      components: Array<{ name: string }>;
    };
    const known = new Set(componentsIndex.components.map((c) => c.name));
    for (const pattern of buildPatternsIndex().patterns) {
      for (const component of pattern.components) {
        expect(known, `${pattern.id} cites ${component}`).toContain(component);
      }
    }
  });

  it("every pattern's tokensUsed exist in tokens-index.json", () => {
    const tokensIndex = JSON.parse(committed('tokens-index.json')) as {
      tokens: Array<{ cssVar: string }>;
    };
    const known = new Set(tokensIndex.tokens.map((t) => t.cssVar));
    for (const pattern of buildPatternsIndex().patterns) {
      for (const token of pattern.tokensUsed) {
        expect(known, `${pattern.id} cites ${token}`).toContain(token);
      }
    }
  });

  it('every docFile exists on disk', () => {
    for (const pattern of buildPatternsIndex().patterns) {
      expect(
        existsSync(path.join(repoRoot, pattern.docFile)),
        pattern.docFile,
      ).toBe(true);
    }
  });
});
