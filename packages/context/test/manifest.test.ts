import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { sha256 } from '../src/hash.ts';
import { buildBundle, FIXED_NOW, readOut, walk } from './helpers.ts';
import type { Manifest } from '../src/types.ts';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');

describe('manifest', () => {
  const bundle = buildBundle();
  afterAll(() => bundle.cleanup());
  const manifest = JSON.parse(readOut(bundle.outDir, 'manifest.json')) as Manifest;

  it('records brand, compiler, and the --now timestamp', () => {
    expect(manifest.brand).toBe('default');
    expect(manifest.compiler).toMatch(/^@ds\/context@/);
    expect(manifest.generatedAt).toBe(FIXED_NOW);
    expect(manifest.sourceHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('lists every emitted file (except itself) and nothing else', () => {
    const onDisk = walk(bundle.outDir).filter((f) => f !== 'manifest.json');
    expect(manifest.files.map((f) => f.path)).toEqual(onDisk);
  });

  it('every emitted-file hash verifies against the bytes on disk', () => {
    for (const f of manifest.files) {
      const buf = readFileSync(join(bundle.outDir, f.path));
      expect(sha256(buf), f.path).toBe(f.sha256);
      expect(buf.length, f.path).toBe(f.bytes);
    }
  });

  it('every source-input hash verifies against the repo', () => {
    expect(manifest.inputs.length).toBeGreaterThanOrEqual(20); // registries, brand, specs, stories…
    for (const input of manifest.inputs) {
      const buf = readFileSync(join(REPO_ROOT, input.path));
      expect(sha256(buf), input.path).toBe(input.sha256);
    }
  });

  it('registry copies in the bundle are byte-identical to the source registries', () => {
    for (const reg of [
      'registries/tokens-index.json',
      'registries/components-index.json',
      'registries/contrast-report.json',
    ]) {
      expect(readOut(bundle.outDir, reg)).toBe(readFileSync(join(REPO_ROOT, reg), 'utf8'));
    }
  });
});
