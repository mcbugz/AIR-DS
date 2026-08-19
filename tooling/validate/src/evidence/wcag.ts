import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { componentDirs } from '../workspace.ts';

/**
 * WCAG evidence collectors for the evidence pack (M6):
 *  - contrast: summarizes the generated registries/contrast-report.json
 *    (mandated semantic pairs + the alias index proving component-hook
 *    coverage + the honestly-unaudited list);
 *  - stories-axe: the latest browser-run axe results, stamped fresh or
 *    committed-with-staleness;
 *  - vitest-axe: which components assert axe in unit tests, in which states —
 *    counted by scanning the test files, never asserted from memory.
 */

// ---------------------------------------------------------------------------
// Contrast (registries/contrast-report.json)
// ---------------------------------------------------------------------------

export interface ContrastPairSummary {
  id: string;
  foreground: string;
  background: string;
  foregroundValue: string;
  backgroundValue: string;
  ratio: number;
  required: number;
  pass: boolean;
  /** Component-tier css vars whose value chains resolve to this pair. */
  coveredVars: { foreground: number; background: number };
}

export interface ContrastEvidence {
  standard: string;
  threshold: number;
  brand: string;
  failures: number;
  pairCount: number;
  allPass: boolean;
  pairs: ContrastPairSummary[];
  aliasIndex: {
    /** Component-tier color vars verified via at least one audited pair. */
    componentVarsCovered: number;
  };
  unaudited: { count: number; entries: { name: string; cssVar: string; reason: string }[] };
}

interface RawContrastReport {
  standard: string;
  threshold: number;
  brand: string;
  failures: number;
  pairs: {
    id: string;
    foreground: string;
    background: string;
    foregroundValue: string;
    backgroundValue: string;
    ratio: number;
    required: number;
    pass: boolean;
    resolvesTo?: { foreground?: string[]; background?: string[] };
  }[];
  aliasIndex?: Record<string, string[]>;
  unaudited?: { name: string; cssVar: string; aliasOf?: string; reason: string }[];
}

export function collectContrastEvidence(root: string): ContrastEvidence {
  const path = join(root, 'registries', 'contrast-report.json');
  if (!existsSync(path)) {
    throw new Error(`WCAG evidence: ${path} not found — run the token build to generate the contrast report`);
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as RawContrastReport;
  const pairs = raw.pairs.map((p) => ({
    id: p.id,
    foreground: p.foreground,
    background: p.background,
    foregroundValue: p.foregroundValue,
    backgroundValue: p.backgroundValue,
    ratio: p.ratio,
    required: p.required,
    pass: p.pass,
    coveredVars: {
      foreground: p.resolvesTo?.foreground?.length ?? 0,
      background: p.resolvesTo?.background?.length ?? 0,
    },
  }));
  return {
    standard: raw.standard,
    threshold: raw.threshold,
    brand: raw.brand,
    failures: raw.failures,
    pairCount: pairs.length,
    allPass: raw.failures === 0 && pairs.every((p) => p.pass),
    pairs,
    aliasIndex: { componentVarsCovered: Object.keys(raw.aliasIndex ?? {}).length },
    unaudited: {
      count: raw.unaudited?.length ?? 0,
      entries: (raw.unaudited ?? []).map((u) => ({ name: u.name, cssVar: u.cssVar, reason: u.reason })),
    },
  };
}

// ---------------------------------------------------------------------------
// Stories-axe (tooling/validate/stories-axe-results/<date>.json)
// ---------------------------------------------------------------------------

export interface StoriesAxeEvidence {
  /** "fresh-run" = executed during evidence generation; "committed" = latest checked-in results. */
  source: 'fresh-run' | 'committed';
  resultDate: string;
  stories: number;
  clean: number;
  withViolations: number;
  renderErrors: number;
  violations: number;
  serious: number;
  critical: number;
  gatePassed: boolean;
  allowlisted: number;
  staleness: {
    /** Whole days between the result date and evidence generation time. */
    ageDays: number;
    stale: boolean;
    note: string | null;
  };
  /** Absolute path of the results file that was copied into the pack. */
  resultsFile: string;
  /** Set when a fresh run was attempted but fell back to committed results. */
  freshRunError: string | null;
}

interface RawStoriesAxeResults {
  date: string;
  summary: {
    stories: number;
    clean: number;
    withViolations: number;
    renderErrors: number;
    violations: number;
    byImpact: Record<string, number>;
  };
  gate: unknown[];
  allowlisted?: number;
}

export function latestStoriesAxeFile(root: string): string | null {
  const dir = join(root, 'tooling', 'validate', 'stories-axe-results');
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  const last = files[files.length - 1];
  return last ? join(dir, last) : null;
}

export function summarizeStoriesAxe(
  resultsFile: string,
  opts: { source: 'fresh-run' | 'committed'; now: string; freshRunError?: string | null },
): StoriesAxeEvidence {
  const raw = JSON.parse(readFileSync(resultsFile, 'utf8')) as RawStoriesAxeResults;
  const resultMs = Date.parse(`${raw.date}T00:00:00Z`);
  const nowMs = Date.parse(opts.now);
  const ageDays =
    Number.isFinite(resultMs) && Number.isFinite(nowMs)
      ? Math.max(0, Math.floor((nowMs - resultMs) / 86_400_000))
      : 0;
  const stale = opts.source === 'committed' && ageDays > 0;
  return {
    source: opts.source,
    resultDate: raw.date,
    stories: raw.summary.stories,
    clean: raw.summary.clean,
    withViolations: raw.summary.withViolations,
    renderErrors: raw.summary.renderErrors,
    violations: raw.summary.violations,
    serious: raw.summary.byImpact['serious'] ?? 0,
    critical: raw.summary.byImpact['critical'] ?? 0,
    gatePassed: raw.gate.length === 0,
    allowlisted: raw.allowlisted ?? 0,
    staleness: {
      ageDays,
      stale,
      note: stale
        ? `Committed results predate evidence generation by ${ageDays} day(s); run stories-axe with a local chromium (pnpm --filter @ds/validate run stories-axe) for fresh results.`
        : null,
    },
    resultsFile,
    freshRunError: opts.freshRunError ?? null,
  };
}

// ---------------------------------------------------------------------------
// vitest-axe coverage (packages/react/src/components/**/**.test.tsx)
// ---------------------------------------------------------------------------

export interface VitestAxeState {
  /** The `it(...)` title the axe assertion(s) run under. */
  title: string;
  assertions: number;
}

export interface VitestAxeComponent {
  component: string;
  /** Repo-relative test files scanned. */
  files: string[];
  assertions: number;
  states: VitestAxeState[];
}

export interface VitestAxeEvidence {
  componentsTotal: number;
  componentsWithAxe: number;
  componentsWithoutAxe: string[];
  totalAssertions: number;
  components: VitestAxeComponent[];
}

const IT_RE = /\b(?:it|test)\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
const AXE_CALL_RE = /\baxe\s*\(/g;

/** Scan one test file: axe() call sites bucketed under the nearest preceding it/test title. */
export function scanTestFileForAxe(source: string): VitestAxeState[] {
  // Only files that import vitest-axe count — a local helper named axe would
  // otherwise inflate the numbers.
  if (!/from\s+['"]vitest-axe['"]/.test(source)) return [];
  const titles: { index: number; title: string }[] = [];
  let m: RegExpExecArray | null;
  IT_RE.lastIndex = 0;
  while ((m = IT_RE.exec(source)) !== null) {
    titles.push({ index: m.index, title: m[2] as string });
  }
  const counts = new Map<string, number>();
  AXE_CALL_RE.lastIndex = 0;
  while ((m = AXE_CALL_RE.exec(source)) !== null) {
    const lineStart = source.lastIndexOf('\n', m.index) + 1;
    const line = source.slice(lineStart, source.indexOf('\n', m.index) === -1 ? undefined : source.indexOf('\n', m.index));
    if (/^\s*import\b/.test(line)) continue;
    let title = '(module scope)';
    for (const t of titles) {
      if (t.index < m.index) title = t.title;
      else break;
    }
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }
  return [...counts.entries()].map(([title, assertions]) => ({ title, assertions }));
}

export function collectVitestAxeEvidence(root: string): VitestAxeEvidence {
  const dirs = componentDirs(root).sort();
  const components: VitestAxeComponent[] = [];
  const componentsWithoutAxe: string[] = [];
  for (const dir of dirs) {
    const abs = join(root, 'packages', 'react', 'src', 'components', dir);
    const testFiles = readdirSync(abs)
      .filter((f) => f.endsWith('.test.tsx') || f.endsWith('.test.ts'))
      .sort();
    const states: VitestAxeState[] = [];
    const files: string[] = [];
    for (const f of testFiles) {
      const rel = `packages/react/src/components/${dir}/${f}`;
      const found = scanTestFileForAxe(readFileSync(join(abs, f), 'utf8'));
      if (found.length > 0) {
        files.push(rel);
        states.push(...found);
      }
    }
    const assertions = states.reduce((acc, s) => acc + s.assertions, 0);
    if (assertions > 0) {
      components.push({ component: dir, files, assertions, states });
    } else {
      componentsWithoutAxe.push(dir);
    }
  }
  return {
    componentsTotal: dirs.length,
    componentsWithAxe: components.length,
    componentsWithoutAxe,
    totalAssertions: components.reduce((acc, c) => acc + c.assertions, 0),
    components,
  };
}
