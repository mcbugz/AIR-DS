import { coreRuleBody, generatedLineMd } from '../render.ts';
import type { RenderCtx } from '../render.ts';
import { SYSTEM_TITLE } from '../config.ts';

/**
 * Editor rules for Cursor / GitHub Copilot / Claude Code — all three channels
 * render the SAME core rule body used by the skills (single source, multiple
 * channels; ADR-004: channels never drift).
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

  return files;
}
