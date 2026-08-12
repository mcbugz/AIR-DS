/**
 * WCAG AA pre-check for a candidate brand palette, run BEFORE the tokens build,
 * with deterministic auto-repair.
 *
 * - The mandated pair list is read from registries/contrast-report.json (the
 *   gate's own last output — semantic foreground/background names), falling back
 *   to a replica of mandatedPairs() in packages/tokens/src/build/build.ts.
 * - Semantic name -> palette ramp position comes from the live semantic source
 *   (packages/tokens/src/semantic/color.json `{palette.family.step}` aliases),
 *   so the pre-check resolves pairs exactly like the build will.
 * - Repair strategy mirrors what the tokens engineer did by hand for the default
 *   brand (e.g. warning.600 #d97706 -> #b25607): the DARKER color of a failing
 *   pair is nudged darker in OKLCH lightness until the pair clears the threshold.
 *   Lowering the darker color's luminance strictly increases the pair's ratio and
 *   never hurts any other mandated pair (surfaces are only ever the lighter side).
 * - A monotonicity pass keeps each ramp's 50->950 lightness strictly decreasing
 *   after repairs. Every change is recorded and reported.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { contrastRatio, hexToOklch, oklchToHex } from "./oklch.js";
import { RAMP_STEPS, type Ramp, type RampStep } from "./ramp.js";
import { PALETTE_FAMILIES, type PaletteFamily } from "./intake.js";

export type Palette = Record<PaletteFamily, Ramp>;

export interface MandatedPair {
  foreground: string;
  background: string;
}

export interface PairResult extends MandatedPair {
  foregroundValue: string;
  backgroundValue: string;
  ratio: number;
  required: number;
  pass: boolean;
}

export interface AaAdjustment {
  /** e.g. "palette.warning.600" */
  rampPath: string;
  reason: "contrast" | "ramp-monotonicity";
  /** The mandated pair that forced the change (contrast reason only). */
  pair?: MandatedPair;
  before: string;
  after: string;
  ratioBefore?: number;
  ratioAfter?: number;
}

export interface AaFixResult {
  palette: Palette;
  adjustments: AaAdjustment[];
  /** Final state of every mandated pair — all `pass: true` or fixPalette threw. */
  pairs: PairResult[];
  threshold: number;
}

/** Fallback replica of mandatedPairs() in packages/tokens/src/build/build.ts. */
function fallbackMandatedPairs(): MandatedPair[] {
  const pairs: MandatedPair[] = [];
  const lightTexts = ["color.text.primary", "color.text.secondary", "color.text.muted", "color.text.link"];
  const lightSurfaces = ["color.surface.default", "color.surface.raised", "color.surface.sunken"];
  for (const fg of lightTexts) for (const bg of lightSurfaces) pairs.push({ foreground: fg, background: bg });
  pairs.push({ foreground: "color.text.inverse", background: "color.surface.inverse" });
  pairs.push({ foreground: "color.text.on-accent", background: "color.accent.default" });
  pairs.push({ foreground: "color.text.on-accent", background: "color.accent.emphasis" });
  for (const tone of ["info", "success", "warning", "danger"]) {
    pairs.push({ foreground: `color.status.${tone}.text`, background: `color.status.${tone}.surface` });
    pairs.push({ foreground: "color.text.inverse", background: `color.status.${tone}.default` });
    pairs.push({ foreground: "color.text.inverse", background: `color.status.${tone}.emphasis` });
  }
  return pairs;
}

export const FALLBACK_THRESHOLD = 4.5;

export interface MandatedPairSet {
  pairs: MandatedPair[];
  threshold: number;
  source: string;
}

/** Read the gate's pair list from the workspace contrast report (read-only), else replicate. */
export function loadMandatedPairs(repoRoot: string): MandatedPairSet {
  const reportPath = join(repoRoot, "registries", "contrast-report.json");
  if (existsSync(reportPath)) {
    try {
      const parsed = JSON.parse(readFileSync(reportPath, "utf8")) as {
        threshold?: unknown;
        pairs?: Array<{ foreground?: unknown; background?: unknown }>;
      };
      if (Array.isArray(parsed.pairs) && parsed.pairs.length > 0) {
        const pairs: MandatedPair[] = [];
        for (const p of parsed.pairs) {
          if (typeof p.foreground === "string" && typeof p.background === "string") {
            pairs.push({ foreground: p.foreground, background: p.background });
          }
        }
        if (pairs.length > 0) {
          return {
            pairs,
            threshold: typeof parsed.threshold === "number" ? parsed.threshold : FALLBACK_THRESHOLD,
            source: "registries/contrast-report.json",
          };
        }
      }
    } catch {
      /* fall through to replica */
    }
  }
  return {
    pairs: fallbackMandatedPairs(),
    threshold: FALLBACK_THRESHOLD,
    source: "replicated from packages/tokens/src/build/build.ts mandatedPairs()",
  };
}

export interface PaletteRef {
  family: PaletteFamily;
  step: RampStep;
}

const PALETTE_REF_RE = /^\{palette\.([a-z]+)\.(\d+)\}$/;

/** semantic color name -> palette ramp position, read from the live semantic source. */
export function loadSemanticColorRefs(repoRoot: string): Map<string, PaletteRef> {
  const sourcePath = join(repoRoot, "packages", "tokens", "src", "semantic", "color.json");
  const parsed = JSON.parse(readFileSync(sourcePath, "utf8")) as Record<string, unknown>;
  const refs = new Map<string, PaletteRef>();

  const walk = (node: Record<string, unknown>, prefix: string[]): void => {
    const value = node["$value"];
    if (typeof value === "string") {
      const m = PALETTE_REF_RE.exec(value);
      if (m) {
        const family = m[1] as string;
        const step = m[2] as string;
        if (
          (PALETTE_FAMILIES as readonly string[]).includes(family) &&
          (RAMP_STEPS as readonly string[]).includes(step)
        ) {
          refs.set(prefix.join("."), { family: family as PaletteFamily, step: step as RampStep });
        }
      }
      return;
    }
    for (const key of Object.keys(node)) {
      if (key.startsWith("$")) continue;
      const child = node[key];
      if (typeof child === "object" && child !== null && !Array.isArray(child)) {
        walk(child as Record<string, unknown>, [...prefix, key]);
      }
    }
  };
  walk(parsed, []);
  if (refs.size === 0) {
    throw new Error(`No palette-backed semantic colors found in ${sourcePath} — semantic source moved?`);
  }
  return refs;
}

const DARKEN_STEP_L = 0.005;
const MAX_FIX_ITERATIONS = 4000;

function resolve(palette: Palette, ref: PaletteRef): string {
  return palette[ref.family][ref.step];
}

/** Darken by reducing OKLCH lightness until the hex actually changes. */
function darkenHex(hex: string): string {
  const color = hexToOklch(hex);
  let l = color.l;
  for (let i = 0; i < 200; i += 1) {
    l = Math.max(0, l - DARKEN_STEP_L);
    const next = oklchToHex({ l, c: color.c, h: color.h });
    if (next !== hex) return next;
    if (l === 0) break;
  }
  throw new Error(`Cannot darken ${hex} any further`);
}

export function evaluatePairs(palette: Palette, pairSet: MandatedPairSet, refs: Map<string, PaletteRef>): PairResult[] {
  return pairSet.pairs.map((pair) => {
    const fgRef = refs.get(pair.foreground);
    const bgRef = refs.get(pair.background);
    if (!fgRef || !bgRef) {
      throw new Error(
        `Mandated pair (${pair.foreground}, ${pair.background}) references a semantic color with no palette alias — semantic source and gate disagree`,
      );
    }
    const foregroundValue = resolve(palette, fgRef);
    const backgroundValue = resolve(palette, bgRef);
    const ratio = contrastRatio(foregroundValue, backgroundValue);
    return {
      ...pair,
      foregroundValue,
      backgroundValue,
      ratio: Math.round(ratio * 100) / 100,
      required: pairSet.threshold,
      pass: ratio >= pairSet.threshold,
    };
  });
}

/**
 * Pre-check every mandated pair and minimally darken ramp steps until all pass.
 * Deterministic: fixed pair order, fixed lightness decrement. Returns the fixed
 * palette (a deep copy — the input is not mutated) and the full adjustment log.
 */
export function fixPalette(input: Palette, pairSet: MandatedPairSet, refs: Map<string, PaletteRef>): AaFixResult {
  const palette: Palette = Object.fromEntries(
    PALETTE_FAMILIES.map((family) => [family, { ...input[family] }]),
  ) as Palette;
  const adjustments: AaAdjustment[] = [];
  let iterations = 0;

  for (let round = 0; round < 20; round += 1) {
    let changed = false;

    /* Contrast repairs: darken the darker color of each failing pair. */
    for (const pair of pairSet.pairs) {
      const fgRef = refs.get(pair.foreground);
      const bgRef = refs.get(pair.background);
      if (!fgRef || !bgRef) {
        throw new Error(
          `Mandated pair (${pair.foreground}, ${pair.background}) references a semantic color with no palette alias`,
        );
      }
      let fg = resolve(palette, fgRef);
      let bg = resolve(palette, bgRef);
      let ratio = contrastRatio(fg, bg);
      if (ratio >= pairSet.threshold) continue;

      const fgDarker = contrastRatio(fg, "#ffffff") >= contrastRatio(bg, "#ffffff");
      const target = fgDarker ? fgRef : bgRef;
      const before = resolve(palette, target);
      const ratioBefore = Math.round(ratio * 100) / 100;
      while (ratio < pairSet.threshold) {
        iterations += 1;
        if (iterations > MAX_FIX_ITERATIONS) {
          throw new Error(
            `AA pre-check could not converge fixing (${pair.foreground} on ${pair.background}); last ratio ${ratio.toFixed(2)}`,
          );
        }
        palette[target.family][target.step] = darkenHex(palette[target.family][target.step]);
        fg = resolve(palette, fgRef);
        bg = resolve(palette, bgRef);
        ratio = contrastRatio(fg, bg);
      }
      adjustments.push({
        rampPath: `palette.${target.family}.${target.step}`,
        reason: "contrast",
        pair,
        before,
        after: resolve(palette, target),
        ratioBefore,
        ratioAfter: Math.round(ratio * 100) / 100,
      });
      changed = true;
    }

    /* Monotonicity: keep each ramp's lightness strictly decreasing 50 -> 950. */
    for (const family of PALETTE_FAMILIES) {
      for (let i = 1; i < RAMP_STEPS.length; i += 1) {
        const prevStep = RAMP_STEPS[i - 1] as RampStep;
        const step = RAMP_STEPS[i] as RampStep;
        const prevL = hexToOklch(palette[family][prevStep]).l;
        let currL = hexToOklch(palette[family][step]).l;
        if (currL < prevL) continue;
        const before = palette[family][step];
        while (currL >= prevL) {
          iterations += 1;
          if (iterations > MAX_FIX_ITERATIONS) {
            throw new Error(`AA pre-check could not restore lightness order for palette.${family}`);
          }
          palette[family][step] = darkenHex(palette[family][step]);
          currL = hexToOklch(palette[family][step]).l;
        }
        adjustments.push({
          rampPath: `palette.${family}.${step}`,
          reason: "ramp-monotonicity",
          before,
          after: palette[family][step],
        });
        changed = true;
      }
    }

    if (!changed) break;
  }

  const pairs = evaluatePairs(palette, pairSet, refs);
  const failures = pairs.filter((p) => !p.pass);
  if (failures.length > 0) {
    throw new Error(
      `AA pre-check finished with ${failures.length} unresolved pair(s): ${failures
        .map((p) => `${p.foreground} on ${p.background} (${p.ratio}:1)`)
        .join(", ")}`,
    );
  }
  return { palette, adjustments, pairs, threshold: pairSet.threshold };
}
