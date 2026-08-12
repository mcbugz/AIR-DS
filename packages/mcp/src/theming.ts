/**
 * `get_theming_guide` — the three-tier theming model plus the ACTIVE brand's
 * resolved values, read from the loaded registries at runtime (never baked
 * in), so per-customer builds answer with their own brand.
 */

import type { Registry } from './registry.js';

export interface ThemingGuide {
  model: {
    summary: string;
    tiers: Array<{ tier: string; role: string; themable: string }>;
  };
  activeBrand: {
    source: string;
    tokenCount: number;
    keyResolvedValues: Record<string, string>;
  };
  contrast: {
    standard: string;
    threshold: number;
    failures: number;
    pairCount: number;
  } | null;
  overrides: {
    allowed: string[];
    notAllowed: string[];
  };
}

const KEY_TOKENS = [
  '--ds-color-accent-default',
  '--ds-color-accent-emphasis',
  '--ds-color-surface-default',
  '--ds-color-surface-raised',
  '--ds-color-text-primary',
  '--ds-color-text-on-accent',
  '--ds-font-family-sans',
  '--ds-radius-md',
  '--ds-size-control-md',
  '--ds-space-gap-md',
];

export function buildThemingGuide(registry: Registry): ThemingGuide {
  const keyResolvedValues: Record<string, string> = {};
  for (const cssVar of KEY_TOKENS) {
    const token = registry.tokenByVar.get(cssVar);
    if (token) keyResolvedValues[cssVar] = token.value;
  }

  return {
    model: {
      summary:
        'Three token tiers, DTCG source of truth, brand-only theming (ADR-003/ADR-006): customer = one brand-tier token file + optional semantic overrides; zero component code changes for standard engagements.',
      tiers: [
        {
          tier: 'brand',
          role: 'Raw values: palette, type scale ramp, radii ramp, elevation ramp. Never referenced by components; never emitted as public CSS variables.',
          themable: 'THE only tier a customer theme may replace (brands/<customer>.json).',
        },
        {
          tier: 'semantic',
          role: 'Intent-named aliases of brand tokens (--ds-color-surface-raised, --ds-space-inset-md). The public vocabulary agents and humans use.',
          themable: 'Optional targeted overrides during an engagement; every color mapping must re-pass WCAG 2.2 AA contrast checks or the theme build fails.',
        },
        {
          tier: 'component',
          role: 'Per-component hooks aliasing semantic tokens (--ds-button-radius, --ds-field-gap). The customer override surface for a single component.',
          themable: 'Overridable per component; each hook belongs to its component only (NR-008).',
        },
      ],
    },
    activeBrand: {
      source: registry.tokens.brand,
      tokenCount: registry.tokens.count,
      keyResolvedValues,
    },
    contrast: registry.contrast
      ? {
          standard: registry.contrast.standard,
          threshold: registry.contrast.threshold,
          failures: registry.contrast.failures,
          pairCount: registry.contrast.pairs.length,
        }
      : null,
    overrides: {
      allowed: [
        'Brand-tier token file replacement (brands/<customer>.json) — palette, type ramp, radii, elevation.',
        'Optional semantic-tier overrides, gated by automated contrast validation at brand-ingest time.',
        'Component-tier hooks (--ds-<component>-*) for per-component tuning, on the owning component only.',
        'Allowlisted extension points (token overrides, slots, composition) declared in extension-points.json.',
      ],
      notAllowed: [
        'Component code changes for standard engagements (white-label model, ADR-006).',
        'Referencing brand-tier tokens directly in component or product CSS.',
        'Raw values (hex, px/rem/em, palette names) at usage sites — CLAUDE.md rule 2.',
        "Overriding another component's hooks (NR-008) or anything named by the negative-rule catalog.",
        'Color mappings that fail WCAG 2.2 AA — a failing customer palette fails the theme build; it does not ship.',
      ],
    },
  };
}
