/**
 * @ds/tokens build pipeline.
 *
 * Hand-rolled DTCG resolver — deliberately not Style Dictionary. SD v4/v5 supports
 * DTCG input, but the closed-world requirements here (registry emission, build-failing
 * WCAG gate, literal-union type generation, brand-tier privacy) would all live in
 * custom formats/actions anyway; the plain resolver keeps output byte-deterministic
 * with zero runtime dependencies.
 *
 * Tiers (ADR-003):
 *   brand      brands/<name>.json          raw ramps, never emitted publicly
 *   semantic   src/semantic/*.json         aliases INTO the brand tier only
 *   component  src/component/*.json        aliases INTO the semantic tier only
 *
 * Brand ingest derives deterministic ramps from the brand scalars
 * (type-scale base+ratio -> derived.font-size.*, space-base -> derived.space.*,
 * radius-scale.* -> derived.radius.*) so semantic sources stay pure aliases.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PKG_ROOT: string = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const REPO_ROOT: string = resolve(PKG_ROOT, "..", "..");

export const CSS_PREFIX = "--ds-"; // build-time constant per ADR-001

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface RawToken {
  value: unknown;
  type: string;
  description: string;
}

export type Tier = "semantic" | "component";

/** A fully resolved public token: one row of the closed-world contract. */
export interface PublicToken {
  /** DTCG dot path, e.g. "color.surface.raised". */
  name: string;
  /** Emitted custom property, e.g. "--ds-color-surface-raised". */
  cssVar: string;
  tier: Tier;
  /** DTCG $type. */
  type: string;
  description: string;
  /** Value resolved against the brand file this build ran with. */
  value: string | number;
}

export interface ContrastPair {
  /** Stable pair id: "<foreground>|<background>". Keys aliasIndex entries. */
  id: string;
  foreground: string;
  background: string;
  foregroundValue: string;
  backgroundValue: string;
  ratio: number;
  required: number;
  pass: boolean;
  /**
   * FB-5: every component-tier cssVar whose value chain resolves to the same
   * color as this pair's foreground / background semantic token, so text on a
   * component surface (e.g. --ds-card-surface) is verifiable via the alias.
   */
  resolvesTo: {
    foreground: string[];
    background: string[];
  };
}

/** A component-tier color token that inherits no audited pair, with the reason. */
export interface UnauditedToken {
  name: string;
  cssVar: string;
  /** The semantic token it aliases, or null if the value is not a pure alias. */
  aliasOf: string | null;
  reason: string;
}

export interface ContrastReport {
  $description: string;
  standard: string;
  threshold: number;
  brand: string;
  failures: number;
  pairs: ContrastPair[];
  /**
   * FB-5: component-tier color cssVar -> ids of the audited pairs it inherits
   * (its semantic alias target appears as that pair's foreground or background).
   */
  aliasIndex: Record<string, string[]>;
  /** Component-tier color tokens covered by no audited pair, each with a reason. */
  unaudited: UnauditedToken[];
}

export interface BuildOptions {
  /** Brand-tier file. Default: <repo>/brands/default.json. */
  brandPath?: string;
  /** Output dir for css/ + TS entry. Default: <pkg>/dist. */
  distDir?: string;
  /** Output dir for tokens-index.json + contrast-report.json. Default: <repo>/registries. */
  registriesDir?: string;
}

export interface BuildResult {
  brandPath: string;
  semanticCount: number;
  componentCount: number;
  tokens: PublicToken[];
  css: string;
  contrast: ContrastReport;
  files: {
    css: string;
    indexJs: string;
    indexDts: string;
    tokensIndex: string;
    contrastReport: string;
  };
}

/** Thrown after all artifacts (including the report) are written. */
export class ContrastError extends Error {}

/* ------------------------------------------------------------------ */
/* DTCG flattening                                                     */
/* ------------------------------------------------------------------ */

function isRecord(v: JsonValue | undefined): v is { [key: string]: JsonValue } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const SEGMENT_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function flattenInto(
  node: { [key: string]: JsonValue },
  prefix: readonly string[],
  inheritedType: string | undefined,
  out: Map<string, RawToken>,
  file: string,
): void {
  const typeAttr = node["$type"];
  const type = typeof typeAttr === "string" ? typeAttr : inheritedType;

  if ("$value" in node) {
    const path = prefix.join(".");
    if (out.has(path)) throw new Error(`Duplicate token path "${path}" (${file})`);
    const desc = node["$description"];
    out.set(path, {
      value: node["$value"],
      type: type ?? "string",
      description: typeof desc === "string" ? desc : "",
    });
    return;
  }

  for (const key of Object.keys(node)) {
    if (key.startsWith("$")) continue;
    if (!SEGMENT_RE.test(key)) {
      throw new Error(`Token path segment "${key}" violates the naming grammar (${file}, under "${prefix.join(".")}")`);
    }
    const child = node[key];
    if (!isRecord(child)) {
      throw new Error(`Expected a group or token object at "${[...prefix, key].join(".")}" (${file})`);
    }
    flattenInto(child, [...prefix, key], type, out, file);
  }
}

function flattenFile(filePath: string, out: Map<string, RawToken>): void {
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as JsonValue;
  if (!isRecord(parsed)) throw new Error(`${filePath}: root must be an object`);
  flattenInto(parsed, [], undefined, out, filePath);
}

function loadTierDir(dir: string): Map<string, RawToken> {
  const out = new Map<string, RawToken>();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  for (const f of files) flattenFile(join(dir, f), out);
  return out;
}

/* ------------------------------------------------------------------ */
/* Brand ingest: derived ramps                                         */
/* ------------------------------------------------------------------ */

const TYPE_SCALE_STEPS: ReadonlyArray<readonly [string, number]> = [
  ["xs", -2],
  ["sm", -1],
  ["md", 0],
  ["lg", 1],
  ["xl", 2],
  ["2xl", 3],
  ["3xl", 4],
];

const SPACE_MULTIPLIERS: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16];

function trimNumber(n: number): string {
  return String(parseFloat(n.toFixed(4)));
}

function expectBrandNumber(brand: Map<string, RawToken>, path: string, brandPath: string): number {
  const tok = brand.get(path);
  if (!tok || typeof tok.value !== "number") {
    throw new Error(`Brand file ${brandPath} must define numeric "${path}"`);
  }
  return tok.value;
}

function deriveBrand(brand: Map<string, RawToken>, brandPath: string): void {
  const base = expectBrandNumber(brand, "type-scale.base", brandPath);
  const ratio = expectBrandNumber(brand, "type-scale.ratio", brandPath);
  for (const [name, step] of TYPE_SCALE_STEPS) {
    const px = Math.round(base * Math.pow(ratio, step));
    brand.set(`derived.font-size.${name}`, {
      value: `${trimNumber(px / 16)}rem`,
      type: "dimension",
      description: "",
    });
  }

  const spaceBase = expectBrandNumber(brand, "space-base", brandPath);
  SPACE_MULTIPLIERS.forEach((multiplier, index) => {
    brand.set(`derived.space.${index}`, {
      value: `${trimNumber(spaceBase * multiplier)}px`,
      type: "dimension",
      description: "",
    });
  });

  for (const [path, tok] of [...brand.entries()]) {
    if (!path.startsWith("radius-scale.")) continue;
    const key = path.slice("radius-scale.".length);
    if (typeof tok.value !== "number") {
      throw new Error(`Brand file ${brandPath}: "${path}" must be numeric`);
    }
    brand.set(`derived.radius.${key}`, {
      value: `${trimNumber(tok.value)}px`,
      type: "dimension",
      description: "",
    });
  }
}

/* ------------------------------------------------------------------ */
/* Alias resolution                                                    */
/* ------------------------------------------------------------------ */

const WHOLE_REF_RE = /^\{([^{}]+)\}$/;
const EMBEDDED_REF_RE = /\{([^{}]+)\}/g;

function resolveRawValue(
  path: string,
  raw: unknown,
  lookup: (ref: string) => string | number | undefined,
  targetTierLabel: string,
): string | number {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") {
    throw new Error(`Token "${path}": $value must be a string or number, got ${typeof raw}`);
  }
  const whole = WHOLE_REF_RE.exec(raw);
  if (whole) {
    const target = lookup(whole[1] as string);
    if (target === undefined) {
      throw new Error(`Token "${path}": unresolved reference {${whole[1]}} — must alias a ${targetTierLabel} token`);
    }
    return target;
  }
  return raw.replace(EMBEDDED_REF_RE, (_match, ref: string) => {
    const target = lookup(ref);
    if (target === undefined) {
      throw new Error(`Token "${path}": unresolved reference {${ref}} — must alias a ${targetTierLabel} token`);
    }
    return String(target);
  });
}

const SEMANTIC_CATEGORIES: ReadonlyArray<readonly [string, string]> = [
  ["color", "DsColorToken"],
  ["font", "DsFontToken"],
  ["text", "DsTextToken"],
  ["space", "DsSpaceToken"],
  ["radius", "DsRadiusToken"],
  ["border", "DsBorderToken"],
  ["shadow", "DsShadowToken"],
  ["motion", "DsMotionToken"],
  ["z", "DsZToken"],
  ["size", "DsSizeToken"],
];

const SEMANTIC_CATEGORY_SET: ReadonlySet<string> = new Set(SEMANTIC_CATEGORIES.map(([c]) => c));

function toCssVar(name: string): string {
  return `${CSS_PREFIX}${name.replaceAll(".", "-")}`;
}

function resolveTier(
  raw: Map<string, RawToken>,
  tier: Tier,
  lookup: (ref: string) => string | number | undefined,
  targetTierLabel: string,
): PublicToken[] {
  const tokens: PublicToken[] = [];
  for (const [name, tok] of raw.entries()) {
    const category = name.split(".")[0] as string;
    if (tier === "semantic" && !SEMANTIC_CATEGORY_SET.has(category)) {
      throw new Error(`Semantic token "${name}": unknown category "${category}" (not in the taxonomy spec)`);
    }
    if (tier === "component" && SEMANTIC_CATEGORY_SET.has(category)) {
      throw new Error(`Component token "${name}": root "${category}" collides with a semantic category`);
    }
    if (tok.description.trim() === "") {
      throw new Error(`Token "${name}": $description is required on every public token (agent-facing docs)`);
    }
    tokens.push({
      name,
      cssVar: toCssVar(name),
      tier,
      type: tok.type,
      description: tok.description,
      value: resolveRawValue(name, tok.value, lookup, targetTierLabel),
    });
  }
  tokens.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return tokens;
}

/* ------------------------------------------------------------------ */
/* WCAG 2.2 contrast gate                                              */
/* ------------------------------------------------------------------ */

const AA_NORMAL_TEXT = 4.5;

function srgbChannel(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Contrast check requires a 6-digit hex color, got "${hex}"`);
  const n = parseInt(m[1] as string, 16);
  const r = srgbChannel((n >> 16) & 0xff);
  const g = srgbChannel((n >> 8) & 0xff);
  const b = srgbChannel(n & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foregroundHex: string, backgroundHex: string): number {
  const lf = relativeLuminance(foregroundHex);
  const lb = relativeLuminance(backgroundHex);
  const [hi, lo] = lf >= lb ? [lf, lb] : [lb, lf];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Mandated pairs:
 *  - each color.text.* on each applicable color.surface.* (primary/secondary/muted/link
 *    apply to the light surfaces INCLUDING sunken — muted-on-sunken is the disabled-control
 *    recipe; inverse applies to surface.inverse; overlay is a scrim, never a text background),
 *  - color.text.on-accent on color.accent.default and color.accent.emphasis,
 *  - each color.status.<tone>.text on its matching .surface,
 *  - color.text.inverse on each color.status.<tone>.default and .emphasis
 *    (the solid status fill recipe, e.g. danger Button rest + hover).
 */
function mandatedPairs(): ReadonlyArray<readonly [string, string]> {
  const pairs: Array<readonly [string, string]> = [];
  const lightTexts = ["color.text.primary", "color.text.secondary", "color.text.muted", "color.text.link"];
  const lightSurfaces = ["color.surface.default", "color.surface.raised", "color.surface.sunken"];
  for (const fg of lightTexts) for (const bg of lightSurfaces) pairs.push([fg, bg]);
  pairs.push(["color.text.inverse", "color.surface.inverse"]);
  pairs.push(["color.text.on-accent", "color.accent.default"]);
  pairs.push(["color.text.on-accent", "color.accent.emphasis"]);
  for (const tone of ["info", "success", "warning", "danger"]) {
    pairs.push([`color.status.${tone}.text`, `color.status.${tone}.surface`]);
    pairs.push(["color.text.inverse", `color.status.${tone}.default`]);
    pairs.push(["color.text.inverse", `color.status.${tone}.emphasis`]);
  }
  return pairs;
}

/**
 * FB-5 alias extraction: component-tier color tokens are (by tier rule) pure
 * aliases into the semantic tier. Map each one to its semantic target so the
 * contrast report can express which audited pairs it inherits. A color token
 * whose $value is not a whole-token reference maps to null (goes to `unaudited`).
 */
function componentColorAliases(componentRaw: ReadonlyMap<string, RawToken>): Map<string, string | null> {
  const aliases = new Map<string, string | null>();
  for (const [name, tok] of componentRaw.entries()) {
    if (tok.type !== "color") continue;
    const whole = typeof tok.value === "string" ? WHOLE_REF_RE.exec(tok.value) : null;
    aliases.set(name, whole ? (whole[1] as string) : null);
  }
  return aliases;
}

function unauditedReason(aliasOf: string | null): string {
  if (aliasOf === null) {
    return "Value is not a pure semantic alias, so no audited pair can be inherited.";
  }
  if (aliasOf === "color.surface.overlay") {
    return `Aliases ${aliasOf}, a scrim that is never a text background — outside the normal-text gate by design.`;
  }
  if (aliasOf.startsWith("color.border.") || /^color\.status\.[a-z]+\.border$/.test(aliasOf)) {
    return `Aliases ${aliasOf}, a border color — a non-text edge outside the WCAG 2.2 AA normal-text gate (1.4.11 non-text contrast is not yet audited).`;
  }
  return `Aliases ${aliasOf}, which appears in no mandated contrast pair.`;
}

function runContrast(
  semantic: ReadonlyMap<string, string | number>,
  brandLabel: string,
  componentRaw: ReadonlyMap<string, RawToken>,
): ContrastReport {
  // semantic token name -> component cssVars that alias it (sorted for determinism).
  const aliases = componentColorAliases(componentRaw);
  const aliasedBy = new Map<string, string[]>();
  for (const name of [...aliases.keys()].sort()) {
    const target = aliases.get(name);
    if (target === null || target === undefined) continue;
    const list = aliasedBy.get(target) ?? [];
    list.push(toCssVar(name));
    aliasedBy.set(target, list);
  }

  const pairs: ContrastPair[] = [];
  for (const [fg, bg] of mandatedPairs()) {
    const fgValue = semantic.get(fg);
    const bgValue = semantic.get(bg);
    if (typeof fgValue !== "string" || typeof bgValue !== "string") {
      throw new Error(`Contrast pair (${fg}, ${bg}) references a missing or non-color token`);
    }
    const ratio = contrastRatio(fgValue, bgValue);
    pairs.push({
      id: `${fg}|${bg}`,
      foreground: fg,
      background: bg,
      foregroundValue: fgValue,
      backgroundValue: bgValue,
      ratio: Math.round(ratio * 100) / 100,
      required: AA_NORMAL_TEXT,
      pass: ratio >= AA_NORMAL_TEXT,
      resolvesTo: {
        foreground: aliasedBy.get(fg) ?? [],
        background: aliasedBy.get(bg) ?? [],
      },
    });
  }

  // aliasIndex: component cssVar -> ids of the audited pairs its target appears in.
  // unaudited: component color tokens whose alias target is in no pair (or no pure alias).
  const pairIdsBySemantic = new Map<string, string[]>();
  for (const pair of pairs) {
    for (const semanticName of [pair.foreground, pair.background]) {
      const ids = pairIdsBySemantic.get(semanticName) ?? [];
      if (!ids.includes(pair.id)) ids.push(pair.id);
      pairIdsBySemantic.set(semanticName, ids);
    }
  }
  const aliasIndex: Record<string, string[]> = {};
  const unaudited: UnauditedToken[] = [];
  for (const name of [...aliases.keys()].sort()) {
    const aliasOf = aliases.get(name) ?? null;
    const inheritedPairIds = aliasOf === null ? undefined : pairIdsBySemantic.get(aliasOf);
    if (inheritedPairIds !== undefined) {
      aliasIndex[toCssVar(name)] = inheritedPairIds;
    } else {
      unaudited.push({ name, cssVar: toCssVar(name), aliasOf, reason: unauditedReason(aliasOf) });
    }
  }

  return {
    $description:
      "GENERATED WCAG audit for the active brand. `pairs` are the mandated semantic foreground/background checks; each pair's `resolvesTo` lists every component-tier cssVar whose value chain resolves to that same color. `aliasIndex` maps each component-tier color cssVar to the audited pair ids it inherits (e.g. text on --ds-card-surface is verified by the color.surface.raised pairs). Component color tokens under `unaudited` inherit no pair; each entry states why. A foreground/background combination in no pair and no alias entry is unverified.",
    standard: "WCAG 2.2 AA (normal text)",
    threshold: AA_NORMAL_TEXT,
    brand: brandLabel,
    failures: pairs.filter((p) => !p.pass).length,
    pairs,
    aliasIndex,
    unaudited,
  };
}

/* ------------------------------------------------------------------ */
/* Emitters                                                            */
/* ------------------------------------------------------------------ */

function emitCss(tokens: readonly PublicToken[], brandLabel: string): string {
  const lines: string[] = [
    `/* GENERATED by @ds/tokens — do not edit. Brand: ${brandLabel} */`,
    `/* Public vocabulary: semantic + component tiers only. Brand-tier ramps are never emitted. */`,
    ":root {",
  ];
  for (const tier of ["semantic", "component"] as const) {
    lines.push(`  /* ${tier} tier */`);
    for (const t of tokens) {
      if (t.tier !== tier) continue;
      lines.push(`  ${t.cssVar}: ${String(t.value)};`);
    }
  }
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

function emitIndexJs(tokens: readonly PublicToken[]): string {
  const entries = tokens
    .map(
      (t) =>
        `  ${JSON.stringify(t.name)}: { name: ${JSON.stringify(t.name)}, cssVar: ${JSON.stringify(t.cssVar)}, tier: ${JSON.stringify(t.tier)}, type: ${JSON.stringify(t.type)}, description: ${JSON.stringify(t.description)}, value: ${JSON.stringify(t.value)} },`,
    )
    .join("\n");
  return [
    "// GENERATED by @ds/tokens — do not edit.",
    "export const tokens = Object.freeze({",
    entries,
    "});",
    "export const tokenNames = Object.freeze(Object.keys(tokens));",
    "export function cssVarRef(name) {",
    '  const token = tokens[name];',
    '  if (!token) throw new Error(`Unknown design token: ${name}`);',
    "  return `var(${token.cssVar})`;",
    "}",
    "",
  ].join("\n");
}

function emitIndexDts(tokens: readonly PublicToken[]): string {
  const union = (names: readonly string[]): string =>
    names.length === 0 ? "never" : names.map((n) => `\n  | ${JSON.stringify(n)}`).join("");

  const lines: string[] = ["// GENERATED by @ds/tokens — do not edit.", ""];
  const semanticTypeNames: string[] = [];
  for (const [category, typeName] of SEMANTIC_CATEGORIES) {
    const names = tokens
      .filter((t) => t.tier === "semantic" && (t.name === category || t.name.startsWith(`${category}.`)))
      .map((t) => t.name);
    lines.push(`/** Semantic "${category}" tokens (literal union). */`);
    lines.push(`export type ${typeName} =${union(names)};`, "");
    semanticTypeNames.push(typeName);
  }
  const componentNames = tokens.filter((t) => t.tier === "component").map((t) => t.name);
  lines.push("/** Component-tier tokens (literal union). */");
  lines.push(`export type DsComponentToken =${union(componentNames)};`, "");
  lines.push(`export type DsSemanticToken =\n  | ${semanticTypeNames.join("\n  | ")};`, "");
  lines.push("export type DsToken = DsSemanticToken | DsComponentToken;", "");
  lines.push("export interface DsTokenInfo {");
  lines.push("  readonly name: DsToken;");
  lines.push('  readonly cssVar: `--ds-${string}`;');
  lines.push('  readonly tier: "semantic" | "component";');
  lines.push("  readonly type: string;");
  lines.push("  readonly description: string;");
  lines.push("  readonly value: string | number;");
  lines.push("}", "");
  lines.push("/** Every public token, keyed by DTCG path. The closed-world map. */");
  lines.push("export declare const tokens: Readonly<Record<DsToken, DsTokenInfo>>;", "");
  lines.push("/** All public token names, sorted (semantic tier first, then component). */");
  lines.push("export declare const tokenNames: readonly DsToken[];", "");
  lines.push('/** Returns `var(--ds-...)` for a known token; throws on anything else. */');
  lines.push("export declare function cssVarRef(name: DsToken): string;");
  return `${lines.join("\n")}\n`;
}

/* ------------------------------------------------------------------ */
/* Orchestrator                                                        */
/* ------------------------------------------------------------------ */

function writeOut(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
}

export function buildTokens(options: BuildOptions = {}): BuildResult {
  const brandPath = resolve(options.brandPath ?? join(REPO_ROOT, "brands", "default.json"));
  const distDir = resolve(options.distDir ?? join(PKG_ROOT, "dist"));
  const registriesDir = resolve(options.registriesDir ?? join(REPO_ROOT, "registries"));
  const brandLabel = relative(REPO_ROOT, brandPath).split("\\").join("/");

  // 1. Brand tier: flatten + derive ramps. Never emitted.
  const brand = new Map<string, RawToken>();
  flattenFile(brandPath, brand);
  deriveBrand(brand, brandPath);
  const brandLookup = (ref: string): string | number | undefined => {
    const tok = brand.get(ref);
    if (!tok) return undefined;
    if (typeof tok.value !== "string" && typeof tok.value !== "number") return undefined;
    return tok.value;
  };

  // 2. Semantic tier: aliases into the brand tier only.
  const semantic = resolveTier(loadTierDir(join(PKG_ROOT, "src", "semantic")), "semantic", brandLookup, "brand-tier");
  const semanticValues = new Map<string, string | number>(semantic.map((t) => [t.name, t.value]));

  // 3. Component tier: aliases into the semantic tier only.
  const componentRaw = loadTierDir(join(PKG_ROOT, "src", "component"));
  const component = resolveTier(componentRaw, "component", (ref) => semanticValues.get(ref), "semantic-tier");

  const all: PublicToken[] = [...semantic, ...component];

  // Closed-world sanity: css var names must be unique.
  const seen = new Set<string>();
  for (const t of all) {
    if (seen.has(t.cssVar)) throw new Error(`Duplicate CSS variable ${t.cssVar}`);
    seen.add(t.cssVar);
  }

  // 4. Emit artifacts.
  const css = emitCss(all, brandLabel);
  const files = {
    css: join(distDir, "css", "tokens.css"),
    indexJs: join(distDir, "index.js"),
    indexDts: join(distDir, "index.d.ts"),
    tokensIndex: join(registriesDir, "tokens-index.json"),
    contrastReport: join(registriesDir, "contrast-report.json"),
  };
  writeOut(files.css, css);
  writeOut(files.indexJs, emitIndexJs(all));
  writeOut(files.indexDts, emitIndexDts(all));
  writeOut(
    files.tokensIndex,
    `${JSON.stringify(
      {
        $description:
          "GENERATED closed-world token contract. Every public design token is enumerated here; a token not in this file is provably fabricated.",
        brand: brandLabel,
        count: all.length,
        tokens: all,
      },
      null,
      2,
    )}\n`,
  );

  // 5. WCAG gate — report is always written; failures fail the build.
  const contrast = runContrast(semanticValues, brandLabel, componentRaw);
  writeOut(files.contrastReport, `${JSON.stringify(contrast, null, 2)}\n`);
  if (contrast.failures > 0) {
    const failing = contrast.pairs
      .filter((p) => !p.pass)
      .map((p) => `  ${p.foreground} on ${p.background}: ${p.ratio}:1 (< ${p.required}:1)`)
      .join("\n");
    throw new ContrastError(
      `WCAG 2.2 AA contrast failures for brand ${brandLabel} (${contrast.failures}):\n${failing}\nReport: ${files.contrastReport}`,
    );
  }

  return {
    brandPath,
    semanticCount: semantic.length,
    componentCount: component.length,
    tokens: all,
    css,
    contrast,
    files,
  };
}
