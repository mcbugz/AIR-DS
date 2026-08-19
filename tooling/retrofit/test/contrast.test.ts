import { describe, expect, it } from 'vitest';
import { buildContrastReport, contrastRatio, parseColor } from '../src/contrast.js';
import type { RetroToken } from '../src/types.js';

function token(name: string, cssVar: string, value: string, type = 'color'): RetroToken {
  return {
    name,
    cssVar,
    tier: 'semantic',
    type,
    description: 'test',
    value,
    provenance: { adapter: 'css-custom-properties', source: 't.css', line: 1, declaredAs: cssVar },
  };
}

describe('contrastRatio', () => {
  it('matches known WCAG values', () => {
    const white = parseColor('#ffffff');
    const black = parseColor('#000000');
    expect(white).not.toBeNull();
    expect(black).not.toBeNull();
    expect(contrastRatio(black!, white!)).toBe(21);
    expect(contrastRatio(white!, white!)).toBe(1);
    // #767676 on white is the canonical 4.54:1 AA-borderline gray
    expect(contrastRatio(parseColor('#767676')!, white!)).toBeCloseTo(4.54, 2);
  });

  it('parses hex forms, rgb(), hsl()', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('rgb(255, 0, 0)')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseColor('rgba(0,0,0,0.5)')?.a).toBe(0.5);
    const hsl = parseColor('hsl(0, 100%, 50%)');
    expect(hsl?.r).toBeCloseTo(255);
    expect(parseColor('oklch(0.5 0.1 200)')).toBeNull();
  });
});

describe('buildContrastReport', () => {
  const tokens = [
    token('color.text.main', '--text-main', '#111827'),
    token('color.text.subtle', '--text-subtle', '#6b7280'),
    token('surface.default', '--surface-default', '#ffffff'),
    token('brand.danger', '--brand-danger', '#b91c1c'),
    token('brand.danger.bg', '--brand-danger-bg', '#fef2f2'),
    token('brand.alias', '--brand-alias', '#b91c1c'),
    token('weird.gradient', '--weird', 'oklch(0.7 0.1 30)'),
    token('sp.1', '--sp-1', '4px', 'dimension'),
  ];
  const rawByVar = new Map([
    ['--text-main', '#111827'],
    ['--text-subtle', '#6b7280'],
    ['--surface-default', '#ffffff'],
    ['--brand-danger', '#b91c1c'],
    ['--brand-danger-bg', '#fef2f2'],
    ['--brand-alias', 'var(--brand-danger)'],
    ['--weird', 'oklch(0.7 0.1 30)'],
    ['--sp-1', '4px'],
  ]);
  const report = buildContrastReport(tokens, { brand: 'brand/test.json', rawByVar });

  it('builds stem pairs and global text x surface pairs', () => {
    const ids = report.pairs.map((p) => p.id);
    expect(ids).toContain('brand.danger|brand.danger.bg');
    expect(ids).toContain('color.text.main|surface.default');
    expect(ids).toContain('color.text.subtle|surface.default');
  });

  it('computes pass/fail against 4.5 and counts failures', () => {
    const main = report.pairs.find((p) => p.id === 'color.text.main|surface.default');
    expect(main?.pass).toBe(true);
    expect(report.failures).toBe(report.pairs.filter((p) => !p.pass).length);
  });

  it('credits pure var() aliases via resolvesTo and aliasIndex', () => {
    const danger = report.pairs.find((p) => p.id === 'brand.danger|brand.danger.bg');
    expect(danger?.resolvesTo.foreground).toContain('--brand-alias');
    expect(report.aliasIndex['--brand-alias']).toContain('brand.danger|brand.danger.bg');
  });

  it('lists unpaired/unparseable color tokens as unaudited with reasons', () => {
    const weird = report.unaudited.find((u) => u.cssVar === '--weird');
    expect(weird?.reason).toMatch(/not a parseable sRGB color/);
    // dimension tokens are not color tokens — absent entirely
    expect(report.unaudited.some((u) => u.cssVar === '--sp-1')).toBe(false);
  });

  it('carries the canonical report shape', () => {
    expect(report.standard).toBe('WCAG 2.2 AA (normal text)');
    expect(report.threshold).toBe(4.5);
    expect(report.brand).toBe('brand/test.json');
    for (const p of report.pairs) {
      expect(Object.keys(p)).toEqual([
        'id', 'foreground', 'background', 'foregroundValue', 'backgroundValue',
        'ratio', 'required', 'pass', 'resolvesTo',
      ]);
    }
  });
});
