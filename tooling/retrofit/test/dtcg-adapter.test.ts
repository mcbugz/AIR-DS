import { describe, expect, it } from 'vitest';
import { dtcgTokens, looksLikeTokenTree } from '../src/dtcg-adapter.js';

const DTCG = JSON.stringify(
  {
    color: {
      $type: 'color',
      brand: {
        primary: { $value: '#1a56db', $description: 'Primary brand color' },
        emphasis: { $value: '{color.brand.primary}' },
      },
    },
    space: {
      sm: { $value: '8px', $type: 'dimension' },
    },
    broken: {
      alias: { $value: '{does.not.exist}' },
    },
  },
  null,
  2,
);

describe('looksLikeTokenTree', () => {
  it('detects $value trees and rejects ordinary JSON', () => {
    expect(looksLikeTokenTree(JSON.parse(DTCG))).toBe(true);
    expect(looksLikeTokenTree({ name: 'pkg', version: '1.0.0' })).toBe(false);
  });
});

describe('dtcgTokens', () => {
  const result = dtcgTokens(DTCG, 'tokens/core.json');

  it('converts leaves with inherited $type and proposed vars', () => {
    const primary = result.tokens.find((t) => t.cssVar === '--color-brand-primary');
    expect(primary).toMatchObject({ type: 'color', value: '#1a56db', tier: 'semantic' });
    expect(primary?.provenance).toMatchObject({ adapter: 'dtcg', proposed: true, declaredAs: 'color.brand.primary' });
    const sm = result.tokens.find((t) => t.cssVar === '--space-sm');
    expect(sm?.type).toBe('dimension');
  });

  it('resolves {path} aliases within the set', () => {
    const emphasis = result.tokens.find((t) => t.cssVar === '--color-brand-emphasis');
    expect(emphasis?.value).toBe('#1a56db');
  });

  it('reports unresolvable aliases', () => {
    expect(result.unresolvedAliases).toContain('broken.alias');
    const broken = result.tokens.find((t) => t.cssVar === '--broken-alias');
    expect(broken?.provenance.resolved).toBe(false);
  });

  it('is safe on invalid JSON', () => {
    expect(dtcgTokens('{ not json', 'x.json').tokens).toEqual([]);
  });
});
