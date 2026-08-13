# AIR-DS — AI-Ready White-Label Design System

Team handbook. Every agent working in this repo follows these rules. The full brief lives in `docs/brief.md`; decisions in `docs/decisions/`.

## Mission

One neutral, token-driven design system, engineered for re-branding, with a complete AI consumption layer (MCP, llms.txt, skills, editor rules, registries) **compiled from the same source of truth** and re-emitted per customer.

## The guiding principle

> "Instruction hopes the model complies. Structure checks."

Prefer deterministic structure (types, linters, validators, registries) over prose instructions, and prose instructions over nothing.

## Non-negotiable rules

1. **Nothing agent-facing is hand-written.** llms.txt, AGENTS.md, skills, editor rules, registries are all COMPILED from docgen/token sources. If you find yourself hand-authoring one, stop — build the compiler instead. (This repo-internal CLAUDE.md is the one exception: it is for the team building the system, not a shipped artifact.)
2. **No hard-coded values in component CSS.** Every color, font, size, space, radius, shadow, and motion value is `var(--ds-*)`. Allowed literals: `0`, `100%`, `auto`, `none`, `currentColor`, and layout keywords. A validator enforces this.
3. **Brand tier is the only theming surface.** Customer = one brand token file + optional semantic overrides. Zero component code changes for standard engagements.
4. **Semantic names describe intent, not appearance.** `--ds-color-surface-raised`, never `--ds-blue-500` at usage sites.
5. **Closed world.** Every component and token is enumerated in a generated registry (`registries/`). Anything not in a registry is provably fabricated.
6. **Discriminated unions for variants.** Invalid prop combinations must fail at compile time.
7. **Accessibility ships inside the component** (keyboard, ARIA, focus). Built on React Aria Components — never hand-roll focus management.
8. **Stories are contract artifacts.** Every variant and state gets a Storybook story; stories are the agents' ground-truth usage examples.
9. **No LLM in the merge-blocking path.** The validation gauntlet (typecheck → lint → build → test/a11y → registry check) gates merges deterministically.
10. **Vendor-neutral voice.** `ds` prefix everywhere (renamable at build), no customer/brand assumptions in core code or docs prose.

## Stack (ADR-002)

pnpm workspaces · TypeScript (strict) · React 19 · react-aria-components · CSS Modules with `--ds-*` custom properties · Style Dictionary v4+ (DTCG source) · Storybook · Vitest + Testing Library + axe · Node 24.

## Repo layout

```
packages/tokens     @ds/tokens    — DTCG token source + build pipeline (CSS vars, TS types, tokens-index.json)
packages/react      @ds/react     — components + stories + tests
packages/mcp        @ds/mcp       — MCP server (search_docs, get_component, list_tokens, validate_usage)
packages/context    @ds/context   — compiler emitting llms.txt family, skills, AGENTS.md, editor rules
tooling/validate    @ds/validate  — the validation gauntlet CLI + custom lint rules
brands/             customer brand-tier token files (default.json is the neutral core)
registries/         GENERATED machine contracts (tokens-index.json, components-index.json, …)
docs/               brief, ADRs, specs (human-authored); generated docs land in packages/context/dist/<brand>/
```

## Working method

- Run `pnpm validate` (the gauntlet) before declaring any task done. If a step doesn't exist yet, run the parts that do (`pnpm -r typecheck`, `pnpm -r test`, `pnpm -r build`).
- Component work: one directory per component under `packages/react/src/components/<Name>/`. Do not edit shared barrels by hand — `pnpm generate` rebuilds `index.ts` and registries from the filesystem.
- Conventional-ish commits, imperative mood. Commit only at phase gates unless asked.
- When you observe an agent hallucination pattern (invented prop, fabricated token), record it in `docs/specs/negative-rules.md` as a wrong→right pair. That catalog compiles into the shipped negative rules.
