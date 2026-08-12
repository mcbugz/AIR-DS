/**
 * Minimal CSS parser for *.module.css scanning. Handles nested at-rules
 * (@media, @supports, @keyframes, @starting-style), comments, and multi-line
 * declaration values. Not a general-purpose CSS parser — just enough for the
 * deterministic gauntlet rules, with line numbers for reporting. Assumes no
 * nested style rules (CSS Modules corpus is flat).
 */

export interface CssDecl {
  prop: string;
  value: string;
  line: number;
}

export interface CssRule {
  selector: string;
  decls: CssDecl[];
  line: number;
  /** True when the rule lives inside @keyframes (selectors are offsets, not classes). */
  inKeyframes: boolean;
}

export interface CssSheet {
  rules: CssRule[];
}

/** Replace comments with spaces, preserving newlines so line numbers survive. */
export function stripCssComments(css: string): string {
  let out = '';
  let i = 0;
  while (i < css.length) {
    if (css[i] === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? css.length : end + 2;
      for (let j = i; j < stop; j++) out += css[j] === '\n' ? '\n' : ' ';
      i = stop;
    } else {
      out += css[i];
      i++;
    }
  }
  return out;
}

interface Ctx {
  /** 'wrapper' = @media/@supports/@keyframes/...; 'rule' = style rule collecting decls. */
  kind: 'wrapper' | 'rule';
  isKeyframes: boolean;
}

export function parseCss(cssRaw: string): CssSheet {
  const css = stripCssComments(cssRaw);
  const rules: CssRule[] = [];
  const stack: Ctx[] = [];
  let current: CssRule | null = null;
  let line = 1;
  let buf = '';
  let bufStartLine = 1;

  const flushDecl = (raw: string, declLine: number): void => {
    if (!current) return;
    const text = raw.trim();
    if (!text) return;
    const colon = text.indexOf(':');
    if (colon === -1) return;
    const prop = text.slice(0, colon).trim();
    const value = text.slice(colon + 1).trim();
    if (prop) current.decls.push({ prop, value, line: declLine });
  };

  for (let i = 0; i < css.length; i++) {
    const ch = css[i] as string;
    if (ch === '\n') line++;

    if (ch === '{') {
      const header = buf.trim();
      buf = '';
      const isKeyframes = /^@(-\w+-)?keyframes\b/.test(header);
      const isWrapper =
        isKeyframes || /^@(media|supports|container|layer|starting-style|scope)\b/.test(header);
      if (isWrapper) {
        stack.push({ kind: 'wrapper', isKeyframes });
        current = null;
      } else {
        current = {
          selector: header,
          decls: [],
          line: bufStartLine,
          inKeyframes: stack.some((s) => s.isKeyframes),
        };
        rules.push(current);
        stack.push({ kind: 'rule', isKeyframes: false });
      }
      bufStartLine = line;
    } else if (ch === '}') {
      flushDecl(buf, bufStartLine);
      buf = '';
      stack.pop();
      current = null; // no nested style rules in this corpus
      bufStartLine = line;
    } else if (ch === ';' && current) {
      flushDecl(buf, bufStartLine);
      buf = '';
      bufStartLine = line;
    } else {
      if (buf.trim() === '' && ch.trim() !== '') bufStartLine = line;
      buf += ch;
    }
  }

  return { rules };
}
