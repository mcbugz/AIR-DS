/**
 * Registry loading for the AIR-DS MCP server.
 *
 * The registries are the closed world (CLAUDE.md rule 5): every legal
 * component and token is enumerated in `registries/`. This module loads them
 * AT RUNTIME — values are never baked into the server — so per-brand builds
 * answer with the brand's own resolved values.
 *
 * Resolution order for the registry directory:
 *   1. explicit `--registry-dir` flag
 *   2. `DS_REGISTRY_DIR` environment variable
 *   3. `<packageRoot>/registries` — shipped layout: per-customer builds place
 *      their re-emitted registries alongside the package
 *   4. `<packageRoot>/../../registries` — dev layout: the pnpm workspace root
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/* ---------------------------------------------------------------- types -- */

export interface TokenEntry {
  name: string;
  cssVar: string;
  tier: 'semantic' | 'component';
  type: string;
  description: string;
  value: string;
}

export interface TokensIndex {
  $description: string;
  brand: string;
  count: number;
  tokens: TokenEntry[];
}

export interface PropEntry {
  name: string;
  type: string;
  required: boolean;
  defaultValue: string | null;
  description: string;
}

export interface ComponentEntry {
  name: string;
  description: string;
  racBase: string | null;
  example: string;
  props: PropEntry[];
}

export interface ComponentsIndex {
  $description: string;
  package: string;
  components: ComponentEntry[];
}

export interface ContrastPair {
  foreground: string;
  background: string;
  foregroundValue: string;
  backgroundValue: string;
  ratio: number;
  required: number;
  pass: boolean;
}

export interface ContrastReport {
  standard: string;
  threshold: number;
  brand: string;
  failures: number;
  pairs: ContrastPair[];
}

export interface Registry {
  registryDir: string;
  tokens: TokensIndex;
  components: ComponentsIndex;
  contrast: ContrastReport | null;
  /** component name -> repo-relative story file path (null when stories are not shipped) */
  storyFiles: Map<string, string | null>;
  /** fast lookup sets */
  tokenByVar: Map<string, TokenEntry>;
  componentByName: Map<string, ComponentEntry>;
  /** component-tier token prefixes, e.g. "button", "alert" (from --ds-<prefix>-*) */
  componentTokenPrefixes: Set<string>;
}

/* ----------------------------------------------------------- resolution -- */

function packageRoot(): string {
  // this file lives at <pkg>/src/registry.ts or <pkg>/dist/registry.js
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

export function resolveRegistryDir(explicit?: string): string {
  const hasIndex = (dir: string): boolean => existsSync(path.join(dir, 'tokens-index.json'));

  // An explicitly requested directory must resolve — NEVER silently fall back
  // to another registry set (a per-customer build would answer with the wrong
  // brand's values).
  const required = explicit ?? process.env['DS_REGISTRY_DIR'];
  if (required) {
    const abs = path.resolve(required);
    if (hasIndex(abs)) return abs;
    throw new Error(
      `Could not locate a registry directory: no tokens-index.json in '${abs}' (from ${explicit ? '--registry-dir' : 'DS_REGISTRY_DIR'}).`,
    );
  }

  const candidates = [
    path.join(packageRoot(), 'registries'), // shipped: registries alongside the package
    path.resolve(packageRoot(), '..', '..', 'registries'), // dev: pnpm workspace root
  ];
  for (const candidate of candidates) {
    if (hasIndex(candidate)) return path.resolve(candidate);
  }
  throw new Error(
    `Could not locate a registry directory (looked for tokens-index.json in: ${candidates.join(
      ', ',
    )}). Pass --registry-dir <path> or set DS_REGISTRY_DIR.`,
  );
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

/* ---------------------------------------------------- story-file discovery -- */

/**
 * Map registry components to their Storybook story files by scanning
 * `packages/react/src/components/<Dir>/<Dir>.stories.tsx` relative to the
 * repo root (registryDir/..). Sub-components (CardBody, Tab, ...) live in
 * their parent's directory, so match by JSX usage inside the story source.
 * Shipped per-customer builds normally do not include the stories tree; the
 * story path is then null and consumers rely on the registry `example`.
 */
function discoverStoryFiles(
  registryDir: string,
  components: ComponentEntry[],
): Map<string, string | null> {
  const result = new Map<string, string | null>();
  const repoRoot = path.resolve(registryDir, '..');
  const componentsDir = path.join(repoRoot, 'packages', 'react', 'src', 'components');
  for (const c of components) result.set(c.name, null);
  if (!existsSync(componentsDir)) return result;

  const storySources: Array<{ rel: string; source: string; dir: string }> = [];
  for (const dir of readdirSync(componentsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const storyFile = path.join(componentsDir, dir.name, `${dir.name}.stories.tsx`);
    if (!existsSync(storyFile)) continue;
    storySources.push({
      rel: path.relative(repoRoot, storyFile),
      source: readFileSync(storyFile, 'utf8'),
      dir: dir.name,
    });
  }

  for (const c of components) {
    // 1. exact directory match (Button -> Button/Button.stories.tsx)
    const exact = storySources.find((s) => s.dir === c.name);
    if (exact) {
      result.set(c.name, exact.rel);
      continue;
    }
    // 2. first story file that renders the component (<CardBody ...)
    const jsxTag = new RegExp(`<${c.name}[\\s/>]`);
    const usage = storySources.find((s) => jsxTag.test(s.source));
    if (usage) result.set(c.name, usage.rel);
  }
  return result;
}

/* -------------------------------------------------------------- loading -- */

export function loadRegistry(registryDirInput?: string): Registry {
  const registryDir = resolveRegistryDir(registryDirInput);
  const tokens = readJson<TokensIndex>(path.join(registryDir, 'tokens-index.json'));
  const components = readJson<ComponentsIndex>(path.join(registryDir, 'components-index.json'));
  const contrastPath = path.join(registryDir, 'contrast-report.json');
  const contrast = existsSync(contrastPath) ? readJson<ContrastReport>(contrastPath) : null;

  const tokenByVar = new Map(tokens.tokens.map((t) => [t.cssVar, t]));
  const componentByName = new Map(components.components.map((c) => [c.name, c]));

  const componentTokenPrefixes = new Set<string>();
  for (const t of tokens.tokens) {
    if (t.tier !== 'component') continue;
    const m = /^--ds-([a-z0-9]+)-/.exec(t.cssVar);
    if (m?.[1]) componentTokenPrefixes.add(m[1]);
  }

  return {
    registryDir,
    tokens,
    components,
    contrast,
    storyFiles: discoverStoryFiles(registryDir, components.components),
    tokenByVar,
    componentByName,
    componentTokenPrefixes,
  };
}

/* ------------------------------------------------------------- helpers -- */

/** token categories are the first segment of the dotted name (color, space, button, ...) */
export function tokenCategories(registry: Registry): string[] {
  const cats = new Set<string>();
  for (const t of registry.tokens.tokens) {
    const first = t.name.split('.')[0];
    if (first) cats.add(first);
  }
  return [...cats].sort();
}

/** Levenshtein distance, for closed-world "did you mean" suggestions. */
export function editDistance(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  const row: number[] = Array.from({ length: lb + 1 }, (_, i) => i);
  for (let i = 1; i <= la; i++) {
    let prev = row[0] as number;
    row[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cur = row[j] as number;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(cur + 1, (row[j - 1] as number) + 1, prev + cost);
      prev = cur;
    }
  }
  return row[lb] as number;
}

export function nearestNames(target: string, candidates: string[], max = 3): string[] {
  return candidates
    .map((c) => ({ c, d: editDistance(target.toLowerCase(), c.toLowerCase()) }))
    .sort((x, y) => x.d - y.d || x.c.localeCompare(y.c))
    .slice(0, max)
    .map((x) => x.c);
}
