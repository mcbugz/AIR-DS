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

## Demo locally (zero credentials)

The entire system — build, validation gauntlet, evals, benchmark, customer ingest, metrics — runs in any clean environment with **no API keys, no accounts, no network services**:

```bash
bash scripts/demo.sh
```

One command: install → build → gauntlet → evals → benchmark (fixture replay) → ingest the `acme` sample customer → metrics report, ending in a summary scoreboard with paths to explore. Idempotent; after the initial `pnpm install`, fully offline.

What you get:

- **Benchmark scoreboard** — `tooling/validate/benchmark-results/<date>-scoreboard.md`. Default mode replays the *committed recorded generations* (`tooling/validate/benchmark/recordings/`, one system-compliant + one baseline-style per scenario), scored deterministically against the raw-Tailwind baseline: token compliance, fabrications, static gauntlet, axe. Clients benchmark their own agent by passing `--generator '{"name":"...","cmd":"..."}'` (their CLI, their credentials — never invoked by tests or CI).
- **Axe column (optional browser)** — the only optional extra: `npx playwright install chromium` (run inside `tooling/validate/`). Each recorded screen is bundled with esbuild + `@ds/react` + token CSS into a static page and scored with axe-core in a local chromium. Without the browser the column reads `skipped (no browser)` — the demo never fails for lack of it.
- **Metrics per release** — every gauntlet/evals/benchmark run appends a line to `metrics/history.jsonl`; `pnpm --filter @ds/validate run metrics:report` renders `metrics/README.md` (latest snapshot + per-release trend). CI uploads `metrics/` as an artifact; nothing is auto-pushed.
- **MCP with zero setup** — `.mcp.json` wires the `ds-mcp` server for anyone opening this repo in Claude Code (after `pnpm build`).
- **Release, proven locally** — `bash scripts/release-pack.sh` (or `pnpm --filter @ds/validate run release:pack`) packs every publishable package into `release-artifacts/*.tgz` plus a version-stamped registry bundle. Version bump + changelog: `node scripts/release-version.mjs <major|minor|patch>`. Actual `npm publish` is a documented, **disabled** step in `.github/workflows/release.yml`, gated on a client-provided `NPM_TOKEN`.
