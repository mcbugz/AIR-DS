/** Tailwind config adapter — STATIC extraction (the config is never executed:
 *  deterministic, no code execution on customer input). Parses the literal
 *  `theme` object for colors / spacing / borderRadius (plus `theme.extend.*`)
 *  and synthesizes tokens with a PROPOSED `--tw-*` custom-property mapping.
 *  Non-literal values (functions, spreads, requires) are skipped and reported. */

import { inferType, normalizeName } from './normalize.js';
import type { Provenance, RetroToken, TailwindMapping } from './types.js';
import { coerceValue } from './css-adapter.js';

interface TwLeaf {
  value: string;
  offset: number;
}
type TwTree = Map<string, TwLeaf | TwTree>;

interface ParseState {
  text: string;
  i: number;
  skipped: string[];
}

function skipWs(s: ParseState): void {
  for (;;) {
    while (s.i < s.text.length && /\s/.test(s.text[s.i] as string)) s.i += 1;
    if (s.text.startsWith('//', s.i)) {
      while (s.i < s.text.length && s.text[s.i] !== '\n') s.i += 1;
    } else if (s.text.startsWith('/*', s.i)) {
      const end = s.text.indexOf('*/', s.i + 2);
      s.i = end === -1 ? s.text.length : end + 2;
    } else {
      return;
    }
  }
}

/** Skip a non-literal value up to the enclosing comma / closing brace. */
function skipValue(s: ParseState): void {
  let depth = 0;
  let quote: string | null = null;
  while (s.i < s.text.length) {
    const ch = s.text[s.i] as string;
    if (quote !== null) {
      if (ch === '\\') s.i += 1;
      else if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
    } else if (ch === '(' || ch === '[' || ch === '{') {
      depth += 1;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) return; // enclosing object's closing brace
      depth -= 1;
    } else if (ch === ',' && depth === 0) {
      return;
    }
    s.i += 1;
  }
}

/** Parse an object literal starting at `{`. Literal string/number leaves only. */
function parseObjectLiteral(s: ParseState, path: string[]): TwTree {
  const tree: TwTree = new Map();
  if (s.text[s.i] !== '{') return tree;
  s.i += 1;
  for (;;) {
    skipWs(s);
    while (s.text[s.i] === ',') {
      s.i += 1;
      skipWs(s);
    }
    if (s.i >= s.text.length || s.text[s.i] === '}') {
      s.i += 1;
      return tree;
    }
    // ---- key ----
    let key = '';
    const ch = s.text[s.i] as string;
    if (ch === "'" || ch === '"') {
      const end = s.text.indexOf(ch, s.i + 1);
      if (end === -1) return tree;
      key = s.text.slice(s.i + 1, end);
      s.i = end + 1;
    } else if (/[A-Za-z0-9_$.]/.test(ch)) {
      const m = /^[A-Za-z0-9_$.]+/.exec(s.text.slice(s.i));
      key = m?.[0] ?? '';
      s.i += key === '' ? 1 : key.length;
    } else {
      // computed key, spread, or anything non-literal — skip the entry
      s.skipped.push([...path, `<non-literal key at offset ${s.i}>`].join('.'));
      skipValue(s);
      continue;
    }
    skipWs(s);
    if (s.text[s.i] !== ':') {
      // spread / shorthand — not a literal entry
      s.skipped.push([...path, key === '' ? '?' : key].join('.'));
      skipValue(s);
      continue;
    }
    s.i += 1;
    skipWs(s);
    // ---- value ----
    const vch = s.text[s.i] as string;
    if (vch === '{') {
      tree.set(key, parseObjectLiteral(s, [...path, key]));
    } else if (vch === "'" || vch === '"') {
      const offset = s.i;
      const end = s.text.indexOf(vch, s.i + 1);
      if (end === -1) return tree;
      tree.set(key, { value: s.text.slice(s.i + 1, end), offset });
      s.i = end + 1;
    } else if (/[0-9.-]/.test(vch)) {
      const offset = s.i;
      const m = /^-?\d*\.?\d+/.exec(s.text.slice(s.i));
      const num = m ? (m[0] ?? '') : '';
      tree.set(key, { value: num, offset });
      s.i += num.length;
    } else {
      s.skipped.push([...path, key].join('.'));
      skipValue(s);
    }
  }
}

export interface TailwindAdapterResult {
  tokens: RetroToken[];
  mappings: TailwindMapping[];
  skipped: string[];
}

const SECTIONS: ReadonlyArray<{ key: string; segment: string }> = [
  { key: 'colors', segment: 'color' },
  { key: 'spacing', segment: 'spacing' },
  { key: 'borderRadius', segment: 'radius' },
];

function lineOf(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
}

/**
 * Extract tokens from a tailwind config's literal `theme` object.
 * `resolvedCssValues` (existing cssVar -> resolved value) powers the
 * mapping-table column "matches existing var".
 */
export function tailwindTokens(
  configText: string,
  source: string,
  resolvedCssValues: ReadonlyMap<string, string>,
): TailwindAdapterResult {
  const themeMatch = /\btheme\s*:\s*\{/.exec(configText);
  if (!themeMatch) return { tokens: [], mappings: [], skipped: [] };
  const s: ParseState = {
    text: configText,
    i: themeMatch.index + themeMatch[0].length - 1,
    skipped: [],
  };
  const theme = parseObjectLiteral(s, ['theme']);

  const leaves: Array<{ themePath: string[]; segment: string; leaf: TwLeaf }> = [];
  const collectSection = (sectionTree: TwTree | TwLeaf | undefined, segment: string, base: string[]): void => {
    if (sectionTree === undefined || !(sectionTree instanceof Map)) return;
    const walk = (tree: TwTree, path: string[]): void => {
      for (const [key, node] of tree) {
        if (node instanceof Map) walk(node, [...path, key]);
        else leaves.push({ themePath: [...base, ...path, key], segment, leaf: node });
      }
    };
    walk(sectionTree, []);
  };
  for (const { key, segment } of SECTIONS) {
    collectSection(theme.get(key), segment, ['theme', key]);
    const extend = theme.get('extend');
    if (extend instanceof Map) {
      collectSection(extend.get(key), segment, ['theme', 'extend', key]);
    }
  }

  // value -> existing cssVars with that resolved value (for the mapping table)
  const byValue = new Map<string, string[]>();
  for (const [cssVar, value] of resolvedCssValues) {
    const list = byValue.get(value.toLowerCase()) ?? [];
    list.push(cssVar);
    byValue.set(value.toLowerCase(), list);
  }

  const tokens: RetroToken[] = [];
  const mappings: TailwindMapping[] = [];
  const seenVars = new Set<string>();
  for (const { themePath, segment, leaf } of leaves) {
    // theme.extend.colors.brand.DEFAULT -> path parts after the section key
    const sectionIdx = themePath.findIndex((p) => SECTIONS.some((sec) => sec.key === p));
    const keyPath = themePath.slice(sectionIdx + 1).filter((p) => p !== 'DEFAULT');
    const varBody = ['tw', segment, ...keyPath]
      .join('-')
      .replace(/[^A-Za-z0-9-]+/g, '-')
      .toLowerCase();
    const cssVar = `--${varBody}`;
    if (seenVars.has(cssVar)) continue;
    seenVars.add(cssVar);
    const name = normalizeName(cssVar);
    const type = inferType(leaf.value, name);
    const matches = byValue.get(leaf.value.toLowerCase()) ?? [];
    const provenance: Provenance = {
      adapter: 'tailwind',
      source,
      line: lineOf(configText, leaf.offset),
      declaredAs: themePath.join('.'),
      proposed: true,
    };
    tokens.push({
      name,
      cssVar,
      tier: 'semantic',
      type,
      description:
        `Retrofit-synthesized from ${source}:${provenance.line} (${themePath.join('.')}). ` +
        `PROPOSED custom property — adopt \`${cssVar}\` in shipped CSS to activate it.`,
      value: coerceValue(leaf.value, type),
      provenance,
    });
    mappings.push({
      themePath: themePath.join('.'),
      proposedVar: cssVar,
      value: leaf.value,
      matchesExistingVar: matches.length > 0 ? (matches.slice().sort()[0] as string) : null,
    });
  }
  tokens.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  mappings.sort((a, b) => a.themePath.localeCompare(b.themePath, 'en'));
  return { tokens, mappings, skipped: s.skipped.sort() };
}
