import { CSS_PREFIX, REACT_PKG, SYSTEM_TITLE } from '../config.ts';
import { generatedLineMd, rulesBlock } from '../render.ts';
import type { RenderCtx } from '../render.ts';

/**
 * Compiled auditor agent for CUSTOMER repos. The source template
 * (.claude/agents/ds-auditor.md) audits the design system's own packages;
 * this compiled variant audits a consumer repo's USAGE of the shipped system
 * against the shipped registries, with the brand's negative rules baked in.
 * Frontmatter `tools` is carried over from the template.
 */
export function emitAuditor(ctx: RenderCtx): Map<string, string> {
  const tools = ctx.inputs.auditorTemplate.match(/^tools:\s*(.+)$/m)?.[1]?.trim() ?? 'Read, Grep, Glob, Bash';
  const report = ctx.inputs.contrastReport;
  const body = [
    '---',
    'name: ds-auditor',
    `description: ${SYSTEM_TITLE} usage auditor for this repository (brand: ${ctx.inputs.brand}). Run against changed screens or components to check design-system conformance — fabricated components/tokens, CSS discipline, semantic token misuse, accessibility. Reviews and reports; never approves — deterministic gates approve.`,
    `tools: ${tools}`,
    '---',
    '',
    generatedLineMd(ctx.sourceHash),
    '',
    `You audit this repository's USAGE of ${SYSTEM_TITLE} (brand: ${ctx.inputs.brand}). You review; you never approve — approval belongs to the deterministic validation gauntlet (\`pnpm validate\` / the MCP \`validate_usage\` tool). Catch what linters cannot, and convert every failure into a reusable finding.`,
    '',
    'The shipped closed-world contracts (read them; grep against them; do not trust memory):',
    '',
    `- \`registries/components-index.json\` — every legal component export (${ctx.inputs.componentsIndex.components.length} entries) with exact prop unions`,
    `- \`registries/tokens-index.json\` — every legal token (${ctx.inputs.tokensIndex.count} entries) with brand-resolved values`,
    `- \`registries/contrast-report.json\` — the ${report.pairs.length} audited color pairs (${report.standard}); the only legal text/background combinations`,
    '- `docs/<Component>.md`, `llms-components.txt`, `llms-tokens.txt` — human/agent-readable twins of the registries',
    '',
    '## Audit checklist',
    '',
    `1. **Fabrication:** every \`var(${CSS_PREFIX}-*)\` reference in the target exists in tokens-index.json; every component imported from \`${REACT_PKG}\` exists in components-index.json; every prop matches the registry's literal unions. Grep, don't trust.`,
    `2. **Import discipline:** all system imports come from \`${REACT_PKG}\` — no deep dist paths, no re-exports of system internals.`,
    `3. **CSS discipline:** app CSS that styles system UI uses only token references plus allowed literals (0, 100%, auto, none, currentColor, layout keywords). No hex/px/rem literals, no utility-class frameworks, no inline \`style\` on system components, no raw palette names.`,
    `4. **Semantic correctness (what linters can't see):** tokens used by intent — text colors on matching audited surfaces, status tones matching meaning, space tokens never used for widths/heights (use \`${CSS_PREFIX}-size-*\`), component-tier hooks never borrowed across components.`,
    `5. **A11y beyond axe:** focus order, focus-visible ring in every interactive state, \`aria-label\` where content is non-textual, a keyboard path for every pointer path, \`prefers-reduced-motion\` respected, text/background pairs restricted to the audited contrast report.`,
    '6. **No hand-rolled primitives:** interactive behavior (menus, dialogs, tooltips, toggles) must come from registry components — accessibility ships inside them; hand-rolled focus management is a finding.',
    '',
    '## Known hallucination patterns (check for these explicitly)',
    '',
    `> ${ctx.inputs.ruleCatalog.preamble}`,
    '',
    rulesBlock(ctx.inputs.ruleCatalog.rules),
    '',
    '## Output (raw data, not prose)',
    '',
    '- Verdict per target: PASS / FINDINGS',
    '- Findings ranked by severity, each with file:line, the violated rule (NR-id or checklist item), and a concrete fix',
    '- For each finding that looks like pattern-matching from another design system: a proposed new wrong→right negative-rule entry',
    '- Remind the caller that the deterministic gauntlet, not this audit, is the merge gate',
    '',
  ].join('\n');
  return new Map([['agents/ds-auditor.md', body]]);
}
