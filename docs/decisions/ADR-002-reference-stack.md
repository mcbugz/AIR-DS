# ADR-002: Reference stack

**Status:** Accepted · **Phase:** 0 · **Date:** 2026-08-12

## Decision

| Concern | Choice | Why |
|---|---|---|
| Workspace | pnpm workspaces, plain scripts (no turbo at v1) | Deterministic, low-magic; validation gauntlet is a fixed command sequence |
| Language | TypeScript, `strict: true` | Discriminated-union variant APIs are a core enforcement mechanism (brief L2) |
| UI runtime | React 19 | Brief scope: React + TS at v1 |
| A11y primitives | `react-aria-components` | Proven primitives over hand-rolled keyboard/ARIA/focus (brief L2; agent-teams case study) |
| Styling | CSS Modules consuming `--ds-*` custom properties only | Mechanically lintable "no hard-coded values" rule; themes swap at the token layer with zero component rebuilds |
| Tokens | W3C DTCG JSON, Style Dictionary v4+ | Brief L1; compiles to CSS vars, TS types, Figma variables, tokens-index.json |
| Docs/stories | Storybook (stories = contract artifacts) + TSDoc → react-docgen | Stories double as agent ground-truth examples; docgen feeds the compiled machine surface |
| Tests | Vitest + Testing Library + axe (vitest-axe), Storybook interaction tests | a11y audit is a gauntlet step |
| MCP | `@modelcontextprotocol/sdk`, npm-distributed server | Industry-converged toolset (17/20 systems) |
| Node | 24 LTS | Current default |

## Out of scope for v1 (must not be precluded)

Native mobile, Vue/Angular ports, hosted docs product. The token layer (platform-agnostic DTCG) and registry contracts (JSON) are the portability seam.
