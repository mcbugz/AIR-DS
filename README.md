# AIR-DS — AI-Ready, White-Label Design System

A machine-readable, agent-operable design system: built once, branded per customer, shipped with the AI tooling (MCP server, llms.txt, skills, editor rules, registries) that makes customer engineering teams — and their AI agents — productive on day one.

- **Brief:** [docs/brief.md](docs/brief.md)
- **Decisions:** [docs/decisions/](docs/decisions/)
- **Team handbook:** [CLAUDE.md](CLAUDE.md)

## Principle

> Instruction hopes the model complies. **Structure checks.**

Four layers, one source of truth: **Tokens** (DTCG, three tiers, brand-only theming) → **Components** (typed, closed-world, a11y inside) → **Machine surface** (compiled per release, per customer) → **Enforcement** (deterministic gauntlet; no LLM in the merge gate).

## Quick start

```bash
pnpm install
pnpm build       # tokens → components → registries → context artifacts
pnpm validate    # the gauntlet: typecheck → lint → build → test → registry-check
pnpm storybook
```
