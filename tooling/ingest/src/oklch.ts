/**
 * Zero-dependency sRGB <-> OKLCH conversion (Björn Ottosson's OKLab math) plus the
 * exact WCAG 2.2 contrast math used by the @ds/tokens build gate
 * (packages/tokens/src/build/build.ts). The contrast functions here MUST stay
 * numerically identical to the gate: the ingest pre-check promises that a brand
 * file it emits will pass the gate, so both sides must agree bit-for-bit.
 */

export interface Oklch {
  /** Perceptual lightness, 0..1. */
  l: number;
  /** Chroma, >= 0 (sRGB gamut tops out around 0.37 depending on hue). */
  c: number;
  /** Hue angle in degrees, 0..360. 0 when the color is achromatic. */
  h: number;
}

const HEX6_RE = /^#([0-9a-f]{6})$/i;
const HEX3_RE = /^#([0-9a-f]{3})$/i;

/** Normalize #rgb / #RRGGBB to lowercase 6-digit #rrggbb. Returns null when not a hex color. */
export function normalizeHex(input: string): string | null {
  const six = HEX6_RE.exec(input.trim());
  if (six) return `#${(six[1] as string).toLowerCase()}`;
  const three = HEX3_RE.exec(input.trim());
  if (three) {
    const s = (three[1] as string).toLowerCase();
    const [r, g, b] = [s[0] as string, s[1] as string, s[2] as string];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex);
  if (!normalized) throw new Error(`Not a hex color: "${hex}"`);
  const n = parseInt(normalized.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clampByte = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
  const n = (clampByte(r) << 16) | (clampByte(g) << 8) | clampByte(b);
  return `#${n.toString(16).padStart(6, "0")}`;
}

/* ---------------- sRGB transfer ---------------- */

function srgbToLinear(channel255: number): number {
  const c = channel255 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(linear: number): number {
  const c = linear <= 0.0031308 ? linear * 12.92 : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
  return c * 255;
}

/* ---------------- OKLab (Ottosson reference matrices) ---------------- */

function linearSrgbToOklab(r: number, g: number, b: number): { L: number; a: number; b: number } {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l3 = Math.cbrt(l);
  const m3 = Math.cbrt(m);
  const s3 = Math.cbrt(s);
  return {
    L: 0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3,
    a: 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3,
    b: 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3,
  };
}

function oklabToLinearSrgb(L: number, a: number, b: number): { r: number; g: number; b: number } {
  const l3 = L + 0.3963377774 * a + 0.2158037573 * b;
  const m3 = L - 0.1055613458 * a - 0.0638541728 * b;
  const s3 = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l3 * l3 * l3;
  const m = m3 * m3 * m3;
  const s = s3 * s3 * s3;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  };
}

export function hexToOklch(hex: string): Oklch {
  const { r, g, b } = hexToRgb(hex);
  const lab = linearSrgbToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
  const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let h = 0;
  if (c > 1e-6) {
    h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
    if (h < 0) h += 360;
  }
  return { l: lab.L, c, h };
}

const GAMUT_EPSILON = 1e-6;

function oklchToLinear(l: number, c: number, hDeg: number): { r: number; g: number; b: number } {
  const hRad = (hDeg * Math.PI) / 180;
  return oklabToLinearSrgb(l, c * Math.cos(hRad), c * Math.sin(hRad));
}

function inGamut(rgb: { r: number; g: number; b: number }): boolean {
  return (
    rgb.r >= -GAMUT_EPSILON &&
    rgb.r <= 1 + GAMUT_EPSILON &&
    rgb.g >= -GAMUT_EPSILON &&
    rgb.g <= 1 + GAMUT_EPSILON &&
    rgb.b >= -GAMUT_EPSILON &&
    rgb.b <= 1 + GAMUT_EPSILON
  );
}

/**
 * OKLCH -> lowercase 6-digit hex, deterministically gamut-mapped: when the requested
 * chroma is out of sRGB gamut it is reduced (binary search, fixed 32 iterations,
 * lightness and hue held) until the color fits.
 */
export function oklchToHex(color: Oklch): string {
  const l = Math.max(0, Math.min(1, color.l));
  const h = color.h;
  let c = Math.max(0, color.c);
  let rgb = oklchToLinear(l, c, h);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 32; i += 1) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear(l, mid, h))) lo = mid;
      else hi = mid;
    }
    c = lo;
    rgb = oklchToLinear(l, c, h);
  }
  return rgbToHex(linearToSrgb(rgb.r), linearToSrgb(rgb.g), linearToSrgb(rgb.b));
}

/* ---------------- WCAG 2.2 contrast — replicated from the tokens build gate ---------------- */

function srgbChannel(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Contrast check requires a 6-digit hex color, got "${hex}"`);
  const n = parseInt(m[1] as string, 16);
  const r = srgbChannel((n >> 16) & 0xff);
  const g = srgbChannel((n >> 8) & 0xff);
  const b = srgbChannel(n & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Identical math to packages/tokens/src/build/build.ts#contrastRatio. */
export function contrastRatio(foregroundHex: string, backgroundHex: string): number {
  const lf = relativeLuminance(foregroundHex);
  const lb = relativeLuminance(backgroundHex);
  const [hi, lo] = lf >= lb ? [lf, lb] : [lb, lf];
  return (hi + 0.05) / (lo + 0.05);
}
