# AIR-DS — the record

One document, changelog-style, tying together what this project set out to be, what it became, and why it changed. Primary sources are preserved unmodified and linked per entry; every claim here is checkable against the git history and the gates that enforced it.

> The one constant across every entry: **"Instruction hopes the model complies. Structure checks."**

---

## v0 — The thesis (2026-08-12)

**Source: [docs/brief.md](brief.md) · Phase gates: [decisions/](decisions/)**

The starting bet, grounded in the July 2026 *State of AI in Design Systems* field study (Kaelig Deloumeau-Prigent; 20 systems audited): machine-readable design systems had stopped being experimental — 17 of 20 leaders shipped MCP servers — and the differentiator had moved to how well systems *enforce* correctness on AI-generated UI. The plan: one neutral, token-driven design system in four layers (tokens → typed components → compiled machine surface → deterministic enforcement), white-labeled per customer as a single brand token file, with **nothing agent-facing hand-written** and **no LLM anywhere in the merge path**.

## v0.1 — The system, built and gated (2026-08-12)

**Sources: [architecture.md](architecture.md) · six ADRs · [specs/](specs/)**

Built by an agent team in five waves (exemplar → adversarial audit → freeze the pattern → parallel fan-out → deterministic gate), with every phase closing on its acceptance gate:

- **Tokens:** DTCG source, three tiers, brand-only theming; WCAG-AA contrast gate that fails the build (a bad palette cannot ship — it gets auto-repaired and logged).
- **Components:** 14 components + 25 icons on react-aria-components, typed literal-union props, a11y inside; 97 stories as contract artifacts.
- **Machine surface:** llms.txt family, markdown twins, agent skills, editor rules for four channels, a theme-aware MCP server, per-customer auditor agent — all compiled from the registries.
- **Enforcement:** the validation gauntlet, a living negative-rule catalog (NR-001…013 — each an observed AI hallucination class, promoted to a deterministic check + eval pair), and a fixture-replay benchmark.
- **White-label proof:** the `acme` sample customer — intake file → fully branded system including every AI artifact in ~260 ms.

The acceptance tests that matter: a **blind consumer agent** (compiled artifacts only, no source) built a reference screen with **zero fabricated tokens or components**; a **live MCP client session** passed the full matrix; an **outside-contributor agent** got a new component gauntlet-green on the first try from the checklist alone. Zero fabrications held across the entire build — roughly thirty agent engagements.

## v2 — The pivot: design system → control plane (2026-08-19)

**Source: [strategy/mandate-v2.md](strategy/mandate-v2.md)**

The reframe, from asking how an enterprise CTO would evaluate this: the components are commodity; the *governance mechanics* are the product. Enterprises don't need another design system — they need their **existing** systems made safe for agent-scale UI production. Six capabilities shipped in one mandate, all credential-free and deterministic:

| Capability | The one-line proof |
|---|---|
| `ds-assess` — score any repo's AI-readiness | this repo: 99.4/A; a typical 2023 DS fixture: 6.6/F, gaps named |
| `ds-retrofit` — their system in, AI layer out | committed legacy fixture → 48-file machine surface on *their* components |
| `ds-fleet` — govern N repos + policy-as-code | policy breaches block merges; this repo governs itself, 6/6 green |
| `@ds/genui` — safe generative UI at runtime | 51-case fuzz: every injection rejected or rendered inert |
| Portability — WC + React Native emitters | existing outputs proven byte-identical while platforms were added |
| Evidence pack — auditor bundle in one command | refuses to certify a broken system (proven live, seven refusals) |

## v2.1 — Hardened in public (2026-08-19)

What shipping to a real URL surfaced, and what each cost:

- **CI vs. local truth:** three "works locally" failures traced to build-chain gaps; ended structurally — the root build now produces every workspace artifact in dependency order, proven by wiping all dists and rebuilding from the chain alone.
- **A human eye caught what the tooling couldn't:** the site header's brand mark rendered at a measured 3.45:1 (a CSS specificity bug) — the browser-axe sweep audits component stories, not the marketing page. Fixed to 17:1; the gap became a backlog item.
- **The doom loop (FB-16):** adopting our own fleet policy deadlocked our own merge gate — the first-pass metric counted every dev-loop run against the release, so each fix attempt worsened the number. Fixed by correcting the metric's semantics (first run per release), not by moving the threshold.
- **Measured, not estimated — enforced on ourselves:** an external review caught the README and deck disagreeing about test counts (662 vs ~1,300). The measured truth was **1,013 tests across eleven packages**; all surfaces now carry it, and generating these numbers from the build is queued (FB-17).

## Current state & open items

**Live:** [the demo site](https://mcbugz.github.io/AIR-DS/) (real components, live brand switcher) · gauntlet 6/6 incl. self-governance · evals 21/21 at 1.0 critical · 0 axe violations across 97 stories · 0 fabrications, ever.

**Open, tracked honestly:** the Figma library + Code Connect (needs design tooling; the `design-to-code` skill ships the tool-agnostic half) · pilot customers (the ≥80% first-pass field gate) · [feedback-backlog.md](specs/feedback-backlog.md) (FB-1…17) · repo governance decisions (license, ownership, open-source slicing) pending with the owner and counsel.

---

*Every entry above was produced under the same discipline it describes: agent-built, adversarially audited, deterministically gated, and committed at phase gates. The git log is the unabridged version of this document.*
