/** Schema-compat: the synthesized registries must match the canonical
 *  registries/*.json shapes EXACTLY (field names, types, enum domains) so
 *  @ds/context and @ds/mcp consume them unchanged. The canonical files in
 *  <repo>/registries are the source of truth for the expected shape. */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { runRetrofit } from '../src/pipeline.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '../../..');
const FIXTURE = join(REPO, 'examples/legacy-ds');

const outDir = mkdtempSync(join(tmpdir(), 'retrofit-schema-'));
// context off: this test is about registry shapes only (e2e covers context)
runRetrofit(FIXTURE, { outDir, context: false });

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

function load(rel: string, root: string): unknown {
  return JSON.parse(readFileSync(join(root, rel), 'utf8'));
}

type Obj = Record<string, unknown>;

/** Structural type tag compatible across both registries. */
function tag(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

describe('tokens-index.json schema compatibility', () => {
  const canonical = load('registries/tokens-index.json', REPO) as Obj;
  const emitted = load('registries/tokens-index.json', outDir) as Obj;

  it('has the canonical top-level fields with matching types', () => {
    for (const key of Object.keys(canonical)) {
      expect(Object.keys(emitted), `missing top-level ${key}`).toContain(key);
      expect(tag(emitted[key])).toBe(tag(canonical[key]));
    }
  });

  it('every token entry carries the canonical fields with canonical types', () => {
    const canonicalEntry = (canonical['tokens'] as Obj[])[0] as Obj;
    const tokens = emitted['tokens'] as Obj[];
    expect(tokens.length).toBeGreaterThan(0);
    expect(emitted['count']).toBe(tokens.length);
    for (const t of tokens) {
      for (const key of Object.keys(canonicalEntry)) {
        expect(Object.keys(t), `token missing ${key}`).toContain(key);
      }
      expect(typeof t['name']).toBe('string');
      expect(typeof t['cssVar']).toBe('string');
      expect((t['cssVar'] as string).startsWith('--')).toBe(true);
      expect(['semantic', 'component']).toContain(t['tier']);
      expect(typeof t['type']).toBe('string');
      expect(typeof t['description']).toBe('string');
      expect(['string', 'number']).toContain(typeof t['value']);
    }
  });
});

describe('components-index.json schema compatibility', () => {
  const canonical = load('registries/components-index.json', REPO) as Obj;
  const emitted = load('registries/components-index.json', outDir) as Obj;

  it('has the canonical top-level fields', () => {
    for (const key of Object.keys(canonical)) {
      expect(Object.keys(emitted)).toContain(key);
      expect(tag(emitted[key])).toBe(tag(canonical[key]));
    }
  });

  it('entries match the canonical component shape (storyFile optional)', () => {
    const components = emitted['components'] as Obj[];
    expect(components.length).toBeGreaterThan(0);
    for (const c of components) {
      expect(typeof c['name']).toBe('string');
      expect(typeof c['description']).toBe('string');
      expect(c['racBase']).toBeNull();
      expect(c['racPropsNote']).toBeNull();
      expect(c['racProps']).toBeNull();
      expect(c['tokenPrefix']).toBeNull();
      expect(typeof c['example']).toBe('string');
      if ('storyFile' in c) expect(typeof c['storyFile']).toBe('string');
      for (const p of c['props'] as Obj[]) {
        expect(Object.keys(p).sort()).toEqual(['defaultValue', 'description', 'name', 'required', 'type']);
        expect(typeof p['name']).toBe('string');
        expect(typeof p['type']).toBe('string');
        expect(typeof p['required']).toBe('boolean');
        expect(p['defaultValue'] === null || typeof p['defaultValue'] === 'string').toBe(true);
        expect(typeof p['description']).toBe('string');
      }
    }
  });
});

describe('contrast-report.json schema compatibility', () => {
  const canonical = load('registries/contrast-report.json', REPO) as Obj;
  const emitted = load('registries/contrast-report.json', outDir) as Obj;

  it('has the canonical top-level fields with matching types', () => {
    for (const key of Object.keys(canonical)) {
      expect(Object.keys(emitted)).toContain(key);
      expect(tag(emitted[key])).toBe(tag(canonical[key]));
    }
    expect(emitted['standard']).toBe(canonical['standard']);
    expect(emitted['threshold']).toBe(canonical['threshold']);
  });

  it('pairs, aliasIndex, unaudited match the canonical entry shapes', () => {
    const canonicalPair = (canonical['pairs'] as Obj[])[0] as Obj;
    for (const p of emitted['pairs'] as Obj[]) {
      for (const key of Object.keys(canonicalPair)) {
        expect(Object.keys(p), `pair missing ${key}`).toContain(key);
      }
      expect(typeof p['ratio']).toBe('number');
      expect(typeof p['pass']).toBe('boolean');
      const rt = p['resolvesTo'] as Obj;
      expect(Array.isArray(rt['foreground'])).toBe(true);
      expect(Array.isArray(rt['background'])).toBe(true);
    }
    for (const [k, v] of Object.entries(emitted['aliasIndex'] as Obj)) {
      expect(k.startsWith('--')).toBe(true);
      expect(Array.isArray(v)).toBe(true);
    }
    for (const u of emitted['unaudited'] as Obj[]) {
      expect(typeof u['name']).toBe('string');
      expect(typeof u['cssVar']).toBe('string');
      expect(typeof u['reason']).toBe('string');
    }
    expect(emitted['failures']).toBe((emitted['pairs'] as Obj[]).filter((p) => p['pass'] === false).length);
  });
});
