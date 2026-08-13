# @ds/mcp

MCP server for the AIR-DS design system. Stdio transport, npm-distributable,
bin: `ds-mcp`. Everything it answers comes from the generated registries
loaded **at startup** — nothing is baked in, so a per-brand build answers with
that brand's resolved values (theme-aware), and regenerating the registries
plus restarting the server is a full refresh.

```jsonc
// MCP client config
{
  "mcpServers": {
    "ds": { "command": "ds-mcp", "args": ["--registry-dir", "/path/to/registries"] }
  }
}
```

## Registry resolution

`ds-mcp [--registry-dir <path>] [--rules-file <path>]`

1. `--registry-dir` flag — **strict**: if the path has no `tokens-index.json`
   the server exits with an error; it never silently falls back to another
   registry set (a per-customer build must never answer with the wrong brand).
2. `DS_REGISTRY_DIR` env var — same strictness.
3. `<package>/registries` — shipped layout: per-customer builds re-emit their
   registries (`tokens-index.json`, `components-index.json`,
   `contrast-report.json`, optionally `negative-rules.md`) and ship them
   alongside this package in their private scope.
4. `<package>/../../registries` — dev layout: the pnpm workspace root.

The negative-rule catalog (`negative-rules.md`) resolves via `--rules-file` →
`DS_NEGATIVE_RULES` → `<registryDir>/negative-rules.md` →
`<registryDir>/../docs/specs/negative-rules.md`. Story file paths are
discovered from `<registryDir>/../packages/react/src/components/` when that
tree exists (dev); shipped builds report `storyFile: null` and rely on the
registry's `example`.

## Tools

All deterministic — registry lookups and lexical rules, no LLM anywhere
(ADR-005).

- `search_docs({ query, limit? })` — ranked keyword search over components,
  props, and tokens; hits carry `kind` (`component | token | prop`) and a
  compact snippet.
- `get_component({ name })` — full contract: description, `racBase` (with the
  statement that the RAC base's props are also legal), exact props with
  literal-union types/defaults, the canonical `@example`, story file path.
  Closed world: unknown names error with the valid list + nearest suggestion.
- `list_tokens({ category?, tier? })` — every public token with `cssVar`,
  tier, type, description, and the active brand's resolved value.
- `validate_usage({ code, css? })` — deterministic snippet validation:
  fabricated tokens (closed world), unregistered/deep-path imports,
  hallucinated primitives, raw color/size literals (hex, color functions,
  named CSS colors, unit literals — via the SHARED allowed-literal ruleset,
  see below), JSX inline-style literals for color/dimension props (the
  sanctioned runtime-geometry pattern `` inlineSize: `${percentage}%` ``
  stays legal), space-tokens-as-sizes, cross-component hook borrowing,
  pseudo-class state selectors, Tailwind classes, undefined CSS-module class
  references (NR-011), class z-index on RAC-positioned overlays (NR-012),
  ungated movement animations (NR-013), and kebab-cased base classes of
  registered components (NR-010). Returns
  `{ valid, violations: [{ rule, message, fix }] }` with wrong→right messages
  sourced from the live negative-rule catalog.

### Shared allowed-literal ruleset

`src/generated/allowlist.ts` is a GENERATED verbatim copy of
`tooling/validate/src/rules/allowlist.ts` — the single source of truth both
this server and the gauntlet decide literal legality through, so the two
approvers cannot disagree. `scripts/sync-allowlist.mjs` refreshes it as the
first step of `pnpm --filter @ds/mcp build` (a runtime workspace dependency
on @ds/validate was rejected to keep the shipped server standalone:
MCP SDK + zod only). `tests/allowlist-parity.test.ts` byte-compares the copy
against the source and replays the shared verdict corpus
(`tooling/validate/config/allowlist-corpus.json`); the gauntlet side replays
the same corpus in its own suite — divergence fails both.
- `audit_checklist({ scope? })` — the pre-PR self-check list (token
  discipline, registry existence, a11y musts, story/test contract, one item
  per negative rule). Scopes: `all | tokens | components | a11y | stories |
  negative-rules`.
- `get_theming_guide({})` — three-tier model, active brand summary with key
  resolved values, contrast-report status, and what may / may not be
  overridden.

## Develop

```sh
pnpm --filter @ds/mcp build      # tsc → dist/, bin dist/cli.js
pnpm --filter @ds/mcp typecheck
pnpm --filter @ds/mcp test       # vitest; includes a stdio boot test of the built bin
```

The test suite parses `docs/specs/negative-rules.md` for its wrong→right
pairs — adding an NR to the catalog without wiring it into `validate_usage`
fails the suite.
