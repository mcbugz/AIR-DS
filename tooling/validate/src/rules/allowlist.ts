/**
 * THE shared allowed-literal ruleset (single source of truth).
 *
 * Both approvers — the gauntlet's CSS/code rules (@ds/validate) and the MCP
 * server's validate_usage (@ds/mcp) — decide "is this literal legal?" through
 * THIS module, so their verdicts cannot drift apart. @ds/mcp ships standalone
 * (no runtime dependency on this package), so it consumes a build-time
 * generated verbatim copy at packages/mcp/src/generated/allowlist.ts; a
 * parity test (byte-compare + shared verdict corpus in
 * tooling/validate/config/allowlist-corpus.json) fails on any divergence.
 *
 * DO NOT add imports to this file — it must compile verbatim under both
 * packages' module settings.
 *
 * Canonical literal semantics (CLAUDE.md rule 2 + documented relaxations):
 *  - allowed: 0 (any unit), percentages (proportions, not brand values),
 *    angles (deg/turn/rad/grad) and grid fractions (fr), unitless numbers
 *    (flex: 1, opacity: 0.5) EXCEPT in font-weight / line-height / z-index,
 *    `auto`, `none`, `currentColor`, `transparent`, and layout keywords.
 *  - flagged: hex colors, color functions (rgb/hsl/oklch/…; color-mix over
 *    tokens stays legal), CSS named colors in color-capable properties
 *    (NR-003), any non-zero dimension/duration literal with a unit, and bare
 *    numbers in font-weight / line-height / z-index.
 */

/* ------------------------------------------------------------ named colors */

/**
 * The standard CSS named colors (extended color keywords incl.
 * rebeccapurple), EXCLUDING the legitimately allowed `transparent` and
 * `currentcolor`. Using any of these in a color-capable property violates
 * the token rule (NR-003): every color is a var(--ds-color-*) token.
 */
export const NAMED_CSS_COLORS: ReadonlySet<string> = new Set([
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige',
  'bisque', 'black', 'blanchedalmond', 'blue', 'blueviolet', 'brown',
  'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'coral',
  'cornflowerblue', 'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan',
  'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki',
  'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred',
  'darksalmon', 'darkseagreen', 'darkslateblue', 'darkslategray',
  'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue',
  'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite',
  'forestgreen', 'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod',
  'gray', 'green', 'greenyellow', 'grey', 'honeydew', 'hotpink', 'indianred',
  'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush', 'lawngreen',
  'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan',
  'lightgoldenrodyellow', 'lightgray', 'lightgreen', 'lightgrey', 'lightpink',
  'lightsalmon', 'lightseagreen', 'lightskyblue', 'lightslategray',
  'lightslategrey', 'lightsteelblue', 'lightyellow', 'lime', 'limegreen',
  'linen', 'magenta', 'maroon', 'mediumaquamarine', 'mediumblue',
  'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue',
  'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue',
  'mintcream', 'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace',
  'olive', 'olivedrab', 'orange', 'orangered', 'orchid', 'palegoldenrod',
  'palegreen', 'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff',
  'peru', 'pink', 'plum', 'powderblue', 'purple', 'rebeccapurple', 'red',
  'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen',
  'seashell', 'sienna', 'silver', 'skyblue', 'slateblue', 'slategray',
  'slategrey', 'snow', 'springgreen', 'steelblue', 'tan', 'teal', 'thistle',
  'tomato', 'turquoise', 'violet', 'wheat', 'white', 'whitesmoke', 'yellow',
  'yellowgreen',
]);

/* -------------------------------------------------------- property shapes */

/** CSS properties whose values can carry a color (longhand + shorthand). */
export const COLOR_CAPABLE_CSS_PROP =
  /^(color|fill|stroke|caret-color|accent-color|box-shadow|text-shadow|(background|border|outline|text-decoration|column-rule)(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-color)?)$/;

/** Properties where bare numbers are token values, not free literals. */
export const UNITLESS_TOKEN_PROPS: ReadonlySet<string> = new Set([
  'font-weight',
  'line-height',
  'z-index',
]);

/**
 * JSX style-object keys (camelCase) that carry COLOR values (B1 scan).
 * `border`/`borderTop`/… shorthands are included: their values can embed
 * colors ('1px solid red').
 */
export const JSX_COLOR_STYLE_PROP =
  /^(color|fill|stroke|caretColor|accentColor|background[A-Za-z]*|border([A-Za-z]*Color)?|borderTop|borderRight|borderBottom|borderLeft|borderBlock|borderInline|outline(Color)?|textDecorationColor|columnRuleColor|boxShadow|textShadow)$/;

/**
 * JSX style-object keys (camelCase) that carry DIMENSION values (B1 scan).
 */
export const JSX_DIMENSION_STYLE_PROP =
  /^((padding|margin)([A-Z][A-Za-z]*)?|width|height|(min|max)(Width|Height|InlineSize|BlockSize)|inlineSize|blockSize|flexBasis|top|right|bottom|left|inset([A-Z][A-Za-z]*)?|gap|rowGap|columnGap|fontSize|borderRadius|border(Top|Bottom)(Left|Right)Radius|border(Start|End)(Start|End)Radius)$/;

/* --------------------------------------------------------------- scanning */

export type LiteralViolationKind =
  | 'hex-color'
  | 'color-function'
  | 'named-color'
  | 'unit-literal'
  | 'unitless-token-prop';

export interface LiteralViolation {
  kind: LiteralViolationKind;
  /** The offending literal text, e.g. "#fff", "red", "13px", "400". */
  literal: string;
  /** True when the literal is a color-rule violation (maps to NR-003). */
  isColor: boolean;
}

/** Non-zero number followed by a flagged (non-%, non-angle) unit. */
const FLAGGED_UNIT_RE =
  /(-?\d*\.?\d+)(px|rem|em|pt|pc|cm|mm|in|q|ch|ex|cap|ic|lh|rlh|vw|vh|vmin|vmax|ms|s)\b/gi;

/** Color-constructing functions. Deliberately NOT matching color-mix( — mixing tokens is legal. */
const COLOR_FN_RE = /(^|[^\w-])(rgba?|hsla?|hwb|oklch|oklab|lab|lch|light-dark|color)\(/i;

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;

/** Mask var(...) expressions (balanced parens) so literal scanning skips token refs. */
export function maskVarCalls(value: string): string {
  let out = '';
  let i = 0;
  while (i < value.length) {
    if (value.startsWith('var(', i)) {
      let depth = 0;
      let j = i + 3;
      do {
        const c = value[j];
        if (c === '(') depth++;
        else if (c === ')') depth--;
        j++;
      } while (j < value.length && depth > 0);
      out += '§';
      i = j;
    } else {
      out += value[i];
      i++;
    }
  }
  return out;
}

export function camelToKebab(prop: string): string {
  return prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/**
 * Scan one CSS declaration value for literal-discipline violations.
 * `prop` is the kebab-case CSS property name; var(...) calls are masked out
 * before scanning. Blocklist-based: anything not flagged is allowed, which is
 * how keywords (auto/none/flex/solid/…), percentages, angles, `transparent`,
 * `currentColor`, zero in any unit, and non-token unitless numbers pass.
 */
export function scanCssValueLiterals(prop: string, value: string): LiteralViolation[] {
  const violations: LiteralViolation[] = [];
  const masked = maskVarCalls(value);

  const hex = HEX_RE.exec(masked);
  if (hex) violations.push({ kind: 'hex-color', literal: hex[0], isColor: true });

  const fn = COLOR_FN_RE.exec(masked);
  if (fn) violations.push({ kind: 'color-function', literal: `${fn[2]}(`, isColor: true });

  FLAGGED_UNIT_RE.lastIndex = 0;
  let um: RegExpExecArray | null;
  while ((um = FLAGGED_UNIT_RE.exec(masked)) !== null) {
    if (parseFloat(um[1] as string) !== 0) {
      violations.push({ kind: 'unit-literal', literal: um[0], isColor: false });
    }
  }

  if (UNITLESS_TOKEN_PROPS.has(prop)) {
    const bare = /(^|[\s(])(-?\d*\.?\d+)(?![\w.%])/.exec(masked);
    if (bare && parseFloat(bare[2] as string) !== 0) {
      violations.push({ kind: 'unitless-token-prop', literal: bare[2] as string, isColor: false });
    }
  }

  if (COLOR_CAPABLE_CSS_PROP.test(prop)) {
    for (const word of masked.split(/[\s,/()]+/).filter(Boolean)) {
      if (NAMED_CSS_COLORS.has(word.toLowerCase())) {
        violations.push({ kind: 'named-color', literal: word, isColor: true });
      }
    }
  }

  return violations;
}

/* ------------------------------------------- JSX inline-style scan (B1) -- */

export interface JsxStyleEntry {
  /** Style-object key as written (camelCase or quoted css name). */
  prop: string;
  /** Raw value expression text. */
  valueText: string;
  /** Character offset of the entry inside the scanned source. */
  index: number;
}

export interface JsxStyleObject {
  /** Character offset of `style={{` in the scanned source. */
  index: number;
  entries: JsxStyleEntry[];
}

/**
 * Lexically extract `style={{ ... }}` JSX attribute objects. Balanced-brace
 * scan that respects strings, template literals (incl. ${} nesting), and
 * comments — no AST dependency. Render-prop styles (`style={(s) => …}`) are
 * not object literals and are intentionally not matched.
 */
export function extractJsxStyleObjects(source: string): JsxStyleObject[] {
  const out: JsxStyleObject[] = [];
  const open = /style\s*=\s*\{\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = open.exec(source)) !== null) {
    const bodyStart = m.index + m[0].length;
    const body = readBalanced(source, bodyStart);
    if (body === null) continue;
    out.push({ index: m.index, entries: splitStyleEntries(body.text, bodyStart) });
    open.lastIndex = body.end;
  }
  return out;
}

/** Read until the brace opened just before `start` closes; returns inner text. */
function readBalanced(source: string, start: number): { text: string; end: number } | null {
  let depth = 1;
  let i = start;
  while (i < source.length) {
    const c = source[i] as string;
    if (c === "'" || c === '"' || c === '`') {
      i = skipString(source, i);
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return { text: source.slice(start, i), end: i + 1 };
    }
    i++;
  }
  return null;
}

/** Skip a quoted string / template literal starting at `i`; returns index after it. */
function skipString(source: string, i: number): number {
  const quote = source[i] as string;
  let j = i + 1;
  while (j < source.length) {
    const c = source[j] as string;
    if (c === '\\') {
      j += 2;
      continue;
    }
    if (quote === '`' && c === '$' && source[j + 1] === '{') {
      let depth = 1;
      j += 2;
      while (j < source.length && depth > 0) {
        const t = source[j] as string;
        if (t === "'" || t === '"' || t === '`') {
          j = skipString(source, j);
          continue;
        }
        if (t === '{') depth++;
        else if (t === '}') depth--;
        j++;
      }
      continue;
    }
    if (c === quote) return j + 1;
    j++;
  }
  return j;
}

/** Split a style-object body into top-level `key: value` entries. */
function splitStyleEntries(body: string, baseIndex: number): JsxStyleEntry[] {
  const entries: JsxStyleEntry[] = [];
  let depth = 0;
  let entryStart = 0;
  const flush = (endExclusive: number): void => {
    const raw = body.slice(entryStart, endExclusive);
    if (!raw.trim()) return;
    const colon = topLevelColon(raw);
    if (colon === -1) return; // spread / shorthand — nothing checkable
    const key = raw.slice(0, colon).trim();
    const prop = /^(['"])(.*)\1$/.exec(key)?.[2] ?? key;
    if (!/^[A-Za-z-][\w-]*$/.test(prop)) return; // computed keys — skip
    entries.push({ prop, valueText: raw.slice(colon + 1).trim(), index: baseIndex + entryStart });
  };
  let i = 0;
  while (i < body.length) {
    const c = body[i] as string;
    if (c === "'" || c === '"' || c === '`') {
      i = skipString(body, i);
      continue;
    }
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') depth--;
    else if (c === ',' && depth === 0) {
      flush(i);
      entryStart = i + 1;
    }
    i++;
  }
  flush(body.length);
  return entries;
}

/** Index of the first top-level `:` in an entry (skips quoted keys); -1 if none. */
function topLevelColon(entry: string): number {
  let depth = 0;
  let i = 0;
  while (i < entry.length) {
    const c = entry[i] as string;
    if (c === "'" || c === '"' || c === '`') {
      i = skipString(entry, i);
      continue;
    }
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') depth--;
    else if (c === '?') return -1; // ternary before any colon — not a plain entry
    else if (c === ':' && depth === 0) return i;
    i++;
  }
  return -1;
}

/**
 * Scan one JSX style-object value expression (B1). Literal string/number
 * values for COLOR and DIMENSION properties are violations unless they are
 * var(--ds-*), 0, '100%' (any pure percentage), 'auto', 'none',
 * 'currentColor', or a pure runtime expression.
 *
 * THE sanctioned pattern for runtime-computed geometry is template
 * interpolation with no literal parts: `inlineSize: `${percentage}%`` —
 * after stripping ${…} holes the residue ('%') carries no literal, so it
 * passes; `${x}px`-style computed lengths pass the same way, while
 * '13px' / `13px ${x}` / '#ff0000' / 'red' are flagged.
 */
export function scanJsxStyleValue(jsxProp: string, valueText: string): LiteralViolation[] {
  const isColor = JSX_COLOR_STYLE_PROP.test(jsxProp);
  const isDimension = JSX_DIMENSION_STYLE_PROP.test(jsxProp);
  if (!isColor && !isDimension) return [];
  const cssProp = camelToKebab(jsxProp);
  const v = valueText.trim();

  // Bare number literal: React serializes it as px (0 stays legal).
  if (/^-?(\d*\.)?\d+$/.test(v)) {
    if (isDimension && parseFloat(v) !== 0) {
      return [{ kind: 'unit-literal', literal: `${v} (implicit px)`, isColor: false }];
    }
    return [];
  }

  // String literal: scan its contents like a CSS declaration value.
  const str = /^(['"])([\s\S]*)\1$/.exec(v);
  if (str) return scanCssValueLiterals(cssProp, str[2] as string);

  // Template literal: strip ${…} holes, scan only the static residue.
  if (v.startsWith('`') && v.endsWith('`')) {
    return scanCssValueLiterals(cssProp, stripTemplateHoles(v.slice(1, -1)));
  }

  // Arbitrary expression: pure runtime expressions pass; embedded string /
  // template / hex literals inside (e.g. ternary arms) are still scanned.
  const violations: LiteralViolation[] = [];
  let i = 0;
  while (i < v.length) {
    const c = v[i] as string;
    if (c === "'" || c === '"' || c === '`') {
      const end = skipString(v, i);
      const lit = v.slice(i, end);
      if (c === '`') {
        violations.push(...scanCssValueLiterals(cssProp, stripTemplateHoles(lit.slice(1, -1))));
      } else {
        violations.push(...scanCssValueLiterals(cssProp, lit.slice(1, -1)));
      }
      i = end;
      continue;
    }
    i++;
  }
  return violations;
}

function stripTemplateHoles(template: string): string {
  let out = '';
  let i = 0;
  while (i < template.length) {
    if (template[i] === '$' && template[i + 1] === '{') {
      let depth = 1;
      i += 2;
      while (i < template.length && depth > 0) {
        const c = template[i] as string;
        if (c === "'" || c === '"' || c === '`') {
          i = skipString(template, i);
          continue;
        }
        if (c === '{') depth++;
        else if (c === '}') depth--;
        i++;
      }
      out += ' ';
    } else {
      out += template[i];
      i++;
    }
  }
  return out;
}
