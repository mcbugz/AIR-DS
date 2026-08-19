/**
 * Lightweight CSS declaration iterator for foreign stylesheets.
 *
 * Deliberately regex-based and tolerant: assessed repos contain arbitrary
 * CSS/SCSS/LESS that a strict parser would choke on. Literal verdicts are NOT
 * re-invented here — they come from @ds/validate's shared allowed-literal
 * ruleset (scanCssValueLiterals), so the assessor and the gauntlet agree on
 * what counts as a hard-coded value.
 */

export interface CssDecl {
  prop: string;
  value: string;
}

/** Strip comments, url() payloads, and at-rule preludes (@media (min-width: 768px)
 * is not a themable value — CSS cannot var() a media query). */
function preprocess(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ') // scss line comments
    .replace(/url\(\s*[^)]*\)/gi, 'url(_)')
    .replace(/@(media|supports|container|import|use|forward|charset)[^{;]*/gi, '@$1 ');
}

const DECL_RE = /(?:^|[{;])\s*(--?[A-Za-z][\w-]*|[A-Za-z][\w-]*)\s*:\s*([^;{}]+)/g;

/** Iterate declarations in a stylesheet body. */
export function cssDecls(css: string): CssDecl[] {
  const out: CssDecl[] = [];
  const text = preprocess(css);
  DECL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DECL_RE.exec(text)) !== null) {
    const prop = (m[1] as string).toLowerCase();
    const value = (m[2] as string).trim();
    if (value.length === 0) continue;
    // Selector fragments like `a:hover` sneak in as prop=a value=hover; they
    // carry no literals or var refs, so they are harmless noise.
    out.push({ prop, value });
  }
  return out;
}

/** Count var(--x) references in a value/expression. */
export function countVarRefs(text: string): number {
  const m = text.match(/var\(\s*--/g);
  return m ? m.length : 0;
}

/** Count SCSS $variable references in a value (LESS @vars are too ambiguous). */
export function countScssVarRefs(text: string): number {
  const m = text.match(/(?<![\w$])\$[A-Za-z][\w-]*/g);
  return m ? m.length : 0;
}
