/** DTCG / Style Dictionary source adapter — direct conversion. Walks a token
 *  JSON tree ($value / $type, or legacy style-dictionary `value`), resolves
 *  `{path.to.token}` aliases within the set, and synthesizes entries with a
 *  proposed custom-property mapping. */

import { inferType, normalizeName } from './normalize.js';
import { coerceValue } from './css-adapter.js';
import type { Provenance, RetroToken } from './types.js';

interface DtcgLeaf {
  path: string[];
  value: string;
  type: string | null;
}

/** True when the parsed JSON looks like a DTCG / style-dictionary token tree. */
export function looksLikeTokenTree(parsed: unknown): boolean {
  let found = false;
  const walk = (node: unknown, depth: number): void => {
    if (found || depth > 12 || node === null || typeof node !== 'object' || Array.isArray(node)) return;
    const obj = node as Record<string, unknown>;
    if ('$value' in obj || (typeof obj['value'] === 'string' && !('$description' in obj))) {
      found = true;
      return;
    }
    for (const v of Object.values(obj)) walk(v, depth + 1);
  };
  walk(parsed, 0);
  return found;
}

function collectLeaves(parsed: unknown): DtcgLeaf[] {
  const leaves: DtcgLeaf[] = [];
  const walk = (node: unknown, path: string[], inheritedType: string | null): void => {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) return;
    const obj = node as Record<string, unknown>;
    const typeHere = typeof obj['$type'] === 'string' ? (obj['$type'] as string) : inheritedType;
    const rawValue = obj['$value'] ?? obj['value'];
    if (typeof rawValue === 'string' || typeof rawValue === 'number') {
      leaves.push({ path, value: String(rawValue), type: typeHere });
      return;
    }
    for (const [key, child] of Object.entries(obj)) {
      if (key.startsWith('$')) continue;
      walk(child, [...path, key], typeHere);
    }
  };
  walk(parsed, [], null);
  return leaves;
}

/** Resolve `{a.b.c}` alias references within the collected set. */
function resolveAliases(leaves: DtcgLeaf[]): { byPath: Map<string, string>; unresolved: Set<string> } {
  const byPath = new Map<string, string>();
  for (const leaf of leaves) byPath.set(leaf.path.join('.'), leaf.value);
  const unresolved = new Set<string>();
  const resolve = (value: string, depth: number): { v: string; ok: boolean } => {
    if (depth > 16) return { v: value, ok: false };
    const m = /\{([^{}]+)\}/.exec(value);
    if (!m) return { v: value, ok: true };
    const target = byPath.get((m[1] ?? '').trim());
    if (target === undefined) return { v: value, ok: false };
    return resolve(value.replace(m[0], target), depth + 1);
  };
  const resolved = new Map<string, string>();
  for (const [path, value] of byPath) {
    const r = resolve(value, 0);
    resolved.set(path, r.v);
    if (!r.ok) unresolved.add(path);
  }
  return { byPath: resolved, unresolved };
}

/** Best-effort line of the leaf's last path segment in the source text. */
function lineOfPath(text: string, path: string[]): number {
  let from = 0;
  for (const segment of path) {
    const idx = text.indexOf(`"${segment}"`, from);
    if (idx === -1) return 1;
    from = idx + segment.length;
  }
  let line = 1;
  for (let i = 0; i < from && i < text.length; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
}

export interface DtcgAdapterResult {
  tokens: RetroToken[];
  unresolvedAliases: string[];
}

export function dtcgTokens(jsonText: string, source: string): DtcgAdapterResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { tokens: [], unresolvedAliases: [] };
  }
  const leaves = collectLeaves(parsed);
  const { byPath, unresolved } = resolveAliases(leaves);

  const tokens: RetroToken[] = [];
  for (const leaf of leaves) {
    const pathStr = leaf.path.join('.');
    const value = byPath.get(pathStr) ?? leaf.value;
    const cssVar = `--${leaf.path
      .map((p) => normalizeName(p).replace(/\./g, '-'))
      .join('-')
      .toLowerCase()}`;
    const name = normalizeName(cssVar);
    const type = leaf.type ?? inferType(value, name);
    const line = lineOfPath(jsonText, leaf.path);
    const provenance: Provenance = {
      adapter: 'dtcg',
      source,
      line,
      declaredAs: pathStr,
      proposed: true,
      ...(unresolved.has(pathStr) ? { resolved: false } : {}),
    };
    tokens.push({
      name,
      cssVar,
      tier: 'semantic',
      type,
      description:
        `Retrofit-converted from DTCG source ${source}:${line} (\`${pathStr}\`). ` +
        `PROPOSED custom property \`${cssVar}\` — emit via your token build to activate it.`,
      value: coerceValue(value, type),
      provenance,
    });
  }
  tokens.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  return { tokens, unresolvedAliases: [...unresolved].sort() };
}
