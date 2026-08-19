import { describe, expect, it } from 'vitest';
import { cssTokens, extractCustomProperties, findHardcodedColors } from '../src/css-adapter.js';

const CSS = `/* header comment
spanning lines */
:root {
  --brand-primary: #1a56db;
  --brand-alias: var(--brand-primary);
  --space-2: 8px;
}
[data-theme="dark"] {
  --brand-primary: #93c5fd;
}
.btn {
  --scoped-only: 4px;
  color: #fff;
  background: var(--brand-primary);
  border: 1px solid rgba(0, 0, 0, 0.2);
}
`;

describe('extractCustomProperties', () => {
  it('finds declarations with selector and 1-based line provenance', () => {
    const decls = extractCustomProperties(CSS, 'a.css');
    const primary = decls.find((d) => d.prop === '--brand-primary' && d.selector === ':root');
    expect(primary).toMatchObject({ value: '#1a56db', line: 4, source: 'a.css' });
    const dark = decls.find((d) => d.selector === '[data-theme="dark"]');
    expect(dark).toMatchObject({ prop: '--brand-primary', value: '#93c5fd' });
    expect(decls.some((d) => d.prop === '--scoped-only')).toBe(true);
  });
});

describe('cssTokens', () => {
  const result = cssTokens(extractCustomProperties(CSS, 'a.css'));

  it('base scope wins over themed re-declarations, which are counted', () => {
    const primary = result.tokens.find((t) => t.cssVar === '--brand-primary');
    expect(primary?.value).toBe('#1a56db');
    expect(primary?.provenance.redeclarations).toBe(1);
  });

  it('resolves var() chains and normalizes names', () => {
    const alias = result.tokens.find((t) => t.cssVar === '--brand-alias');
    expect(alias?.value).toBe('#1a56db');
    expect(alias?.name).toBe('brand.alias');
    expect(alias?.type).toBe('color');
  });

  it('includes scoped-only declarations and sorts deterministically', () => {
    expect(result.tokens.some((t) => t.cssVar === '--scoped-only')).toBe(true);
    const names = result.tokens.map((t) => t.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });

  it('all tokens carry the canonical fields plus provenance', () => {
    for (const t of result.tokens) {
      expect(t.tier).toBe('semantic');
      expect(typeof t.name).toBe('string');
      expect(t.cssVar.startsWith('--')).toBe(true);
      expect(typeof t.type).toBe('string');
      expect(typeof t.description).toBe('string');
      expect(t.provenance.adapter).toBe('css-custom-properties');
      expect(t.provenance.line).toBeGreaterThan(0);
    }
  });
});

describe('findHardcodedColors', () => {
  it('flags color literals in non-custom-property declarations only', () => {
    const findings = findHardcodedColors(CSS, 'a.css');
    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({ property: 'color', literal: '#fff' });
    expect(findings[1]?.literal).toBe('rgba(0, 0, 0, 0.2)');
    // custom-property declarations are tokens, not sins
    expect(findings.every((f) => !f.property.startsWith('--'))).toBe(true);
  });
});
