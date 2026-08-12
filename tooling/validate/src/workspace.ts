import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { RegistryContext, Violation } from './types.ts';

/** Workspace-level checks: G4 dead hooks, G7 generator drift, registry coverage. */

/** Shared hook namespaces: registry segment -> component dirs allowed to consume it. */
const SHARED_SEGMENT_DIRS: Record<string, string[]> = {
  field: ['TextField', 'TextArea', 'Select'],
  button: ['Button', 'IconButton'],
};

export interface Waivers {
  /** cssVar names exempt from the G4 dead-hook check. */
  deadHookWaivers: string[];
}

export function loadWaivers(): Waivers {
  try {
    const url = new URL('../config/waivers.json', import.meta.url);
    const parsed = JSON.parse(readFileSync(url, 'utf8')) as Partial<Waivers>;
    return { deadHookWaivers: parsed.deadHookWaivers ?? [] };
  } catch {
    return { deadHookWaivers: [] };
  }
}

export function componentDirs(root: string): string[] {
  const dir = join(root, 'packages', 'react', 'src', 'components');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((d) => {
    try {
      return statSync(join(dir, d)).isDirectory() && /^[A-Z]/.test(d);
    } catch {
      return false;
    }
  });
}

/**
 * Component names exported from each component directory's index.ts —
 * the deterministic ground truth for which registered components (including
 * subcomponents like Radio, Tab, CardHeader) live in which directory.
 */
export function componentDirExports(root: string): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const dir of componentDirs(root)) {
    const indexPath = join(root, 'packages', 'react', 'src', 'components', dir, 'index.ts');
    const names = new Set<string>();
    if (existsSync(indexPath)) {
      const src = readFileSync(indexPath, 'utf8');
      const re = /\b([A-Z][A-Za-z0-9]*)\b/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const name = m[1] as string;
        if (!name.endsWith('Props')) names.add(name);
      }
    }
    names.add(dir);
    map.set(dir, names);
  }
  return map;
}

/** Recursively collect scannable source files under packages/react/src. */
export function reactSourceFiles(root: string): string[] {
  const base = join(root, 'packages', 'react', 'src');
  if (!existsSync(base)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (/\.(module\.css|tsx|ts)$/.test(entry) && !entry.endsWith('.d.ts')) out.push(full);
    }
  };
  walk(base);
  return out;
}

/**
 * G4: every registered --ds-<component>-* hook whose namespace maps to a
 * shipped component directory must be consumed by that component family's CSS.
 * An unconsumed hook is a silent no-op on the customer override surface.
 */
export function checkDeadHooks(root: string, ctx: RegistryContext, waivers: Waivers): Violation[] {
  const violations: Violation[] = [];
  const dirs = componentDirs(root);
  const dirsLower = new Map(dirs.map((d) => [d.toLowerCase(), d]));
  const waived = new Set(waivers.deadHookWaivers);

  for (const [segment, tokens] of ctx.componentTokensBySegment) {
    const targets: string[] = [];
    const shared = SHARED_SEGMENT_DIRS[segment];
    if (shared) {
      targets.push(...shared.filter((d) => dirs.includes(d)));
    } else {
      const exact = dirsLower.get(segment);
      if (exact) targets.push(exact);
      else {
        // Subcomponent namespaces live in their parent's directory
        // (radio -> RadioGroup/, tab -> Tabs/, cardheader -> Card/):
        // resolve via the directory's index.ts exports, falling back to the
        // prefix relation between segment and directory name.
        const exportsMap = componentDirExports(root);
        for (const [dir, names] of exportsMap) {
          if ([...names].some((n) => n.toLowerCase() === segment)) {
            targets.push(dir);
          }
        }
        if (targets.length === 0) {
          for (const [lower, dir] of dirsLower) {
            if (lower.startsWith(segment) || segment.startsWith(lower)) targets.push(dir);
          }
        }
      }
    }
    if (targets.length === 0) continue; // namespace does not match a shipped component dir

    let cssCorpus = '';
    for (const target of targets) {
      const compDir = join(root, 'packages', 'react', 'src', 'components', target);
      for (const entry of readdirSync(compDir)) {
        if (entry.endsWith('.module.css')) {
          cssCorpus += readFileSync(join(compDir, entry), 'utf8');
        }
      }
    }

    for (const token of tokens) {
      if (waived.has(token)) continue;
      if (!cssCorpus.includes(token)) {
        violations.push({
          rule: 'G4',
          nr: null,
          file: `packages/react/src/components/${targets.join('|')}`,
          line: 0,
          message: `Dead hook: registered component token "${token}" is not consumed by ${targets.join('/')} CSS — a customer override of it would be a silent no-op. Consume it or add it to tooling/validate/config/waivers.json.`,
        });
      }
    }
  }
  return violations;
}

/** Registry coverage: shipped component dirs and components-index must agree. */
export function checkComponentCoverage(root: string, ctx: RegistryContext): Violation[] {
  const violations: Violation[] = [];
  const dirs = componentDirs(root);
  for (const dir of dirs) {
    if (!ctx.componentNames.has(dir)) {
      violations.push({
        rule: 'G5',
        nr: null,
        file: `packages/react/src/components/${dir}`,
        line: 0,
        message: `Component directory "${dir}" is missing from registries/components-index.json — run pnpm --filter @ds/react generate.`,
      });
    }
  }
  // Reverse direction: every registered component must be exported from some
  // component directory's index.ts (subcomponents live in their parent's dir).
  const exportsMap = componentDirExports(root);
  const allExports = new Set<string>();
  for (const names of exportsMap.values()) for (const n of names) allExports.add(n);
  for (const name of ctx.componentNames) {
    if (!allExports.has(name)) {
      violations.push({
        rule: 'G5',
        nr: null,
        file: 'registries/components-index.json',
        line: 0,
        message: `Registry lists component "${name}" but no packages/react/src/components/*/index.ts exports it — stale registry, run pnpm --filter @ds/react generate.`,
      });
    }
  }
  return violations;
}

/** Files owned by the @ds/react generator (compared before/after for G7). */
export function generatedFilePaths(root: string): string[] {
  const candidates = [
    join(root, 'registries', 'tokens-index.json'),
    join(root, 'registries', 'components-index.json'),
    join(root, 'registries', 'contrast-report.json'),
    join(root, 'packages', 'react', 'src', 'index.ts'),
  ];
  return candidates.filter((p) => existsSync(p));
}

export function hashFiles(paths: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of paths) {
    try {
      map.set(p, createHash('sha256').update(readFileSync(p)).digest('hex'));
    } catch {
      map.set(p, 'MISSING');
    }
  }
  return map;
}

/**
 * G7 drift = the generator changed generated files relative to their
 * pre-generate working-tree state (works on dirty trees where a plain
 * `git diff --exit-code` would false-positive on unrelated edits).
 */
export function diffHashes(before: Map<string, string>, after: Map<string, string>): string[] {
  const changed: string[] = [];
  for (const [path, hash] of after) {
    if (before.get(path) !== hash) changed.push(path);
  }
  for (const path of before.keys()) {
    if (!after.has(path)) changed.push(path);
  }
  return changed;
}
