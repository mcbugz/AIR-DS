import { afterAll, describe, expect, it } from 'vitest';
import { BUDGETS, estimateTokens } from '../src/config.ts';
import { buildBundle, readOut, walk } from './helpers.ts';

describe('token budgets and generated headers', () => {
  const bundle = buildBundle();
  afterAll(() => bundle.cleanup());

  it('llms.txt stays under the 2k-token index budget', () => {
    expect(estimateTokens(readOut(bundle.outDir, 'llms.txt'))).toBeLessThan(BUDGETS.index);
  });

  it('every concern slice stays under the 25k-token slice budget', () => {
    for (const slice of ['llms-components.txt', 'llms-tokens.txt', 'llms-theming.txt', 'llms-migration.txt']) {
      expect(estimateTokens(readOut(bundle.outDir, slice)), slice).toBeLessThan(BUDGETS.slice);
    }
  });

  it('manifest records the enforced budgets', () => {
    const manifest = JSON.parse(readOut(bundle.outDir, 'manifest.json'));
    expect(manifest.budgets).toEqual({ indexMaxTokens: BUDGETS.index, sliceMaxTokens: BUDGETS.slice });
  });

  it('every emitted markdown/text file carries a generated-do-not-edit header with the source hash', () => {
    const shortHash = bundle.report.sourceHash.slice(0, 16);
    const generated = walk(bundle.outDir).filter(
      (f) => (f.endsWith('.md') || f.endsWith('.txt') || f.endsWith('.mdc')) && !f.startsWith('registries/'),
    );
    expect(generated.length).toBeGreaterThan(30);
    for (const rel of generated) {
      const text = readOut(bundle.outDir, rel);
      expect(text, rel).toContain('GENERATED');
      expect(text, rel).toContain('DO NOT EDIT');
      expect(text, rel).toContain(shortHash);
    }
  });
});
