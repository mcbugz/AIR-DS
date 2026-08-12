import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseNegativeRules } from '../src/rules.ts';
import { buildBundle, readOut } from './helpers.ts';
import type { TokensIndex } from '../src/types.ts';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');

interface ExtensionPoints {
  $description: string;
  brand: string;
  tokenOverrides: { brandTier: string; semanticTier: string; componentHooks: string[] };
  composition: {
    slots: { component: string; kind: string; parts?: string[]; prop?: string }[];
    patterns: { name: string }[];
  };
  forbidden: { surface: string; detail: string; rules: string[] }[];
}

describe('extension-points.json (ADR-006 §4)', () => {
  const bundle = buildBundle();
  afterAll(() => bundle.cleanup());
  const contract = JSON.parse(readOut(bundle.outDir, 'extension-points.json')) as ExtensionPoints;

  it('is emitted, brand-stamped, and marked generated', () => {
    expect(contract.brand).toBe('default');
    expect(contract.$description).toContain('GENERATED');
    expect(contract.$description).toContain(bundle.report.sourceHash.slice(0, 16));
  });

  it('componentHooks are exactly the component-tier cssVars from tokens-index, sorted', () => {
    const tokensIndex = JSON.parse(
      readFileSync(join(REPO_ROOT, 'registries/tokens-index.json'), 'utf8'),
    ) as TokensIndex;
    const expected = tokensIndex.tokens
      .filter((t) => t.tier === 'component')
      .map((t) => t.cssVar)
      .sort();
    expect(contract.tokenOverrides.componentHooks).toEqual(expected);
    expect(contract.tokenOverrides.brandTier).toBe('full');
    expect(contract.tokenOverrides.semanticTier).toBe('by-engagement');
  });

  it('derives the registry composition slots: Card slots, Dialog trigger, Alert onDismiss', () => {
    const { slots } = contract.composition;
    const card = slots.find((s) => s.component === 'Card' && s.kind === 'children-slots');
    expect(card?.parts).toEqual(['CardBody', 'CardFooter', 'CardHeader']);
    expect(
      slots.some((s) => s.component === 'Dialog' && s.kind === 'render-prop' && s.prop === 'trigger'),
    ).toBe(true);
    expect(
      slots.some((s) => s.component === 'Alert' && s.kind === 'dismiss-hook' && s.prop === 'onDismiss'),
    ).toBe(true);
    // Wrapper context must not be misread as a slot (CardBody's example wraps in <Card>).
    const cardBody = slots.find((s) => s.component === 'CardBody');
    expect(cardBody).toBeUndefined();
  });

  it('every slot references only registry components', () => {
    const registry = JSON.parse(
      readFileSync(join(REPO_ROOT, 'registries/components-index.json'), 'utf8'),
    ) as { components: { name: string }[] };
    const names = new Set(registry.components.map((c) => c.name));
    for (const slot of contract.composition.slots) {
      expect(names.has(slot.component), slot.component).toBe(true);
      for (const part of slot.parts ?? []) expect(names.has(part), part).toBe(true);
    }
  });

  it('forbidden list covers the four closed surfaces and cites only real NR ids', () => {
    const catalog = parseNegativeRules(
      readFileSync(join(REPO_ROOT, 'docs/specs/negative-rules.md'), 'utf8'),
    );
    const known = new Set(catalog.rules.map((r) => r.id));
    const surfaces = contract.forbidden.map((f) => f.surface).sort();
    expect(surfaces).toEqual(['base-classes', 'component-internals', 'cross-component-hooks', 'deep-imports']);
    for (const entry of contract.forbidden) {
      expect(entry.rules.length, `${entry.surface} must cite at least one NR id`).toBeGreaterThan(0);
      for (const id of entry.rules) expect(known.has(id), `${entry.surface} cites unknown ${id}`).toBe(true);
    }
  });

  it('patterns mirror the optional patterns-index registry state', () => {
    const patternsOnDisk = existsSync(join(REPO_ROOT, 'registries/patterns-index.json'));
    if (patternsOnDisk) {
      expect(contract.composition.patterns.length).toBeGreaterThan(0);
    } else {
      expect(contract.composition.patterns).toEqual([]);
      expect(bundle.report.warnings.some((w) => w.includes('patterns-index.json'))).toBe(true);
    }
  });

  it('is deterministic across builds', () => {
    const again = buildBundle();
    try {
      expect(readOut(again.outDir, 'extension-points.json')).toBe(
        readOut(bundle.outDir, 'extension-points.json'),
      );
    } finally {
      again.cleanup();
    }
  });
});
