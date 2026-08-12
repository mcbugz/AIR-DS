# Token taxonomy spec (v1)

Source of truth: DTCG JSON in `packages/tokens/src/` (semantic + component tiers) and `brands/*.json` (brand tier). See ADR-003 for tier rules.

## Naming grammar

DTCG path: `{category}.{concept}[.{variant}][.{state}]`
CSS emission (semantic): `--ds-{category}-{concept}[-{variant}][-{state}]`
CSS emission (component): `--ds-{component}-{property}[-{variant}][-{state}]`
TS type emission: literal-union types per category (`DsColorToken`, `DsSpaceToken`, …).

States use the fixed vocabulary: `default | hover | active | focus | disabled | invalid | selected`.

## Semantic categories (public vocabulary)

| Category | Concepts (v1) | Notes |
|---|---|---|
| `color.surface` | `default`, `raised`, `sunken`, `overlay`, `inverse` | backgrounds |
| `color.text` | `primary`, `secondary`, `muted`, `inverse`, `link`, `on-accent` | foregrounds |
| `color.accent` | `default`, `emphasis`, `muted` | brand action color, AA-checked vs `on-accent` |
| `color.border` | `default`, `muted`, `strong`, `focus` | |
| `color.status` | `{info,success,warning,danger}.{default,emphasis,surface,border,text}` — nested; the strong hue is `.default` (DTCG forbids a group also being a token), `.emphasis` is the hover step for solid fills | surface/text triples AA-checked; `text.inverse` on `.default`/`.emphasis` AA-checked (solid-fill recipe) |
| `font` | `family-sans`, `family-mono` | |
| `text` | `size-{xs…3xl}`, `weight-{regular,medium,semibold,bold}`, `leading-{tight,normal,loose}` | modular scale from brand ramp |
| `space` | `0`–`10` scale + `inset-{sm,md,lg}`, `gap-{sm,md,lg}` | 4px-base scale in brand tier |
| `radius` | `sm`, `md`, `lg`, `full` | |
| `border` | `width-1`, `width-2` | |
| `shadow` | `raised`, `overlay`, `focus-ring` | elevation ramp from brand tier |
| `motion` | `duration-{fast,normal,slow}`, `easing-{standard,enter,exit}` | |
| `z` | `dropdown`, `sticky`, `overlay`, `toast`, `tooltip` | fixed ordering |
| `size` | `control-{sm,md,lg}`, `icon-{sm,md,lg}` | control heights; icon/indicator boxes. Space tokens are never sizes (NR-006) |

## Brand tier shape (`brands/*.json`)

Raw ramps only — no intent: `palette.{neutral,primary,…}.{50…950}`, `typeface.{sans,mono}`, `type-scale` (base + ratio), `radius-scale`, `space-base`, `elevation`, `assets.logo*`. The semantic tier maps intent → ramp positions; a customer file replaces ramps, never mappings (semantic overrides are a separate, allowlisted layer).

## Rules (validator-enforced)

1. Component CSS references semantic or component tokens only.
2. Brand tokens are referenced only by semantic-tier aliases.
3. Every public token appears in generated `registries/tokens-index.json` with tier, DTCG type, description, and default-brand resolved value.
4. Every `color.*` mapping ships with a computed contrast result; AA failures fail the build.
