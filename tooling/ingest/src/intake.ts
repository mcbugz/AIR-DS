/**
 * Customer intake schema + hand-rolled validator (zero dependencies, precise
 * error paths). The intake is what a delivery engineer fills in from the
 * customer's brand guidelines; `ds-ingest generate` turns it into a brand-tier
 * file matching brands/default.json's exact shape (ADR-003 / ADR-006).
 */

import { normalizeHex } from "./oklch.js";
import { RAMP_STEPS, type Ramp } from "./ramp.js";

export const PALETTE_FAMILIES = ["neutral", "primary", "info", "success", "warning", "danger"] as const;
export type PaletteFamily = (typeof PALETTE_FAMILIES)[number];

/** A palette entry is either a single seed hex or a full 50–950 ramp. */
export type PaletteInput = { kind: "seed"; hex: string } | { kind: "ramp"; ramp: Ramp };

export interface RadiusScaleInput {
  "1": number;
  "2": number;
  "3": number;
  "4": number;
  full: number;
}

export type ElevationPreset = "subtle" | "standard" | "pronounced";

export interface ElevationExplicit {
  "1": string;
  "2": string;
  "3": string;
}

export interface DistributionInput {
  /** Public crawlability of docs is an explicit per-customer decision (ADR-006 §5). Default false (gated). */
  publicDocs: boolean;
  /** Private npm scope the per-customer artifacts publish under, e.g. "@acme-ds". */
  npmScope: string;
}

export interface Intake {
  /** Brand key: kebab-case, becomes brands/<name>.json and customer-builds/<name>/. */
  name: string;
  displayName?: string;
  palette: Partial<Record<PaletteFamily, PaletteInput>> & {
    neutral: PaletteInput;
    primary: PaletteInput;
  };
  typefaces: { sans: string; mono?: string };
  typeScale?: { base: number; ratio: number };
  radiusScale?: RadiusScaleInput;
  spaceBase?: number;
  elevation?: ElevationPreset | ElevationExplicit;
  assets?: { logoLight?: string; logoDark?: string; favicon?: string };
  distribution: DistributionInput;
}

export interface ValidationError {
  /** JSON path into the intake document, e.g. "palette.primary". */
  path: string;
  message: string;
}

export type ValidationResult = { ok: true; intake: Intake } | { ok: false; errors: ValidationError[] };

const NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const NPM_SCOPE_RE = /^@[a-z0-9][a-z0-9._-]*$/;
const ELEVATION_PRESETS: readonly string[] = ["subtle", "standard", "pronounced"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pushHex(errors: ValidationError[], path: string, value: unknown): string | null {
  if (typeof value !== "string") {
    errors.push({ path, message: `expected a hex color string, got ${value === null ? "null" : typeof value}` });
    return null;
  }
  const hex = normalizeHex(value);
  if (!hex) {
    errors.push({ path, message: `"${value}" is not a #rgb or #rrggbb hex color` });
    return null;
  }
  return hex;
}

function validatePaletteEntry(errors: ValidationError[], path: string, value: unknown): PaletteInput | null {
  if (typeof value === "string") {
    const hex = pushHex(errors, path, value);
    return hex ? { kind: "seed", hex } : null;
  }
  if (isRecord(value)) {
    const ramp = {} as Ramp;
    let bad = false;
    for (const step of RAMP_STEPS) {
      if (!(step in value)) {
        errors.push({ path: `${path}.${step}`, message: `full ramps must define every step 50–950; "${step}" is missing` });
        bad = true;
        continue;
      }
      const hex = pushHex(errors, `${path}.${step}`, value[step]);
      if (hex) ramp[step] = hex;
      else bad = true;
    }
    const extra = Object.keys(value).filter((k) => !(RAMP_STEPS as readonly string[]).includes(k));
    if (extra.length > 0) {
      errors.push({ path, message: `unknown ramp steps: ${extra.join(", ")} (allowed: ${RAMP_STEPS.join(", ")})` });
      bad = true;
    }
    return bad ? null : { kind: "ramp", ramp };
  }
  errors.push({
    path,
    message: "expected a seed hex string (e.g. \"#1a6b4a\") or a full { \"50\"..\"950\" } ramp object",
  });
  return null;
}

function validateNumber(
  errors: ValidationError[],
  path: string,
  value: unknown,
  { min, max }: { min: number; max: number },
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push({ path, message: `expected a number, got ${value === null ? "null" : typeof value}` });
    return null;
  }
  if (value < min || value > max) {
    errors.push({ path, message: `${value} is out of range [${min}, ${max}]` });
    return null;
  }
  return value;
}

/** Validate an arbitrary parsed JSON document as an intake. Collects ALL errors. */
export function validateIntake(doc: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  if (!isRecord(doc)) {
    return { ok: false, errors: [{ path: "$", message: "intake root must be a JSON object" }] };
  }

  /* name */
  let name = "";
  if (typeof doc["name"] !== "string" || !NAME_RE.test(doc["name"])) {
    errors.push({
      path: "name",
      message: `required kebab-case brand key (matches ${NAME_RE}); becomes brands/<name>.json`,
    });
  } else if (doc["name"] === "default") {
    errors.push({ path: "name", message: '"default" is reserved for the neutral core brand' });
  } else {
    name = doc["name"];
  }

  /* displayName */
  let displayName: string | undefined;
  if (doc["displayName"] !== undefined) {
    if (typeof doc["displayName"] !== "string" || doc["displayName"].trim() === "") {
      errors.push({ path: "displayName", message: "when present, must be a non-empty string" });
    } else displayName = doc["displayName"];
  }

  /* palette */
  const palette: Partial<Record<PaletteFamily, PaletteInput>> = {};
  if (!isRecord(doc["palette"])) {
    errors.push({
      path: "palette",
      message: 'required object; "neutral" and "primary" entries are mandatory (seed hex or full ramp)',
    });
  } else {
    const rawPalette = doc["palette"];
    for (const family of PALETTE_FAMILIES) {
      const raw = rawPalette[family];
      if (raw === undefined) {
        if (family === "neutral" || family === "primary") {
          errors.push({ path: `palette.${family}`, message: "required (seed hex or full 50–950 ramp)" });
        }
        continue;
      }
      const entry = validatePaletteEntry(errors, `palette.${family}`, raw);
      if (entry) palette[family] = entry;
    }
    const extraFamilies = Object.keys(rawPalette).filter((k) => !(PALETTE_FAMILIES as readonly string[]).includes(k));
    if (extraFamilies.length > 0) {
      errors.push({
        path: "palette",
        message: `unknown palette families: ${extraFamilies.join(", ")} (allowed: ${PALETTE_FAMILIES.join(", ")})`,
      });
    }
  }

  /* typefaces */
  let typefaces: Intake["typefaces"] | null = null;
  if (!isRecord(doc["typefaces"])) {
    errors.push({ path: "typefaces", message: 'required object with a "sans" font stack (and optional "mono")' });
  } else {
    const sans = doc["typefaces"]["sans"];
    const mono = doc["typefaces"]["mono"];
    if (typeof sans !== "string" || sans.trim() === "") {
      errors.push({ path: "typefaces.sans", message: "required non-empty CSS font-family stack" });
    } else if (mono !== undefined && (typeof mono !== "string" || mono.trim() === "")) {
      errors.push({ path: "typefaces.mono", message: "when present, must be a non-empty CSS font-family stack" });
    } else {
      typefaces = mono === undefined ? { sans } : { sans, mono: mono as string };
    }
  }

  /* typeScale */
  let typeScale: Intake["typeScale"];
  if (doc["typeScale"] !== undefined) {
    if (!isRecord(doc["typeScale"])) {
      errors.push({ path: "typeScale", message: 'expected { "base": number, "ratio": number }' });
    } else {
      const base = validateNumber(errors, "typeScale.base", doc["typeScale"]["base"], { min: 12, max: 24 });
      const ratio = validateNumber(errors, "typeScale.ratio", doc["typeScale"]["ratio"], { min: 1.05, max: 1.62 });
      if (base !== null && ratio !== null) typeScale = { base, ratio };
    }
  }

  /* radiusScale */
  let radiusScale: RadiusScaleInput | undefined;
  if (doc["radiusScale"] !== undefined) {
    if (!isRecord(doc["radiusScale"])) {
      errors.push({ path: "radiusScale", message: 'expected { "1", "2", "3", "4", "full" } numeric px values' });
    } else {
      const raw = doc["radiusScale"];
      const r1 = validateNumber(errors, "radiusScale.1", raw["1"], { min: 0, max: 32 });
      const r2 = validateNumber(errors, "radiusScale.2", raw["2"], { min: 0, max: 48 });
      const r3 = validateNumber(errors, "radiusScale.3", raw["3"], { min: 0, max: 64 });
      const r4 = validateNumber(errors, "radiusScale.4", raw["4"], { min: 0, max: 96 });
      const full = validateNumber(errors, "radiusScale.full", raw["full"], { min: 96, max: 10000 });
      if (r1 !== null && r2 !== null && r3 !== null && r4 !== null && full !== null) {
        if (!(r1 <= r2 && r2 <= r3 && r3 <= r4)) {
          errors.push({ path: "radiusScale", message: `steps 1..4 must be non-decreasing (got ${r1}, ${r2}, ${r3}, ${r4})` });
        } else {
          radiusScale = { "1": r1, "2": r2, "3": r3, "4": r4, full };
        }
      }
    }
  }

  /* spaceBase */
  let spaceBase: number | undefined;
  if (doc["spaceBase"] !== undefined) {
    const v = validateNumber(errors, "spaceBase", doc["spaceBase"], { min: 2, max: 8 });
    if (v !== null) spaceBase = v;
  }

  /* elevation */
  let elevation: Intake["elevation"];
  if (doc["elevation"] !== undefined) {
    const raw = doc["elevation"];
    if (typeof raw === "string") {
      if (!ELEVATION_PRESETS.includes(raw)) {
        errors.push({ path: "elevation", message: `unknown preset "${raw}" (allowed: ${ELEVATION_PRESETS.join(" | ")}, or explicit { "1".."3" } shadow strings)` });
      } else elevation = raw as ElevationPreset;
    } else if (isRecord(raw)) {
      const levels = ["1", "2", "3"] as const;
      const out: Partial<ElevationExplicit> = {};
      let bad = false;
      for (const level of levels) {
        const v = raw[level];
        if (typeof v !== "string" || v.trim() === "") {
          errors.push({ path: `elevation.${level}`, message: "explicit elevation needs CSS box-shadow strings for levels 1, 2, 3" });
          bad = true;
        } else out[level] = v;
      }
      if (!bad) elevation = out as ElevationExplicit;
    } else {
      errors.push({ path: "elevation", message: `expected a preset (${ELEVATION_PRESETS.join(" | ")}) or explicit { "1".."3" } shadow strings` });
    }
  }

  /* assets */
  let assets: Intake["assets"];
  if (doc["assets"] !== undefined) {
    if (!isRecord(doc["assets"])) {
      errors.push({ path: "assets", message: 'expected object with optional "logoLight" / "logoDark" / "favicon" paths' });
    } else {
      const out: NonNullable<Intake["assets"]> = {};
      for (const key of ["logoLight", "logoDark", "favicon"] as const) {
        const v = doc["assets"][key];
        if (v === undefined) continue;
        if (typeof v !== "string" || v.trim() === "") {
          errors.push({ path: `assets.${key}`, message: "when present, must be a non-empty path string" });
        } else out[key] = v;
      }
      const extra = Object.keys(doc["assets"]).filter((k) => !["logoLight", "logoDark", "favicon"].includes(k));
      if (extra.length > 0) {
        errors.push({ path: "assets", message: `unknown asset keys: ${extra.join(", ")} (allowed: logoLight, logoDark, favicon)` });
      }
      assets = out;
    }
  }

  /* distribution */
  let distribution: DistributionInput | null = null;
  if (!isRecord(doc["distribution"])) {
    errors.push({
      path: "distribution",
      message: 'required object: { "publicDocs": boolean, "npmScope": "@customer-scope" } (ADR-006: gated by default)',
    });
  } else {
    const publicDocsRaw = doc["distribution"]["publicDocs"];
    const scopeRaw = doc["distribution"]["npmScope"];
    let ok = true;
    if (publicDocsRaw !== undefined && typeof publicDocsRaw !== "boolean") {
      errors.push({ path: "distribution.publicDocs", message: "must be a boolean (default false = gated)" });
      ok = false;
    }
    if (typeof scopeRaw !== "string" || !NPM_SCOPE_RE.test(scopeRaw)) {
      errors.push({ path: "distribution.npmScope", message: `required npm scope matching ${NPM_SCOPE_RE}, e.g. "@acme-ds"` });
      ok = false;
    }
    if (ok) {
      distribution = { publicDocs: publicDocsRaw === true, npmScope: scopeRaw as string };
    }
  }

  /* unknown top-level keys */
  const KNOWN_TOP = ["$schema", "name", "displayName", "palette", "typefaces", "typeScale", "radiusScale", "spaceBase", "elevation", "assets", "distribution"];
  for (const key of Object.keys(doc)) {
    if (!KNOWN_TOP.includes(key)) errors.push({ path: key, message: "unknown intake field" });
  }

  if (errors.length > 0) return { ok: false, errors };

  const intake: Intake = {
    name,
    palette: palette as Intake["palette"],
    typefaces: typefaces as Intake["typefaces"],
    distribution: distribution as DistributionInput,
  };
  if (displayName !== undefined) intake.displayName = displayName;
  if (typeScale !== undefined) intake.typeScale = typeScale;
  if (radiusScale !== undefined) intake.radiusScale = radiusScale;
  if (spaceBase !== undefined) intake.spaceBase = spaceBase;
  if (elevation !== undefined) intake.elevation = elevation;
  if (assets !== undefined) intake.assets = assets;
  return { ok: true, intake };
}

export function formatErrors(errors: readonly ValidationError[]): string {
  return errors.map((e) => `  ${e.path}: ${e.message}`).join("\n");
}
