/** Retrofit orchestrator: detect adapters -> synthesize registries ->
 *  invoke @ds/context (native --registries-dir/--brand-path inputs) ->
 *  emit gauntlet starter config + RETROFIT.md report. Deterministic,
 *  credential-free, no LLM anywhere. */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cssTokens, extractCustomProperties, findHardcodedColors } from './css-adapter.js';
import { tailwindTokens } from './tailwind-adapter.js';
import { dtcgTokens, looksLikeTokenTree } from './dtcg-adapter.js';
import { buildContrastReport } from './contrast.js';
import { componentIndex } from './components.js';
import { renderRetrofitMd } from './report.js';
import { buildGauntletConfig } from './gauntlet-config.js';
import type {
  AdapterDetection,
  CssDecl,
  HardcodedFinding,
  RetroToken,
  RetrofitResult,
  TokensIndexOut,
} from './types.js';

const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.next', 'out']);

/** Walk up from this package to the AIR-DS workspace root. */
export function findAirRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}

function walkFiles(root: string, dir: string, predicate: (name: string) => boolean, acc: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir).sort();
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const abs = join(dir, entry);
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (!IGNORE_DIRS.has(entry) && !entry.startsWith('.')) walkFiles(root, abs, predicate, acc);
    } else if (predicate(entry)) {
      acc.push(abs);
    }
  }
  return acc;
}

const rel = (root: string, abs: string): string => relative(root, abs).split('\\').join('/');

/** Detect which adapters fire for a repo (all detections composable). */
export function detectAdapters(repoRoot: string): AdapterDetection {
  const css = walkFiles(repoRoot, repoRoot, (n) => n.endsWith('.css')).map((f) => rel(repoRoot, f));

  let tailwind: string | null = null;
  for (const candidate of ['tailwind.config.js', 'tailwind.config.cjs', 'tailwind.config.mjs', 'tailwind.config.ts']) {
    if (existsSync(join(repoRoot, candidate))) {
      tailwind = candidate;
      break;
    }
  }

  const dtcg = walkFiles(repoRoot, repoRoot, (n) => n.endsWith('.json') && n !== 'package.json' && !n.startsWith('tsconfig'))
    .filter((f) => {
      try {
        return looksLikeTokenTree(JSON.parse(readFileSync(f, 'utf8')));
      } catch {
        return false;
      }
    })
    .map((f) => rel(repoRoot, f));

  const pkgPath = join(repoRoot, 'package.json');
  let componentEntry: string | null = null;
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
      for (const field of ['types', 'main']) {
        if (typeof pkg[field] === 'string' && existsSync(resolve(repoRoot, pkg[field] as string))) {
          componentEntry = pkg[field] as string;
          break;
        }
      }
    } catch {
      componentEntry = null;
    }
  }
  return { css, tailwind, dtcg, componentEntry };
}

export interface RetrofitOptions {
  outDir: string;
  /** Brand name for the emitted context bundle. Default: sanitized package name. */
  name?: string;
  /** Fixed ISO timestamp for byte-identical context builds. */
  now?: string;
  /** Comma-separated globs (repo-relative) selecting component sources. */
  componentsGlob?: string;
  /** Skip the @ds/context invocation (registries + report only). */
  context?: boolean;
  /** Override the AIR-DS workspace root (tests). */
  airRoot?: string;
}

/** Path shown in registry `brand` fields — must mirror @ds/context displayPath. */
function displayPath(airRoot: string, abs: string): string {
  const r = relative(airRoot, abs);
  return r === '' || r.startsWith('..') || isAbsolute(r) ? abs : r.split('\\').join('/');
}

function sanitizeBrandName(raw: string): string {
  const cleaned = raw.replace(/^@/, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return cleaned === '' ? 'retrofit' : cleaned;
}

export function runRetrofit(repoPath: string, options: RetrofitOptions): RetrofitResult {
  const repoRoot = resolve(repoPath);
  if (!existsSync(repoRoot) || !statSync(repoRoot).isDirectory()) {
    throw new Error(`target repo not found or not a directory: ${repoRoot}`);
  }
  const outDir = resolve(options.outDir);
  if (outDir === repoRoot) throw new Error('outdir must differ from the target repo');
  const airRoot = options.airRoot ?? findAirRoot();
  const warnings: string[] = [];

  const detection = detectAdapters(repoRoot);

  // ---------------------------------------------------------------- tokens
  const cssDecls: CssDecl[] = [];
  const hardcoded: HardcodedFinding[] = [];
  for (const cssRel of detection.css) {
    const text = readFileSync(join(repoRoot, cssRel), 'utf8');
    cssDecls.push(...extractCustomProperties(text, cssRel));
    hardcoded.push(...findHardcodedColors(text, cssRel));
  }
  const cssResult = cssTokens(cssDecls);

  const resolvedCssValues = new Map<string, string>();
  for (const t of cssResult.tokens) resolvedCssValues.set(t.cssVar, String(t.value));

  let tailwindResult = { tokens: [] as RetroToken[], mappings: [] as RetrofitResult['tailwindMappings'], skipped: [] as string[] };
  if (detection.tailwind !== null) {
    const text = readFileSync(join(repoRoot, detection.tailwind), 'utf8');
    tailwindResult = tailwindTokens(text, detection.tailwind, resolvedCssValues);
  }

  const dtcgTokensAll: RetroToken[] = [];
  const dtcgUnresolved: string[] = [];
  for (const dtcgRel of detection.dtcg) {
    const r = dtcgTokens(readFileSync(join(repoRoot, dtcgRel), 'utf8'), dtcgRel);
    dtcgTokensAll.push(...r.tokens);
    dtcgUnresolved.push(...r.unresolvedAliases);
  }

  // Merge (css first — shipped reality beats proposals), dedupe cssVar, then names.
  const merged: RetroToken[] = [];
  const seenVars = new Set<string>();
  for (const t of [...cssResult.tokens, ...dtcgTokensAll, ...tailwindResult.tokens]) {
    if (seenVars.has(t.cssVar)) {
      warnings.push(`duplicate cssVar ${t.cssVar} from adapter ${t.provenance.adapter} — first adapter wins.`);
      continue;
    }
    seenVars.add(t.cssVar);
    merged.push(t);
  }
  const seenNames = new Map<string, number>();
  for (const t of merged) {
    const n = seenNames.get(t.name);
    if (n !== undefined) {
      seenNames.set(t.name, n + 1);
      warnings.push(`normalized-name collision: ${t.name} (from ${t.cssVar}) renamed to ${t.name}.${n + 1}.`);
      t.name = `${t.name}.${n + 1}`;
    } else {
      seenNames.set(t.name, 1);
    }
  }
  merged.sort((a, b) => a.name.localeCompare(b.name, 'en'));

  // -------------------------------------------------------------- components
  const compResult = componentIndex(repoRoot, {
    ...(options.componentsGlob !== undefined ? { componentsGlob: options.componentsGlob } : {}),
  });

  const detected = merged.length > 0 || compResult.index.components.length > 0;
  const brandName = sanitizeBrandName(options.name ?? compResult.index.package);

  const base: Omit<
    RetrofitResult,
    'tokensIndex' | 'componentsIndex' | 'contrastReport' | 'contextStatus' | 'contextError' | 'contextFiles'
  > = {
    repoRoot,
    outDir,
    brandName,
    detection,
    detected,
    tailwindMappings: tailwindResult.mappings,
    hardcoded,
    componentConfidence: compResult.confidence,
    unresolvedVars: [...cssResult.unresolvedVars, ...dtcgUnresolved].sort(),
    skippedTailwindPaths: tailwindResult.skipped,
    warnings,
  };

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  if (!detected) {
    const result: RetrofitResult = {
      ...base,
      tokensIndex: null,
      componentsIndex: null,
      contrastReport: null,
      contextStatus: 'skipped',
      contextError: null,
      contextFiles: 0,
    };
    writeFileSync(join(outDir, 'RETROFIT.md'), renderRetrofitMd(result));
    return result;
  }

  // ------------------------------------------------------- registry emission
  const brandAbs = join(outDir, 'brand', `${brandName}.json`);
  const brandDisplay = displayPath(airRoot, brandAbs);

  const tokensIndex: TokensIndexOut = {
    $description:
      `GENERATED closed-world token contract synthesized by @ds/retrofit from ${compResult.index.package}. ` +
      'Every detected design token is enumerated here; a custom property not in this file is provably fabricated. ' +
      'Names are normalized (camel/snake/kebab -> dot path); `cssVar` is the ORIGINAL custom property as shipped ' +
      '(tailwind/DTCG entries carry PROPOSED vars flagged `provenance.proposed`). `tier` is "semantic" as a ' +
      'best-effort default — confirm per token (see RETROFIT.md). `provenance` records the source file:line. ' +
      'Regenerate with: ds-retrofit <repo> -o <outdir>',
    brand: brandDisplay,
    count: merged.length,
    tokens: merged,
  };
  const contrastReport = buildContrastReport(merged, { brand: brandDisplay, rawByVar: cssResult.rawByVar });

  const registriesDir = join(outDir, 'registries');
  mkdirSync(registriesDir, { recursive: true });
  const writeJson = (path: string, value: unknown): void => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  };
  writeJson(join(registriesDir, 'tokens-index.json'), tokensIndex);
  writeJson(join(registriesDir, 'components-index.json'), compResult.index);
  writeJson(join(registriesDir, 'contrast-report.json'), contrastReport);

  // Minimal brand descriptor — hashed as a compiler input; display values only.
  writeJson(brandAbs, {
    $description:
      'Retrofit brand descriptor synthesized by @ds/retrofit — display metadata for the context compiler ' +
      '(resolved token values live in registries/tokens-index.json).',
    name: brandName,
    source: 'retrofit',
    package: compResult.index.package,
    detected: {
      cssFiles: detection.css.length,
      tailwindConfig: detection.tailwind,
      dtcgFiles: detection.dtcg.length,
      tokens: merged.length,
      components: compResult.index.components.length,
    },
  });

  if (tailwindResult.mappings.length > 0) {
    writeJson(join(outDir, 'tailwind-mapping.json'), {
      $description:
        'Proposed Tailwind theme -> custom-property mapping table synthesized by @ds/retrofit. ' +
        '`matchesExistingVar` names an already-shipped custom property with the same resolved value (adopt it ' +
        'instead of minting a new var).',
      mappings: tailwindResult.mappings,
    });
  }

  // ------------------------------------------------------------ context layer
  let contextStatus: RetrofitResult['contextStatus'] = 'skipped';
  let contextError: string | null = null;
  let contextFiles = 0;
  if (options.context !== false) {
    const contextCli = join(airRoot, 'packages', 'context', 'src', 'cli.ts');
    if (!existsSync(contextCli)) {
      contextStatus = 'failed';
      contextError = `@ds/context CLI not found at ${contextCli}`;
    } else {
      const args = [
        contextCli,
        '--brand', brandName,
        '--registries-dir', registriesDir,
        '--brand-path', brandAbs,
        '--out', join(outDir, 'context'),
        ...(options.now !== undefined ? ['--now', options.now] : []),
      ];
      const run = spawnSync(process.execPath, args, { cwd: airRoot, encoding: 'utf8' });
      if (run.status === 0) {
        contextStatus = 'emitted';
        contextFiles = countFiles(join(outDir, 'context'));
      } else {
        contextStatus = 'failed';
        contextError = `${(run.stderr || run.stdout || 'unknown error').trim().slice(0, 2000)}`;
        warnings.push('context compilation failed — registries and report were still emitted (see RETROFIT.md).');
      }
    }
  }

  // ------------------------------------------------- gauntlet + human report
  const result: RetrofitResult = {
    ...base,
    tokensIndex,
    componentsIndex: compResult.index,
    contrastReport,
    contextStatus,
    contextError,
    contextFiles,
  };
  writeJson(join(outDir, 'gauntlet.config.json'), buildGauntletConfig(result));
  writeFileSync(join(outDir, 'RETROFIT.md'), renderRetrofitMd(result));
  writeJson(join(outDir, 'retrofit-report.json'), {
    $description: 'Machine-readable twin of RETROFIT.md — the retrofit run summary.',
    package: compResult.index.package,
    brand: brandName,
    detection,
    counts: {
      tokens: merged.length,
      tokensByAdapter: {
        css: cssResult.tokens.length,
        tailwind: tailwindResult.tokens.length,
        dtcg: dtcgTokensAll.length,
      },
      components: compResult.index.components.length,
      contrastPairs: contrastReport.pairs.length,
      contrastFailures: contrastReport.failures,
      unaudited: contrastReport.unaudited.length,
      hardcodedLiterals: hardcoded.length,
      contextFiles,
    },
    contextStatus,
    warnings,
  });
  return result;
}

function countFiles(dir: string): number {
  let count = 0;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const abs = join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) count += countFiles(abs);
    else count += 1;
  }
  return count;
}
