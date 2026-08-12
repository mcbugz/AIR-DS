PROJECT BRIEF

**White-Label, AI-Ready Design System**

*A machine-readable, agent-operable design system we build once, brand
per customer, and ship with the AI tooling that makes customer
engineering teams — and their AI agents — productive on day one.*

Prepared: August 2026 · Audience: Design system core team (design +
engineering) · Status: Ready to start

1\. Why this, why now

The July 2026 field study **“State of AI in Design Systems”** (Kaelig
Deloumeau-Prigent) audited 20 leading design systems and cataloged 150+
techniques for making a design system consumable by AI agents. The
headline: this is no longer experimental. 17–19 of 20 systems ship MCP
servers, 18 ship agent skills, 14 publish llms.txt. The debate about
**whether** to build machine interfaces is over; the leaders now compete
on how well they slice, gate, validate, and maintain that context.

For us the opportunity is sharper than for a product company. Every
customer we serve is being pushed to generate UI with AI agents, and
agents produce garbage against design systems they cannot read: invented
components, fabricated tokens, off-brand drift. A white-label design
system that is AI-ready out of the box lets a customer’s teams and
agents produce on-brand, accessible, validated UI from week one — and
lets us re-theme and redeploy the whole stack, including the AI tooling,
per customer in days rather than months.

**Guiding principle (from the field study): “Instruction hopes the model
complies. Structure checks.”** Everything in this brief follows that
gradient — we prefer deterministic structure (types, linters,
validators, registries) over prose instructions, and prose instructions
over nothing.

2\. What we are building

One neutral core system, engineered for re-branding, with a complete AI
consumption layer that regenerates automatically per customer:

- **Core UI kit:** a token-driven React + TypeScript component library
  (12–15 foundational components at v1), Storybook-documented, WCAG 2.2
  AA, with a matching Figma library.

- **White-label theming:** all brand expression isolated in a swappable
  brand token tier; a customer theme is a data file, not a fork.

- **AI consumption layer:** MCP server, llms.txt family, agent skills,
  editor rules, repo agent files, machine-readable registries — all
  compiled from the same source of truth and re-emitted per customer
  brand.

- **Enforcement layer:** validators, evals, and CI gates that make
  hallucinated UI provably impossible to merge.

*Out of scope for v1: native mobile, multi-framework ports
(Vue/Angular), and a hosted docs product. The architecture must not
preclude them.*

3\. Architecture: four layers, one source of truth

Every artifact below is **compiled, never hand-written**. The field
study is unambiguous that hand-authored agent docs rot; the best systems
(Mantine, Cloudscape, HeroUI, Astryx) regenerate llms.txt, markdown
twins, and MCP metadata from docgen sources on every release. Our build
pipeline is the product.

Layer 1 — Tokens (the foundation and the white-label mechanism)

- W3C DTCG-format token JSON as the single source of truth; Style
  Dictionary (or equivalent) compiles to CSS custom properties, TS
  types, and Figma variables.

- **Three tiers:** brand (raw values — the ONLY tier a customer theme
  may replace) → semantic (intent-named: --ds-color-surface-raised,
  never --ds-blue-500 at usage sites) → component (per-component hooks).

- Semantic names describe intent, not appearance — agents and humans
  pick tokens by purpose. No hard-coded value anywhere in component CSS;
  a lint rule enforces this mechanically.

- Published token registry (tokens-index.json) so any tool — or agent —
  can enumerate every legal token. A token that is not in the registry
  is provably fabricated (the SLDS / Carbon pattern).

Layer 2 — Components (typed, enumerated, closed-world)

- TypeScript component APIs with discriminated unions for variants —
  invalid prop combinations fail at compile time, so agents physically
  cannot emit them.

- **Closed component registry:** components-index.json enumerating every
  export with exact prop shapes, generated from the code. Ant Design’s
  allow-list exists specifically because agents hallucinate
  Box/Stack/Container/Heading; enumeration makes invention detectable.

- Storybook stories are contract artifacts, not decoration: every
  variant and state gets a story with interaction tests; stories double
  as the agents’ ground-truth usage examples.

- Accessibility is built into the component, not the consumer: keyboard
  behavior, ARIA, focus management ship inside; built on proven
  primitives (e.g., React Aria or Floating UI) rather than hand-rolled —
  the agent-teams case study found the library-research step prevented
  rebuilding 300 lines of keyboard navigation that a dependency already
  provided.

Layer 3 — Machine-readable surface (compiled per release, per customer)

| **Artifact** | **What it is / best-in-class pattern** |
|----|----|
| llms.txt family | Compact llms.txt index + llms-full.txt + concern-based slices (components / tokens / theming / migration), token-budget aware — the Chakra / HeroUI / Nord pattern. Regenerated every release. |
| Markdown twins | Every docs page also served as .md (content negotiation or /raw/ paths) so agents fetch clean text, not HTML — the Spectrum / Nord / Cloudscape pattern. |
| MCP server | One npm-distributed server: search_docs, get_component (docs + props + examples), list_tokens, validate_usage, audit_checklist-as-tool. Same core toolset the whole industry converged on; ours adds theme awareness (answers reflect the active customer brand). |
| Agent skills | SKILL.md router + lazy-loaded reference files (the Carbon pattern: small router, 12+ on-demand reference files). Consumer skills: use-system, build-screen, migrate. Builder skills: contribute-component, audit-a11y. Distributed via npx skills add and /.well-known/skills/. |
| Repo agent files | Small, vendor-neutral AGENTS.md / CLAUDE.md routers that point to indexed references — retrieval over persisted context. Field study: top-level agent files are deliberately small. |
| Editor rules | Path-scoped rules for Cursor / Copilot / Claude Code, emitted from the same source as the skills so channels never drift. |
| Registries | components-index.json, tokens-index.json, icons-metadata.json, patterns index — the machine contracts everything else validates against. |

Layer 4 — Enforcement (structure checks; deterministic gates block the
merge)

- **Validation gauntlet:** a fixed, mandatory command sequence —
  typecheck → lint (incl. token/import rules) → build → a11y audit →
  registry grep for fabricated tokens/components — that agents must run
  and pass before finishing (the Chakra five-step / Mantine
  fixed-sequence pattern). Exposed as a single validate command and as
  an MCP tool.

- **Named-failure negative rules:** the study’s most effective
  prohibitions name the exact failure: “Never emit Box/Stack/Container —
  they do not exist; use Flex or Grid.” We maintain a living catalog of
  observed hallucinations with wrong→right pairs, plus a “your training
  data is stale” preamble (Ant Design / HeroUI pattern).

- **Evals as regression tests:** every skill rule gets a
  prompt→expectation pair in a committed evals.json (the shadcn
  pattern); critical gates require a 1.0 pass rate (the PatternFly
  pattern). AI artifacts are versioned, measured software.

- **Nightly benchmark:** agent-generated screens vs. a baseline (e.g.,
  raw shadcn/Tailwind), scored on fidelity, a11y, token compliance;
  results logged publicly-to-the-team, including losses (the Astryx
  pattern).

- **Hard rule: no LLM in the merge-blocking path.** Linters, type
  checks, and validators gate merges; LLMs draft, review, and fix, but
  never approve.

4\. The white-label model

White-labeling is a token-and-pipeline problem, not a component problem.
The rules that make that true:

1.  **Customer = theme file.** A customer engagement produces one
    brand-tier token file (colors, type, radii, elevation, logo assets)
    plus optional semantic overrides. Zero component code changes for
    standard engagements.

2.  **Brand ingest pipeline.** Intake from brand guidelines or Figma →
    generate brand tier → automated contrast/a11y validation of every
    semantic mapping → build. Target: new customer theme in under 5
    working days.

3.  **AI artifacts rebuild per customer.** llms.txt, MCP metadata,
    skills, and editor rules are re-emitted with the customer’s brand
    values and component set, published to a private npm scope per
    customer. Their agents consume THEIR system, not a generic one.

4.  **Allowlisted extension points.** Customization happens through
    declared APIs (token overrides, slots, composition). Prohibition
    rules in the agent layer name what may not be overridden — the
    mechanism the study calls gated walled gardens, which is how we
    prevent per-customer forks from drifting.

5.  **Neutral voice everywhere.** Vendor-neutral naming (ds- prefix,
    renamable at build), no brand assumptions in docs prose, USWDS-style
    vendor-neutral agent files so the system works in whichever AI
    tooling the customer runs.

5\. The ten practices we are adopting (best of the best)

Distilled from the field study’s 150+ techniques, the AI-Ready Index
criteria, the AI-Ready Roadmap, and both case studies — these are the
non-negotiables, each traced to the system that proved it:

| **\#** | **Practice** | **Proven by** |
|----|----|----|
| 1 | DTCG semantic tokens, three-tiered, with a published token registry; theming touches only the brand tier | Index framework; SLDS; Carbon |
| 2 | Typed components with discriminated unions + closed component registry (invention is provable) | Index framework; Ant Design; Carbon |
| 3 | Compiled context: llms.txt tiers + markdown twins regenerated every release, never hand-written | Mantine; Cloudscape; Chakra; Nord |
| 4 | MCP server with the converged core toolset + validation-as-a-tool | 17 of 20 systems; shadcn; USWDS |
| 5 | Skills as router + lazy-loaded references; distribute via npx skills add and .well-known | Carbon; Nuxt UI; PatternFly; Spectrum |
| 6 | Small repo agent files; retrieval over persisted context | Carbon; Cloudscape; field-study finding 16 |
| 7 | Named-failure negative rules with wrong→right exemplar pairs | Ant Design; shadcn; HeroUI; Atlassian |
| 8 | Deterministic validation gauntlet agents must pass; no LLM in the merge gate | Chakra; Primer; Polaris; Astryx |
| 9 | Evals per rule (1.0 on critical gates) + nightly benchmark vs. baseline, losses logged | shadcn; PatternFly; Astryx; Atlassian |
| 10 | Figma Code Connect + spec-extraction tooling (design→brief.md before code) | Carbon; Primer; agent-teams case study |

**On \#10, note the market gap:** only 2 of 20 systems ship Code Connect
despite the entire design-to-code narrative depending on it. The
agent-teams case study showed why it matters — 70% of output quality is
determined in the understand/extract phase, and its worst failure (27
fabricated tokens producing an unstyled-but-passing component) was
eliminated permanently by three encoded rules plus registry linting.
Doing design-to-code grounding well is our clearest differentiation.

6\. Roadmap and deliverables

Phases follow the AI-Ready Roadmap arc (Define → Create → Adopt →
Evolve). Durations are planning targets, not commitments; each phase has
a hard acceptance gate.

| **Phase** | **Scope & key deliverables** | **Acceptance gate** |
|----|----|----|
| 0 · Define (2 wks) | Naming/prefix, reference stack decision record, target agent surfaces (Claude Code, Cursor, Copilot, v0), component inventory for v1, governance + ownership, token taxonomy spec | Signed-off architecture decision records; v1 component list frozen |
| 1 · Foundations (5–6 wks) | DTCG token source + build pipeline; 12–15 components (typed, accessible, tested); Storybook; Figma library wired to token variables; docs as structured MDX/docgen | Zero hard-coded values (lint-proven); WCAG 2.2 AA on all components; registries generate from code |
| 2 · Machine surface (3–4 wks) | llms.txt family + markdown twins; MCP server v1; skills v1 (router + references); AGENTS.md + editor rules; .well-known discovery; all compiled in CI | A fresh agent with only our MCP + skills builds a reference screen with zero invented tokens/components |
| 3 · Enforcement (3–4 wks) | Validation gauntlet command + CI gates; negative-rule catalog v1; evals.json wired to CI; nightly benchmark harness vs. baseline | Critical evals at 1.0; benchmark running nightly with published scores |
| 4 · White-label ops (ongoing) | Brand ingest pipeline; per-customer artifact builds + private npm scopes; Code Connect on the Figma library; pilot with 1–2 friendly customers | New customer theme + full AI layer shipped in ≤5 working days; pilot teams’ agents pass the gauntlet first-try ≥80% |

7\. Team shape

- **DS lead (1):** owns architecture decisions, governance, and the
  acceptance gates.

- **Designers (2):** token taxonomy and theming model; Figma library,
  variables, and Code Connect coverage.

- **Component engineers (2–3):** typed components, Storybook, a11y,
  validation tooling.

- **AI/DX engineer (1):** MCP server, skills, llms.txt pipeline, evals,
  benchmark harness — this role is the difference between a design
  system and an AI-ready one; staff it deliberately.

- **Docs engineer (0.5–1):** docgen pipeline, markdown twins, structured
  MDX.

Working method: use agent teams to build the system itself (the
agent-teams case study got a production component from Figma in 3 hours
vs. 15–20 manual, with zero hand-written component code) — but with its
human gates intact: architecture decisions, degraded-input halts, and
manual checks for screen readers, motion, and design intent. Roughly
half of failures are automatable with rules, a quarter need better
tooling, and a quarter need humans; plan capacity accordingly.

8\. Success metrics

- **Hallucination rate:** fabricated tokens/components in agent output →
  0 (registry-linted, tracked per release).

- **Eval pass rate:** 1.0 on critical gates; ≥0.95 overall, tracked in
  CI.

- **First-pass gauntlet rate:** % of agent-generated PRs passing
  validation on first attempt (target ≥80%).

- **Nightly benchmark:** win rate vs. baseline on fidelity / a11y /
  token compliance, trend published.

- **Time-to-theme:** brand intake → customer-branded system incl. AI
  artifacts, ≤5 working days.

- **Adoption:** per customer — % of new UI built through the system,
  agent sessions using our MCP/skills.

9\. Risks and open decisions

- **Open vs. gated distribution:** the industry is split (Nuxt UI
  maximizes open discovery; Shopify Polaris blocks AI crawlers and
  routes everything through its own toolkit). For white-label,
  per-customer private distribution effectively is the gated model — but
  decide explicitly per customer whether docs are publicly crawlable.

- **Maintenance debt:** every AI artifact we hand-write becomes rot.
  Mitigation is architectural: nothing agent-facing is authored by hand
  (Phase 2 gate enforces this).

- **Vendor churn:** agent formats are consolidating (AGENTS.md, MCP,
  skills) but still moving; emit all channels from one source so a
  format change is a compiler change.

- **Scope discipline:** the field study covers sophisticated, dedicated
  teams; not every customer needs every layer. The architecture is
  modular so smaller engagements can ship layers 1–3 without 4.

Appendix: Sources

- **State of AI in Design Systems (field study, Kaelig
  Deloumeau-Prigent, July 2026) —**
  https://state-of-ai-in-design-systems.netlify.app/ (see /techniques
  and /insights)

- **AI-Ready Design System Index / readiness framework
  (DesignSystems.one, Kiryl Zhukouski) —**
  https://www.designsystems.one/ai-ready

- **AI-Ready Design System Roadmap (designsystems.surf, Ilya Greben) —**
  https://designsystems.surf/products/ai-ready-roadmap

- **Case study: Building design system components with AI agent teams
  (Kaelig Deloumeau-Prigent) —**
  https://www.kaelig.fr/design-system-components-with-ai-agent-teams/

- **Case study: How To Make Your Design System AI-Ready (Hardik Pandya,
  Smashing Magazine) —**
  https://www.smashingmagazine.com/2026/06/how-make-design-system-ai-ready/

- **Original LinkedIn post (Vitaly Friedman) —** Summary of the field
  study with 17 takeaways
