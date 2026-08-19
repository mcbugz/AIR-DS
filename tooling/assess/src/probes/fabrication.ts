/**
 * Fabrication-exposure probe: sample the repo's own component styles and
 * count hard-coded values (hex / color functions / named colors / non-zero
 * unit literals) against design-variable references. The ratio is reported
 * raw — honestly computed, never massaged.
 *
 * Literal verdicts REUSE @ds/validate's shared allowed-literal ruleset
 * (the same module the AIR-DS gauntlet and MCP validate_usage run), so a
 * value the gauntlet would flag is exactly what this probe counts.
 *
 * Sampling scope: hand-written styles only — generated output (dist/build/
 * coverage/…) and test/fixture/demo material are excluded, and stylesheets
 * that mostly DEFINE custom properties (token files) are classified as
 * definition files and excluded from the ratio (defining raw values is what
 * token files are for).
 */
import {
  extractJsxStyleObjects,
  scanCssValueLiterals,
  scanJsxStyleValue,
} from '@ds/validate';
import { countScssVarRefs, countVarRefs, cssDecls } from '../css-scan.ts';
import type { FabricationExposure } from '../types.ts';
import { isGenerated, isTestish, type RepoScan } from '../walk.ts';

interface FileTally {
  path: string;
  hardcoded: number;
  variableRefs: number;
}

export function probeFabrication(scan: RepoScan): FabricationExposure {
  const tallies: FileTally[] = [];

  // --- Stylesheets ----------------------------------------------------------
  for (const f of scan.byExt('.css', '.scss', '.less')) {
    if (isGenerated(f) || isTestish(f)) continue;
    const text = scan.read(f);
    if (text === null) continue;
    const decls = cssDecls(text);
    if (decls.length === 0) continue;

    let defs = 0;
    let hardcoded = 0;
    let variableRefs = 0;
    for (const d of decls) {
      if (d.prop.startsWith('--')) {
        defs++;
        continue; // definitions are the token side of the ledger, not usage
      }
      variableRefs += countVarRefs(d.value);
      if (f.ext === '.scss') variableRefs += countScssVarRefs(d.value);
      hardcoded += scanCssValueLiterals(d.prop, d.value).length;
    }
    // Definition-heavy files ARE the token layer — exclude from usage ratio.
    if (defs >= decls.length / 2) continue;
    if (hardcoded + variableRefs === 0) continue;
    tallies.push({ path: f.rel, hardcoded, variableRefs });
  }

  // --- Inline JSX styles ----------------------------------------------------
  for (const f of scan.byExt('.tsx', '.jsx')) {
    if (isGenerated(f) || isTestish(f)) continue;
    const text = scan.read(f);
    if (text === null || !text.includes('style=')) continue;
    let hardcoded = 0;
    let variableRefs = 0;
    for (const obj of extractJsxStyleObjects(text)) {
      for (const entry of obj.entries) {
        variableRefs += countVarRefs(entry.valueText);
        hardcoded += scanJsxStyleValue(entry.prop, entry.valueText).length;
      }
    }
    if (hardcoded + variableRefs === 0) continue;
    tallies.push({ path: f.rel, hardcoded, variableRefs });
  }

  const hardcoded = tallies.reduce((s, t) => s + t.hardcoded, 0);
  const variableRefs = tallies.reduce((s, t) => s + t.variableRefs, 0);
  const total = hardcoded + variableRefs;
  const worstFiles = [...tallies]
    .filter((t) => t.hardcoded > 0)
    .sort((a, b) => b.hardcoded - a.hardcoded)
    .slice(0, 5);

  return {
    sampledFiles: tallies.length,
    variableRefs,
    hardcoded,
    ratio: total === 0 ? null : hardcoded / total,
    worstFiles,
  };
}
