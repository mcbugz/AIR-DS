import { CSS_PREFIX, REACT_PKG, SYSTEM_TITLE } from '../config.ts';
import {
  componentTokenGroups,
  fenced,
  generatedLineMd,
  propsTable,
  racBaseNote,
  semanticCategories,
  sortedComponents,
  tokensTable,
} from '../render.ts';
import type { RenderCtx } from '../render.ts';
import type { ComponentEntry } from '../types.ts';

/** Markdown twins: docs/<Component>.md per registry export + docs/tokens.md. */
export function emitDocs(ctx: RenderCtx): Map<string, string> {
  const files = new Map<string, string>();
  for (const comp of sortedComponents(ctx)) {
    files.set(`docs/${comp.name}.md`, componentDoc(ctx, comp));
  }
  files.set('docs/tokens.md', tokensDoc(ctx));
  return files;
}

function a11yNotes(ctx: RenderCtx, comp: ComponentEntry): string[] {
  const notes: string[] = [];
  if (comp.racBase !== null) {
    notes.push(
      `- Keyboard behavior, ARIA semantics, and focus management come from react-aria-components \`${comp.racBase}\` — never re-implement or bypass them.`,
      `- Interaction states are exposed as data attributes (\`[data-hovered]\`, \`[data-focus-visible]\`, \`[data-disabled]\`, …); the focus-visible ring uses \`var(${CSS_PREFIX}-color-border-focus)\` and \`var(${CSS_PREFIX}-shadow-focus-ring)\`.`,
    );
  } else {
    notes.push(`- Static component rendered as plain semantic HTML; roles/ARIA are set by the component where needed (see description).`);
  }
  const ariaProp = comp.props.find((p) => p.name === 'aria-label');
  if (ariaProp) {
    notes.push(`- \`aria-label\` is ${ariaProp.required ? 'REQUIRED (typed-required — non-textual content)' : 'available'} on this component.`);
  }
  notes.push(
    `- Color pairs used by this system are contrast-audited (${ctx.inputs.contrastReport.standard}); see registries/contrast-report.json. Only audited foreground/background token pairs are legal.`,
  );
  return notes;
}

function componentDoc(ctx: RenderCtx, comp: ComponentEntry): string {
  const stories = ctx.inputs.storyFilesByExport.get(comp.name) ?? [];
  return [
    generatedLineMd(ctx.sourceHash),
    '',
    `# ${comp.name}`,
    '',
    comp.description.replace(/\s*\n\s*/g, ' ').trim(),
    '',
    `Import: \`import { ${comp.name} } from '${REACT_PKG}';\` — the only public entry point.`,
    '',
    racBaseNote(comp),
    '',
    '## Props',
    '',
    propsTable(comp),
    '',
    '## Accessibility',
    '',
    ...a11yNotes(ctx, comp),
    '',
    '## Examples',
    '',
    fenced(comp.example, 'tsx'),
    '',
    ...(stories.length > 0
      ? ['Ground-truth stories (contract artifacts): ' + stories.map((s) => `\`${s}\``).join(', '), '']
      : []),
  ].join('\n');
}

function tokensDoc(ctx: RenderCtx): string {
  const { tokensIndex, brand } = ctx.inputs;
  const out: string[] = [
    generatedLineMd(ctx.sourceHash),
    '',
    `# ${SYSTEM_TITLE} tokens (brand: ${brand})`,
    '',
    `${tokensIndex.count} tokens, resolved for the \`${brand}\` brand. Reference them only as \`var(${CSS_PREFIX}-…)\`; a token not listed here is fabricated.`,
    '',
    '## Semantic tier',
    '',
  ];
  for (const [cat, tokens] of semanticCategories(tokensIndex.tokens)) {
    out.push(`### ${cat}`, '', tokensTable(tokens), '');
  }
  out.push('## Component tier', '', `Per-component theming hooks. Each set belongs to its component ONLY (NR-008).`, '');
  for (const [comp, tokens] of componentTokenGroups(tokensIndex.tokens)) {
    out.push(`### ${comp}`, '', tokensTable(tokens), '');
  }
  return out.join('\n');
}
