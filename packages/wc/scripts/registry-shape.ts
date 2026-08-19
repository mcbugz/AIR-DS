/**
 * Pure manifest -> registry JSON transform, shared by the generator CLI and
 * the tests (which regenerate in memory and byte-compare against the
 * committed registries/wc-index.json to catch drift).
 */

import type { WcComponentSpec } from "../src/manifest.ts";

export function buildWcRegistry(manifest: readonly WcComponentSpec[]): string {
  const registry = {
    $description:
      "GENERATED closed-world component registry for @ds/wc (web components). Compiled from packages/wc/src/manifest.ts — the same source the elements import their attribute vocabularies from. Any tag not listed here does not exist; any attribute value outside an attribute's `values` list falls back to its `default` (the elements never invent states). Separate contract from components-index.json by design: different framework, different consumption surface (attributes/events/cssParts instead of props). Regenerate with: pnpm --filter @ds/wc generate",
    package: "@ds/wc",
    count: manifest.length,
    components: manifest.map((c) => ({
      tag: c.tag,
      description: c.description,
      attributes: c.attributes.map((a) => ({
        name: a.name,
        type: a.type,
        values: a.values === null ? null : [...a.values],
        default: a.default,
        description: a.description,
      })),
      events: c.events.map((e) => ({ name: e.name, description: e.description })),
      cssParts: c.cssParts.map((p) => ({ name: p.name, description: p.description })),
    })),
  };
  return `${JSON.stringify(registry, null, 2)}\n`;
}
