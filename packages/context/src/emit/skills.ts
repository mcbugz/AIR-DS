import { COMPILER_PKG, CSS_PREFIX, REACT_PKG, SYSTEM_TITLE } from '../config.ts';
import {
  CLOSED_WORLD,
  GAP_VS_SPACE,
  componentTokenGroups,
  coreRuleBody,
  generatedLineMd,
  rulesBlock,
  semanticCategories,
  sortedComponents,
} from '../render.ts';
import type { RenderCtx } from '../render.ts';

interface SkillDef {
  name: string;
  description: string;
}

const SKILLS: SkillDef[] = [
  {
    name: 'use-system',
    description:
      'How to build UI with this design system: closed-world registries, token-only styling, the negative-rule catalog of known hallucinations. Load before writing any component or CSS.',
  },
  {
    name: 'build-screen',
    description:
      'Workflow for composing a full screen: enumerate the registry, compose components with token-based layout CSS, then pass the deterministic validation gauntlet.',
  },
  {
    name: 'migrate',
    description:
      'Migrating existing UI (raw HTML/CSS, Tailwind, Chakra/MUI/Ant/shadcn) onto this design system, driven by the wrong→right negative-rule catalog.',
  },
  {
    name: 'contribute-component',
    description:
      'Adding a new component to the design system itself: exact file set, TSX/CSS/story/test rules, and the generate+typecheck+test gate. Compiled from CONTRIBUTING-COMPONENT.md.',
  },
  {
    name: 'audit-a11y',
    description:
      'Accessibility audit checklist beyond automated axe runs: focus order, focus-visible rings, keyboard paths, ARIA labeling, contrast pairs from the audited report.',
  },
];

function skillHeader(ctx: RenderCtx, def: SkillDef): string {
  return [
    '---',
    `name: ${def.name}`,
    `description: ${def.description}`,
    '---',
    '',
    generatedLineMd(ctx.sourceHash),
    '',
  ].join('\n');
}

export function emitSkills(ctx: RenderCtx): Map<string, string> {
  const files = new Map<string, string>();
  files.set('skills/use-system/SKILL.md', useSystemSkill(ctx));
  files.set('skills/use-system/references/negative-rules.md', negativeRulesRef(ctx));
  files.set('skills/use-system/references/components.md', componentsRef(ctx));
  files.set('skills/use-system/references/tokens.md', tokensRef(ctx));
  files.set('skills/build-screen/SKILL.md', buildScreenSkill(ctx));
  files.set('skills/build-screen/references/checklist.md', buildScreenChecklist(ctx));
  if (ctx.inputs.patternsIndex !== null) {
    files.set('skills/build-screen/references/patterns.md', buildScreenPatternsRef(ctx));
  }
  files.set('skills/migrate/SKILL.md', migrateSkill(ctx));
  files.set('skills/migrate/references/migration-map.md', migrationMapRef(ctx));
  files.set('skills/contribute-component/SKILL.md', contributeSkill(ctx));
  files.set('skills/contribute-component/references/contributing.md', contributingRef(ctx));
  files.set('skills/audit-a11y/SKILL.md', auditA11ySkill(ctx));
  files.set('skills/audit-a11y/references/contrast-pairs.md', contrastPairsRef(ctx));
  files.set('.well-known/skills/index.json', skillsIndex(ctx));
  return files;
}

function skillsIndex(ctx: RenderCtx): string {
  const index = {
    $description: `GENERATED skills discovery manifest for ${SYSTEM_TITLE} — compiled by ${COMPILER_PKG}, do not edit. Source hash sha256:${ctx.sourceHash.slice(0, 16)}.`,
    brand: ctx.inputs.brand,
    skills: SKILLS.map((s) => ({
      name: s.name,
      description: s.description,
      path: `skills/${s.name}/SKILL.md`,
    })),
  };
  return JSON.stringify(index, null, 2) + '\n';
}

/* ------------------------------------------------------------ use-system */

function useSystemSkill(ctx: RenderCtx): string {
  const def = SKILLS[0] as SkillDef;
  return [
    skillHeader(ctx, def),
    `# Use ${SYSTEM_TITLE} (brand: ${ctx.inputs.brand})`,
    '',
    // The stale-training-data preamble + the FULL negative-rule catalog live in
    // this router by design — they are the highest-value tokens in the bundle.
    coreRuleBody(ctx),
    '',
    '## References (load on demand)',
    '',
    '- [references/components.md](references/components.md): quick index of every component export with import lines',
    '- [references/tokens.md](references/tokens.md): token categories and usage guidance',
    '- [references/negative-rules.md](references/negative-rules.md): the negative-rule catalog with full rationale',
    '- `../../llms-components.txt` / `../../llms-tokens.txt`: full props tables and resolved token values',
    '',
  ].join('\n');
}

function negativeRulesRef(ctx: RenderCtx): string {
  return [
    generatedLineMd(ctx.sourceHash),
    '',
    '# Negative rules — observed agent hallucinations (wrong → right)',
    '',
    `> ${ctx.inputs.ruleCatalog.preamble}`,
    '',
    rulesBlock(ctx.inputs.ruleCatalog.rules),
    '',
  ].join('\n');
}

function componentsRef(ctx: RenderCtx): string {
  const out = [
    generatedLineMd(ctx.sourceHash),
    '',
    '# Component index',
    '',
    CLOSED_WORLD,
    '',
    `Every export comes from \`${REACT_PKG}\`. Full props tables: \`../../llms-components.txt\` or \`../../docs/<Name>.md\`.`,
    '',
  ];
  for (const comp of sortedComponents(ctx)) {
    const firstSentence = comp.description.replace(/\s*\n\s*/g, ' ').split(/(?<=\.)\s/)[0] ?? '';
    const rac = comp.racBase === null ? 'static' : `rac: ${comp.racBase}`;
    out.push(`- **${comp.name}** (${rac}) — ${firstSentence}`);
  }
  out.push('');
  return out.join('\n');
}

function tokensRef(ctx: RenderCtx): string {
  const sem = semanticCategories(ctx.inputs.tokensIndex.tokens);
  const compGroups = componentTokenGroups(ctx.inputs.tokensIndex.tokens);
  return [
    generatedLineMd(ctx.sourceHash),
    '',
    '# Token quick reference',
    '',
    `${ctx.inputs.tokensIndex.count} tokens total. Resolved values for this brand: \`../../llms-tokens.txt\` or \`../../docs/tokens.md\`.`,
    '',
    '## Semantic categories',
    '',
    ...[...sem.entries()].map(
      ([cat, tokens]) => `- \`${CSS_PREFIX}-${cat}-*\` — ${tokens.length} tokens (${tokens.slice(0, 3).map((t) => `\`${t.cssVar}\``).join(', ')}${tokens.length > 3 ? ', …' : ''})`,
    ),
    '',
    '## Component hooks (belong to their component ONLY)',
    '',
    ...[...compGroups.entries()].map(([comp, tokens]) => `- \`${CSS_PREFIX}-${comp}-*\` — ${tokens.length} hooks`),
    '',
    '## Usage guidance',
    '',
    `- Pick by intent: surfaces from \`${CSS_PREFIX}-color-surface-*\`, text from \`${CSS_PREFIX}-color-text-*\`, actions from \`${CSS_PREFIX}-color-accent-*\`, status from \`${CSS_PREFIX}-color-status-*\`.`,
    `- Space tokens ONLY in margin/padding/gap/inset. Box dimensions use \`${CSS_PREFIX}-size-control-*\` / \`${CSS_PREFIX}-size-icon-*\`.`,
    `- ${GAP_VS_SPACE}`,
    `- Text on solid status fills is \`var(${CSS_PREFIX}-color-text-inverse)\` — there is no \`text-on-danger\` style token.`,
    `- Only foreground/background pairs present in registries/contrast-report.json are legal color combinations.`,
    '',
  ].join('\n');
}

/* ----------------------------------------------------------- build-screen */

function buildScreenSkill(ctx: RenderCtx): string {
  const def = SKILLS[1] as SkillDef;
  return [
    skillHeader(ctx, def),
    `# Build a screen with ${SYSTEM_TITLE}`,
    '',
    `> ${ctx.inputs.ruleCatalog.preamble}`,
    '',
    '## Workflow',
    '',
    `1. **Enumerate the closed world first.** Read \`registries/components-index.json\` (${ctx.inputs.componentsIndex.components.length} exports) and \`registries/tokens-index.json\` (${ctx.inputs.tokensIndex.count} tokens) — or the llms-components.txt / llms-tokens.txt slices. Plan the screen ONLY in terms of what is enumerated there plus plain semantic HTML.`,
    `2. **Compose.** Import components from \`${REACT_PKG}\` only. Layout is plain elements + CSS Modules with space tokens (\`display: flex; gap: var(${CSS_PREFIX}-space-gap-md)\`) — there are no Box/Stack/Grid components. Copy prop usage from the registry \`@example\` blocks and the Storybook stories (ground truth), not from memory.`,
    `3. **Style with tokens by intent.** Every color/size/space/radius/shadow/motion value in your CSS is \`var(${CSS_PREFIX}-*)\` from the registry. No hex, no px/rem literals, no utility classes.`,
    `4. **Validate deterministically.** Run \`pnpm validate\` (typecheck → lint → build → test/a11y → registry check) — or the MCP \`validate_usage\` tool — and fix until green. The gauntlet approves; you do not.`,
    '',
    'Full checklist: [references/checklist.md](references/checklist.md). Rules and known hallucinations: `../use-system/SKILL.md`.',
    ...(ctx.inputs.patternsIndex !== null
      ? [
          '',
          `Approved composition patterns (${ctx.inputs.patternsIndex.patterns.length}): [references/patterns.md](references/patterns.md) — check for an existing pattern before composing a screen from scratch.`,
        ]
      : []),
    '',
  ].join('\n');
}

/** Pattern summaries (from OPTIONAL registries/patterns-index.json). */
function buildScreenPatternsRef(ctx: RenderCtx): string {
  const patterns = ctx.inputs.patternsIndex?.patterns ?? [];
  const out = [
    generatedLineMd(ctx.sourceHash),
    '',
    '# Approved composition patterns',
    '',
    `${patterns.length} patterns enumerated in registries/patterns-index.json. A pattern names an approved composition of registry components — prefer reusing one over inventing an equivalent layout.`,
    '',
  ];
  for (const p of patterns) {
    const parts: string[] = [`- **${p.title ?? p.name}** (\`${p.name}\`)`];
    if (p.description !== undefined) parts.push(`— ${p.description}`);
    if (p.components !== undefined && p.components.length > 0) {
      parts.push(`— components: ${[...p.components].sort().map((c) => `\`${c}\``).join(', ')}`);
    }
    if (p.docFile !== undefined) parts.push(`— full doc: \`${p.docFile}\``);
    if (p.storyFile !== undefined) parts.push(`— ground truth: \`${p.storyFile}\``);
    if (p.keywords !== undefined && p.keywords.length > 0) parts.push(`— keywords: ${p.keywords.join(', ')}`);
    out.push(parts.join(' '));
  }
  out.push('');
  return out.join('\n');
}

function buildScreenChecklist(ctx: RenderCtx): string {
  return [
    generatedLineMd(ctx.sourceHash),
    '',
    '# Screen checklist',
    '',
    '- [ ] Every imported component exists in registries/components-index.json (grep, do not trust memory)',
    `- [ ] Every import comes from \`${REACT_PKG}\` — no deep paths`,
    `- [ ] Every \`var(${CSS_PREFIX}-*)\` reference exists in registries/tokens-index.json`,
    '- [ ] No hex/rgb/px/rem literals, no utility classes, no inline `style`',
    '- [ ] Space tokens only in margin/padding/gap/inset; widths/heights use size tokens',
    '- [ ] Layout via plain elements + flex/grid CSS, not layout components',
    '- [ ] Text/background combinations limited to pairs audited in registries/contrast-report.json',
    '- [ ] Interactive elements are registry components (accessibility ships inside) — nothing hand-rolled',
    '- [ ] `pnpm validate` passes end to end',
    '',
  ].join('\n');
}

/* ---------------------------------------------------------------- migrate */

function migrateSkill(ctx: RenderCtx): string {
  const def = SKILLS[2] as SkillDef;
  return [
    skillHeader(ctx, def),
    `# Migrate existing UI to ${SYSTEM_TITLE}`,
    '',
    `> ${ctx.inputs.ruleCatalog.preamble}`,
    '',
    '## Workflow',
    '',
    '1. Enumerate the target closed world (registries or llms slices) before touching legacy code.',
    '2. Map each legacy pattern using [references/migration-map.md](references/migration-map.md) — utility classes → token CSS, layout components → plain elements + space tokens, hue-scale colors → intent tokens.',
    '3. Port screen by screen; never carry over fabricated components, utility classes, or inline styles.',
    '4. Gate every ported screen on `pnpm validate`. The full migration slice lives at `../../llms-migration.txt`.',
    '',
  ].join('\n');
}

function migrationMapRef(ctx: RenderCtx): string {
  return [
    generatedLineMd(ctx.sourceHash),
    '',
    '# Migration map (wrong → right)',
    '',
    `| Coming from | You will reach for | Use instead |`,
    `| --- | --- | --- |`,
    `| Tailwind | \`className="p-4 rounded-lg text-gray-600"\` | CSS Module: \`padding: var(${CSS_PREFIX}-space-4); border-radius: var(${CSS_PREFIX}-radius-lg); color: var(${CSS_PREFIX}-color-text-muted);\` |`,
    `| Tailwind | \`w-64\`, \`h-10\` via space scale | \`${CSS_PREFIX}-size-control-*\` / \`${CSS_PREFIX}-size-icon-*\` for box dimensions |`,
    `| Chakra/MUI/Ant | \`<Box>\`, \`<Stack>\`, \`<Flex>\`, \`<Grid>\`, \`<Container>\` | plain elements + \`display:flex; gap: var(${CSS_PREFIX}-space-gap-md)\` |`,
    `| Chakra/MUI | \`<Heading level={2}>\`, \`<Text size="sm">\` | \`<h2>\`, \`<p>\` + \`var(${CSS_PREFIX}-text-size-*)\` / \`var(${CSS_PREFIX}-text-weight-*)\` — but Dialog owns its title: pass the required \`title\` prop, never add a heading to name a dialog |`,
    `| MUI/Emotion | \`sx\`/\`css\` props, \`styled()\` | CSS Modules consuming \`${CSS_PREFIX}-*\` tokens; components accept \`className\` only |`,
    `| Any DS | deep imports (\`${REACT_PKG}/dist/Button\`) | \`import { Button } from '${REACT_PKG}'\` |`,
    `| Raw CSS | hex/rgb literals, \`:hover\`/\`:disabled\` pseudo-classes | intent tokens; \`[data-hovered]\` / \`[data-disabled]\` data attributes |`,
    '',
    '## Full negative-rule catalog',
    '',
    rulesBlock(ctx.inputs.ruleCatalog.rules),
    '',
  ].join('\n');
}

/* --------------------------------------------------- contribute-component */

function contributeSkill(ctx: RenderCtx): string {
  const def = SKILLS[3] as SkillDef;
  return [
    skillHeader(ctx, def),
    `# Contribute a component to ${SYSTEM_TITLE}`,
    '',
    'Copy the `Button` pattern exactly. Five files, no extras, in `src/components/<Name>/`: `<Name>.tsx` (component + TSDoc), `<Name>.module.css` (token-only), `<Name>.stories.tsx` (CSF3 contract stories), `<Name>.test.tsx` (vitest + testing-library + axe), `index.ts` (single re-export).',
    '',
    '## Non-negotiables',
    '',
    `- Build on the react-aria-components base named in the inventory; never hand-roll keyboard/ARIA/focus.`,
    `- Every CSS value is \`var(${CSS_PREFIX}-*)\`; states via RAC data attributes, base class = lowercased component name.`,
    `- Inline literal-union props + TSDoc \`@default\`, \`@racBase\`, and a fenced \`@example\` — the registry compiles them verbatim.`,
    '- One story per variant, per state, and per variant×state with its own CSS; interaction tests prove events fire and blocked states do not.',
    '',
    '## Gate (all must pass)',
    '',
    '```',
    `pnpm --filter ${REACT_PKG} generate`,
    `pnpm --filter ${REACT_PKG} typecheck`,
    `pnpm --filter ${REACT_PKG} test`,
    '```',
    '',
    'Then verify your entry in `registries/components-index.json` (exact literal unions, defaults, racBase, example). Never edit generated files by hand.',
    '',
    'Full compiled reference: [references/contributing.md](references/contributing.md).',
    '',
  ].join('\n');
}

function contributingRef(ctx: RenderCtx): string {
  return [
    generatedLineMd(ctx.sourceHash),
    '',
    '<!-- Compiled verbatim from packages/react/CONTRIBUTING-COMPONENT.md -->',
    '',
    ctx.inputs.contributingMd.trimEnd(),
    '',
  ].join('\n');
}

/* -------------------------------------------------------------- audit-a11y */

function auditA11ySkill(ctx: RenderCtx): string {
  const def = SKILLS[4] as SkillDef;
  const report = ctx.inputs.contrastReport;
  return [
    skillHeader(ctx, def),
    `# Accessibility audit (${SYSTEM_TITLE})`,
    '',
    `Standard: ${report.standard}, threshold ${report.threshold}:1. Automated axe checks run in the gauntlet; this skill covers what axe cannot see. You review and report — the deterministic gauntlet approves.`,
    '',
    '## Checklist (beyond axe)',
    '',
    '- [ ] Focus order follows reading order; no focus traps outside modal overlays',
    `- [ ] Focus-visible ring present in EVERY interactive state (\`[data-focus-visible]\` → \`var(${CSS_PREFIX}-color-border-focus)\` outline + \`var(${CSS_PREFIX}-shadow-focus-ring)\`)`,
    '- [ ] `aria-label` provided wherever content is non-textual (IconButton requires it at the type level)',
    '- [ ] Every pointer interaction has a keyboard path (components ship this — verify compositions do not break it)',
    '- [ ] `prefers-reduced-motion` respected wherever motion tokens are used',
    '- [ ] Disabled states keep AA-safe recipes (never accent/status fill under lightened text)',
    '- [ ] Text/background token pairs limited to audited pairs: [references/contrast-pairs.md](references/contrast-pairs.md)',
    `- [ ] Current brand report: ${report.failures} failures across ${report.pairs.length} audited pairs (registries/contrast-report.json)`,
    '',
  ].join('\n');
}

function contrastPairsRef(ctx: RenderCtx): string {
  const report = ctx.inputs.contrastReport;
  const pairs = report.pairs
    .slice()
    .sort((a, b) => (a.foreground + a.background).localeCompare(b.foreground + b.background));
  return [
    generatedLineMd(ctx.sourceHash),
    '',
    `# Audited contrast pairs (brand: ${ctx.inputs.brand})`,
    '',
    `${report.standard}; required ratio ${report.threshold}:1; ${report.failures} failures. These are the ONLY legal text/background token combinations.`,
    '',
    '| Foreground | Background | Ratio | Pass |',
    '| --- | --- | --- | --- |',
    ...pairs.map((p) => `| \`${p.foreground}\` | \`${p.background}\` | ${p.ratio} | ${p.pass ? 'yes' : 'NO'} |`),
    '',
  ].join('\n');
}

export { SKILLS };
