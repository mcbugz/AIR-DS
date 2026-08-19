/**
 * Design-token probe (brief practice 1): token source format, build pipeline,
 * compiled CSS custom properties, and naming discipline.
 * Every finding carries the file paths and counts that produced it.
 */
import { cssDecls } from '../css-scan.ts';
import { isGenerated, isTestish, type RepoFile, type RepoScan } from '../walk.ts';

export interface TokenFindings {
  /** JSON files containing DTCG "$value" tokens, with per-file counts. */
  dtcgFiles: Array<{ path: string; tokens: number }>;
  dtcgTokenCount: number;
  /** Style Dictionary evidence (dependency or config file). */
  styleDictionary: string | null;
  /** A dedicated token package with a build script (custom pipelines count). */
  tokenPackage: string | null;
  tailwindConfig: string | null;
  /** Distinct CSS custom properties DEFINED across stylesheets. */
  cssVarNames: string[];
  cssVarDefFiles: Array<{ path: string; defs: number }>;
  /** Dominant naming prefix among defined custom properties. */
  dominantPrefix: { prefix: string; share: number } | null;
  /** Raw-scale names (--blue-500 style) among defined custom properties. */
  rawScaleNames: string[];
  /** Distinct custom-property names CONSUMED via var() in hand-written styles. */
  usageVarNames: string[];
  /** Usage names that are raw-scale (--blue-500 style) — appearance-coupled usage. */
  rawUsageNames: string[];
}

/** Tailwind-style raw color-scale naming: --blue-500, --ds-gray-90, --brand-600. */
export const RAW_SCALE_RE =
  /-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|grey|zinc|neutral|stone|brand|primary|secondary|palette)-?\d{1,4}$/i;

function countOccurrences(text: string, needle: string): number {
  let n = 0;
  let i = 0;
  while ((i = text.indexOf(needle, i)) !== -1) {
    n++;
    i += needle.length;
  }
  return n;
}

function depNamed(scan: RepoScan, f: RepoFile, re: RegExp): boolean {
  const parsed = scan.json(f);
  if (parsed === null || typeof parsed !== 'object') return false;
  const pkg = parsed as Record<string, unknown>;
  for (const key of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const deps = pkg[key];
    if (deps !== null && typeof deps === 'object') {
      for (const name of Object.keys(deps as Record<string, unknown>)) {
        if (re.test(name)) return true;
      }
    }
  }
  return false;
}

export function probeTokens(scan: RepoScan): TokenFindings {
  // --- DTCG token source ---------------------------------------------------
  const dtcgFiles: Array<{ path: string; tokens: number }> = [];
  for (const f of scan.byExt('.json')) {
    if (f.size > 2_000_000 || f.base === 'package-lock.json') continue;
    const text = scan.read(f);
    if (text === null || !text.includes('"$value"')) continue;
    const tokens = countOccurrences(text, '"$value"');
    if (tokens >= 3) dtcgFiles.push({ path: f.rel, tokens });
  }
  const dtcgTokenCount = dtcgFiles.reduce((s, f) => s + f.tokens, 0);

  // --- Build pipeline ------------------------------------------------------
  let styleDictionary: string | null = null;
  let tokenPackage: string | null = null;
  for (const f of scan.byBase(/^package\.json$/)) {
    if (styleDictionary === null && depNamed(scan, f, /^style-dictionary$/)) {
      styleDictionary = f.rel;
    }
    if (tokenPackage === null) {
      const parsed = scan.json(f);
      if (parsed !== null && typeof parsed === 'object') {
        const pkg = parsed as Record<string, unknown>;
        const name = typeof pkg['name'] === 'string' ? (pkg['name'] as string) : '';
        const scripts = pkg['scripts'];
        const hasBuild =
          scripts !== null &&
          typeof scripts === 'object' &&
          typeof (scripts as Record<string, unknown>)['build'] === 'string';
        if (/token/i.test(name) && hasBuild) tokenPackage = f.rel;
      }
    }
  }
  if (styleDictionary === null) {
    const cfg = scan.byBase(/^(style-?dictionary\.config|sd\.config)\.[cm]?[jt]s(on)?$/)[0];
    if (cfg !== undefined) styleDictionary = cfg.rel;
  }
  const tailwind = scan.byBase(/^tailwind\.config\.[cm]?[jt]s$/)[0];

  // --- CSS custom properties (definitions + hand-written usage) ------------
  const varNames = new Set<string>();
  const usageNames = new Set<string>();
  const cssVarDefFiles: Array<{ path: string; defs: number }> = [];
  const USAGE_RE = /var\(\s*(--[\w-]+)/g;
  for (const f of scan.byExt('.css', '.scss', '.less')) {
    const text = scan.read(f);
    if (text === null) continue;
    let defs = 0;
    for (const d of cssDecls(text)) {
      if (d.prop.startsWith('--')) {
        defs++;
        varNames.add(d.prop);
        continue;
      }
      if (!isGenerated(f) && !isTestish(f)) {
        USAGE_RE.lastIndex = 0;
        let um: RegExpExecArray | null;
        while ((um = USAGE_RE.exec(d.value)) !== null) usageNames.add(um[1] as string);
      }
    }
    if (defs > 0) cssVarDefFiles.push({ path: f.rel, defs });
  }
  cssVarDefFiles.sort((a, b) => b.defs - a.defs);

  // --- Naming discipline ---------------------------------------------------
  const names = [...varNames];
  let dominantPrefix: { prefix: string; share: number } | null = null;
  if (names.length >= 10) {
    const byPrefix = new Map<string, number>();
    for (const n of names) {
      const prefix = (/^--([A-Za-z0-9]+)/.exec(n)?.[1] ?? '').toLowerCase();
      byPrefix.set(prefix, (byPrefix.get(prefix) ?? 0) + 1);
    }
    let best: { prefix: string; share: number } | null = null;
    for (const [prefix, count] of byPrefix) {
      const share = count / names.length;
      if (best === null || share > best.share) best = { prefix, share };
    }
    dominantPrefix = best;
  }
  const rawScaleNames = names.filter((n) => RAW_SCALE_RE.test(n));

  return {
    dtcgFiles: dtcgFiles.sort((a, b) => b.tokens - a.tokens),
    dtcgTokenCount,
    styleDictionary,
    tokenPackage,
    tailwindConfig: tailwind?.rel ?? null,
    cssVarNames: names,
    cssVarDefFiles,
    dominantPrefix,
    rawScaleNames,
    usageVarNames: [...usageNames],
    rawUsageNames: [...usageNames].filter((n) => RAW_SCALE_RE.test(n)),
  };
}
