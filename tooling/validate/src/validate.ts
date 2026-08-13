import { readFileSync } from 'node:fs';
import { checkCssFile } from './rules/css-rules.ts';
import { checkCodeFile } from './rules/code-rules.ts';
import { checkModuleClassRefs } from './rules/module-classes.ts';
import { findRepoRoot, loadRegistryContext } from './registry.ts';
import type { RegistryContext, SourceFile, ValidateResult, Violation } from './types.ts';

/**
 * Programmatic validation API. `validateSources` is pure (used by the eval
 * runner and benchmark scorer with hermetic fixture registries);
 * `validateFiles` reads paths from disk against the live workspace registries.
 * The MCP server's validate_usage imports these.
 */

export function validateSources(files: SourceFile[], ctx: RegistryContext): ValidateResult {
  const violations: Violation[] = [];
  for (const f of files) {
    const path = f.path.replace(/\\/g, '/');
    if (path.endsWith('.module.css') || path.endsWith('.css')) {
      violations.push(...checkCssFile(f.path, f.content, ctx));
    } else if (/\.(tsx|ts|jsx|js|mjs)$/.test(path)) {
      violations.push(...checkCodeFile(f.path, f.content, ctx));
    }
  }
  // G10 / NR-011 is cross-file (tsx <-> its imported .module.css).
  violations.push(...checkModuleClassRefs(files));
  return { ok: violations.length === 0, violations, filesChecked: files.length };
}

export interface ValidateFilesOptions {
  /** Workspace root containing registries/ (defaults to walking up to pnpm-workspace.yaml). */
  root?: string;
  /** Pre-built registry context (skips the fresh disk read). */
  registry?: RegistryContext;
}

export function validateFiles(paths: string[], opts: ValidateFilesOptions = {}): ValidateResult {
  const root = opts.root ?? findRepoRoot(process.cwd());
  // Always re-read registries fresh unless one was injected — sibling
  // processes regenerate them between runs.
  const ctx = opts.registry ?? loadRegistryContext(root);
  const files: SourceFile[] = paths.map((p) => ({ path: p, content: readFileSync(p, 'utf8') }));
  return validateSources(files, ctx);
}
