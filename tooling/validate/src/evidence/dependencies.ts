import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, normalize } from 'node:path';

/**
 * Dependency inventory for the evidence pack (M6) — derived ENTIRELY from
 * pnpm-lock.yaml plus package.json files already on disk. No registry API,
 * no network: an auditor can regenerate this from a checkout alone.
 *
 * Licenses come from the locally installed packages' package.json files
 * (node_modules/.pnpm/<dir>/node_modules/<name>/package.json). A package
 * whose license cannot be read locally is reported as "unknown" — never
 * guessed, never fetched.
 */

// ---------------------------------------------------------------------------
// Minimal YAML-subset parser for pnpm-lock.yaml (lockfileVersion 9).
// The lockfile is machine-emitted YAML restricted to nested maps of scalars,
// inline flow maps ({integrity: ...} — kept as raw strings), and simple
// `- item` sequences. That is the entire grammar parsed here; anything more
// exotic would mean pnpm changed its emitter and the tests would catch it.
// ---------------------------------------------------------------------------

export type LockNode = string | string[] | LockMap;
export interface LockMap {
  [key: string]: LockNode;
}

function unquote(s: string): string {
  if (s.length >= 2 && ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"')))) {
    return s.slice(1, -1);
  }
  return s;
}

export function parseLockfileYaml(text: string): LockMap {
  const root: LockMap = {};
  // Stack of open mappings: indent = column of the KEYS inside the map.
  const stack: { indent: number; map: LockMap }[] = [{ indent: 0, map: root }];
  let lastKey: { indent: number; map: LockMap; key: string } | null = null;

  for (const rawLine of text.split('\n')) {
    if (rawLine.trim().length === 0) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();
    if (line.startsWith('#')) continue;

    // Sequence item: attach to the pending key as a string array.
    if (line.startsWith('- ')) {
      if (lastKey) {
        const cur = lastKey.map[lastKey.key];
        const arr = Array.isArray(cur) ? cur : [];
        arr.push(unquote(line.slice(2).trim()));
        lastKey.map[lastKey.key] = arr;
      }
      continue;
    }

    // Pop mappings deeper than or at this line's indent.
    while (stack.length > 1 && indent < (stack[stack.length - 1] as { indent: number }).indent) {
      stack.pop();
    }
    const top = stack[stack.length - 1] as { indent: number; map: LockMap };

    // Split "key: value" / "key:" at the first colon outside quotes.
    let key: string;
    let rest: string;
    if (line.startsWith("'") || line.startsWith('"')) {
      const q = line[0] as string;
      const close = line.indexOf(q, 1);
      key = line.slice(1, close);
      rest = line.slice(close + 1).replace(/^:/, '').trim();
    } else {
      const colon = line.indexOf(':');
      if (colon === -1) continue; // not a mapping line — outside our subset
      key = line.slice(0, colon).trim();
      rest = line.slice(colon + 1).trim();
    }

    if (rest.length === 0) {
      // Nested map opens; its children will be indented deeper.
      const child: LockMap = {};
      top.map[key] = child;
      stack.push({ indent: indent + 1, map: child });
      lastKey = { indent, map: top.map, key };
    } else {
      // Scalar (inline flow maps like {integrity: ...} kept as raw strings).
      top.map[key] = unquote(rest);
      lastKey = { indent, map: top.map, key };
    }
  }
  return root;
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

/** `name@1.2.3(peer@x)` -> canonical `name@1.2.3`. */
export function canonicalId(name: string, versionSpec: string): string {
  const paren = versionSpec.indexOf('(');
  const version = paren === -1 ? versionSpec : versionSpec.slice(0, paren);
  return `${name}@${version}`;
}

interface ImporterDeps {
  /** name -> resolved version spec (may carry a peer suffix or be `link:…`). */
  prod: Map<string, string>;
  dev: Map<string, string>;
}

function importerDeps(importer: LockNode | undefined): ImporterDeps {
  const out: ImporterDeps = { prod: new Map(), dev: new Map() };
  if (!importer || typeof importer !== 'object' || Array.isArray(importer)) return out;
  for (const [field, target] of [
    ['dependencies', out.prod],
    ['devDependencies', out.dev],
  ] as const) {
    const section = (importer as LockMap)[field];
    if (!section || typeof section !== 'object' || Array.isArray(section)) continue;
    for (const [name, entry] of Object.entries(section)) {
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        const version = (entry as LockMap)['version'];
        if (typeof version === 'string') target.set(name, version);
      }
    }
  }
  return out;
}

export interface PackageInventory {
  /** Workspace-relative importer path, e.g. "packages/react". */
  path: string;
  name: string;
  version: string;
  private: boolean;
  direct: { prod: number; dev: number };
  /** Unique external name@version reachable via the lockfile graph. */
  transitive: { prod: number; dev: number };
  /** Workspace-internal (link:) dependencies, by importer path. */
  workspaceDeps: string[];
}

export interface InventoryEntry {
  id: string; // name@version
  name: string;
  version: string;
  license: string; // SPDX string or "unknown"
  /** "prod" if reachable from any publishable package's production graph. */
  scope: 'prod' | 'dev';
}

export interface DependencyInventory {
  lockfileVersion: string;
  packages: PackageInventory[];
  /** Every unique external dependency in the workspace graph, sorted by id. */
  entries: InventoryEntry[];
  licenses: { byLicense: Record<string, number>; unknown: number; total: number };
}

/**
 * Build a license map by scanning the local pnpm store
 * (node_modules/.pnpm/<dir>/node_modules/<pkg>/package.json). Local disk only.
 */
export function localLicenseMap(root: string): Map<string, string> {
  const map = new Map<string, string>();
  const store = join(root, 'node_modules', '.pnpm');
  if (!existsSync(store)) return map;
  let dirs: string[] = [];
  try {
    dirs = readdirSync(store);
  } catch {
    return map;
  }
  for (const dir of dirs) {
    const nm = join(store, dir, 'node_modules');
    let names: string[] = [];
    try {
      names = readdirSync(nm);
    } catch {
      continue;
    }
    for (const name of names) {
      if (name.startsWith('.')) continue;
      const candidates = name.startsWith('@')
        ? (() => {
            try {
              return readdirSync(join(nm, name)).map((sub) => `${name}/${sub}`);
            } catch {
              return [];
            }
          })()
        : [name];
      for (const pkgName of candidates) {
        const pjPath = join(nm, pkgName, 'package.json');
        if (!existsSync(pjPath)) continue;
        try {
          const pj = JSON.parse(readFileSync(pjPath, 'utf8')) as {
            name?: string;
            version?: string;
            license?: string | { type?: string };
          };
          if (!pj.name || !pj.version) continue;
          const license =
            typeof pj.license === 'string'
              ? pj.license
              : typeof pj.license === 'object' && pj.license?.type
                ? pj.license.type
                : null;
          if (license) map.set(`${pj.name}@${pj.version}`, license);
        } catch {
          // unreadable package.json — stays unknown
        }
      }
    }
  }
  return map;
}

interface Closure {
  external: Set<string>; // canonical name@version
  workspace: Set<string>; // importer paths
}

/** Resolve a `link:…` version to a workspace importer path. */
function linkTarget(importerPath: string, versionSpec: string): string {
  const rel = versionSpec.slice('link:'.length);
  return normalize(join(importerPath === '.' ? '' : importerPath, rel)).replace(/\\/g, '/') || '.';
}

function snapshotDeps(snapshots: LockMap, key: string): Map<string, string> {
  const out = new Map<string, string>();
  const node = snapshots[key];
  if (!node || typeof node !== 'object' || Array.isArray(node)) return out;
  for (const field of ['dependencies', 'optionalDependencies']) {
    const section = (node as LockMap)[field];
    if (!section || typeof section !== 'object' || Array.isArray(section)) continue;
    for (const [name, v] of Object.entries(section)) {
      if (typeof v === 'string') out.set(name, v);
    }
  }
  return out;
}

/**
 * Transitive closure of one importer's prod or dev graph. Workspace `link:`
 * dependencies recurse into the linked importer's PRODUCTION dependencies —
 * installing a workspace package pulls in its prod deps regardless of why
 * the consumer depends on it.
 */
export function transitiveClosure(
  lock: LockMap,
  importers: LockMap,
  importerPath: string,
  which: 'prod' | 'dev',
): Closure {
  const snapshots = (lock['snapshots'] ?? {}) as LockMap;
  const external = new Set<string>();
  const workspace = new Set<string>();
  const queue: { name: string; versionSpec: string; from: string }[] = [];
  const seenSnapshots = new Set<string>();

  const enqueueImporter = (path: string, scope: 'prod' | 'dev'): void => {
    const deps = importerDeps(importers[path]);
    const source = scope === 'prod' ? deps.prod : deps.dev;
    for (const [name, versionSpec] of source) queue.push({ name, versionSpec, from: path });
  };
  enqueueImporter(importerPath, which);

  while (queue.length > 0) {
    const { name, versionSpec, from } = queue.shift() as { name: string; versionSpec: string; from: string };
    if (versionSpec.startsWith('link:')) {
      const target = linkTarget(from, versionSpec);
      if (workspace.has(target)) continue;
      workspace.add(target);
      enqueueImporter(target, 'prod'); // linked workspace packages contribute prod deps
      continue;
    }
    const snapKey = `${name}@${versionSpec}`;
    if (seenSnapshots.has(snapKey)) continue;
    seenSnapshots.add(snapKey);
    external.add(canonicalId(name, versionSpec));
    for (const [depName, depVersion] of snapshotDeps(snapshots, snapKey)) {
      queue.push({ name: depName, versionSpec: depVersion, from });
    }
  }
  return { external, workspace };
}

export function collectDependencyInventory(root: string): DependencyInventory {
  const lockPath = join(root, 'pnpm-lock.yaml');
  if (!existsSync(lockPath)) {
    throw new Error(`dependency inventory: ${lockPath} not found — the lockfile is the sole source (no network)`);
  }
  const lock = parseLockfileYaml(readFileSync(lockPath, 'utf8'));
  const lockfileVersion = typeof lock['lockfileVersion'] === 'string' ? lock['lockfileVersion'] : 'unknown';
  const importers = (lock['importers'] ?? {}) as LockMap;

  const packages: PackageInventory[] = [];
  const prodUnion = new Set<string>();
  const allUnion = new Set<string>();

  for (const importerPath of Object.keys(importers).sort()) {
    const pjPath = join(root, importerPath, 'package.json');
    let pj: { name?: string; version?: string; private?: boolean } = {};
    if (existsSync(pjPath)) {
      try {
        pj = JSON.parse(readFileSync(pjPath, 'utf8')) as typeof pj;
      } catch {
        // fall through to placeholders
      }
    }
    const deps = importerDeps(importers[importerPath]);
    const prod = transitiveClosure(lock, importers, importerPath, 'prod');
    const dev = transitiveClosure(lock, importers, importerPath, 'dev');
    const isPrivate = pj.private === true;
    for (const id of prod.external) {
      allUnion.add(id);
      if (!isPrivate) prodUnion.add(id);
    }
    for (const id of dev.external) allUnion.add(id);
    packages.push({
      path: importerPath,
      name: pj.name ?? importerPath,
      version: pj.version ?? '0.0.0',
      private: isPrivate,
      direct: { prod: deps.prod.size, dev: deps.dev.size },
      transitive: { prod: prod.external.size, dev: dev.external.size },
      workspaceDeps: [...new Set([...prod.workspace, ...dev.workspace])].sort(),
    });
  }

  const licenseMap = localLicenseMap(root);
  const entries: InventoryEntry[] = [...allUnion].sort().map((id) => {
    const at = id.lastIndexOf('@');
    const name = id.slice(0, at);
    const version = id.slice(at + 1);
    return {
      id,
      name,
      version,
      license: licenseMap.get(id) ?? 'unknown',
      scope: prodUnion.has(id) ? ('prod' as const) : ('dev' as const),
    };
  });

  const byLicense: Record<string, number> = {};
  let unknown = 0;
  for (const e of entries) {
    if (e.license === 'unknown') unknown++;
    else byLicense[e.license] = (byLicense[e.license] ?? 0) + 1;
  }

  return {
    lockfileVersion,
    packages,
    entries,
    licenses: { byLicense: Object.fromEntries(Object.entries(byLicense).sort()), unknown, total: entries.length },
  };
}
