import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  buildTokens,
  PKG_ROOT,
  type BuildResult,
  type ContrastReport,
  type PublicToken,
} from "../src/build/build.ts";

const FIXTURE_BRAND = join(PKG_ROOT, "test", "fixtures", "brand-test.json");

let workDir: string;
let defaultBuild: BuildResult;
let fixtureBuild: BuildResult;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "ds-tokens-test-"));
  // Hermetic: both builds write into the temp dir, never into dist/ or registries/.
  defaultBuild = buildTokens({
    distDir: join(workDir, "default", "dist"),
    registriesDir: join(workDir, "default", "registries"),
  });
  fixtureBuild = buildTokens({
    brandPath: FIXTURE_BRAND,
    distDir: join(workDir, "fixture", "dist"),
    registriesDir: join(workDir, "fixture", "registries"),
  });
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

/** Expected semantic vocabulary, transcribed from docs/specs/token-taxonomy.md. */
const EXPECTED_SEMANTIC: readonly string[] = [
  ...["default", "raised", "sunken", "sunken-hover", "overlay", "inverse"].map((c) => `color.surface.${c}`),
  ...["primary", "secondary", "muted", "inverse", "link", "on-accent"].map((c) => `color.text.${c}`),
  ...["default", "emphasis", "muted"].map((c) => `color.accent.${c}`),
  ...["default", "muted", "strong", "focus"].map((c) => `color.border.${c}`),
  ...["info", "success", "warning", "danger"].flatMap((tone) =>
    ["default", "emphasis", "surface", "border", "text"].map((part) => `color.status.${tone}.${part}`),
  ),
  "font.family.sans",
  "font.family.mono",
  ...["xs", "sm", "md", "lg", "xl", "2xl", "3xl"].map((s) => `text.size.${s}`),
  ...["regular", "medium", "semibold", "bold"].map((w) => `text.weight.${w}`),
  ...["tight", "normal", "loose"].map((l) => `text.leading.${l}`),
  ...Array.from({ length: 11 }, (_, i) => `space.${i}`),
  ...["sm", "md", "lg"].map((s) => `space.inset.${s}`),
  ...["sm", "md", "lg"].map((s) => `space.gap.${s}`),
  ...["sm", "md", "lg", "full"].map((r) => `radius.${r}`),
  "border.width.1",
  "border.width.2",
  ...["raised", "overlay", "focus-ring"].map((s) => `shadow.${s}`),
  ...["fast", "normal", "slow"].map((d) => `motion.duration.${d}`),
  ...["standard", "enter", "exit"].map((e) => `motion.easing.${e}`),
  ...["dropdown", "sticky", "overlay", "toast", "tooltip"].map((z) => `z.${z}`),
  ...["sm", "md", "lg"].map((s) => `size.control.${s}`),
  ...["sm", "md", "lg"].map((s) => `size.icon.${s}`),
];

const REQUIRED_COMPONENTS = [
  "button",
  "field",
  "card",
  "dialog",
  "tooltip",
  "badge",
  "alert",
  "tabs",
  "checkbox",
  "radio",
  "switch",
] as const;

interface Registry {
  brand: string;
  count: number;
  tokens: PublicToken[];
}

function readRegistry(dir: string): Registry {
  return JSON.parse(readFileSync(join(dir, "registries", "tokens-index.json"), "utf8")) as Registry;
}

function readCss(dir: string): string {
  return readFileSync(join(dir, "dist", "css", "tokens.css"), "utf8");
}

describe("registry coverage (taxonomy spec)", () => {
  it("contains every semantic token mandated by docs/specs/token-taxonomy.md", () => {
    const registry = readRegistry(join(workDir, "default"));
    const semanticNames = new Set(registry.tokens.filter((t) => t.tier === "semantic").map((t) => t.name));
    const missing = EXPECTED_SEMANTIC.filter((name) => !semanticNames.has(name));
    expect(missing).toEqual([]);
    // Exact-set check: no semantic tokens outside the spec vocabulary either.
    const extra = [...semanticNames].filter((name) => !EXPECTED_SEMANTIC.includes(name));
    expect(extra).toEqual([]);
  });

  it("contains component-tier hooks for every v1 component group", () => {
    const registry = readRegistry(join(workDir, "default"));
    const componentRoots = new Set(
      registry.tokens.filter((t) => t.tier === "component").map((t) => t.name.split(".")[0]),
    );
    for (const component of REQUIRED_COMPONENTS) {
      expect(componentRoots, `missing component tokens for "${component}"`).toContain(component);
    }
  });

  it("every registry entry carries the full closed-world contract fields", () => {
    const registry = readRegistry(join(workDir, "default"));
    expect(registry.count).toBe(registry.tokens.length);
    for (const t of registry.tokens) {
      expect(["semantic", "component"]).toContain(t.tier);
      expect(t.cssVar).toMatch(/^--ds-[a-z0-9-]+$/);
      expect(t.cssVar).toBe(`--ds-${t.name.replaceAll(".", "-")}`);
      expect(t.type.length).toBeGreaterThan(0);
      expect(t.description.trim().length, `${t.name} needs a real $description`).toBeGreaterThan(10);
      expect(String(t.value).length).toBeGreaterThan(0);
    }
  });
});

describe("brand tier stays private", () => {
  const BRAND_ROOTS = ["palette", "typeface", "type-scale", "radius-scale", "space-base", "elevation", "derived", "assets"];

  it("emits no brand-tier CSS variables", () => {
    const css = readCss(join(workDir, "default"));
    for (const root of BRAND_ROOTS) {
      expect(css).not.toMatch(new RegExp(`--ds-${root}\\b`));
    }
  });

  it("registry contains only semantic and component tiers, no brand paths", () => {
    const registry = readRegistry(join(workDir, "default"));
    for (const t of registry.tokens) {
      expect(BRAND_ROOTS).not.toContain(t.name.split(".")[0]);
    }
  });

  it("CSS custom properties and the registry enumerate the identical closed world", () => {
    const css = readCss(join(workDir, "default"));
    const cssVars = [...css.matchAll(/^\s*(--ds-[a-z0-9-]+):/gm)].map((m) => m[1]).sort();
    const registryVars = readRegistry(join(workDir, "default"))
      .tokens.map((t) => t.cssVar)
      .sort();
    expect(cssVars).toEqual(registryVars);
  });
});

describe("WCAG 2.2 AA contrast gate", () => {
  it("default brand report exists with zero failures and all mandated pairs passing", () => {
    const report = JSON.parse(
      readFileSync(join(workDir, "default", "registries", "contrast-report.json"), "utf8"),
    ) as ContrastReport;
    expect(report.threshold).toBe(4.5);
    expect(report.failures).toBe(0);
    // 4 text colors x 3 light surfaces + inverse-on-inverse + 2 on-accent
    // + 4 status text-on-surface + 4x2 inverse-on-status solid fills
    expect(report.pairs.length).toBe(27);
    for (const pair of report.pairs) {
      expect(pair.pass, `${pair.foreground} on ${pair.background} = ${pair.ratio}:1`).toBe(true);
      expect(pair.ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("covers the mandated on-accent and status pairs explicitly", () => {
    const keys = defaultBuild.contrast.pairs.map((p) => `${p.foreground}|${p.background}`);
    expect(keys).toContain("color.text.on-accent|color.accent.default");
    expect(keys).toContain("color.text.on-accent|color.accent.emphasis");
    for (const tone of ["info", "success", "warning", "danger"]) {
      expect(keys).toContain(`color.status.${tone}.text|color.status.${tone}.surface`);
    }
  });

  it("covers the solid status fill recipe: text.inverse on each status default and emphasis", () => {
    const keys = defaultBuild.contrast.pairs.map((p) => `${p.foreground}|${p.background}`);
    for (const tone of ["info", "success", "warning", "danger"]) {
      expect(keys).toContain(`color.text.inverse|color.status.${tone}.default`);
      expect(keys).toContain(`color.text.inverse|color.status.${tone}.emphasis`);
    }
  });

  it("covers the disabled-control recipe: text.muted on surface.sunken", () => {
    const keys = defaultBuild.contrast.pairs.map((p) => `${p.foreground}|${p.background}`);
    expect(keys).toContain("color.text.muted|color.surface.sunken");
  });

  it("status emphasis is a genuine darkening step (default stays lighter than emphasis)", () => {
    const value = new Map(defaultBuild.tokens.map((t) => [t.name, t.value]));
    const inverse = value.get("color.text.inverse") as string;
    const ratio = (bg: string): number => {
      const pair = defaultBuild.contrast.pairs.find(
        (p) => p.foreground === "color.text.inverse" && p.background === bg,
      );
      if (!pair) throw new Error(`missing pair for ${bg} vs ${inverse}`);
      return pair.ratio;
    };
    for (const tone of ["info", "success", "warning", "danger"]) {
      expect(ratio(`color.status.${tone}.emphasis`)).toBeGreaterThan(ratio(`color.status.${tone}.default`));
    }
  });
});

describe("theme-swap invariant (white-label mechanism)", () => {
  it("a different brand file produces an identical token name set", () => {
    const defaultNames = defaultBuild.tokens.map((t) => t.name);
    const fixtureNames = fixtureBuild.tokens.map((t) => t.name);
    expect(fixtureNames).toEqual(defaultNames);
  });

  it("a different brand file produces identical CSS variable names", () => {
    const varNames = (css: string): string[] =>
      [...css.matchAll(/^\s*(--ds-[a-z0-9-]+):/gm)].map((m) => m[1] as string);
    expect(varNames(readCss(join(workDir, "fixture")))).toEqual(varNames(readCss(join(workDir, "default"))));
  });

  it("a different brand file produces different resolved CSS values", () => {
    const defaultCss = readCss(join(workDir, "default"));
    const fixtureCss = readCss(join(workDir, "fixture"));
    expect(fixtureCss).not.toBe(defaultCss);
    // Spot-check that brand ramps actually flowed through all derived categories.
    const value = (css: string, cssVar: string): string => {
      const m = css.match(new RegExp(`${cssVar}: ([^;]+);`));
      if (!m) throw new Error(`${cssVar} not found`);
      return m[1] as string;
    };
    for (const cssVar of ["--ds-color-accent-default", "--ds-space-4", "--ds-text-size-md", "--ds-radius-md"]) {
      expect(value(fixtureCss, cssVar)).not.toBe(value(defaultCss, cssVar));
    }
  });

  it("the fixture brand build also passes the AA gate", () => {
    expect(fixtureBuild.contrast.failures).toBe(0);
  });
});
