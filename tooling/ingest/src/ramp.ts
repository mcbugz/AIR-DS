/**
 * Deterministic 50–950 palette ramp generation from a single seed hex.
 *
 * Method: OKLCH lightness ladder. The seed contributes hue + chroma; each ramp
 * step gets a FIXED perceptual lightness target, a chroma from a per-step profile
 * scaled to the seed's chroma, and the seed's hue. Everything is pure arithmetic
 * on fixed tables — same seed in, same eleven hexes out, on every machine.
 *
 * Two ladders:
 *  - "chromatic" (primary/status ramps): mid-ramp chroma peak, 600 tuned near
 *    L=0.55 so solid fills usually clear AA against near-white text out of the box.
 *  - "neutral": darker text steps (500–950) matching how the semantic tier uses
 *    neutrals (600 = text.muted must clear AA on the 200 sunken surface), and a
 *    hard chroma cap so a warm seed reads as a tint, never as a color.
 *
 * The AA pre-check (aa.ts) then nudges individual steps darker if a particular
 * hue still misses a mandated pair — those nudges are reported, not silent.
 */

import { hexToOklch, normalizeHex, oklchToHex } from "./oklch.js";

export const RAMP_STEPS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const;
export type RampStep = (typeof RAMP_STEPS)[number];
export type Ramp = Record<RampStep, string>;

export type RampKind = "neutral" | "chromatic";

interface LadderRow {
  l: number;
  chroma: number;
}

/** Chromatic ladder: lightness targets + chroma profile for a fully saturated seed. */
const CHROMATIC_LADDER: Record<RampStep, LadderRow> = {
  "50": { l: 0.985, chroma: 0.02 },
  "100": { l: 0.965, chroma: 0.045 },
  "200": { l: 0.925, chroma: 0.08 },
  "300": { l: 0.87, chroma: 0.12 },
  "400": { l: 0.735, chroma: 0.165 },
  "500": { l: 0.63, chroma: 0.19 },
  "600": { l: 0.55, chroma: 0.2 },
  "700": { l: 0.48, chroma: 0.18 },
  "800": { l: 0.41, chroma: 0.15 },
  "900": { l: 0.35, chroma: 0.12 },
  "950": { l: 0.26, chroma: 0.09 },
};

/** Neutral ladder: slate-like lightness curve, near-flat low chroma. */
const NEUTRAL_LADDER: Record<RampStep, LadderRow> = {
  "50": { l: 0.985, chroma: 0.6 },
  "100": { l: 0.967, chroma: 0.7 },
  "200": { l: 0.929, chroma: 0.85 },
  "300": { l: 0.869, chroma: 1 },
  "400": { l: 0.711, chroma: 1 },
  "500": { l: 0.554, chroma: 1 },
  "600": { l: 0.446, chroma: 1 },
  "700": { l: 0.372, chroma: 1 },
  "800": { l: 0.279, chroma: 0.95 },
  "900": { l: 0.208, chroma: 0.9 },
  "950": { l: 0.129, chroma: 0.8 },
};

/** Neutral ramps never exceed this chroma — a "warm gray" stays a gray. */
const NEUTRAL_CHROMA_CAP = 0.03;

/** Chromatic seed-chroma scale is clamped so washed-out seeds still produce usable ramps. */
const CHROMATIC_SCALE_MAX = 1.35;

function nearestChromaticStep(l: number): RampStep {
  let best: RampStep = "500";
  let bestDist = Infinity;
  for (const step of RAMP_STEPS) {
    const dist = Math.abs(CHROMATIC_LADDER[step].l - l);
    if (dist < bestDist) {
      bestDist = dist;
      best = step;
    }
  }
  return best;
}

/**
 * Generate a full 50–950 ramp from a seed hex. Deterministic.
 * The seed sets hue and chroma; step lightness comes from the fixed ladder
 * (the seed is NOT inserted verbatim into the ramp).
 */
export function generateRamp(seedHex: string, kind: RampKind): Ramp {
  const normalized = normalizeHex(seedHex);
  if (!normalized) throw new Error(`generateRamp: seed "${seedHex}" is not a hex color`);
  const seed = hexToOklch(normalized);
  const hue = seed.c < 1e-4 ? 0 : seed.h;

  const ramp = {} as Ramp;
  if (kind === "neutral") {
    const flatChroma = Math.min(seed.c, NEUTRAL_CHROMA_CAP);
    for (const step of RAMP_STEPS) {
      const row = NEUTRAL_LADDER[step];
      ramp[step] = oklchToHex({ l: row.l, c: flatChroma * row.chroma, h: hue });
    }
    return ramp;
  }

  const anchor = nearestChromaticStep(seed.l);
  const anchorChroma = CHROMATIC_LADDER[anchor].chroma;
  const scale = Math.min(seed.c / anchorChroma, CHROMATIC_SCALE_MAX);
  for (const step of RAMP_STEPS) {
    const row = CHROMATIC_LADDER[step];
    ramp[step] = oklchToHex({ l: row.l, c: row.chroma * scale, h: hue });
  }
  return ramp;
}
