/**
 * Registry contract: registries/wc-index.json is GENERATED from
 * src/manifest.ts. These tests regenerate it in memory and byte-compare
 * against the committed file (drift check), and assert the closed-world
 * shape agents rely on.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { WC_MANIFEST, BUTTON_SIZES, BUTTON_VARIANTS } from "../src/manifest.ts";
import { buildWcRegistry } from "../scripts/registry-shape.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const REGISTRY_PATH = join(REPO_ROOT, "registries", "wc-index.json");

interface WcRegistry {
  $description: string;
  package: string;
  count: number;
  components: Array<{
    tag: string;
    description: string;
    attributes: Array<{
      name: string;
      type: "enum" | "boolean";
      values: string[] | null;
      default: string | null;
      description: string;
    }>;
    events: Array<{ name: string; description: string }>;
    cssParts: Array<{ name: string; description: string }>;
  }>;
}

describe("wc-index.json generation", () => {
  it("the committed registry is byte-identical to the manifest compile (no drift, no hand edits)", () => {
    expect(readFileSync(REGISTRY_PATH, "utf8")).toBe(buildWcRegistry(WC_MANIFEST));
  });

  it("declares itself a generated closed-world contract", () => {
    const reg = JSON.parse(readFileSync(REGISTRY_PATH, "utf8")) as WcRegistry;
    expect(reg.$description).toMatch(/GENERATED/);
    expect(reg.$description).toMatch(/closed-world/);
    expect(reg.package).toBe("@ds/wc");
    expect(reg.count).toBe(reg.components.length);
  });
});

describe("ds-button contract", () => {
  const reg = (): WcRegistry => JSON.parse(readFileSync(REGISTRY_PATH, "utf8")) as WcRegistry;

  it("lists ds-button with the four React-mirroring attributes", () => {
    const button = reg().components.find((c) => c.tag === "ds-button");
    expect(button).toBeDefined();
    expect(button?.attributes.map((a) => a.name).sort()).toEqual(["disabled", "loading", "size", "variant"]);
  });

  it("enumerates every legal value for enum attributes, with defaults", () => {
    const button = reg().components.find((c) => c.tag === "ds-button");
    const variant = button?.attributes.find((a) => a.name === "variant");
    expect(variant?.type).toBe("enum");
    expect(variant?.values).toEqual([...BUTTON_VARIANTS]);
    expect(variant?.default).toBe("primary");
    const size = button?.attributes.find((a) => a.name === "size");
    expect(size?.values).toEqual([...BUTTON_SIZES]);
    expect(size?.default).toBe("md");
  });

  it("boolean attributes carry no value vocabulary (presence-based)", () => {
    const button = reg().components.find((c) => c.tag === "ds-button");
    for (const name of ["loading", "disabled"]) {
      const attr = button?.attributes.find((a) => a.name === name);
      expect(attr?.type).toBe("boolean");
      expect(attr?.values).toBeNull();
    }
  });

  it("documents events and cssParts (the WC consumption surface)", () => {
    const button = reg().components.find((c) => c.tag === "ds-button");
    expect(button?.events.map((e) => e.name)).toContain("click");
    expect(button?.cssParts.map((p) => p.name).sort()).toEqual(["button", "spinner"]);
    for (const part of button?.cssParts ?? []) {
      expect(part.description.trim().length).toBeGreaterThan(10);
    }
  });

  it("every description is substantive (agent-facing docs, same bar as tokens)", () => {
    for (const component of reg().components) {
      expect(component.description.trim().length).toBeGreaterThan(40);
      for (const attr of component.attributes) {
        expect(attr.description.trim().length, `${component.tag}[${attr.name}]`).toBeGreaterThan(20);
      }
    }
  });
});
