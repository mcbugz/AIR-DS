# @ds/genui — the generative-UI runtime contract

A versioned JSON document format that agents emit **at runtime** to describe screens, a deterministic closed-world validator, and a fail-closed renderer that composes only registry components. Server-driven and agent-driven UI, made safe the same way the rest of AIR-DS is made safe: **structure checks; instruction merely hopes.**

```
agent ──emits──▶ document (JSON, no code)
                    │
                    ▼
        validateDocument(doc, registries)     ← components-index.json + tokens-index.json,
                    │                            loaded at runtime; no LLM in this path
              valid │ invalid → { path, rule, message, fix }[]
                    ▼
   <GenUIScreen doc={doc} registries={r} bindings={{ "confirm-delete": fn }} />
                    │
                    ▼
        real @ds/react components, host-owned behavior
```

## The security model in one page

Generated UI is a code-injection surface unless the format makes injection *inexpressible*. This format does, by construction:

1. **Closed world.** A document can only NAME things. Component names are checked against `components-index.json`; a name not in the registry does not exist and fails with a nearest-name suggestion. Props are checked against the component's extracted registry surface (own props + enumerated racProps); values of literal-union props must be one of the extracted literals. Nothing is checked against prose — everything is a set lookup against generated contracts, loaded at runtime.
2. **No code, anywhere.** Event props (`on*`, any function-typed prop) are **forbidden in documents** — a document that could carry a handler would be remote code execution. `className` and `style` are forbidden too (documents name intents and variants, never styling), and element-typed props cannot be smuggled as JSON (they are filled via typed child slots instead). Strings render as React text — escaped, inert; the fuzz suite feeds script payloads through every string channel and asserts the DOM stays clean.
3. **Behavior belongs to the host.** Interactive nodes declare `"intent": "<name>"`. The HOST passes `bindings={{ "<name>": fn }}` to `<GenUIScreen>` — the single point where functions enter. An intent with no binding renders the control **disabled** (or inert) with a dev warning. The agent chooses *which* affordance appears; the host alone decides *what it does*.
4. **Layout and typography live in the contract, not as fake components.** `<Box>`/`<Stack>`/`<Flex>` (NR-001) and `<Heading>`/`<Text>` (NR-002) are the industry's most hallucinated components; here they get a safe landing instead of a rejection dead-end: layout nodes (`stack` | `row` | `grid`) with a **token-named vocabulary** (`gap`/`inset` values are derived at runtime from the `--ds-space-gap-*` / `--ds-space-inset-*` tokens in `tokens-index.json` — never free CSS), and text nodes with roles mapping to semantic HTML + `--ds-text-*` tokens.
5. **Fail closed at every joint.** An invalid document throws (`GenUIValidationError`) — never best-effort renders. The renderer's component map is built from registry names against the `@ds/react` barrel exports and throws on any gap. A regenerated registry that adds an interactive component fails a parity test until the intent map answers for it.
6. **DoS hygiene.** Depth ≤ 24, nodes ≤ 500, strings ≤ 5000 chars, CLI file cap 1 MiB. Validation is a single bounded walk.
7. **Deterministic, credential-free, offline.** No LLM in the validation path (ADR-005), no network in the runtime, no keys anywhere. Same document + same registries ⇒ same verdict, forever.

## Wire format (version 1.0)

Machine contract: [`genui-schema.json`](./genui-schema.json) (`@ds/genui/schema`). The JSON Schema pins the *shape*; the closed-world *semantics* (names, prop surfaces, vocabularies) are enforced by the validator against the registries.

```json
{
  "version": "1.0",
  "screen": { "title": "Workspace settings", "nodes": [ ... ] }
}
```

A node is exactly one of:

| Kind | Shape | Meaning |
|---|---|---|
| **Component** | `{ "component": "Button", "props": { ... }, "children": [ ... ], "slot": "trigger"? }` | One registry component. `children` mixes nodes and plain strings. `slot` names an element-typed prop of the PARENT (derived from the registry — e.g. `trigger` on a Dialog child). |
| **Layout** | `{ "layout": "stack" \| "row" \| "grid", "gap"?, "inset"?, "align"?, "columns"?, "children": [ ... ] }` | Token-vocabulary layout. `gap`/`inset`: `none` + suffixes of `--ds-space-gap-*` / `--ds-space-inset-*` (default brand: `sm md lg`). `align`: `start\|center\|end\|stretch`. `columns` (grid only): `2\|3\|4`. |
| **Text** | `{ "text": "...", "role": "heading2" \| "heading3" \| "body" \| "caption" }` | Semantic HTML + text tokens: `h2`/`h3`/`p`; caption adds `--ds-color-text-secondary`. |

**Props legal on a component node:** the registry surface (own props + enumerated racProps) **minus** event/element/styling props, **plus** the global structural props `id`, `aria-label`, `aria-labelledby`, `aria-describedby`, and `intent` (interactive components only). Documents are deliberately *stricter* than code: the enumerated registry surface is the whole surface.

**Intents:** `"intent": "save-profile"` binds to the component's designated primary event (`Button`→`onPress`, `Switch`/`Checkbox`/`TextField`/`TextArea`/`RadioGroup`→`onChange`, `Select`/`Tabs`→`onSelectionChange`, `Alert`→`onDismiss`, `Dialog`/`Tooltip`→`onOpenChange`, …). See `INTENT_EVENTS`.

**Overlays declaratively:** Dialog takes a `slot: "trigger"` component child plus body children (or `defaultOpen`/`isOpen` via props); Tooltip takes `content` (string prop) and exactly one component child as its focusable trigger.

## Validator

```ts
import { validateDocument } from '@ds/genui';
const { valid, errors } = validateDocument(doc, { components, tokens });
// errors: { path, rule, message, fix }[]
```

Pure and browser-safe; CLI face: `ds-genui validate <file> [--registry-dir <dir>] [--json]` (exit 0 valid / 1 invalid / 2 usage). Registries resolve via `--registry-dir` → `DS_REGISTRY_DIR` → `<package>/registries` → workspace root.

Rules: `doc-shape` · `doc-version` · `unknown-key` · `unknown-component` · `layout-primitive` (NR-001) · `typography-primitive` (NR-002) · `unknown-prop` · `prop-type` · `missing-required-prop` · `event-prop-forbidden` · `styling-forbidden` · `element-prop-forbidden` · `intent-not-allowed` · `unknown-slot` · `slot-not-component` · `duplicate-slot` · `missing-children` · `single-element-child` · `token-vocab` · `text-role` · `depth-limit` · `size-limit`.

## Renderer

```tsx
import { GenUIScreen } from '@ds/genui';

<GenUIScreen
  doc={documentFromAgent}
  registries={{ components, tokens }}
  bindings={{ 'confirm-delete': () => deleteWorkspace(), 'set-density': (v) => save(v) }}
/>
```

Re-validates on render (throws `GenUIValidationError` when invalid), maps registry names to the `@ds/react` barrel (throws on any gap), fills slots, binds intents, and renders layout/text nodes with `var(--ds-*)` styles only.

Demo document: [`examples/genui-demo/settings.genui.json`](../../examples/genui-demo/settings.genui.json) — a full settings screen (tabs, cards, form fields, radio group, tooltip, danger-zone alert, delete-confirmation dialog), validated, render-tested, and axe-clean in CI.

## MCP tool sketch: `validate_genui` (for the @ds/mcp lead — NOT implemented here)

A fourth deterministic tool alongside `validate_usage`, so agents can self-check documents before emitting them:

```jsonc
{
  "name": "validate_genui",
  "description": "Deterministically validate a generative-UI JSON document (wire format 1.0) against the loaded registries. Closed world: unknown components/props/values/vocabulary are rejected with fixes. No LLM in this path.",
  "inputSchema": {
    "type": "object",
    "required": ["document"],
    "properties": {
      "document": { "type": "string", "description": "The genui document as a JSON string." }
    }
  }
  // handler: JSON.parse (reject > 1 MiB) → validateDocument(parsed, registry)
  // result:  { valid, nodeCount, errors: [{ path, rule, message, fix }] }
}
```

Implementation is one import: `@ds/mcp` already loads both registries at startup; the handler calls `validateDocument` from `@ds/genui` and returns the result verbatim. Per-brand builds get brand-correct vocabularies for free (the gap/inset sets derive from the brand's tokens-index at runtime).

## Package

- `@ds/genui` — deps: `@ds/react` (workspace), peer `react` ^19. Entry point is browser-safe (no `node:fs`); registry loading from disk lives only in the CLI.
- Scripts: `build` (tsc → `dist/`, executable CLI) · `typecheck` · `test` (vitest: validator wrong/right pairs per rule, per-category render tests, 50-mutation fuzz suite, demo doc proof + axe, registry-parity pins).
