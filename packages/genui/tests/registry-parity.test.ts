/**
 * Parity pins between the registries and this package's static contracts:
 * a regenerated registry that adds an interactive component, renames a token
 * family, or drops a barrel export must fail HERE, deterministically —
 * never drift silently.
 */

import { describe, expect, it } from 'vitest';
import { buildSurfaces } from '../src/surface.js';
import { INTENT_EVENTS } from '../src/intents.js';
import {
  SCREEN_TITLE_TOKENS,
  TEXT_ROLES,
  deriveLayoutVocabulary,
} from '../src/vocab.js';
import { registries } from './helpers.js';

describe('intent map ↔ registry parity', () => {
  it('every intent-capable registry component has an INTENT_EVENTS entry, and no entry is stale', () => {
    const surfaces = buildSurfaces(registries.components);
    for (const [name, surface] of surfaces) {
      expect(
        name in INTENT_EVENTS,
        `<${name}> intent-capable=${surface.intentCapable} but INTENT_EVENTS ${name in INTENT_EVENTS ? 'has' : 'lacks'} it`,
      ).toBe(surface.intentCapable);
    }
    for (const name of Object.keys(INTENT_EVENTS)) {
      expect(surfaces.has(name), `INTENT_EVENTS names unknown component ${name}`).toBe(true);
    }
  });

  it('every INTENT_EVENTS target is a real event prop on that component surface', () => {
    const surfaces = buildSurfaces(registries.components);
    for (const [name, target] of Object.entries(INTENT_EVENTS)) {
      const surface = surfaces.get(name);
      expect(surface?.eventProps.has(target.event), `<${name}> has no event prop ${target.event}`).toBe(
        true,
      );
    }
  });

  it('disableWhenUnbound is only set where the surface has isDisabled', () => {
    const surfaces = buildSurfaces(registries.components);
    for (const [name, target] of Object.entries(INTENT_EVENTS)) {
      if (target.disableWhenUnbound) {
        expect(
          surfaces.get(name)?.props.has('isDisabled'),
          `<${name}> is disabled-when-unbound but has no isDisabled prop`,
        ).toBe(true);
      }
    }
  });
});

describe('token vocabulary ↔ tokens-index parity', () => {
  it('the layout vocabulary derives from the real space token families', () => {
    const vocab = deriveLayoutVocabulary(registries.tokens);
    expect(vocab.gap).toContain('none');
    for (const value of vocab.gap.filter((v) => v !== 'none')) {
      expect(
        registries.tokens.tokens.some((t) => t.cssVar === `--ds-space-gap-${value}`),
      ).toBe(true);
    }
    for (const value of vocab.inset.filter((v) => v !== 'none')) {
      expect(
        registries.tokens.tokens.some((t) => t.cssVar === `--ds-space-inset-${value}`),
      ).toBe(true);
    }
  });

  it('every token a text role consumes exists in tokens-index (no fabricated tokens)', () => {
    const cssVars = new Set(registries.tokens.tokens.map((t) => t.cssVar));
    for (const [role, spec] of Object.entries(TEXT_ROLES)) {
      for (const token of Object.values(spec.tokens)) {
        expect(cssVars.has(token), `text role '${role}' consumes fabricated token ${token}`).toBe(true);
      }
    }
    for (const token of Object.values(SCREEN_TITLE_TOKENS)) {
      expect(cssVars.has(token), `screen title consumes fabricated token ${token}`).toBe(true);
    }
  });
});

describe('shape sanity of the shipped JSON schema', () => {
  it('genui-schema.json pins version 1.0 and the closed node kinds', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const schema = JSON.parse(
      readFileSync(path.resolve(here, '..', 'genui-schema.json'), 'utf8'),
    ) as {
      properties: { version: { const: string } };
      $defs: Record<string, unknown>;
    };
    expect(schema.properties.version.const).toBe('1.0');
    expect(Object.keys(schema.$defs)).toEqual(
      expect.arrayContaining(['node', 'componentNode', 'layoutNode', 'textNode']),
    );
  });
});
