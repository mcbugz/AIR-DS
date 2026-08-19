# @ds/wc — web components (M5 portability proof)

## The portability argument

The system's value was never React — it is the governed pipeline: one DTCG token graph, resolved deterministically per brand, emitted per platform, with a generated closed-world registry gating what agents may produce. This package proves that claim by adding a render target, not a fork: `<ds-button>` is a framework-free custom element styled by the **same compiled `--ds-*` vocabulary** (via the new Shadow-DOM token build, `packages/tokens/dist/wc/tokens.css`, adopted with `adoptedStyleSheets` + a `<style>` fallback), mirroring the React Button's API (`variant` / `size` / `loading` / `disabled`) and its exact token recipe, held to the same token-only CSS audit, and enumerated in its own generated contract, `registries/wc-index.json`, compiled from the hand-written manifest in `src/manifest.ts` (source → registry, never the reverse). Re-branding works identically one shadow boundary deeper: swap which brand's tokens sheet is provided, zero component changes (`examples/wc-demo`). The React Native emitter (`packages/tokens/dist/react-native/tokens.ts`) extends the same proof to a non-CSS runtime, with every lossy conversion documented in the file header rather than hidden.

## Usage

```html
<script type="module">
  import { provideTokenStyles } from '@ds/wc'; // registers <ds-button> on import
  // Feed any brand's Shadow-DOM token build (packages/tokens/dist/wc/tokens.css).
  provideTokenStyles(tokensCssText);
  // Alternative: skip provideTokenStyles and <link> a tokens.css at document
  // level — the :root fallback + custom-property inheritance covers that path.
</script>

<ds-button variant="secondary" size="lg">Cancel</ds-button>
<ds-button variant="danger" loading>Deleting…</ds-button>
```

The full attribute/event/`::part` contract lives in `registries/wc-index.json` — generated, closed-world, same discipline as `components-index.json` but a separate file because it is a different consumption surface (attributes, not props).

## Test runner choice

`vitest` + `happy-dom`, not web-test-runner: the whole workspace already runs vitest (one toolchain for `pnpm -r test` and the gauntlet); web-test-runner's advantage is real browsers, which means downloading browser binaries — against the repo's credential-free, zero-download posture for merge gates; and happy-dom implements the precise surface under test (custom elements, shadow roots, slots, constructable stylesheets, `adoptedStyleSheets`). The acknowledged gap — real rendering, real focus rings — is covered by the demo page, and a browser-run axe pass would be the first addition of a full port.

## What a full port would take (honest estimate)

Button is deliberately the cheapest component: no overlay, no selection state, no form integration. Porting the remaining 10+ components is **not** a weekend:

- **Simple statics** (Badge, Alert, Card): ~1–2 days each — recipe translation plus manifest/tests, no interaction model.
- **Form controls** (Checkbox, Radio, Switch, TextField/Select via ElementInternals for form association): ~3–5 days each — this is where React Aria stops coming for free; label association, validation states, and form participation must be built on native primitives and tested hard.
- **Overlays and composites** (Dialog, Tooltip, Tabs, Menu): ~1–2 weeks each — focus trapping, dismissal, positioning, and ARIA patterns hand-built or via a dependency-light library; the hardest 20% that react-aria-components currently absorbs.
- **Infrastructure** (once): Storybook-for-WC stories as contract artifacts, browser-based axe run, docgen from the manifest into the compiled context layer (llms.txt / skills), gauntlet wiring. ~2 weeks.

Total: roughly **8–12 engineer-weeks** for parity with the React package at the same quality bar — versus near-zero marginal cost for each additional *brand*, which is the asymmetry the architecture is built around. The tokens layer, registries, validators, and context compiler all carry over unchanged; that is the point.
