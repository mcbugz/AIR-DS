import { BUDGETS, CSS_PREFIX, REACT_PKG, SYSTEM_TITLE, estimateTokens } from '../config.ts';
import {
  CLOSED_WORLD,
  GAP_VS_SPACE,
  componentTokenGroups,
  dialogTitleNote,
  fenced,
  generatedLineTxt,
  propsTable,
  racBaseNote,
  racPropsLine,
  rulesBlock,
  semanticCategories,
  sortedComponents,
  tokenPrefixLine,
  tokensTable,
} from '../render.ts';
import type { RenderCtx } from '../render.ts';

export function emitLlms(ctx: RenderCtx): Map<string, string> {
  const files = new Map<string, string>();
  const iconsBlock = renderIconsBlock(ctx);
  let components = renderComponentsSlice(ctx);

  // Icons ride inside llms-components.txt while the slice budget allows;
  // when the combined slice would blow the hard budget, they split out into
  // their own llms-icons.txt slice (which the budget gate checks like any slice).
  let iconsSlice: string | null = null;
  if (iconsBlock !== null) {
    const combined = `${components}\n${iconsBlock}\n`;
    if (estimateTokens(combined) <= BUDGETS.slice) {
      components = combined;
    } else {
      iconsSlice = [
        `# ${SYSTEM_TITLE} — icons (brand: ${ctx.inputs.brand})`,
        generatedLineTxt(ctx.sourceHash),
        '',
        CLOSED_WORLD,
        '',
        iconsBlock,
        '',
      ].join('\n');
      files.set('llms-icons.txt', iconsSlice);
    }
  }

  const tokens = renderTokensSlice(ctx);
  const theming = renderThemingSlice(ctx);
  const migration = renderMigrationSlice(ctx);
  files.set('llms.txt', renderIndex(ctx, iconsSlice !== null));
  files.set('llms-components.txt', components);
  files.set('llms-tokens.txt', tokens);
  files.set('llms-theming.txt', theming);
  files.set('llms-migration.txt', migration);
  files.set(
    'llms-full.txt',
    [
      `# ${SYSTEM_TITLE} — full context (brand: ${ctx.inputs.brand})`,
      generatedLineTxt(ctx.sourceHash),
      '',
      'Concatenation of every concern slice. Prefer the individual slices when your context window is constrained.',
      '',
      components,
      ...(iconsSlice !== null ? ['', iconsSlice] : []),
      '',
      tokens,
      '',
      theming,
      '',
      migration,
    ].join('\n'),
  );
  return files;
}

/** Icons section (from OPTIONAL registries/icons-metadata.json); null when absent. */
function renderIconsBlock(ctx: RenderCtx): string | null {
  const icons = ctx.inputs.iconsMetadata;
  if (icons === null || icons.icons.length === 0) return null;
  const hasExports = icons.icons.some((i) => i.export !== undefined);
  const out: string[] = [
    `## Icons (${icons.icons.length})`,
    '',
    `Every legal icon is enumerated in registries/icons-metadata.json — an icon name not listed there is fabricated; never inline ad-hoc SVG for system iconography.` +
      (hasExports
        ? ` Icons are named exports (\`export\` below) from the icon entry point declared in registries/icons-metadata.json.`
        : ''),
    '',
  ];
  for (const icon of icons.icons) {
    const meta: string[] = [];
    if (icon.export !== undefined) meta.push(`export \`${icon.export}\``);
    if (icon.category !== undefined) meta.push(icon.category);
    if (icon.keywords !== undefined && icon.keywords.length > 0) meta.push(`keywords: ${icon.keywords.join(', ')}`);
    const suffix = meta.length > 0 ? ` (${meta.join('; ')})` : '';
    out.push(`- \`${icon.name}\`${icon.description !== undefined ? ` — ${icon.description}` : ''}${suffix}`);
  }
  return out.join('\n');
}

function renderIndex(ctx: RenderCtx, hasIconsSlice: boolean): string {
  const { inputs } = ctx;
  const compCount = inputs.componentsIndex.components.length;
  const icons = inputs.iconsMetadata;
  const patterns = inputs.patternsIndex;
  return [
    `# ${SYSTEM_TITLE} (brand: ${inputs.brand})`,
    generatedLineTxt(ctx.sourceHash),
    '',
    `A white-label, token-driven React + TypeScript design system: ${compCount} typed component exports built on react-aria-components (accessibility ships inside), styled exclusively through ${inputs.tokensIndex.count} \`${CSS_PREFIX}-*\` design tokens resolved for the active brand, WCAG 2.2 AA checked (${inputs.contrastReport.failures} contrast failures across ${inputs.contrastReport.pairs.length} audited pairs). Import everything from \`${REACT_PKG}\`.`,
    '',
    `> ${inputs.ruleCatalog.preamble}`,
    '',
    CLOSED_WORLD,
    '',
    '## Context slices (fetch on demand)',
    '',
    '- [llms-components.txt](llms-components.txt): every component — description, exact props, base-component note, example' +
      (icons !== null && !hasIconsSlice ? '; includes the icons index' : ''),
    ...(hasIconsSlice ? ['- [llms-icons.txt](llms-icons.txt): every legal icon with metadata'] : []),
    '- [llms-tokens.txt](llms-tokens.txt): every token by category — name, CSS variable, description, brand-resolved value',
    '- [llms-theming.txt](llms-theming.txt): three-tier token model, brand-file mechanics, allowlisted extension points',
    '- [llms-migration.txt](llms-migration.txt): migrating from raw HTML / Tailwind / other design systems (negative-rule catalog)',
    '- [llms-full.txt](llms-full.txt): all slices concatenated',
    '',
    '## Other machine surfaces in this bundle',
    '',
    '- `registries/`: components-index.json, tokens-index.json, contrast-report.json' +
      `${icons !== null ? ', icons-metadata.json' : ''}${patterns !== null ? ', patterns-index.json' : ''} — the closed-world contracts`,
    '- `extension-points.json`: the machine contract for allowlisted customization (ADR-006) — everything not listed is closed',
    '- `docs/`: one markdown twin per component + tokens.md',
    '- `skills/` + `.well-known/skills/index.json`: use-system, build-screen, migrate, contribute-component, audit-a11y',
    '- `AGENTS.md` / `CLAUDE.md`: drop-in repo router files',
    '- `editor/`: Cursor / Copilot / Claude Code / v0 rules (same rule source as the skills)',
    '- `agents/ds-auditor.md`: reviewer agent for consumer repos (reviews only; deterministic gates approve)',
    '',
    ...(icons !== null
      ? [
          '## Icons',
          '',
          `${icons.icons.length} legal icons, enumerated in registries/icons-metadata.json (closed-world: an icon not listed does not exist). Index: ${hasIconsSlice ? 'llms-icons.txt' : 'llms-components.txt § Icons'}.`,
          '',
        ]
      : []),
    ...(patterns !== null
      ? [
          '## Patterns',
          '',
          `${patterns.patterns.length} approved composition patterns, enumerated in registries/patterns-index.json. Summaries: skills/build-screen/references/patterns.md; machine list: extension-points.json § composition.patterns.`,
          '',
        ]
      : []),
    '## Ground rules (compact)',
    '',
    `1. Import only from \`${REACT_PKG}\`; components not in the registry do not exist (no Box/Stack/Container/Heading/Text).`,
    `2. Style only with \`var(${CSS_PREFIX}-*)\` tokens by intent; no hex, px literals, utility classes, or raw palette scales.`,
    `3. Layout = plain elements + CSS with space tokens; box dimensions use \`${CSS_PREFIX}-size-*\`, never space tokens.`,
    `4. State styling uses react-aria data attributes (\`[data-hovered]\`), never \`:hover\`-style pseudo-classes.`,
    `5. Finish by passing \`pnpm validate\` (typecheck → lint → build → test/a11y → registry check). Deterministic gates approve; no LLM does.`,
    '',
  ].join('\n');
}

function renderComponentsSlice(ctx: RenderCtx): string {
  const out: string[] = [
    `# ${SYSTEM_TITLE} — components (brand: ${ctx.inputs.brand})`,
    generatedLineTxt(ctx.sourceHash),
    '',
    CLOSED_WORLD,
    '',
    `All ${ctx.inputs.componentsIndex.components.length} exports below come from \`${REACT_PKG}\` (the only public entry point). Props tables are generated from the code registry and are exact — including literal-union types.`,
    '',
  ];
  for (const comp of sortedComponents(ctx)) {
    const stories = ctx.inputs.storyFilesByExport.get(comp.name) ?? [];
    const inherited = racPropsLine(comp);
    const hooks = tokenPrefixLine(comp);
    const dialogNote = dialogTitleNote(comp);
    out.push(
      `## ${comp.name}`,
      '',
      `Import: \`import { ${comp.name} } from '${REACT_PKG}';\``,
      '',
      comp.description.replace(/\s*\n\s*/g, ' ').trim(),
      '',
      racBaseNote(comp),
      ...(dialogNote !== null ? ['', dialogNote] : []),
      '',
      propsTable(comp),
      ...(inherited !== null ? ['', inherited] : []),
      ...(hooks !== null ? ['', hooks] : []),
      '',
      '@example',
      fenced(comp.example, 'tsx'),
      ...(stories.length > 0 ? ['', `Ground-truth stories: ${stories.map((s) => `\`${s}\``).join(', ')}`] : []),
      '',
    );
  }
  return out.join('\n');
}

function renderTokensSlice(ctx: RenderCtx): string {
  const { tokensIndex, brand } = ctx.inputs;
  const out: string[] = [
    `# ${SYSTEM_TITLE} — tokens (brand: ${brand})`,
    generatedLineTxt(ctx.sourceHash),
    '',
    CLOSED_WORLD,
    '',
    `${tokensIndex.count} tokens. Values below are RESOLVED for the \`${brand}\` brand (source: ${tokensIndex.brand}); a different brand build re-emits this file with its own values. Reference tokens only as \`var(${CSS_PREFIX}-…)\` — never paste resolved values into code.`,
    '',
    `Tier rules: semantic tokens (intent-named) are the general vocabulary; component tokens (\`${CSS_PREFIX}-<component>-*\`) are theming hooks that belong to their component ONLY — never borrow another component's hooks. Space tokens are legal only in margin/padding/gap/inset; box dimensions use \`${CSS_PREFIX}-size-*\`.`,
    '',
    '## Semantic tier',
    '',
  ];
  for (const [cat, tokens] of semanticCategories(tokensIndex.tokens)) {
    out.push(`### ${cat} (${tokens.length})`, '', tokensTable(tokens), '');
  }
  out.push('## Component tier (per-component theming hooks)', '');
  for (const [comp, tokens] of componentTokenGroups(tokensIndex.tokens)) {
    out.push(`### ${comp} (${tokens.length})`, '', tokensTable(tokens), '');
  }
  return out.join('\n');
}

function renderThemingSlice(ctx: RenderCtx): string {
  const { brand, tokensIndex, contrastReport } = ctx.inputs;
  const hookGroups = componentTokenGroups(tokensIndex.tokens);
  const hookLines = [...hookGroups.entries()].map(
    ([comp, tokens]) => `- \`${CSS_PREFIX}-${comp}-*\` — ${tokens.length} hooks (see llms-tokens.txt for the exact list)`,
  );
  return [
    `# ${SYSTEM_TITLE} — theming (brand: ${brand})`,
    generatedLineTxt(ctx.sourceHash),
    '',
    'White-labeling is a token-and-pipeline problem, not a component problem. A customer theme is a data file, never a fork.',
    '',
    '## The three-tier token model',
    '',
    `1. **Brand tier** (\`brands/<name>.json\`) — raw values only: palette ramps (\`palette.{neutral,primary,…}.{50…950}\`), typefaces, type scale (base + ratio), radius scale, space base, elevation, logo assets. This is the ONLY tier a customer theme may replace.`,
    `2. **Semantic tier** (\`${CSS_PREFIX}-{category}-{concept}[-{variant}][-{state}]\`) — intent-named mappings onto brand ramp positions (\`${CSS_PREFIX}-color-surface-raised\`, never \`${CSS_PREFIX}-blue-500\`). Usage sites reference this tier. Customers do not edit mappings; semantic overrides are a separate, allowlisted layer.`,
    `3. **Component tier** (\`${CSS_PREFIX}-<component>-*\`) — per-component hooks consumed by that component's CSS. The per-component customer override surface.`,
    '',
    GAP_VS_SPACE,
    '',
    '## Brand-file mechanics',
    '',
    `A customer engagement produces one \`brands/<customer>.json\` in the same shape as the neutral core (\`brands/default.json\`): raw ramps, no intent. The pipeline then rebuilds everything: tokens-build resolves semantic + component tiers against the brand file, validates EVERY color mapping for WCAG 2.2 AA contrast (current brand: ${contrastReport.failures} failures across ${contrastReport.pairs.length} audited pairs), regenerates the registries, and re-runs this context compiler with \`--brand <customer>\` so llms.txt, docs, skills, editor rules, and the auditor agent all reflect the customer's resolved values. Zero component code changes for standard engagements.`,
    '',
    '## Allowlisted extension points (everything else is closed)',
    '',
    'Machine contract: `extension-points.json` in this bundle (ADR-006) — the authoritative allowlist.',
    '',
    '1. **Brand-tier token file** — replace raw ramp values wholesale.',
    '2. **Semantic overrides** — a separate, explicitly-allowlisted override layer applied at intake (contrast-validated like everything else).',
    '3. **Component-tier hooks** — override per-component custom properties:',
    ...hookLines,
    `4. **Composition + \`className\`** — every component accepts a plain-string \`className\` appended after its own classes; compose components and plain elements for layout.`,
    '',
    '## Not extension points (negative rules apply)',
    '',
    `- Semantic-tier intent mappings (customer files replace values, never mappings).`,
    `- Component CSS or component source — never fork.`,
    `- Raw palette scales at usage sites (\`${CSS_PREFIX}-blue-500\` does not exist publicly).`,
    `- Another component's hooks (overriding Alert must never restyle Badge).`,
    `- Inline \`style\` props — intentionally not supported; use tokens in CSS.`,
    '',
  ].join('\n');
}

function renderMigrationSlice(ctx: RenderCtx): string {
  const { ruleCatalog } = ctx.inputs;
  return [
    `# ${SYSTEM_TITLE} — migration (brand: ${ctx.inputs.brand})`,
    generatedLineTxt(ctx.sourceHash),
    '',
    `> ${ruleCatalog.preamble}`,
    '',
    'This slice maps habits from raw HTML/CSS, Tailwind, and other design systems onto this system. It is compiled from the living negative-rule catalog — every rule below was observed or anticipated as a real agent hallucination.',
    '',
    '## From Tailwind / utility CSS',
    '',
    `- Utility classes are not part of this system: replace \`className="p-4 rounded-lg text-gray-600"\` with a CSS Module class consuming tokens (\`padding: var(${CSS_PREFIX}-space-4); border-radius: var(${CSS_PREFIX}-radius-lg); color: var(${CSS_PREFIX}-color-text-muted);\`).`,
    `- Tailwind's spacing-scale-for-everything habit does not transfer: space tokens are only legal in margin/padding/gap/inset; widths and heights use \`${CSS_PREFIX}-size-*\` (e.g. \`${CSS_PREFIX}-size-control-md\`).`,
    `- Color utilities map to intent tokens, not hue scales: \`text-gray-600\` → \`var(${CSS_PREFIX}-color-text-secondary)\` or \`-muted\` by intent, never a raw scale.`,
    '',
    '## From Chakra / MUI / Ant / shadcn',
    '',
    `- Layout primitives (\`Box\`, \`Stack\`, \`Container\`, \`Flex\`, \`Grid\`, \`Spacer\`) and typography components (\`Heading\`, \`Text\`) do not exist here — intentionally. Use plain semantic HTML plus CSS with tokens. (Exception to hand-rolled headings: Dialog renders its own title from its required \`title\` prop — never add a heading element to name a dialog.)`,
    `- Theme-object styling (\`sx\`, \`css\` props, styled()) does not exist; components accept \`className\` only, and inline \`style\` is intentionally unsupported.`,
    `- Import from the single entry point \`${REACT_PKG}\`; deep dist paths are not public API.`,
    '',
    '## From raw HTML / hand-rolled CSS',
    '',
    `- Replace hex/rgb literals with intent tokens; the validator rejects hard-coded values in component CSS.`,
    `- Replace \`:hover\`/\`:focus-visible\`/\`:disabled\` pseudo-classes with react-aria data attributes (\`[data-hovered]\`, \`[data-focus-visible]\`, \`[data-disabled]\`) when styling this system's components.`,
    `- Do not hand-roll focus traps, keyboard navigation, or ARIA — the components ship it (react-aria-components).`,
    '',
    '## The negative-rule catalog (wrong → right)',
    '',
    rulesBlock(ruleCatalog.rules),
    '',
    '## Migration workflow',
    '',
    '1. Enumerate the closed world: read `registries/components-index.json` and `registries/tokens-index.json` (or llms-components.txt / llms-tokens.txt).',
    '2. Map each legacy element/class to a registry component or to plain HTML + tokens, using the pairs above.',
    '3. Port screen by screen; never carry over utility classes, inline styles, or fabricated components.',
    '4. Gate every ported screen on the deterministic gauntlet: `pnpm validate` (typecheck → lint → build → test/a11y → registry check).',
    '',
  ].join('\n');
}
