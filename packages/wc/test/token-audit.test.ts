/**
 * Token-only style audit for @ds/wc — the same discipline the react package
 * is held to (CLAUDE.md rule 2), applied to this package's CSS source:
 *
 *  - closed world: every var(--ds-*) reference must exist in
 *    registries/tokens-index.json;
 *  - literal discipline: no hex colors, no named colors, no non-zero px/rem
 *    literals, no font-family literals;
 *  - motion gate: @keyframes require a prefers-reduced-motion override.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { BUTTON_CSS } from "../src/button.css.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

interface TokensIndex {
  tokens: Array<{ cssVar: string }>;
}

const registry = JSON.parse(
  readFileSync(join(REPO_ROOT, "registries", "tokens-index.json"), "utf8"),
) as TokensIndex;
const knownVars = new Set(registry.tokens.map((t) => t.cssVar));

/** Every stylesheet this package ships (extend as components are added). */
const SHEETS: ReadonlyArray<readonly [string, string]> = [["ds-button", BUTTON_CSS]];

describe("token closed-world (G1 for @ds/wc)", () => {
  it.each(SHEETS)("%s: every var(--ds-*) reference exists in tokens-index.json", (_name, css) => {
    const refs = [...css.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1] as string);
    expect(refs.length).toBeGreaterThan(10);
    const fabricated = refs.filter((r) => !knownVars.has(r));
    expect(fabricated, "fabricated tokens (not in the registry)").toEqual([]);
  });

  it.each(SHEETS)("%s: consumes only its own component namespace or semantic tokens (NR-008)", (_name, css) => {
    const componentSegments = new Set(
      registry.tokens
        .map((t) => /^--ds-([a-z0-9]+)-/.exec(t.cssVar)?.[1])
        .filter((s): s is string => s !== undefined),
    );
    const semanticCategories = new Set([
      "color",
      "font",
      "text",
      "space",
      "radius",
      "border",
      "shadow",
      "motion",
      "z",
      "size",
    ]);
    for (const m of css.matchAll(/var\(\s*(--ds-([a-z0-9]+)-[\w-]*)/g)) {
      const seg = m[2] as string;
      if (semanticCategories.has(seg)) continue;
      expect(componentSegments.has(seg) ? seg : "button", `${m[1]} borrows a foreign namespace`).toBe("button");
    }
  });
});

describe("literal discipline (G2 for @ds/wc)", () => {
  const masked = (css: string): string => css.replace(/var\([^)]*\)/g, "var(x)");

  it.each(SHEETS)("%s: no raw hex colors", (_name, css) => {
    expect(masked(css)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it.each(SHEETS)("%s: no color functions or named colors as values", (_name, css) => {
    expect(masked(css)).not.toMatch(/\b(rgb|rgba|hsl|hsla|oklch|color-mix)\s*\(/);
    expect(masked(css)).not.toMatch(/:\s*(red|blue|green|white|black|gray|grey)\s*[;}]/);
  });

  it.each(SHEETS)("%s: no non-zero px/rem/em literals", (_name, css) => {
    const hits = [...masked(css).matchAll(/(-?\d*\.?\d+)(px|rem|em)\b/g)].filter((m) => Number(m[1]) !== 0);
    expect(hits.map((m) => m[0])).toEqual([]);
  });

  it.each(SHEETS)("%s: no font-family literals", (_name, css) => {
    for (const m of masked(css).matchAll(/font-family:\s*([^;]+);/g)) {
      expect((m[1] as string).trim()).toBe("var(x)");
    }
  });

  it.each(SHEETS)("%s: no custom-property declarations (tokens are consumed, not defined)", (_name, css) => {
    expect(css).not.toMatch(/^\s*--[\w-]+\s*:/m);
  });
});

describe("motion gate (G11 for @ds/wc)", () => {
  it.each(SHEETS)("%s: @keyframes are gated behind prefers-reduced-motion", (_name, css) => {
    if (/@keyframes/.test(css)) {
      expect(css).toMatch(/@media[^{]*prefers-reduced-motion\s*:\s*reduce/);
    }
  });
});
