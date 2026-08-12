import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUDGETS, COMPILER_PKG, COMPILER_VERSION, estimateTokens } from './config.ts';
import { combinedHash, sha256 } from './hash.ts';
import { loadInputs } from './inputs.ts';
import type { RenderCtx } from './render.ts';
import type { EmittedFile, Manifest } from './types.ts';
import { emitLlms } from './emit/llms.ts';
import { emitDocs } from './emit/docs.ts';
import { emitSkills } from './emit/skills.ts';
import { emitAgentFiles } from './emit/agents.ts';
import { emitEditorRules } from './emit/editor.ts';
import { emitAuditor } from './emit/auditor.ts';
import { emitExtensionPoints } from './emit/extension-points.ts';

export interface CompileOptions {
  brand?: string;
  /** ISO timestamp for the manifest. Defaults to build time (pass it for byte-identical builds). */
  now?: string;
  repoRoot?: string;
  outDir?: string;
  /**
   * Directory containing the registry JSON files (native brand-input support
   * for the ingest pipeline — no swap/restore). Default: <repoRoot>/registries.
   */
  registriesDir?: string;
  /** Path to the brand file hashed as an input. Default: <repoRoot>/brands/<brand>.json. */
  brandPath?: string;
}

export interface CompileReport {
  brand: string;
  outDir: string;
  sourceHash: string;
  files: EmittedFile[];
  warnings: string[];
  manifestPath: string;
}

const DEFAULT_REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** Budget classes: llms.txt gets the index budget; slices get the slice budget; llms-full.txt is exempt. */
function budgetFor(path: string): number | null {
  if (path === 'llms.txt') return BUDGETS.index;
  if (/^llms-(?!full).*\.txt$/.test(path)) return BUDGETS.slice;
  return null;
}

export function compile(options: CompileOptions = {}): CompileReport {
  const brand = options.brand ?? 'default';
  const repoRoot = options.repoRoot ?? DEFAULT_REPO_ROOT;
  const outDir = options.outDir ?? join(repoRoot, 'packages/context/dist', brand);

  const inputs = loadInputs(repoRoot, brand, {
    ...(options.registriesDir !== undefined ? { registriesDir: options.registriesDir } : {}),
    ...(options.brandPath !== undefined ? { brandPath: options.brandPath } : {}),
  });
  const sourceHash = combinedHash(inputs.rawInputs);
  const now = options.now ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(now))) {
    throw new Error(`--now must be an ISO timestamp, got: ${now}`);
  }
  const ctx: RenderCtx = { inputs, sourceHash };

  // ---- render everything (deterministic: sorted iteration, no clocks) ----
  const rendered = new Map<string, Buffer>();
  const add = (files: Map<string, string>) => {
    for (const [path, content] of files) {
      if (rendered.has(path)) throw new Error(`duplicate emitted path: ${path}`);
      rendered.set(path, Buffer.from(content, 'utf8'));
    }
  };
  add(emitLlms(ctx));
  add(emitDocs(ctx));
  add(emitSkills(ctx));
  add(emitAgentFiles(ctx));
  add(emitEditorRules(ctx));
  add(emitAuditor(ctx));
  add(emitExtensionPoints(ctx));

  // Ship the closed-world contracts inside the bundle (byte-copies of the
  // registries) so the auditor + skills reference paths that exist. The
  // optional registries (icons/patterns) are copied only when present.
  for (const reg of [
    'registries/tokens-index.json',
    'registries/components-index.json',
    'registries/contrast-report.json',
    'registries/icons-metadata.json',
    'registries/patterns-index.json',
  ]) {
    const buf = inputs.rawInputs.get(reg);
    if (buf !== undefined) rendered.set(reg, buf);
  }

  // ---- enforce token budgets (build failure, not a warning) ----
  for (const [path, buf] of rendered) {
    const budget = budgetFor(path);
    if (budget !== null) {
      const est = estimateTokens(buf.toString('utf8'));
      if (est > budget) {
        throw new Error(`${path} exceeds its token budget: ~${est} tokens > ${budget}`);
      }
    }
  }

  // ---- write (clean slate for determinism: no stale files survive) ----
  rmSync(outDir, { recursive: true, force: true });
  const files: EmittedFile[] = [];
  for (const path of [...rendered.keys()].sort()) {
    const buf = rendered.get(path) as Buffer;
    const abs = join(outDir, path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, buf);
    files.push({
      path,
      sha256: sha256(buf),
      bytes: buf.length,
      estTokens: estimateTokens(buf.toString('utf8')),
    });
  }

  const manifest: Manifest = {
    $description: `GENERATED manifest for the ${COMPILER_PKG} agent-context bundle — every emitted file with its sha256, plus the source inputs it was compiled from. Do not edit.`,
    brand,
    generatedAt: now,
    compiler: `${COMPILER_PKG}@${COMPILER_VERSION}`,
    sourceHash: `sha256:${sourceHash}`,
    budgets: { indexMaxTokens: BUDGETS.index, sliceMaxTokens: BUDGETS.slice },
    // Manifest input paths are the ACTUAL read locations (repo-relative when
    // inside the repo, absolute when --registries-dir/--brand-path point out).
    inputs: [...inputs.rawInputs.keys()].sort().map((path) => ({
      path: inputs.inputPaths.get(path) ?? path,
      sha256: sha256(inputs.rawInputs.get(path) as Buffer),
    })),
    files,
    warnings: inputs.warnings,
  };
  const manifestPath = join(outDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  return { brand, outDir, sourceHash, files, warnings: inputs.warnings, manifestPath };
}
