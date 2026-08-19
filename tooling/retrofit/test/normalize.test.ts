import { describe, expect, it } from 'vitest';
import { aliasTarget, inferType, normalizeName, resolveVarRefs } from '../src/normalize.js';

describe('normalizeName', () => {
  it('normalizes kebab, snake, camel, and digit boundaries to dot paths', () => {
    expect(normalizeName('--atlas-blue-dark')).toBe('atlas.blue.dark');
    expect(normalizeName('--btn_primary_bg')).toBe('btn.primary.bg');
    expect(normalizeName('--fontSizeBase')).toBe('font.size.base');
    expect(normalizeName('--atlasGray50')).toBe('atlas.gray.50');
    expect(normalizeName('--color_text_main')).toBe('color.text.main');
    expect(normalizeName('--sp-1')).toBe('sp.1');
  });
});

describe('inferType', () => {
  it('classifies the DTCG-ish types', () => {
    expect(inferType('#1a56db', 'atlas.blue')).toBe('color');
    expect(inferType('rgba(17, 24, 39, 0.5)', 'x')).toBe('color');
    expect(inferType('16px', 'sp.4')).toBe('dimension');
    expect(inferType('4.5rem', 'tw.spacing.18')).toBe('dimension');
    expect(inferType('150ms', 'transition.fast')).toBe('duration');
    expect(inferType('cubic-bezier(0.4, 0, 0.2, 1)', 'ease')).toBe('cubicBezier');
    expect(inferType('0 1px 3px rgba(17, 24, 39, 0.12)', 'shadow.card')).toBe('shadow');
    expect(inferType('600', 'fw.bold')).toBe('fontWeight');
    expect(inferType('600', 'zindex.top')).toBe('number');
    expect(inferType('"Helvetica Neue", Arial, sans-serif', 'font.body')).toBe('fontFamily');
    expect(inferType('underline', 'link.decoration')).toBe('string');
  });
});

describe('resolveVarRefs', () => {
  const map = new Map([
    ['--a', '#111827'],
    ['--b', 'var(--a)'],
    ['--c', 'var(--b)'],
    ['--cycle-1', 'var(--cycle-2)'],
    ['--cycle-2', 'var(--cycle-1)'],
  ]);
  it('resolves chains and fallbacks', () => {
    expect(resolveVarRefs('var(--c)', map)).toEqual({ value: '#111827', resolved: true });
    expect(resolveVarRefs('var(--missing, 4px)', map)).toEqual({ value: '4px', resolved: true });
    expect(resolveVarRefs('1px solid var(--a)', map)).toEqual({ value: '1px solid #111827', resolved: true });
  });
  it('reports unresolvable refs and survives cycles', () => {
    expect(resolveVarRefs('var(--missing)', map).resolved).toBe(false);
    expect(resolveVarRefs('var(--cycle-1)', map).resolved).toBe(false);
  });
});

describe('aliasTarget', () => {
  const map = new Map([
    ['--a', '#111827'],
    ['--b', 'var(--a)'],
    ['--c', 'var(--b)'],
    ['--d', '1px solid var(--a)'],
  ]);
  it('follows pure alias chains to the terminal var', () => {
    expect(aliasTarget('--c', map)).toBe('--a');
    expect(aliasTarget('--b', map)).toBe('--a');
  });
  it('returns null for non-alias declarations', () => {
    expect(aliasTarget('--a', map)).toBeNull();
    expect(aliasTarget('--d', map)).toBeNull();
  });
});
