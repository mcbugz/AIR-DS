/**
 * M5 platform emitters: dist/wc/tokens.css + dist/react-native/tokens.ts +
 * registries/platforms-manifest.json — and the BYTE-IDENTITY proof that the
 * legacy artifacts (css/tokens.css, index.js, index.d.ts, tokens-index.json,
 * contrast-report.json) are unchanged by the platform-emitter addition.
 */

import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildTokens, PKG_ROOT, REPO_ROOT, type BuildResult } from "../src/build/build.ts";
import { RN_LOSSINESS } from "../src/build/platforms.ts";

const FIXTURE_BRAND = join(PKG_ROOT, "test", "fixtures", "brand-test.json");

let workDir: string;
let defaultBuild: BuildResult;
let fixtureBuild: BuildResult;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "ds-tokens-platforms-"));
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

const sha256 = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

/* ------------------------------------------------------------------ */
/* Byte-identity: the legacy outputs are UNCHANGED by the M5 emitters  */
/* ------------------------------------------------------------------ */

describe("byte-identity of legacy artifacts (M5 additive contract)", () => {
  /**
   * Golden SHA-256 hashes of the five pre-M5 artifacts for brands/default.json,
   * captured from the build at the commit BEFORE the platform emitters were
   * added. If a future change to token SOURCES moves these, update them
   * deliberately in the same commit — this test exists to prove the platform
   * EMITTERS never touch the legacy byte streams.
   */
  const GOLDEN: ReadonlyArray<readonly [string, string]> = [
    ["dist/css/tokens.css", "744e678a3834a7bf7d5accb5c6f6c720fcb72860fbf33d84a891253b83242526"],
    ["dist/index.js", "a4637e7ab17d44a70d22a920ef82afba268b7376d563ff8f80222510022ab5aa"],
    ["dist/index.d.ts", "5c8789adc529eca62bfd956308635432f934cf8bf6b8132b3f121935676da50d"],
    ["registries/tokens-index.json", "55a8e4451abac094689faf525077ca8a568044ccd22ab57c1260358c021daed3"],
    ["registries/contrast-report.json", "f460b6a031161baf7146a72adaebb7406f4590fc1897841bbcc717f12489ee62"],
  ];

  it.each(GOLDEN)("%s matches its pre-M5 golden hash", (rel, hash) => {
    expect(sha256(join(workDir, "default", rel))).toBe(hash);
  });

  it("the hermetic build also matches the committed workspace registry byte-for-byte", () => {
    expect(readFileSync(join(workDir, "default", "registries", "tokens-index.json"), "utf8")).toBe(
      readFileSync(join(REPO_ROOT, "registries", "tokens-index.json"), "utf8"),
    );
  });

  it("tokens-index.json keeps its exact pre-M5 shape (platform metadata lives in the manifest, not here)", () => {
    const registry = JSON.parse(
      readFileSync(join(workDir, "default", "registries", "tokens-index.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(Object.keys(registry).sort()).toEqual(["$description", "brand", "count", "tokens"]);
  });
});

/* ------------------------------------------------------------------ */
/* Web Components emitter                                              */
/* ------------------------------------------------------------------ */

function cssDeclarations(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/^\s*(--ds-[a-z0-9-]+):\s*([^;]+);/gm)) {
    out.set(m[1] as string, m[2] as string);
  }
  return out;
}

describe("dist/wc/tokens.css (Shadow-DOM scoped)", () => {
  const wcCss = (dir: string): string => readFileSync(join(workDir, dir, "dist", "wc", "tokens.css"), "utf8");
  const rootCss = (dir: string): string => readFileSync(join(workDir, dir, "dist", "css", "tokens.css"), "utf8");

  it("scopes the block ':host, :root' and documents both consumption paths", () => {
    const css = wcCss("default");
    expect(css).toMatch(/^:host, :root \{$/m);
    expect(css).toMatch(/adoptedStyleSheets/);
    expect(css).toMatch(/:root.*fallback/i);
    expect(css).not.toMatch(/^:root \{$/m);
  });

  it("emits the IDENTICAL custom-property set and values as the canonical web build", () => {
    const web = cssDeclarations(rootCss("default"));
    const wc = cssDeclarations(wcCss("default"));
    expect([...wc.keys()].sort()).toEqual([...web.keys()].sort());
    for (const [name, value] of web) {
      expect(wc.get(name), name).toBe(value);
    }
  });

  it("is brand-aware: the fixture brand yields identical names but different values", () => {
    const def = cssDeclarations(wcCss("default"));
    const fix = cssDeclarations(wcCss("fixture"));
    expect([...fix.keys()].sort()).toEqual([...def.keys()].sort());
    expect(fix.get("--ds-color-accent-default")).not.toBe(def.get("--ds-color-accent-default"));
    expect(wcCss("fixture")).toContain("brand-test.json");
  });
});

/* ------------------------------------------------------------------ */
/* React Native emitter                                                */
/* ------------------------------------------------------------------ */

interface RnShadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowRadius: number;
  shadowOpacity: number;
  elevation: number;
}

type RnTree = { [key: string]: RnTree | string | number | readonly number[] | RnShadow | undefined };

async function importRn(dir: string): Promise<RnTree> {
  const mod = (await import(/* @vite-ignore */ pathToFileURL(join(workDir, dir, "dist", "react-native", "tokens.ts")).href)) as {
    tokens: RnTree;
  };
  return mod.tokens;
}

describe("dist/react-native/tokens.ts (typed RN object)", () => {
  it("emits a compilable TS module exporting the nested token object", async () => {
    const tokens = await importRn("default");
    expect(typeof tokens).toBe("object");
  });

  it("converts px dimensions to numeric dp", async () => {
    const t = await importRn("default");
    expect((t["space"] as RnTree)["4"]).toBe(16);
    expect(((t["size"] as RnTree)["control"] as RnTree)["md"]).toBe(40);
    expect(((t["button"] as RnTree)["height"] as RnTree)["md"]).toBe(40);
  });

  it("converts rem to dp at the 16px root and resolves calc() products", async () => {
    const t = await importRn("default");
    expect(((t["text"] as RnTree)["size"] as RnTree)["md"]).toBe(16);
    expect(((t["text"] as RnTree)["size"] as RnTree)["sm"]).toBe(13);
    expect(((t["size"] as RnTree)["container"] as RnTree)["lg"]).toBe(1200);
  });

  it("keeps colors as strings and weights as RN fontWeight strings", async () => {
    const t = await importRn("default");
    expect(((t["color"] as RnTree)["accent"] as RnTree)["default"]).toBe("#2563eb");
    expect(((t["text"] as RnTree)["weight"] as RnTree)["medium"]).toBe("500");
  });

  it("maps the system font stack to undefined (platform default) — honest, not fabricated", async () => {
    const t = await importRn("default");
    const family = (t["font"] as RnTree)["family"] as RnTree;
    expect("sans" in family).toBe(true);
    expect(family["sans"]).toBeUndefined();
  });

  it("extracts a concrete brand typeface when the stack leads with one (brand-aware)", async () => {
    const t = await importRn("fixture");
    expect(((t["font"] as RnTree)["family"] as RnTree)["sans"]).toBe("Inter Test");
  });

  it("maps shadows to RN shadow*/elevation conventions", async () => {
    const t = await importRn("default");
    const raised = (t["shadow"] as RnTree)["raised"] as RnShadow;
    expect(raised).toEqual({
      shadowColor: "#020617",
      shadowOffset: { width: 0, height: 1 },
      shadowRadius: 1,
      shadowOpacity: 0.06,
      elevation: 1,
    });
    const overlay = (t["shadow"] as RnTree)["overlay"] as RnShadow;
    expect(overlay.elevation).toBe(10);
    // Spread-only focus ring: honest degradation to elevation 0.
    const ring = (t["shadow"] as RnTree)["focus-ring"] as RnShadow;
    expect(ring.elevation).toBe(0);
    expect(ring.shadowOpacity).toBe(1);
  });

  it("converts durations to ms numbers and easings to bezier tuples", async () => {
    const t = await importRn("default");
    expect(((t["motion"] as RnTree)["duration"] as RnTree)["fast"]).toBe(120);
    expect(((t["motion"] as RnTree)["easing"] as RnTree)["standard"]).toEqual([0.2, 0, 0, 1]);
  });

  it("scales percentage number tokens to the RN 0-1 range", async () => {
    const t = await importRn("default");
    expect((t["dialog"] as RnTree)["backdrop-opacity"]).toBe(0.5);
  });

  it("contains no web-only value syntax anywhere in the tree", async () => {
    const t = await importRn("default");
    const walk = (node: RnTree | string | number | readonly number[] | RnShadow | undefined): void => {
      if (typeof node === "string") {
        expect(node).not.toMatch(/var\(|calc\(|\d(px|rem|ms)\b|cubic-bezier/);
      } else if (typeof node === "object" && node !== null && !Array.isArray(node)) {
        for (const v of Object.values(node)) walk(v as RnTree);
      }
    };
    walk(t);
  });

  it("covers the full public token count (every registry entry has an RN leaf)", async () => {
    const t = await importRn("default");
    const registry = JSON.parse(
      readFileSync(join(workDir, "default", "registries", "tokens-index.json"), "utf8"),
    ) as { tokens: Array<{ name: string }> };
    for (const { name } of registry.tokens) {
      let node: RnTree | unknown = t;
      for (const seg of name.split(".")) {
        expect(typeof node === "object" && node !== null, `${name}: missing group at "${seg}"`).toBe(true);
        expect(seg in (node as RnTree), `${name}: missing leaf "${seg}"`).toBe(true);
        node = (node as RnTree)[seg];
      }
    }
  });

  it("carries the honest-lossiness header verbatim", () => {
    const ts = readFileSync(join(workDir, "default", "dist", "react-native", "tokens.ts"), "utf8");
    expect(ts).toMatch(/HONEST LOSSINESS/);
    for (const note of RN_LOSSINESS) {
      expect(ts).toContain(note);
    }
  });

  it("is brand-aware: fixture brand produces different dp values", async () => {
    const def = await importRn("default");
    const fix = await importRn("fixture");
    expect((fix["space"] as RnTree)["4"]).not.toBe((def["space"] as RnTree)["4"]);
    expect(((fix["text"] as RnTree)["size"] as RnTree)["md"]).not.toBe(
      ((def["text"] as RnTree)["size"] as RnTree)["md"],
    );
  });
});

/* ------------------------------------------------------------------ */
/* Platforms manifest                                                  */
/* ------------------------------------------------------------------ */

interface PlatformsManifest {
  $description: string;
  brand: string;
  tokenCount: number;
  platforms: Array<{
    platform: string;
    output: string;
    format: string;
    lossless: boolean;
    lossiness?: string[];
  }>;
}

describe("registries/platforms-manifest.json", () => {
  const manifest = (dir: string): PlatformsManifest =>
    JSON.parse(readFileSync(join(workDir, dir, "registries", "platforms-manifest.json"), "utf8")) as PlatformsManifest;

  it("enumerates exactly the three emitted platforms (closed world)", () => {
    const m = manifest("default");
    expect(m.platforms.map((p) => p.platform)).toEqual(["web", "web-components", "react-native"]);
    expect(m.tokenCount).toBe(232);
    expect(m.brand).toBe("brands/default.json");
  });

  it("declares honesty about lossiness per platform", () => {
    const m = manifest("default");
    const byName = new Map(m.platforms.map((p) => [p.platform, p]));
    expect(byName.get("web")?.lossless).toBe(true);
    expect(byName.get("web-components")?.lossless).toBe(true);
    expect(byName.get("react-native")?.lossless).toBe(false);
    expect(byName.get("react-native")?.lossiness).toEqual([...RN_LOSSINESS]);
  });

  it("emitted outputs actually exist at the manifest paths (relative to dist)", () => {
    const m = manifest("default");
    for (const p of m.platforms) {
      expect(() => readFileSync(join(workDir, "default", "dist", p.output))).not.toThrow();
    }
  });

  it("records the brand it was built with (fixture build says so)", () => {
    expect(manifest("fixture").brand).toMatch(/brand-test\.json$/);
  });
});

/* ------------------------------------------------------------------ */
/* Cross-emitter consistency: one resolved graph, N render targets     */
/* ------------------------------------------------------------------ */

describe("single-source consistency across platforms", () => {
  it("the same resolved value reaches web CSS, wc CSS, and RN for a spot set", async () => {
    const web = cssDeclarations(readFileSync(join(workDir, "default", "dist", "css", "tokens.css"), "utf8"));
    const wc = cssDeclarations(readFileSync(join(workDir, "default", "dist", "wc", "tokens.css"), "utf8"));
    const rn = await importRn("default");
    // color: identical string in all three.
    expect(web.get("--ds-color-accent-default")).toBe("#2563eb");
    expect(wc.get("--ds-color-accent-default")).toBe("#2563eb");
    expect(((rn["color"] as RnTree)["accent"] as RnTree)["default"]).toBe("#2563eb");
    // dimension: 16px in CSS = 16dp in RN.
    expect(web.get("--ds-space-4")).toBe("16px");
    expect((rn["space"] as RnTree)["4"]).toBe(16);
    expect(defaultBuild.tokens.find((t) => t.name === "space.4")?.value).toBe("16px");
    expect(fixtureBuild.tokens.length).toBe(defaultBuild.tokens.length);
  });
});
