import { describe, expect, it } from 'vitest';
import { tailwindTokens } from '../src/tailwind-adapter.js';

const CONFIG = `module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      brand: { DEFAULT: '#1a56db', 600: '#1a56db', 700: '#1e429f' },
      danger: '#b91c1c',
      dynamic: ({ opacityValue }) => \`rgba(0,0,0,\${opacityValue})\`,
    },
    extend: {
      spacing: { 18: '4.5rem' },
      borderRadius: { card: '6px' },
    },
  },
  plugins: [],
};
`;

describe('tailwindTokens', () => {
  const existing = new Map([['--legacy-blue', '#1a56db']]);
  const result = tailwindTokens(CONFIG, 'tailwind.config.js', existing);

  it('extracts literal theme values as proposed tokens', () => {
    const vars = result.tokens.map((t) => t.cssVar);
    expect(vars).toContain('--tw-color-brand');
    expect(vars).toContain('--tw-color-brand-600');
    expect(vars).toContain('--tw-color-brand-700');
    expect(vars).toContain('--tw-color-danger');
    expect(vars).toContain('--tw-spacing-18');
    expect(vars).toContain('--tw-radius-card');
    for (const t of result.tokens) {
      expect(t.provenance.proposed).toBe(true);
      expect(t.provenance.adapter).toBe('tailwind');
      expect(t.provenance.line).toBeGreaterThan(1);
    }
  });

  it('types values and collapses DEFAULT keys', () => {
    const brand = result.tokens.find((t) => t.cssVar === '--tw-color-brand');
    expect(brand?.type).toBe('color');
    expect(brand?.value).toBe('#1a56db');
    expect(brand?.provenance.declaredAs).toBe('theme.colors.brand.DEFAULT');
    const spacing = result.tokens.find((t) => t.cssVar === '--tw-spacing-18');
    expect(spacing?.type).toBe('dimension');
  });

  it('builds the mapping table with existing-var matches', () => {
    const brand = result.mappings.find((m) => m.themePath === 'theme.colors.brand.DEFAULT');
    expect(brand?.matchesExistingVar).toBe('--legacy-blue');
    const danger = result.mappings.find((m) => m.themePath === 'theme.colors.danger');
    expect(danger?.matchesExistingVar).toBeNull();
  });

  it('skips non-literal values (never executes the config) and reports them', () => {
    expect(result.tokens.some((t) => t.cssVar.includes('dynamic'))).toBe(false);
    expect(result.skipped).toContain('theme.colors.dynamic');
  });

  it('returns empty results when no theme object exists', () => {
    const empty = tailwindTokens('module.exports = {};', 't.js', new Map());
    expect(empty.tokens).toEqual([]);
    expect(empty.mappings).toEqual([]);
  });
});
