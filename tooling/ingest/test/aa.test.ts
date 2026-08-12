import { describe, expect, it } from "vitest";
import { evaluatePairs, fixPalette, loadMandatedPairs, loadSemanticColorRefs, type Palette } from "../src/aa.js";
import { contrastRatio } from "../src/oklch.js";
import { generateRamp } from "../src/ramp.js";
import { REPO_ROOT } from "../src/pipeline.js";

function paletteFromSeeds(): Palette {
  return {
    neutral: generateRamp("#78716c", "neutral"),
    primary: generateRamp("#1a6b47", "chromatic"),
    info: generateRamp("#0ea5e9", "chromatic"),
    // Deliberately hostile seed: light vivid green — its 600 solid fill starts
    // too light for near-white inverse text, so the pre-check MUST catch and
    // repair it (the same class of failure the tokens engineer fixed by hand
    // for the default brand's success/warning 600s).
    success: generateRamp("#4ade80", "chromatic"),
    warning: generateRamp("#fbbf24", "chromatic"),
    danger: generateRamp("#ef4444", "chromatic"),
  };
}

describe("AA pre-check", () => {
  const pairSet = loadMandatedPairs(REPO_ROOT);
  const refs = loadSemanticColorRefs(REPO_ROOT);

  it("loads the gate's mandated pair list (25 pairs for the current gate)", () => {
    expect(pairSet.pairs.length).toBeGreaterThanOrEqual(25);
    expect(pairSet.threshold).toBe(4.5);
    expect(pairSet.pairs).toContainEqual({ foreground: "color.text.on-accent", background: "color.accent.default" });
  });

  it("resolves semantic names to palette positions from the live semantic source", () => {
    expect(refs.get("color.text.muted")).toEqual({ family: "neutral", step: "600" });
    expect(refs.get("color.accent.default")).toEqual({ family: "primary", step: "600" });
    expect(refs.get("color.status.warning.default")).toEqual({ family: "warning", step: "600" });
  });

  it("catches a deliberately failing seed and repairs it to 0 failures", () => {
    const palette = paletteFromSeeds();
    const before = evaluatePairs(palette, pairSet, refs);
    const failingBefore = before.filter((p) => !p.pass);
    expect(failingBefore.length).toBeGreaterThan(0); // the light green seed must trip the check
    expect(failingBefore.some((p) => p.background.startsWith("color.status.success"))).toBe(true);

    const fixed = fixPalette(palette, pairSet, refs);
    expect(fixed.pairs.every((p) => p.pass)).toBe(true);
    expect(fixed.adjustments.length).toBeGreaterThan(0);
    // The repair touched the success fill steps, mirroring the manual default-brand fix.
    expect(fixed.adjustments.some((a) => a.rampPath.startsWith("palette.success."))).toBe(true);
    // Every contrast adjustment records the forcing pair and ratio movement.
    for (const adj of fixed.adjustments.filter((a) => a.reason === "contrast")) {
      expect(adj.pair).toBeDefined();
      expect(adj.ratioAfter as number).toBeGreaterThanOrEqual(4.5);
      expect(adj.before).not.toBe(adj.after);
    }
  });

  it("does not mutate the input palette", () => {
    const palette = paletteFromSeeds();
    const original = JSON.parse(JSON.stringify(palette)) as Palette;
    fixPalette(palette, pairSet, refs);
    expect(palette).toEqual(original);
  });

  it("is deterministic end to end", () => {
    const a = fixPalette(paletteFromSeeds(), pairSet, refs);
    const b = fixPalette(paletteFromSeeds(), pairSet, refs);
    expect(a.palette).toEqual(b.palette);
    expect(a.adjustments).toEqual(b.adjustments);
  });

  it("repaired values genuinely clear the gate's own contrast math", () => {
    const fixed = fixPalette(paletteFromSeeds(), pairSet, refs);
    for (const pair of fixed.pairs) {
      expect(contrastRatio(pair.foregroundValue, pair.backgroundValue)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
