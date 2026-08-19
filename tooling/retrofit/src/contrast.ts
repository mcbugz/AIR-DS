/** Best-effort contrast report over synthesized tokens, in the exact
 *  registries/contrast-report.json shape. Pair inference is heuristic and
 *  documented; everything not paired lands in `unaudited` with a reason. */

import { aliasTarget } from './normalize.js';
import type {
  ContrastPairOut,
  ContrastReportOut,
  RetroToken,
  UnauditedEntryOut,
} from './types.js';

/* ---------------------------------------------------------- color parsing */

export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseColor(value: string): Rgb | null {
  const v = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,8})$/.exec(v);
  if (hex) {
    const h = hex[1] as string;
    if (h.length === 3 || h.length === 4) {
      const r = parseInt((h[0] as string) + (h[0] as string), 16);
      const g = parseInt((h[1] as string) + (h[1] as string), 16);
      const b = parseInt((h[2] as string) + (h[2] as string), 16);
      const a = h.length === 4 ? parseInt((h[3] as string) + (h[3] as string), 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (h.length === 6 || h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
    return null;
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/.exec(v);
  if (rgb) {
    const a = rgb[4] === undefined ? 1 : rgb[4].endsWith('%') ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
    return { r: parseFloat(rgb[1] as string), g: parseFloat(rgb[2] as string), b: parseFloat(rgb[3] as string), a };
  }
  const hsl = /^hsla?\(\s*([\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/.exec(v);
  if (hsl) {
    const a = hsl[4] === undefined ? 1 : hsl[4].endsWith('%') ? parseFloat(hsl[4]) / 100 : parseFloat(hsl[4]);
    return { ...hslToRgb(parseFloat(hsl[1] as string), parseFloat(hsl[2] as string) / 100, parseFloat(hsl[3] as string) / 100), a };
  }
  if (v === 'white') return { r: 255, g: 255, b: 255, a: 1 };
  if (v === 'black') return { r: 0, g: 0, b: 0, a: 1 };
  return null;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb: [number, number, number] = [0, 0, 0];
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = l - c / 2;
  return { r: (rgb[0] + m) * 255, g: (rgb[1] + m) * 255, b: (rgb[2] + m) * 255 };
}

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * channelLuminance(rgb.r) + 0.7152 * channelLuminance(rgb.g) + 0.0722 * channelLuminance(rgb.b);
}

/** WCAG 2.x contrast ratio, rounded to 2 decimals. */
export function contrastRatio(fg: Rgb, bg: Rgb): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return Math.round(ratio * 100) / 100;
}

/* ------------------------------------------------------------- inference */

const TEXT_NAME_RE = /(^|\.)(text|fg|foreground|ink|link|label|heading)(\.|$)/;
const SURFACE_NAME_RE = /(^|\.)(surface|bg|background|fill|canvas|panel)(\.|$)/;
/** Stem suffixes that mark a token as the background twin of its stem. */
const BG_SUFFIXES = ['.bg', '.background', '.surface'];

const THRESHOLD = 4.5;
const PAIR_CAP = 100;

export interface ContrastOptions {
  brand: string;
  /** cssVar -> raw (pre-resolution) value; powers alias detection. */
  rawByVar: ReadonlyMap<string, string>;
}

/**
 * Heuristic pair inference (documented in the report `$description`):
 *   1. STEM pairs — `x` on `x.bg` (danger text on danger background).
 *   2. GLOBAL pairs — every text-classified color on every surface-classified
 *      color (cross product, capped at 100 pairs).
 * Color tokens in no pair are listed under `unaudited` with a reason.
 */
export function buildContrastReport(tokens: RetroToken[], options: ContrastOptions): ContrastReportOut {
  const colorTokens = tokens.filter((t) => t.type === 'color');
  const byName = new Map(colorTokens.map((t) => [t.name, t]));

  const parsed = new Map<string, Rgb | null>();
  for (const t of colorTokens) parsed.set(t.name, typeof t.value === 'string' ? parseColor(t.value) : null);

  const texts = colorTokens.filter((t) => TEXT_NAME_RE.test(t.name) && !isBgTwin(t.name));
  const surfaces = colorTokens.filter((t) => SURFACE_NAME_RE.test(t.name) || isBgTwin(t.name));

  interface Candidate {
    fg: RetroToken;
    bg: RetroToken;
  }
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  const push = (fg: RetroToken, bg: RetroToken): void => {
    const id = `${fg.name}|${bg.name}`;
    if (fg.name === bg.name || seen.has(id)) return;
    seen.add(id);
    candidates.push({ fg, bg });
  };

  // 1. stem pairs
  for (const t of colorTokens) {
    for (const suffix of BG_SUFFIXES) {
      if (t.name.endsWith(suffix)) {
        const stem = byName.get(t.name.slice(0, -suffix.length));
        if (stem !== undefined) push(stem, t);
      }
    }
  }
  // 2. global text x surface pairs
  for (const fg of texts) {
    for (const bg of surfaces) push(fg, bg);
  }

  const capped = candidates.slice(0, PAIR_CAP);

  const pairs: ContrastPairOut[] = [];
  const unauditedReasons = new Map<string, string>();
  const inPair = new Set<string>();

  for (const { fg, bg } of capped) {
    const fgRgb = parsed.get(fg.name);
    const bgRgb = parsed.get(bg.name);
    if (!fgRgb || !bgRgb) {
      for (const t of [fg, bg]) {
        if (!parsed.get(t.name) && !unauditedReasons.has(t.name)) {
          unauditedReasons.set(t.name, `Paired by the retrofit heuristic but its value ("${String(t.value)}") is not a parseable sRGB color — audit manually.`);
        }
      }
      continue;
    }
    if (fgRgb.a < 1 || bgRgb.a < 1) {
      for (const t of [fg, bg]) {
        const rgb = parsed.get(t.name);
        if (rgb && rgb.a < 1 && !unauditedReasons.has(t.name)) {
          unauditedReasons.set(t.name, 'Translucent color (alpha < 1) — contrast depends on what it composites over; audit in context.');
        }
      }
      continue;
    }
    const ratio = contrastRatio(fgRgb, bgRgb);
    inPair.add(fg.name);
    inPair.add(bg.name);
    pairs.push({
      id: `${fg.name}|${bg.name}`,
      foreground: fg.name,
      background: bg.name,
      foregroundValue: String(fg.value),
      backgroundValue: String(bg.value),
      ratio,
      required: THRESHOLD,
      pass: ratio >= THRESHOLD,
      resolvesTo: { foreground: [], background: [] },
    });
  }
  pairs.sort((a, b) => a.id.localeCompare(b.id, 'en'));

  // ---- alias analysis: vars that are pure var() chains onto pair members ----
  const varToName = new Map<string, string>();
  for (const t of colorTokens) varToName.set(t.cssVar, t.name);
  const aliasIndex: Record<string, string[]> = {};
  for (const t of colorTokens) {
    const target = aliasTarget(t.cssVar, options.rawByVar);
    if (target === null || target === t.cssVar) continue;
    const targetName = varToName.get(target);
    if (targetName === undefined) continue;
    const pairIds: string[] = [];
    for (const pair of pairs) {
      if (pair.foreground === targetName) {
        pair.resolvesTo.foreground.push(t.cssVar);
        pairIds.push(pair.id);
      }
      if (pair.background === targetName) {
        pair.resolvesTo.background.push(t.cssVar);
        pairIds.push(pair.id);
      }
    }
    if (pairIds.length > 0) {
      aliasIndex[t.cssVar] = pairIds.sort();
      inPair.add(t.name);
    }
  }
  for (const pair of pairs) {
    pair.resolvesTo.foreground.sort();
    pair.resolvesTo.background.sort();
  }

  const unaudited: UnauditedEntryOut[] = [];
  for (const t of colorTokens) {
    if (inPair.has(t.name)) continue;
    const reason =
      unauditedReasons.get(t.name) ??
      (parsed.get(t.name)
        ? 'No text/surface pairing inferred by the retrofit heuristic (name matched neither a text nor a surface class and no stem twin exists) — confirm the intended pairings and audit manually.'
        : `Value ("${String(t.value)}") is not a parseable sRGB color — audit manually.`);
    unaudited.push({ name: t.name, cssVar: t.cssVar, reason });
  }
  unaudited.sort((a, b) => a.name.localeCompare(b.name, 'en'));

  const failures = pairs.filter((p) => !p.pass).length;
  return {
    $description:
      'GENERATED best-effort WCAG audit synthesized by @ds/retrofit from a scanned design system. ' +
      'Pair inference is heuristic: (1) stem pairs — a color token rendered on its `.bg`/`.background`/`.surface` twin; ' +
      '(2) global pairs — every text-classified color token (name matches text/fg/foreground/ink/link/label/heading) on every ' +
      'surface-classified color token (surface/bg/background/fill/canvas/panel), capped at 100 pairs. ' +
      '`resolvesTo` lists custom properties whose pure var() alias chains land on the pair member; `aliasIndex` maps each ' +
      'alias to the pair ids it inherits. Every color token in no pair appears under `unaudited` with a reason — treat that ' +
      'list as an audit backlog, not a pass.',
    standard: 'WCAG 2.2 AA (normal text)',
    threshold: THRESHOLD,
    brand: options.brand,
    failures,
    pairs,
    aliasIndex,
    unaudited,
  };
}

function isBgTwin(name: string): boolean {
  return BG_SUFFIXES.some((s) => name.endsWith(s));
}
