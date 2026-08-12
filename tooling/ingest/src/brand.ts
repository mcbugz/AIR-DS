/**
 * Brand generator: validated intake -> brand-tier document matching
 * brands/default.json's exact shape (ADR-003: raw ramps only, no intent).
 * Ramps are generated deterministically (ramp.ts), then AA pre-checked and
 * minimally repaired (aa.ts) so the tokens build's WCAG gate is guaranteed to
 * pass. Everything defaulted or adjusted is surfaced in the returned notes.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fixPalette, loadMandatedPairs, loadSemanticColorRefs, type AaFixResult, type Palette } from "./aa.js";
import { hexToRgb } from "./oklch.js";
import { generateRamp, RAMP_STEPS, type Ramp } from "./ramp.js";
import { PALETTE_FAMILIES, type Intake, type PaletteFamily } from "./intake.js";

export type RampSource = "provided-ramp" | "generated-from-seed" | "neutral-core-default";

export interface GenerateResult {
  /** The brand document, ready to serialize as brands/<name>.json. */
  document: Record<string, unknown>;
  /** Where each palette family came from. */
  rampSources: Record<PaletteFamily, { source: RampSource; seed?: string }>;
  /** AA pre-check outcome (adjustments + final pair table). */
  aa: AaFixResult;
  /** Intake fields that fell back to neutral-core defaults. */
  defaultsUsed: string[];
  /** Seed hexes before ramp expansion, for the report. */
  notes: string[];
}

interface DefaultBrand {
  palette: Record<string, Record<string, { $value: string }>>;
  typeface: { sans: { $value: string }; mono: { $value: string } };
  "type-scale": { base: { $value: number }; ratio: { $value: number } };
  "radius-scale": Record<string, { $value: number }>;
  "space-base": { $value: number };
  elevation: Record<string, { $value: string }>;
  motion: unknown;
}

function loadDefaultBrand(repoRoot: string): DefaultBrand {
  return JSON.parse(readFileSync(join(repoRoot, "brands", "default.json"), "utf8")) as DefaultBrand;
}

function defaultRamp(defaults: DefaultBrand, family: PaletteFamily): Ramp {
  const raw = defaults.palette[family];
  if (!raw) throw new Error(`brands/default.json has no palette.${family} ramp`);
  const ramp = {} as Ramp;
  for (const step of RAMP_STEPS) {
    const entry = raw[step];
    if (!entry || typeof entry.$value !== "string") {
      throw new Error(`brands/default.json palette.${family}.${step} missing`);
    }
    ramp[step] = entry.$value.toLowerCase();
  }
  return ramp;
}

/** Elevation presets, recolored to the brand's own neutral.950 shadow ink. */
function elevationShadows(preset: "subtle" | "standard" | "pronounced", neutral950: string): Record<"1" | "2" | "3", string> {
  const { r, g, b } = hexToRgb(neutral950);
  const ink = (alpha: number): string => `rgb(${r} ${g} ${b} / ${alpha})`;
  switch (preset) {
    case "subtle":
      return {
        "1": `0 1px 2px 0 ${ink(0.05)}`,
        "2": `0 2px 4px -1px ${ink(0.07)}, 0 1px 2px -1px ${ink(0.06)}`,
        "3": `0 6px 10px -2px ${ink(0.08)}, 0 3px 5px -3px ${ink(0.05)}`,
      };
    case "standard":
      return {
        "1": `0 1px 2px 0 ${ink(0.06)}, 0 1px 3px 0 ${ink(0.1)}`,
        "2": `0 4px 6px -1px ${ink(0.1)}, 0 2px 4px -2px ${ink(0.1)}`,
        "3": `0 10px 15px -3px ${ink(0.1)}, 0 4px 6px -4px ${ink(0.05)}`,
      };
    case "pronounced":
      return {
        "1": `0 2px 4px 0 ${ink(0.1)}, 0 1px 3px 0 ${ink(0.14)}`,
        "2": `0 6px 10px -1px ${ink(0.14)}, 0 3px 6px -2px ${ink(0.12)}`,
        "3": `0 14px 22px -4px ${ink(0.16)}, 0 6px 10px -5px ${ink(0.08)}`,
      };
  }
}

function rampToJson(ramp: Ramp): Record<string, { $value: string }> {
  const out: Record<string, { $value: string }> = {};
  for (const step of RAMP_STEPS) out[step] = { $value: ramp[step] };
  return out;
}

export function generateBrand(intake: Intake, repoRoot: string): GenerateResult {
  const defaults = loadDefaultBrand(repoRoot);
  const defaultsUsed: string[] = [];
  const notes: string[] = [];

  /* 1. Palette: provided ramp > seed expansion > neutral-core default (status only). */
  const rampSources = {} as GenerateResult["rampSources"];
  const palette = {} as Palette;
  for (const family of PALETTE_FAMILIES) {
    const entry = intake.palette[family];
    if (!entry) {
      palette[family] = defaultRamp(defaults, family);
      rampSources[family] = { source: "neutral-core-default" };
      defaultsUsed.push(`palette.${family} (neutral-core status ramp)`);
      continue;
    }
    if (entry.kind === "ramp") {
      palette[family] = { ...entry.ramp };
      rampSources[family] = { source: "provided-ramp" };
      continue;
    }
    palette[family] = generateRamp(entry.hex, family === "neutral" ? "neutral" : "chromatic");
    rampSources[family] = { source: "generated-from-seed", seed: entry.hex };
  }

  /* 2. AA pre-check + deterministic repair against the gate's mandated pairs. */
  const pairSet = loadMandatedPairs(repoRoot);
  const refs = loadSemanticColorRefs(repoRoot);
  const aa = fixPalette(palette, pairSet, refs);
  notes.push(`Mandated contrast pairs sourced from: ${pairSet.source} (${pairSet.pairs.length} pairs, threshold ${pairSet.threshold}:1).`);

  /* 3. Scalars, with neutral-core defaults where the intake is silent. */
  const typeScale = intake.typeScale ?? {
    base: defaults["type-scale"].base.$value,
    ratio: defaults["type-scale"].ratio.$value,
  };
  if (!intake.typeScale) defaultsUsed.push("type-scale (16 / 1.25 neutral core)");

  const radiusScale = intake.radiusScale ?? {
    "1": defaults["radius-scale"]["1"]?.$value ?? 2,
    "2": defaults["radius-scale"]["2"]?.$value ?? 4,
    "3": defaults["radius-scale"]["3"]?.$value ?? 8,
    "4": defaults["radius-scale"]["4"]?.$value ?? 12,
    full: defaults["radius-scale"]["full"]?.$value ?? 9999,
  };
  if (!intake.radiusScale) defaultsUsed.push("radius-scale (neutral core)");

  const spaceBase = intake.spaceBase ?? defaults["space-base"].$value;
  if (intake.spaceBase === undefined) defaultsUsed.push(`space-base (${spaceBase}px neutral core)`);

  const neutral950 = aa.palette.neutral["950"];
  let elevation: Record<"1" | "2" | "3", string>;
  if (intake.elevation === undefined) {
    elevation = elevationShadows("standard", neutral950);
    defaultsUsed.push("elevation (standard preset, recolored to brand neutral.950)");
  } else if (typeof intake.elevation === "string") {
    elevation = elevationShadows(intake.elevation, neutral950);
    notes.push(`Elevation preset "${intake.elevation}" recolored to brand neutral.950 (${neutral950}).`);
  } else {
    elevation = intake.elevation;
  }

  const mono = intake.typefaces.mono ?? defaults.typeface.mono.$value;
  if (!intake.typefaces.mono) defaultsUsed.push("typeface.mono (neutral core stack)");

  /* 4. Assemble in brands/default.json's exact shape. */
  const display = intake.displayName ?? intake.name;
  const document: Record<string, unknown> = {
    $description: `${display} brand tier — GENERATED by @ds/ingest from the customer intake. Raw ramps only, no intent (ADR-003). Ramps are AA pre-checked against the tokens build's mandated contrast pairs; adjustments are listed in the customer's intake-report.md. Do not hand-edit ramp values without re-running ds-ingest.`,
    palette: {
      $type: "color",
      neutral: rampToJson(aa.palette.neutral),
      primary: rampToJson(aa.palette.primary),
      info: rampToJson(aa.palette.info),
      success: rampToJson(aa.palette.success),
      warning: rampToJson(aa.palette.warning),
      danger: rampToJson(aa.palette.danger),
    },
    typeface: {
      $type: "fontFamily",
      sans: { $value: intake.typefaces.sans },
      mono: { $value: mono },
    },
    "type-scale": {
      $type: "number",
      base: { $value: typeScale.base },
      ratio: { $value: typeScale.ratio },
    },
    "radius-scale": {
      $type: "number",
      "1": { $value: radiusScale["1"] },
      "2": { $value: radiusScale["2"] },
      "3": { $value: radiusScale["3"] },
      "4": { $value: radiusScale["4"] },
      full: { $value: radiusScale.full },
    },
    "space-base": { $value: spaceBase, $type: "number" },
    elevation: {
      $type: "shadow",
      "1": { $value: elevation["1"] },
      "2": { $value: elevation["2"] },
      "3": { $value: elevation["3"] },
    },
    motion: defaults.motion,
  };
  defaultsUsed.push("motion (neutral core durations/easings — no intake field yet)");

  if (intake.assets) {
    const assets: Record<string, { $value: string }> = {};
    if (intake.assets.logoLight) assets["logo-light"] = { $value: intake.assets.logoLight };
    if (intake.assets.logoDark) assets["logo-dark"] = { $value: intake.assets.logoDark };
    if (intake.assets.favicon) assets["favicon"] = { $value: intake.assets.favicon };
    if (Object.keys(assets).length > 0) document["assets"] = assets;
  }

  return { document, rampSources, aa, defaultsUsed, notes };
}
