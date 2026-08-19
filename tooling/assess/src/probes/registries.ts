/**
 * Registry / closed-world probe: does the repo ship ANY machine-readable
 * enumeration of its tokens or components? (Brief practice 1 + 2: a token or
 * component not in a registry is provably fabricated — but only if a registry
 * exists at all.)
 */
import type { RepoFile, RepoScan } from '../walk.ts';

export interface RegistryHit {
  path: string;
  entries: number;
}

export interface RegistryFindings {
  tokenRegistry: RegistryHit | null;
  componentRegistry: RegistryHit | null;
}

function arraysIn(value: unknown): unknown[][] {
  if (Array.isArray(value)) return [value];
  if (value !== null && typeof value === 'object') {
    const out: unknown[][] = [];
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(v)) out.push(v);
    }
    return out;
  }
  return [];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Array of >=min objects each carrying `name` plus one of `valueKeys`. */
function enumerationSize(arrays: unknown[][], valueKeys: string[], min: number): number {
  let best = 0;
  for (const arr of arrays) {
    if (arr.length < min) continue;
    const ok = arr.every(
      (e) =>
        isRecord(e) &&
        typeof e['name'] === 'string' &&
        valueKeys.some((k) => e[k] !== undefined),
    );
    if (ok) best = Math.max(best, arr.length);
  }
  return best;
}

export function probeRegistries(scan: RepoScan): RegistryFindings {
  let tokenRegistry: RegistryHit | null = null;
  let componentRegistry: RegistryHit | null = null;

  const candidates: RepoFile[] = scan
    .byExt('.json')
    .filter((f) => f.size <= 2_000_000 && !/^(package(-lock)?|tsconfig.*|deno|composer)\.json$/.test(f.base));

  for (const f of candidates) {
    const parsed = scan.json(f);
    if (parsed === null) continue;
    const arrays = arraysIn(parsed);
    if (arrays.length === 0) continue;

    const tokenEntries = enumerationSize(arrays, ['value', '$value', 'cssVar', 'variable'], 20);
    if (tokenEntries > 0 && (tokenRegistry === null || tokenEntries > tokenRegistry.entries)) {
      tokenRegistry = { path: f.rel, entries: tokenEntries };
    }

    const componentEntries = enumerationSize(arrays, ['props', 'exports', 'api'], 3);
    if (
      componentEntries > 0 &&
      (componentRegistry === null || componentEntries > componentRegistry.entries)
    ) {
      componentRegistry = { path: f.rel, entries: componentEntries };
    }
  }

  return { tokenRegistry, componentRegistry };
}
