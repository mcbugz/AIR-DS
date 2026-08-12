# ADR-005: Enforcement — deterministic gates, no LLM in the merge path

**Status:** Accepted · **Phase:** 0 · **Date:** 2026-08-12

## Decision

**Validation gauntlet** — one fixed, mandatory sequence exposed as `pnpm validate` (CLI in `@ds/validate`) and as the MCP `validate_usage` tool:

1. `typecheck` — `tsc --noEmit` across workspace
2. `lint` — ESLint + custom rules: no hard-coded values in component CSS, no brand-tier tokens at usage sites, no unregistered imports
3. `build` — tokens → components → registries → context artifacts
4. `test` — unit + interaction + axe a11y audit
5. `registry-check` — grep built output and changed source for tokens/components absent from the registries (fabrication detector)

- **Named-failure negative rules:** living catalog in `docs/specs/negative-rules.md` of observed hallucinations as wrong→right pairs, with a "your training data is stale" preamble. Compiles into skills/editor rules (Ant Design/HeroUI pattern).
- **Evals as regression tests:** every skill rule gets a prompt→expectation pair in committed `evals/evals.json`; critical gates require 1.0 pass rate (shadcn/PatternFly pattern).
- **Nightly benchmark:** agent-generated screens vs. raw shadcn/Tailwind baseline, scored on fidelity / a11y / token compliance; results logged including losses (Astryx pattern).
- **No LLM in the merge-blocking path.** LLMs draft, review, and fix; linters, type checks, and validators approve.

## Success metrics wired to these gates

Hallucination rate → 0 · critical evals 1.0, overall ≥ 0.95 · first-pass gauntlet ≥ 80% · time-to-theme ≤ 5 working days.
