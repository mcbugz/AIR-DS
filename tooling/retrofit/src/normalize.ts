/** Name normalization, token type inference, and var() resolution.
 *  Pure functions — deterministic, no I/O. */

/** `--Btn_primaryBg2` -> `btn.primary.bg.2` (camel, snake, kebab, digit boundaries). */
export function normalizeName(cssVarOrBody: string): string {
  const body = cssVarOrBody.replace(/^--/, '');
  const spaced = body
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/[-_]+/g, ' ');
  const segments = spaced
    .split(/\s+/)
    .map((s) => s.toLowerCase())
    .filter((s) => s.length > 0);
  return segments.join('.');
}

const NAMED_COLORS = new Set([
  'white', 'black', 'red', 'green', 'blue', 'transparent', 'currentcolor',
  'gray', 'grey', 'silver', 'maroon', 'olive', 'lime', 'aqua', 'teal',
  'navy', 'fuchsia', 'purple', 'yellow', 'orange', 'rebeccapurple',
]);

export function isColorValue(value: string): boolean {
  const v = value.trim().toLowerCase();
  return (
    /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(v) ||
    /^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(/.test(v) ||
    NAMED_COLORS.has(v)
  );
}

const DIMENSION_RE = /^-?\d*\.?\d+(px|rem|em|%|vw|vh|vmin|vmax|ch|ex|pt|pc|cm|mm|in)$/;

/** Best-effort DTCG-ish type for a CSS value, using the normalized name as a hint. */
export function inferType(value: string | number, name: string): string {
  if (typeof value === 'number') {
    return isFontWeightHint(name) ? 'fontWeight' : 'number';
  }
  const v = value.trim();
  const lower = v.toLowerCase();
  if (isColorValue(v)) return 'color';
  if (/^cubic-bezier\(/.test(lower)) return 'cubicBezier';
  if (/^-?\d*\.?\d+(ms|s)$/.test(lower)) return 'duration';
  if (isShadowValue(lower)) return 'shadow';
  if (DIMENSION_RE.test(lower)) return 'dimension';
  if (/^\d{3}$/.test(lower) && isFontWeightHint(name)) return 'fontWeight';
  if (/^(bold|bolder|lighter)$/.test(lower)) return 'fontWeight';
  if (/^-?\d*\.?\d+$/.test(lower)) {
    return isFontWeightHint(name) ? 'fontWeight' : 'number';
  }
  if (isFontFamilyValue(v, name)) return 'fontFamily';
  return 'string';
}

function isFontWeightHint(name: string): boolean {
  return /(^|\.)(fw|weight|font\.weight)(\.|$)|weight/.test(name);
}

function isFontFamilyValue(value: string, name: string): boolean {
  const familyHint = /(^|\.)(font|family|typeface)(\.|$)/.test(name) && !/size|weight|height/.test(name);
  const looksLikeStack = /^[^;{}]+,\s*[a-zA-Z-]+/.test(value) && /[a-zA-Z]/.test(value) && !/\d(px|rem|em|%)/.test(value);
  const quotedFamily = /^["'][^"']+["']/.test(value);
  return (familyHint && (looksLikeStack || quotedFamily || /^[a-zA-Z ,"'-]+$/.test(value))) || (looksLikeStack && quotedFamily);
}

/** Multiple lengths + (usually) a color: `0 1px 3px rgba(...)`, `inset 0 0 0 1px #fff`. */
function isShadowValue(v: string): boolean {
  const lengths = v.match(/-?\d*\.?\d+(px|rem|em)?(\s|$)/g) ?? [];
  const hasColor = /#[0-9a-f]{3,8}|rgba?\(|hsla?\(/.test(v);
  return (v.startsWith('inset ') || lengths.length >= 3) && (hasColor || lengths.length >= 3) && /\s/.test(v.trim());
}

const VAR_RE = /var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/;

/**
 * Resolve `var(--x)` / `var(--x, fallback)` references against a declaration
 * map. Returns the resolved value plus whether every reference resolved.
 */
export function resolveVarRefs(
  raw: string,
  byVar: ReadonlyMap<string, string>,
  depthLimit = 16,
): { value: string; resolved: boolean } {
  let value = raw;
  let resolved = true;
  for (let depth = 0; depth < depthLimit; depth += 1) {
    const m = VAR_RE.exec(value);
    if (!m) return { value: value.trim(), resolved };
    const [whole, varName, fallback] = m;
    const target = varName !== undefined ? byVar.get(varName) : undefined;
    if (target !== undefined) {
      value = value.replace(whole, target);
    } else if (fallback !== undefined) {
      value = value.replace(whole, fallback.trim());
    } else {
      resolved = false;
      return { value: value.trim(), resolved };
    }
  }
  // Depth limit hit (cycle or pathological nesting).
  return { value: value.trim(), resolved: false };
}

/** Terminal var target of a pure-alias declaration chain (`--a: var(--b)` -> `--b`'s end), else null. */
export function aliasTarget(
  cssVar: string,
  byVar: ReadonlyMap<string, string>,
  depthLimit = 16,
): string | null {
  let current = cssVar;
  let hops = 0;
  for (let depth = 0; depth < depthLimit; depth += 1) {
    const raw = byVar.get(current);
    if (raw === undefined) return hops > 0 ? current : null;
    const m = /^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/.exec(raw.trim());
    if (!m || m[1] === undefined) return hops > 0 ? current : null;
    current = m[1];
    hops += 1;
  }
  return null;
}
