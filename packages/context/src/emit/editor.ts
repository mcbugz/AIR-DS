import { coreRuleBody, generatedLineMd } from '../render.ts';
import type { RenderCtx } from '../render.ts';
import { SYSTEM_TITLE } from '../config.ts';

/**
 * Editor rules for Cursor / GitHub Copilot / Claude Code / v0 — all four
 * channels render the SAME core rule body used by the skills (single source,
 * multiple channels; ADR-004: channels never drift; v0 is an ADR-004 v1
 * target surface).
 */
export function emitEditorRules(ctx: RenderCtx): Map<string, string> {
  const body = coreRuleBody(ctx);
  const files = new Map<string, string>();

  files.set(
    'editor/cursor/.cursor/rules/ds.mdc',
    [
      '---',
      `description: ${SYSTEM_TITLE} rules — closed-world components and tokens, negative-rule catalog (brand: ${ctx.inputs.brand})`,
      'globs:',
      '  - "**/*.tsx"',
      '  - "**/*.ts"',
      '  - "**/*.css"',
      'alwaysApply: false',
      '---',
      '',
      generatedLineMd(ctx.sourceHash),
      '',
      `# ${SYSTEM_TITLE} rules`,
      '',
      body,
      '',
    ].join('\n'),
  );

  files.set(
    'editor/copilot/.github/copilot-instructions.md',
    [
      generatedLineMd(ctx.sourceHash),
      '',
      `# ${SYSTEM_TITLE} rules (brand: ${ctx.inputs.brand})`,
      '',
      'Applies to all `*.tsx`, `*.ts`, and `*.css` files in this repository.',
      '',
      body,
      '',
    ].join('\n'),
  );

  files.set(
    'editor/claude/CLAUDE.md',
    [
      generatedLineMd(ctx.sourceHash),
      '',
      `# ${SYSTEM_TITLE} rules (brand: ${ctx.inputs.brand})`,
      '',
      'Applies when editing `*.tsx`, `*.ts`, or `*.css` files in this repository.',
      '',
      body,
      '',
    ].join('\n'),
  );

  // v0 consumes project-level instructions: a concise markdown file pasted
  // into (or synced to) the v0 project's Settings -> Instructions, plus the
  // closed-world registry pointer so generations stay inside the registries.
  files.set(
    'editor/v0/instructions.md',
    [
      generatedLineMd(ctx.sourceHash),
      '',
      `# ${SYSTEM_TITLE} rules (brand: ${ctx.inputs.brand}) — v0 project instructions`,
      '',
      'Use as the v0 PROJECT-LEVEL instructions (Project Settings > Instructions). Applies to every generation in the project.',
      '',
      'Closed-world contracts (ship alongside this bundle — treat as the only source of truth):',
      '',
      '- `registries/components-index.json` — every legal component export with exact prop unions',
      '- `registries/tokens-index.json` — every legal token with brand-resolved values',
      '- `registries/contrast-report.json` — the only legal text/background color pairs',
      '',
      body,
      '',
    ].join('\n'),
  );

  return files;
}
