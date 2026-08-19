/** CSS custom-property adapter: scan stylesheets for `--*` declarations and
 *  synthesize token entries with provenance. Also collects hard-coded color
 *  literals in non-token declarations (the "sins" surfaced in RETROFIT.md). */

import { normalizeName, inferType, resolveVarRefs } from './normalize.js';
import type { CssDecl, HardcodedFinding, Provenance, RetroToken } from './types.js';

/** Selectors treated as the base (default-value) scope. */
const BASE_SCOPES = new Set([':root', 'html', 'body', ':host', '*']);

/** Replace comments with spaces (newlines kept) so line numbers survive. */
export function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

interface RawDecl {
  prop: string;
  value: string;
  selector: string;
  line: number;
}

/** Tiny CSS walker: tracks brace depth + current selector, yields declarations. */
function walkDeclarations(css: string): RawDecl[] {
  const text = stripCssComments(css);
  const decls: RawDecl[] = [];
  const selectorStack: string[] = [];
  let buf = '';
  let bufStartLine = 1;
  let line = 1;
  let bufStarted = false;

  const flushDecl = (): void => {
    const m = /^\s*([A-Za-z-][A-Za-z0-9_-]*)\s*:\s*([\s\S]+?)\s*(!important)?\s*$/.exec(buf);
    if (m && selectorStack.length > 0) {
      const prop = m[1] ?? '';
      const value = (m[2] ?? '').replace(/\s+/g, ' ').trim();
      const selector = selectorStack[selectorStack.length - 1] ?? '';
      if (prop !== '' && value !== '') {
        decls.push({ prop, value, selector, line: bufStartLine });
      }
    }
    buf = '';
    bufStarted = false;
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] as string;
    if (ch === '\n') line += 1;
    if (ch === '{') {
      selectorStack.push(buf.replace(/\s+/g, ' ').trim());
      buf = '';
      bufStarted = false;
    } else if (ch === '}') {
      if (bufStarted) flushDecl();
      selectorStack.pop();
      buf = '';
      bufStarted = false;
    } else if (ch === ';') {
      flushDecl();
    } else {
      if (!bufStarted && !/\s/.test(ch)) {
        bufStarted = true;
        bufStartLine = line;
      }
      buf += ch;
    }
  }
  return decls;
}

/** All custom-property declarations in a stylesheet. */
export function extractCustomProperties(css: string, source: string): CssDecl[] {
  return walkDeclarations(css)
    .filter((d) => d.prop.startsWith('--'))
    .map((d) => ({ ...d, source }));
}

/** Hard-coded hex/rgb color literals in NON-custom-property declarations. */
export function findHardcodedColors(css: string, source: string): HardcodedFinding[] {
  const findings: HardcodedFinding[] = [];
  for (const d of walkDeclarations(css)) {
    if (d.prop.startsWith('--')) continue;
    const literals = d.value.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g) ?? [];
    for (const literal of literals) {
      findings.push({ source, line: d.line, property: d.prop, literal });
    }
  }
  return findings;
}

export interface CssAdapterResult {
  tokens: RetroToken[];
  /** cssVar -> raw base-scope value (pre-resolution) — feeds alias analysis. */
  rawByVar: Map<string, string>;
  unresolvedVars: string[];
}

/**
 * Synthesize tokens from custom-property declarations across stylesheets.
 * Base-scope (`:root`/`html`/`body`) declarations define the token value;
 * scoped re-declarations (themes, media) are counted as `redeclarations`.
 * Within the same scope class, the LAST declaration wins (CSS cascade).
 */
export function cssTokens(declsBySource: CssDecl[]): CssAdapterResult {
  const chosen = new Map<string, CssDecl>();
  const redecls = new Map<string, number>();
  const isBase = (sel: string): boolean =>
    sel.split(',').some((s) => BASE_SCOPES.has(s.trim()));

  for (const d of declsBySource) {
    const existing = chosen.get(d.prop);
    if (existing === undefined) {
      chosen.set(d.prop, d);
      continue;
    }
    redecls.set(d.prop, (redecls.get(d.prop) ?? 0) + 1);
    const existingBase = isBase(existing.selector);
    const currentBase = isBase(d.selector);
    // Base scope beats scoped rules; within the same class the LAST wins.
    if (currentBase || !existingBase) chosen.set(d.prop, d);
  }

  const rawByVar = new Map<string, string>();
  for (const [prop, d] of chosen) rawByVar.set(prop, d.value);

  const unresolvedVars: string[] = [];
  const tokens: RetroToken[] = [];
  for (const [prop, d] of chosen) {
    const { value, resolved } = resolveVarRefs(d.value, rawByVar);
    if (!resolved) unresolvedVars.push(prop);
    const name = normalizeName(prop);
    const type = inferType(value, name);
    const provenance: Provenance = {
      adapter: 'css-custom-properties',
      source: d.source,
      line: d.line,
      declaredAs: prop,
      ...(resolved ? {} : { resolved: false }),
      ...((redecls.get(prop) ?? 0) > 0 ? { redeclarations: redecls.get(prop) as number } : {}),
    };
    tokens.push({
      name,
      cssVar: prop,
      tier: 'semantic',
      type,
      description: describeCssToken(prop, d, redecls.get(prop) ?? 0),
      value: coerceValue(value, type),
      provenance,
    });
  }
  tokens.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  unresolvedVars.sort();
  return { tokens, rawByVar, unresolvedVars };
}

function describeCssToken(prop: string, d: CssDecl, redeclarations: number): string {
  const extra = redeclarations > 0
    ? ` Re-declared in ${redeclarations} scoped rule(s) (theme/media overrides) — base-scope value shown.`
    : '';
  return `Retrofit-synthesized from ${d.source}:${d.line} (declared as \`${prop}\` in \`${d.selector}\`).${extra}`;
}

export function coerceValue(value: string, type: string): string | number {
  if ((type === 'number' || type === 'fontWeight') && /^-?\d*\.?\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return value;
}
