import { describe, expect, it } from "vitest";
import { generateRamp, RAMP_STEPS } from "../src/ramp.js";
import { hexToOklch } from "../src/oklch.js";

describe("generateRamp", () => {
  it("is deterministic: same seed, byte-identical ramp", () => {
    const a = generateRamp("#1a6b47", "chromatic");
    const b = generateRamp("#1a6b47", "chromatic");
    expect(a).toEqual(b);
    const n1 = generateRamp("#78716c", "neutral");
    const n2 = generateRamp("#78716c", "neutral");
    expect(n1).toEqual(n2);
  });

  it("emits all eleven steps as lowercase 6-digit hex", () => {
    const ramp = generateRamp("#3b82f6", "chromatic");
    expect(Object.keys(ramp).sort()).toEqual([...RAMP_STEPS].sort());
    for (const step of RAMP_STEPS) {
      expect(ramp[step]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("produces strictly decreasing OKLCH lightness from 50 to 950", () => {
    for (const [seed, kind] of [
      ["#1a6b47", "chromatic"],
      ["#d97706", "chromatic"],
      ["#78716c", "neutral"],
    ] as const) {
      const ramp = generateRamp(seed, kind);
      const lightness = RAMP_STEPS.map((step) => hexToOklch(ramp[step]).l);
      for (let i = 1; i < lightness.length; i += 1) {
        expect(lightness[i] as number, `${seed} step ${RAMP_STEPS[i]}`).toBeLessThan(lightness[i - 1] as number);
      }
    }
  });

  it("preserves the seed hue on chromatic ramps", () => {
    const seedHue = hexToOklch("#1a6b47").h;
    const ramp = generateRamp("#1a6b47", "chromatic");
    for (const step of ["300", "500", "700"] as const) {
      const hue = hexToOklch(ramp[step]).h;
      // Gamut clamping only reduces chroma, never rotates hue; allow tiny rounding drift.
      expect(Math.abs(hue - seedHue)).toBeLessThan(2.5);
    }
  });

  it("caps neutral chroma so a warm gray stays a gray", () => {
    const ramp = generateRamp("#8a6d4f", "neutral"); // fairly saturated brown seed
    for (const step of RAMP_STEPS) {
      expect(hexToOklch(ramp[step]).c).toBeLessThanOrEqual(0.031);
    }
  });

  it("handles an achromatic seed without NaN hues", () => {
    const ramp = generateRamp("#808080", "neutral");
    for (const step of RAMP_STEPS) {
      expect(ramp[step]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("rejects a non-hex seed", () => {
    expect(() => generateRamp("teal", "chromatic")).toThrow(/not a hex color/);
  });
});
