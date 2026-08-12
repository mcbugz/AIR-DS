# ADR-003: Token architecture — three tiers, brand-only theming

**Status:** Accepted · **Phase:** 0 · **Date:** 2026-08-12

## Decision

Three tiers, DTCG format, single source of truth in `packages/tokens/src/`:

1. **Brand tier** (`brands/*.json`) — raw values: palette, type scale ramp, radii ramp, elevation ramp, logo assets. **The ONLY tier a customer theme may replace.** Never referenced by components directly; never emitted as public CSS variables.
2. **Semantic tier** — intent-named aliases of brand tokens: `color.surface.raised`, `color.text.primary`, `space.inset.md`. This is the public vocabulary agents and humans use. Emitted as `--ds-<category>-<concept>[-<variant>][-<state>]`.
3. **Component tier** — per-component hooks aliasing semantic tokens: `button.radius`, `field.gap`. Emitted as `--ds-<component>-<property>`.

Full grammar and category set: `docs/specs/token-taxonomy.md`.

## Enforcement

- Component CSS may reference semantic/component tokens only; a validator rejects brand-tier references and raw values at usage sites.
- `registries/tokens-index.json` is generated on every build and enumerates every legal public token with tier, type, and resolved default value. A token absent from the registry is provably fabricated (SLDS/Carbon pattern).
- Every semantic color mapping passes automated WCAG 2.2 AA contrast checks at brand-ingest time; a failing customer palette fails the theme build, it does not ship.

## Consequences

A customer engagement produces one brand file + optional semantic overrides. `brands/default.json` is the neutral core brand and the reference for the ingest pipeline.
