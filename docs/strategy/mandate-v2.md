# Mandate v2 — from design system to control plane

**Date:** 2026-08-19 · **Authorized:** repo owner, full execution without per-step approval · **Supersedes nothing** — extends the original brief (all phases 0–4 complete and gated).

## The thesis

Within the enterprise planning horizon, AI agents produce the majority of UI. The only open variable is whether that production is **governed or ungoverned**. AIR-DS v1 proved the governance mechanics on its own neutral system (closed-world registries, deterministic gauntlet, compiled context, zero fabrications end-to-end). Mandate v2 turns those mechanics into the product an enterprise CTO cannot decline: **the control plane for AI-generated UI** — attachable to the design systems they already have, observable across the fleet they already run, and provable to the auditors they already answer to.

## The six moves (this repo, this mandate)

| # | Move | Deliverable | Kills |
|---|---|---|---|
| M1 | **Assessment scanner** (`@ds/assess`) | Score ANY repo's AI-readiness: fabrication exposure, context coverage, enforcement gaps → scored report + business framing. Credential-free, runs on a local path. | "Why would I need this?" — the diagnosis that makes the gap undeniable |
| M2 | **Retrofit ingestion** (`@ds/retrofit`) | Their existing DS in (CSS vars / Tailwind config / React lib) → our layer out (registries, machine surface, gauntlet config) on top of THEIR components. Proven against a committed legacy-DS fixture. | "We already have a design system" — the #1 objection becomes the purchase order |
| M3 | **Fleet control plane** (`@ds/fleet`) | Multi-repo metrics aggregation → static observability dashboard (hallucination rate, first-pass rate, adoption, drift, per-brand) + policy-as-code enforced by the gauntlet. | "How do I govern 300 repos?" — the artifact a CTO shows their board |
| M4 | **Generative-UI runtime contract** (`@ds/genui`) | A JSON schema agents emit at runtime that can only compose registry components + a validating renderer. Safe server-driven/agent-driven UI. | "What about agentic experiences themselves?" — the differentiator nobody else has |
| M5 | **Portability proof** (tokens platform emitters + one web component) | Tokens emitted for a second platform (web components CSS + React Native styles) and one registry-listed WC Button consuming them. | "You're a React shop" — architecture proven framework-agnostic once |
| M6 | **Evidence pack** (`@ds/validate evidence`) | One command → auditor-ready bundle: WCAG evidence (contrast + browser axe), provenance (git sha, artifact hashes, gauntlet/eval results), dependency inventory. | "Prove it to compliance" — the risk-number attachment |

## Out of this repo's reach (tracked, not attempted)

Lighthouse pilot (needs customers), Figma library/Code Connect (needs client credentials — the `design-to-code` skill ships the agnostic half), standards-body participation (human calendar work). Named here so absence reads as sequencing, not blindness.

## Rules unchanged

Credential-free everything; deterministic structure over prose; closed world; no LLM in any merge or scoring path; every new claim measured, every finding promoted to a rule.
