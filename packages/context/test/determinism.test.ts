import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { compile } from '../src/compile.ts';
import { buildBundle, walk } from './helpers.ts';

describe('determinism', () => {
  const a = buildBundle();
  const b = buildBundle();
  afterAll(() => {
    a.cleanup();
    b.cleanup();
  });

  it('same inputs + same --now produce byte-identical output trees', () => {
    const filesA = walk(a.outDir);
    const filesB = walk(b.outDir);
    expect(filesB).toEqual(filesA);
    for (const rel of filesA) {
      const bufA = readFileSync(join(a.outDir, rel));
      const bufB = readFileSync(join(b.outDir, rel));
      expect(bufB.equals(bufA), `byte mismatch in ${rel}`).toBe(true);
    }
  });

  it('the manifest (including hashes and timestamp) is identical across builds', () => {
    const mA = readFileSync(join(a.outDir, 'manifest.json'), 'utf8');
    const mB = readFileSync(join(b.outDir, 'manifest.json'), 'utf8');
    expect(mB).toBe(mA);
  });

  it('rejects a non-ISO --now instead of emitting garbage timestamps', () => {
    expect(() => compile({ now: 'not-a-date', outDir: `${a.outDir}-bad` })).toThrow(/ISO/);
  });
});
