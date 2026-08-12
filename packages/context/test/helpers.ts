import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile } from '../src/compile.ts';
import type { CompileOptions, CompileReport } from '../src/compile.ts';

export const FIXED_NOW = '2026-01-01T00:00:00.000Z';

export interface BuiltBundle {
  report: CompileReport;
  outDir: string;
  cleanup: () => void;
}

export function buildBundle(brand = 'default', extra: Partial<CompileOptions> = {}): BuiltBundle {
  const outDir = mkdtempSync(join(tmpdir(), 'ds-context-test-'));
  const report = compile({ brand, now: FIXED_NOW, outDir, ...extra });
  return { report, outDir, cleanup: () => rmSync(outDir, { recursive: true, force: true }) };
}

/** Recursive file listing, relative posix paths, sorted. */
export function walk(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

export function readOut(outDir: string, rel: string): string {
  return readFileSync(join(outDir, rel), 'utf8');
}
