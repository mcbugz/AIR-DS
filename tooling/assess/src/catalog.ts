/**
 * Business framing per check: the concrete risk when the check fails, and the
 * AIR-DS capability that closes it. Static, deterministic prose — the scanner
 * decides WHICH of these appear (by measured deficit), never invents text.
 */

export interface GapFraming {
  risk: string;
  closedBy: string;
  /** Present when the gap is closable in days, not quarters. */
  quickWin?: string;
}

export const GAP_CATALOG: Record<string, GapFraming> = {
  'TOK-1': {
    risk: 'Design decisions live in code and tooling configs, not portable data. Every AI agent styling a screen re-derives values by guessing, and no tool can enumerate what is legal.',
    closedBy: 'AIR-DS token pipeline: W3C DTCG source compiled to CSS variables, TypeScript types, and a machine registry (@ds/tokens); @ds/retrofit ingests existing CSS/Tailwind values into DTCG.',
    quickWin: 'Extract current color/spacing/type values into one DTCG JSON file — even uncompiled, it becomes the single list agents can be pointed at.',
  },
  'TOK-2': {
    risk: 'Without a build pipeline, tokens drift per platform and every re-brand is manual find-and-replace across formats.',
    closedBy: 'AIR-DS build pipeline: one DTCG source emitted to CSS custom properties, TS literal types, and registries per brand (@ds/tokens).',
  },
  'TOK-3': {
    risk: 'Styles that never flow through custom properties cannot be re-themed at runtime or per customer, and agents have no variable names to reference.',
    closedBy: 'AIR-DS emits every token as a --prefixed CSS custom property; components consume only var(--*) (mechanically enforced).',
  },
  'TOK-4': {
    risk: 'Inconsistent variable naming means agents (and new engineers) cannot predict a token name — so they invent one, and the invention looks plausible in review.',
    closedBy: 'AIR-DS single-namespace token taxonomy (--ds-*, renamable per customer) with generated naming documentation.',
  },
  'TOK-5': {
    risk: 'With no token registry there is no closed world: a fabricated token (--brand-blue-450) is indistinguishable from a real one until it silently renders unstyled in production.',
    closedBy: 'AIR-DS generated tokens-index.json: every legal token enumerated; anything else is provably fabricated and lint-blocked.',
    quickWin: 'Generate a token index JSON from existing CSS variables — one script, immediate closed world for linting.',
  },
  'TOK-6': {
    risk: 'Raw-scale names (blue-500) hard-couple usage sites to today\'s palette. A re-brand or dark mode becomes a full-codebase audit instead of a token-file swap.',
    closedBy: 'AIR-DS semantic tier (--ds-color-surface-raised, never --ds-blue-500 at usage sites) with brand values isolated one tier below.',
  },
  'CMP-1': {
    risk: 'No enumerable component layer means every screen is bespoke — AI agents rebuild buttons and dialogs from divs, each one a fresh accessibility and consistency liability.',
    closedBy: 'AIR-DS component library: token-driven, WCAG-tested React components; @ds/retrofit wraps existing components into the governed layer.',
  },
  'CMP-2': {
    risk: 'Untyped components accept anything — an agent passing variant="prmary" ships without a compile error and fails silently in front of users.',
    closedBy: 'AIR-DS TypeScript-strict component APIs; invalid props fail the build, not the user.',
  },
  'CMP-3': {
    risk: 'Loose string props are an open invitation to hallucination: agents invent variant values that type-check and render broken. Literal unions make invalid combinations physically inexpressible.',
    closedBy: 'AIR-DS discriminated-union prop contracts, generated into the component registry agents consume.',
  },
  'CMP-4': {
    risk: 'Without a component registry, an agent-invented <Stack> or <Box> is unprovable — Ant Design maintains an allow-list precisely because this happens constantly.',
    closedBy: 'AIR-DS components-index.json: every export with exact prop shapes, generated from code, lint-enforced closed world.',
    quickWin: 'Generate a components index from the barrel exports — enumeration alone makes invention detectable.',
  },
  'CMP-5': {
    risk: 'Without per-variant stories there is no ground-truth usage corpus — agents learn component usage from the wild web instead of from your contract.',
    closedBy: 'AIR-DS story-per-variant convention with interaction tests; stories compile into agent context.',
  },
  'MS-1': {
    risk: 'Agents integrating without an MCP server guess from stale training data. 17 of 20 leading design systems now ship one — consumers increasingly expect to query, not scrape.',
    closedBy: 'AIR-DS MCP server (@ds/mcp): search_docs, get_component, list_tokens, validate_usage — theme-aware, credential-free, stdio-only.',
  },
  'MS-2': {
    risk: 'No llms.txt means every agent session burns tokens re-discovering the system from raw source — or skips discovery and fabricates.',
    closedBy: 'AIR-DS compiled llms.txt family (index + full + concern slices), regenerated from docgen sources every release, never hand-written.',
    quickWin: 'Compile a first llms.txt from existing docs — a day of work that upgrades every agent session immediately.',
  },
  'MS-3': {
    risk: 'Without repo agent files, every AI coding session starts contextless; conventions are re-explained per session or violated.',
    closedBy: 'AIR-DS emits small AGENTS.md / CLAUDE.md routers pointing at indexed references — retrieval over persisted context.',
    quickWin: 'Add a one-page AGENTS.md router pointing at the real docs — smallest possible surface, immediate effect.',
  },
  'MS-4': {
    risk: 'No skills distribution means agent workflows (build a screen, migrate a pattern) are re-invented by each consumer team at varying quality.',
    closedBy: 'AIR-DS compiled skills (router + lazy references) distributed via .well-known/skills.',
  },
  'MS-5': {
    risk: 'Editor assistants (Cursor/Copilot) operate rule-free, so their suggestions ignore the design system in the very editor where most code is written.',
    closedBy: 'AIR-DS emits path-scoped editor rules from the same source as skills, so channels never drift.',
    quickWin: 'Emit a .cursor/rules file from existing conventions — one compiled file covers the most-used surface.',
  },
  'ENF-1': {
    risk: 'No CI gate means every quality property is opt-in. Whatever agents or humans produce merges on trust.',
    closedBy: 'AIR-DS validation gauntlet wired as a merge-blocking CI workflow (typecheck → lint → build → test/a11y → registry check).',
    quickWin: 'Add a CI workflow running the existing build and tests — the gate exists before it is strict.',
  },
  'ENF-2': {
    risk: 'Hard-coded values merge silently, and each one is a future re-brand defect and an agent training example that fabrication is acceptable.',
    closedBy: 'AIR-DS token lint rules (@ds/validate): every literal color/dimension flagged mechanically; no LLM in the merge path.',
  },
  'ENF-3': {
    risk: 'Accessibility regressions ship undetected until an audit or a lawsuit finds them. Agent-generated UI multiplies the exposure.',
    closedBy: 'AIR-DS axe-based a11y testing inside the gauntlet plus WCAG evidence artifacts per release.',
  },
  'ENF-4': {
    risk: 'Without evals, agent-facing behavior is unmeasured — rule regressions are discovered by customers instead of by CI.',
    closedBy: 'AIR-DS evals.json per rule (critical gates at 1.0) wired into CI, with a nightly benchmark against baseline.',
    quickWin: 'Encode the top-5 known agent failure modes as eval cases — measurement starts the same week.',
  },
  'ENF-5': {
    risk: 'Thin test coverage means neither humans nor agents get fast feedback; regressions surface in production.',
    closedBy: 'AIR-DS component test + interaction-test conventions (Vitest + Testing Library + axe), enforced by the gauntlet.',
  },
  'WL-1': {
    risk: 'Brand expression woven through component code makes each re-brand (or white-label customer) a fork — the most expensive possible theming architecture.',
    closedBy: 'AIR-DS brand tier: a customer is one token data file plus optional semantic overrides; zero component code changes (@ds/ingest pipeline).',
  },
  'WL-2': {
    risk: 'Every hard-coded value is invisible to theming, breaks in dark mode, and teaches AI agents that fabricated values pass review. This is the single strongest predictor of agent-generated UI drift.',
    closedBy: 'AIR-DS token discipline: 100% var(--*) component styles, mechanically enforced by @ds/validate; @ds/retrofit migrates existing literals to tokens.',
  },
  'WL-3': {
    risk: 'Usage sites naming raw palette steps (blue-500) cannot be re-themed by data alone — intent was never captured, only appearance.',
    closedBy: 'AIR-DS semantic-tier consumption rule, lint-enforced: usage sites state intent, the brand tier states appearance.',
  },
  'EVD-1': {
    risk: 'Without committed machine contracts, "what exists" is tribal knowledge — unverifiable by tools, auditors, or agents.',
    closedBy: 'AIR-DS registries/ (tokens, components, icons, patterns) generated from source every build.',
  },
  'EVD-2': {
    risk: 'Accessibility compliance is asserted, not evidenced. When procurement or legal asks for proof, there is none.',
    closedBy: 'AIR-DS contrast-report.json + browser-axe story sweeps, committed as auditor-ready evidence (evidence-pack command).',
  },
  'EVD-3': {
    risk: 'Quality has no time series — no one can say whether agent output, a11y, or drift got better or worse last quarter.',
    closedBy: 'AIR-DS metrics history (JSONL per commit) and nightly benchmark scores, aggregatable across repos by @ds/fleet.',
  },
  'EVD-4': {
    risk: 'Quality gates that only exist inside CI YAML cannot be run locally before a merge — feedback arrives post-hoc.',
    closedBy: 'AIR-DS one-command gauntlet (pnpm validate) reproducible on any checkout, byte-identical to the CI gate.',
    quickWin: 'Add a root "validate" script chaining existing checks — local parity with CI in an afternoon.',
  },
};
