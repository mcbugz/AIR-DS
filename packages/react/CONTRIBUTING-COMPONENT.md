# Adding a component to @ds/react

Copy the `Button` pattern (`src/components/Button/`) exactly. Binding specs:
`docs/specs/component-inventory-v1.md` (your API), `docs/specs/token-taxonomy.md`
(legal `--ds-*` names), `docs/specs/negative-rules.md`, root `CLAUDE.md`.

## File set (all five, no extras)

```
src/components/<Name>/
  <Name>.tsx          component + all TSDoc
  <Name>.module.css   token-only styles
  <Name>.stories.tsx  Storybook CSF3 stories
  <Name>.test.tsx     vitest + testing-library + axe
  index.ts            exactly: export { <Name>, type <Name>Props } from './<Name>';
```

Directory name = component name = docgen displayName. The generator keys on
`<Name>/<Name>.tsx` + `<Name>/index.ts`; anything else is skipped with a warning.

## `<Name>.tsx` rules

- Build on the react-aria-components base named in the inventory. Never
  hand-roll keyboard/ARIA/focus. Static components (Badge, Card, Alert) use
  plain semantic HTML.
- Props interface — narrow, never widen, and re-add the typed ref:

  ```ts
  export interface <Name>Props
    extends Omit<RAC<Name>Props, 'className' | 'style' | ...>,
      RefAttributes<HTML<Element>Element> {
  ```

  RAC puts `ref` on a `RefAttributes` intersection around its props, NOT
  inside `RAC<Name>Props` — if you skip the `RefAttributes` extend, `<Name
  ref={...}>` is a type error for consumers. Refs do NOT work for free.
- Redeclare `className?: string` (plain string, no render-prop form). Do NOT
  re-expose `style`.
- Write variant/size unions INLINE in the interface
  (`variant?: 'a' | 'b'`), not as named type aliases — the registry must
  capture the exact literal-union text.
- Every public prop: TSDoc description + `@default 'x'` tag when defaulted
  (docgen cannot see destructuring defaults; the `@default` tag feeds
  `defaultValue` in the registry).
- Defaults via destructuring: `{ variant = 'primary', size = 'md', ... }`
  (required with `exactOptionalPropertyTypes`).
- Compose classes from the CSS module:
  `[styles.<name>, styles[variant], styles[size], className].filter(Boolean).join(' ')`
  where `<name>` is the lowercased component name (see CSS rules).
- Component TSDoc block: description, then `@racBase <RACName>` naming the
  react-aria-components base (omit for static components — the registry then
  records `racBase: null`), then `@tokenPrefix <prefix>` naming the
  component-tier `--ds-<prefix>-*` hook namespace your CSS consumes (the
  NR-008 family: e.g. Button AND IconButton say `button`; TextField,
  TextArea, and Select say `field`; omit only if the component has no
  component-tier hooks — the registry then records `tokenPrefix: null`),
  then a fenced ```tsx `@example` with 2–3 realistic usages. All three tags
  are compiled into the registry verbatim.
- Named function export (`export function <Name>(...)`), no default exports,
  no `forwardRef` (React 19 refs are props; spreading `...props` onto the
  RAC base forwards the ref — the exemplar's ref test proves it).

## `<Name>.module.css` rules (CLAUDE.md rule 2 — validator-enforced)

- EVERY color/font/size/space/radius/shadow/motion value is `var(--ds-*)`,
  with names derived from `docs/specs/token-taxonomy.md`. Allowed literals:
  `0`, `100%`, `auto`, `none`, `currentColor`, and CSS keywords
  (`flex`, `center`, `solid`, `nowrap`, `pointer`, ...).
- Token tier selection: use your own component-tier
  `--ds-<component>-*` hooks where `registries/tokens-index.json` provides
  them — they are the customer override surface, and a hook your CSS does not
  consume is a silent no-op — and semantic-tier tokens otherwise. NEVER
  another component's hooks (NR-008). Never raw palette names, never hex,
  never px/rem/em literals.
- Space vs size (NR-006): `--ds-space-*` tokens ONLY in margin/padding/gap/
  inset properties; box dimensions (width/height/inline-size/block-size) use
  `--ds-size-*` tokens (`--ds-size-control-*` for control heights,
  `--ds-size-icon-*` for icons/spinners).
- Base class = lowercased component name (`.button` for `Button`) — never
  `.root`, `.wrapper`, `.container` (NR-010). One class per variant and per
  size value, class name = the literal (`.primary`, `.sm`).
- States via RAC data-attribute selectors ONLY:
  `[data-hovered]`, `[data-pressed]`, `[data-focus-visible]`,
  `[data-disabled]`, `[data-selected]`, `[data-invalid]`, `[data-pending]` —
  never `:hover` / `:active` / `:focus-visible` pseudo-classes.
- Canonical disabled recipe for filled/solid controls (contrast-safe,
  AA-checked once per theme):

  ```css
  background-color: var(--ds-color-surface-sunken);
  color: var(--ds-color-text-muted);
  ```

  (via your component's own disabled surface hooks if the registry provides
  them). Transparent/ghost-style variants keep `background: none` and take
  only `color: var(--ds-color-text-muted)`. Never ship a disabled state that
  keeps the accent/status fill under lightened text.
- Focus ring (interactive components):
  `outline: var(--ds-border-width-2) solid var(--ds-color-border-focus)` +
  `box-shadow: var(--ds-shadow-focus-ring)` on `[data-focus-visible]`.
- Elevation (`--ds-shadow-raised` / `--ds-shadow-overlay`) is for surfaces
  (cards, menus, popovers) — not for control state feedback; state feedback
  is a fill/border/color shift.
- Animations: honor `@media (prefers-reduced-motion: reduce)`.

## `<Name>.stories.tsx` rules

- Imports: `import type { Meta, StoryObj } from '@storybook/react-vite';`
  and `import { expect, fn, userEvent, within } from 'storybook/test';`.
- `const meta = { title: 'Components/<Name>', component: <Name>, args: { ...defaults, onX: fn() } } satisfies Meta<typeof <Name>>;`
  then `type Story = StoryObj<typeof meta>;`.
- Required stories: ONE story per variant value; one sizes showcase; one
  story per interaction state you support (loading, disabled, invalid, ...);
  ADDITIONALLY one story per variant×state combination that has its own CSS
  (e.g. Button's danger-disabled) — if a selector like
  `.danger[data-disabled]` exists, a story must render it. At least one
  `play`-function interaction test asserting the primary event fires — plus
  one asserting the blocked state (disabled/loading) does NOT fire it.
- OUTPUT-ONLY components (no events, no disabled state — e.g. a progress
  indicator): the two interaction play tests are replaced by ONE play test
  asserting the ARIA semantics (role, accessible name, and value/state
  attributes). NEVER fabricate an event prop to satisfy this checklist.
- Story-level layout wrappers may use inline `style` with `var(--ds-*)`
  values (stories are docs, not component CSS). No `<Stack>`/`<Box>` — they
  do not exist (NR-001).

## `<Name>.test.tsx` rules

- Imports: `@testing-library/react`, `@testing-library/user-event`,
  `vitest`, `axe` from `vitest-axe`, and the component's own
  `./<Name>.module.css` for class assertions.
- Required coverage: renders with accessible role/name; default variant+size
  classes applied; each variant/size maps to its class (use `it.each`);
  caller `className` is appended; typed ref reaches the underlying DOM
  element (`createRef<HTML...Element>()`); interaction fires handler; every
  disabling state (disabled/loading) blocks the handler and exposes correct
  ARIA (`toBeDisabled()` / `aria-disabled`) — run the disabled assertions
  `it.each` across ALL variants, since disabled CSS can differ per variant;
  `expect(await axe(container)).toHaveNoViolations()` for at least default +
  one stateful render. Output-only components substitute the
  interaction/disabled items with ARIA value/state assertions (see the
  story-canon carve-out above).
- Do not import the barrel (`src/index.ts`) or `@ds/tokens` in tests —
  import from `./<Name>` so tests never depend on the tokens build.

## De-facto conventions (codified from the shipped 14)

- Focus recipe includes the offset: `outline: var(--ds-border-width-2) solid var(--ds-color-border-focus); outline-offset: var(--ds-border-width-1); box-shadow: var(--ds-shadow-focus-ring);` (negative offset only for tightly-packed options, see Select).
- COMPOUND components (Card+slots, Tabs family, RadioGroup/Radio) are the sanctioned exception to "one export": all parts live in `<Name>.tsx`, all are exported from `index.ts` (one line per export), each part gets its own lowercased base class (`.cardheader`), TSDoc, and registry entry.
- CSS-module lookups under `noUncheckedIndexedAccess` use the non-null assertion (`styles.error!`) ONLY where the class is unconditionally defined in the sibling .module.css — which the dead-class lint verifies (NR-011).
- RAC-positioned overlays (Popover, Tooltip): z-index goes through an inline `style={{ zIndex: 'var(--ds-z-*)' }}` on the RAC element, never a class rule (NR-012 — RAC's inline 100000 beats classes). Inline `style` on internal elements is otherwise reserved for runtime-computed geometry from data (e.g. a progress fill's `inlineSize: \`${pct}%\``) — never for design values (the lint scans TSX literals).
- Motion canon (NR-013): gate `@keyframes` and transform/translate/rotate/scale transitions behind `prefers-reduced-motion: reduce`; color/border/shadow transitions are exempt.

## Before you are done (all must pass)

```
pnpm --filter @ds/react generate    # regenerates src/index.ts + registries/components-index.json
pnpm --filter @ds/react typecheck
pnpm --filter @ds/react test
pnpm validate                       # the full gauntlet — the merge gate; your CSS token lint runs here
```

Then verify your component appears in `registries/components-index.json` with
the exact literal-union `type` strings, `defaultValue` for every defaulted
prop, the correct `racBase`, and a non-null `example`. Never edit
`src/index.ts` or the registry by hand — the generator owns them. Do not
touch files outside `src/components/<Name>/`.
