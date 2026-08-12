# ADR-004: Machine-readable surface — compiled, never hand-written

**Status:** Accepted · **Phase:** 0 · **Date:** 2026-08-12

## Decision

All agent-facing artifacts are emitted by `@ds/context` (the context compiler) from three inputs: token build output, react-docgen extraction of `@ds/react`, and Storybook story metadata. Emitted per release and per customer brand:

- **llms.txt family** — compact `llms.txt` index, `llms-full.txt`, concern-based slices (`llms-components.txt`, `llms-tokens.txt`, `llms-theming.txt`, `llms-migration.txt`), token-budget aware (Chakra/HeroUI/Nord pattern).
- **Markdown twins** — every generated docs page also emitted as `.md` under `docs/generated/`.
- **MCP server metadata** — `@ds/mcp` reads the registries at runtime; the compiler emits its search index.
- **Agent skills** — `SKILL.md` router + lazy-loaded reference files (Carbon pattern). Consumer skills: `use-system`, `build-screen`, `migrate`. Builder skills: `contribute-component`, `audit-a11y`. Distributed via `npx skills add` and `/.well-known/skills/`.
- **Repo agent files** — small vendor-neutral `AGENTS.md` / `CLAUDE.md` routers pointing at indexed references (retrieval over persisted context).
- **Editor rules** — path-scoped rules for Cursor / Copilot / Claude Code, emitted from the same source as skills.
- **Registries** — `components-index.json`, `tokens-index.json`, `icons-metadata.json`, patterns index.

Target agent surfaces at v1: **Claude Code, Cursor, GitHub Copilot, v0.**

## Hard rule

Hand-authoring any of the above is a build failure, not a code-review comment: CI recompiles and diffs; a dirty diff fails the gate (Phase 2 acceptance).
