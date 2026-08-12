import { describe, expect, it } from "vitest";
import { validateIntake } from "../src/intake.js";

const minimalValid = {
  name: "test-brand",
  palette: { neutral: "#777777", primary: "#1a6b47" },
  typefaces: { sans: "Inter, sans-serif" },
  distribution: { publicDocs: false, npmScope: "@test-ds" },
};

function errorsOf(doc: unknown): Array<{ path: string; message: string }> {
  const result = validateIntake(doc);
  if (result.ok) throw new Error("expected validation to fail");
  return result.errors;
}

describe("validateIntake", () => {
  it("accepts a minimal valid intake", () => {
    const result = validateIntake(minimalValid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intake.name).toBe("test-brand");
      expect(result.intake.distribution.npmScope).toBe("@test-ds");
      expect(result.intake.palette.primary).toEqual({ kind: "seed", hex: "#1a6b47" });
    }
  });

  it("rejects a non-object root with a $ path", () => {
    expect(errorsOf(null)).toEqual([{ path: "$", message: "intake root must be a JSON object" }]);
  });

  it("requires kebab-case name and reserves 'default'", () => {
    expect(errorsOf({ ...minimalValid, name: "Not Kebab" }).some((e) => e.path === "name")).toBe(true);
    expect(errorsOf({ ...minimalValid, name: "default" })[0]?.message).toContain("reserved");
  });

  it("pinpoints bad hex seeds with the exact path", () => {
    const errors = errorsOf({ ...minimalValid, palette: { neutral: "#777777", primary: "#zzz" } });
    expect(errors).toEqual([{ path: "palette.primary", message: '"#zzz" is not a #rgb or #rrggbb hex color' }]);
  });

  it("normalizes 3-digit hex seeds", () => {
    const result = validateIntake({ ...minimalValid, palette: { neutral: "#777", primary: "#1a6b47" } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.intake.palette.neutral).toEqual({ kind: "seed", hex: "#777777" });
  });

  it("requires every step 50-950 on a full ramp and names the missing ones", () => {
    const errors = errorsOf({
      ...minimalValid,
      palette: { neutral: "#777777", primary: { "50": "#eeffee", "500": "#118855" } },
    });
    const missing = errors.filter((e) => e.path.startsWith("palette.primary.") && e.message.includes("missing"));
    expect(missing).toHaveLength(9);
    expect(missing.map((e) => e.path)).toContain("palette.primary.950");
  });

  it("requires neutral and primary palette entries", () => {
    const errors = errorsOf({ ...minimalValid, palette: {} });
    expect(errors.map((e) => e.path).sort()).toEqual(["palette.neutral", "palette.primary"]);
  });

  it("rejects unknown palette families", () => {
    const errors = errorsOf({ ...minimalValid, palette: { ...minimalValid.palette, brandish: "#123456" } });
    expect(errors[0]?.message).toContain("unknown palette families: brandish");
  });

  it("validates npm scope shape", () => {
    const errors = errorsOf({ ...minimalValid, distribution: { publicDocs: false, npmScope: "acme" } });
    expect(errors[0]?.path).toBe("distribution.npmScope");
  });

  it("range-checks type scale and reports both violations", () => {
    const errors = errorsOf({ ...minimalValid, typeScale: { base: 40, ratio: 3 } });
    expect(errors.map((e) => e.path).sort()).toEqual(["typeScale.base", "typeScale.ratio"]);
    expect(errors[0]?.message).toContain("out of range");
  });

  it("enforces non-decreasing radius steps", () => {
    const errors = errorsOf({ ...minimalValid, radiusScale: { "1": 8, "2": 4, "3": 10, "4": 16, full: 9999 } });
    expect(errors[0]?.path).toBe("radiusScale");
    expect(errors[0]?.message).toContain("non-decreasing");
  });

  it("rejects unknown elevation presets but accepts explicit shadows", () => {
    expect(errorsOf({ ...minimalValid, elevation: "dramatic" })[0]?.message).toContain('unknown preset "dramatic"');
    const ok = validateIntake({
      ...minimalValid,
      elevation: { "1": "0 1px 2px rgb(0 0 0 / 0.1)", "2": "0 2px 4px rgb(0 0 0 / 0.1)", "3": "0 4px 8px rgb(0 0 0 / 0.1)" },
    });
    expect(ok.ok).toBe(true);
  });

  it("flags unknown top-level fields", () => {
    const errors = errorsOf({ ...minimalValid, colour: "#fff" });
    expect(errors).toEqual([{ path: "colour", message: "unknown intake field" }]);
  });

  it("collects multiple errors in one pass", () => {
    const errors = errorsOf({ name: "X", palette: 3, typefaces: {}, distribution: {} });
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });
});
