# @ds/context

Deterministic context compiler for AIR-DS: emits every agent-facing artifact — the llms.txt family, markdown twins, skills, repo agent routers, editor rules (Cursor / Copilot / Claude Code / v0), the `ds-auditor` agent, `extension-points.json`, and byte-copies of the registries — per brand, from the machine registries and spec sources (ADR-004, ADR-006).

## Usage

```sh
pnpm --filter @ds/context build            # compile brand "default" -> dist/default
node src/cli.ts --brand acme               # compile another brand
node src/cli.ts --help                     # full flag reference
```

Same inputs + same `--now` ⇒ byte-identical output trees (enforced by test).

## Flags

| Flag | Default | Meaning |
| --- | --- | --- |
| `--brand <name>` | `default` | Brand to compile for; names the output dir and resolves the default brand file `brands/<name>.json`. |
| `--now <ISO>` | build time | Timestamp recorded in `manifest.json`. Pass a fixed value for byte-identical builds. |
| `--out <dir>` | `packages/context/dist/<brand>` | Output directory (cleaned before writing). |
| `--registries-dir <dir>` | `<repo>/registries` | Directory containing the registry JSON files: `tokens-index.json`, `components-index.json`, `contrast-report.json`, plus the optional `icons-metadata.json` / `patterns-index.json`. Native brand-input support for the ingest pipeline — point it at a customer-built registries directory instead of swap/restoring `<repo>/registries`. |
| `--brand-path <file>` | `<repo>/brands/<brand>.json` | Path to the brand file hashed as a compiler input (resolved token values still come from the registry — sequence tokens-build before context-build). |

`compile()` (`src/compile.ts`) accepts the same options programmatically: `{ brand, now, outDir, registriesDir, brandPath, repoRoot }`.

Notes on the ingest flags:

- Registry files read via `--registries-dir` keep their **logical** `registries/...` names for source hashing and for the byte-copies shipped inside the bundle, so a byte-identical registry set produces the same `sourceHash` regardless of where it lives (native flags replace the old swap/restore workaround 1:1).
- `manifest.json` `inputs[].path` records the **actual** read location — repo-relative when inside the repo, absolute otherwise.

## Optional registries and enrichment (degrade gracefully)

The compiler consumes these when present and stays green when absent — each absence is recorded as a `manifest.json` warning:

- `registries/icons-metadata.json` → icons index inside `llms-components.txt` (or a separate `llms-icons.txt` slice if the combined slice would exceed the 25k-token budget), an Icons section in `llms.txt`, and a bundle byte-copy.
- `registries/patterns-index.json` → `skills/build-screen/references/patterns.md`, a Patterns section in `llms.txt`, `composition.patterns` in `extension-points.json`, and a bundle byte-copy.
- Per-entry `components-index.json` fields `racProps` (inherited-but-legal RAC props), `tokenPrefix` (component-token prefix or null), and `storyFile` → inherited-props and theming-hook lines in the component docs/slice, and registry-declared ground-truth stories.

## Emitted bundle (dist/<brand>/)

- `llms.txt` (≤ 2k tokens), `llms-components.txt`, `llms-tokens.txt`, `llms-theming.txt`, `llms-migration.txt` (≤ 25k tokens each), `llms-full.txt` (exempt)
- `extension-points.json` — machine contract for allowlisted customization (ADR-006 §4): brand/semantic/component-hook token overrides, derived composition slots, patterns, and the forbidden list citing NR ids
- `docs/<Component>.md` + `docs/tokens.md` — markdown twins
- `skills/*` + `.well-known/skills/index.json` — use-system, build-screen, migrate, contribute-component, audit-a11y
- `AGENTS.md` / `CLAUDE.md` — repo router files
- `editor/cursor/…`, `editor/copilot/…`, `editor/claude/…`, `editor/v0/instructions.md` — four channels rendering the SAME core rule body (no drift, tested)
- `agents/ds-auditor.md` — compiled reviewer agent
- `registries/*.json` — byte-copies of the source registries
- `manifest.json` — every emitted file + every source input with sha256, budgets, warnings

## Gates

```sh
pnpm --filter @ds/context build && pnpm --filter @ds/context typecheck && pnpm --filter @ds/context test
```

Token budgets are build failures, not warnings. Hand-editing any emitted file is a build failure at the repo gate (CI recompiles and diffs — ADR-004).
