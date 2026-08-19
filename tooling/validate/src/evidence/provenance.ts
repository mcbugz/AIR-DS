import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Provenance collectors for the evidence pack (M6): git identity, toolchain
 * versions, per-artifact sha256 hashes, and a reproducibility statement whose
 * every claim is VERIFIED against the named test at generation time — a claim
 * whose backing test has vanished is reported unverified, never asserted.
 *
 * Local-only: git is the single external tool, and its absence degrades to
 * "unknown" values rather than failure. No network anywhere.
 */

function git(root: string, args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

export interface GitProvenance {
  sha: string;
  shortSha: string;
  /** Exact tag pointing at HEAD, if any. */
  tag: string | null;
  /** Nearest-tag description (git describe --tags --always). */
  describe: string;
  branch: string;
  commitTime: string;
  /** True when the working tree differs from HEAD — evidence from a dirty tree says so. */
  dirty: boolean;
  dirtyFiles: number;
}

export function collectGitProvenance(root: string): GitProvenance {
  const sha = git(root, ['rev-parse', 'HEAD']) ?? 'unknown';
  const status = git(root, ['status', '--porcelain']);
  const dirtyFiles = status ? status.split('\n').filter((l) => l.trim().length > 0).length : 0;
  return {
    sha,
    shortSha: git(root, ['rev-parse', '--short', 'HEAD']) ?? 'unknown',
    tag: git(root, ['describe', '--tags', '--exact-match']) || null,
    describe: git(root, ['describe', '--tags', '--always']) ?? 'unknown',
    branch: git(root, ['rev-parse', '--abbrev-ref', 'HEAD']) ?? 'unknown',
    commitTime: git(root, ['show', '-s', '--format=%cI', 'HEAD']) ?? 'unknown',
    dirty: dirtyFiles > 0,
    dirtyFiles,
  };
}

export interface ToolchainProvenance {
  node: string;
  /** From the root package.json packageManager field (the pinned pnpm). */
  packageManager: string;
  /** Workspace package name -> version. */
  workspacePackages: Record<string, string>;
  /** Key third-party tool versions resolved from locally installed packages. */
  tools: Record<string, string>;
}

const TOOL_PACKAGES = ['typescript', 'react', 'react-aria-components', 'style-dictionary', 'vitest', 'axe-core', 'playwright', 'storybook'];

function installedVersion(root: string, name: string): string | null {
  const p = join(root, 'node_modules', name, 'package.json');
  if (!existsSync(p)) return null;
  try {
    const pj = JSON.parse(readFileSync(p, 'utf8')) as { version?: string };
    return pj.version ?? null;
  } catch {
    return null;
  }
}

export function collectToolchain(root: string): ToolchainProvenance {
  let packageManager = 'unknown';
  const workspacePackages: Record<string, string> = {};
  const rootPj = join(root, 'package.json');
  if (existsSync(rootPj)) {
    try {
      const pj = JSON.parse(readFileSync(rootPj, 'utf8')) as { packageManager?: string };
      packageManager = pj.packageManager ?? 'unknown';
    } catch {
      // stays unknown
    }
  }
  for (const group of ['packages', 'tooling']) {
    const dir = join(root, group);
    if (!existsSync(dir)) continue;
    for (const sub of readdirSync(dir).sort()) {
      const p = join(dir, sub, 'package.json');
      if (!existsSync(p)) continue;
      try {
        const pj = JSON.parse(readFileSync(p, 'utf8')) as { name?: string; version?: string };
        if (pj.name && pj.version) workspacePackages[pj.name] = pj.version;
      } catch {
        // skip unreadable manifests
      }
    }
  }
  const tools: Record<string, string> = {};
  for (const name of TOOL_PACKAGES) {
    const local = installedVersion(root, name) ?? installedVersion(join(root, 'tooling', 'validate'), name) ?? installedVersion(join(root, 'packages', 'react'), name);
    if (local) tools[name] = local;
  }
  return { node: process.version, packageManager, workspacePackages, tools };
}

export interface ArtifactHash {
  path: string; // repo-relative
  sha256: string;
  bytes: number;
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export interface ArtifactHashes {
  registries: ArtifactHash[];
  /** The @ds/context dist manifest(s): file hash + the sourceHash embedded in each. */
  contextManifests: { path: string; sha256: string; sourceHash: string | null }[];
  releaseArtifacts: ArtifactHash[];
}

function hashDirFiles(root: string, relDir: string, filter: (f: string) => boolean): ArtifactHash[] {
  const dir = join(root, relDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(filter)
    .sort()
    .map((f) => {
      const abs = join(dir, f);
      const buf = readFileSync(abs);
      return {
        path: `${relDir}/${f}`,
        sha256: createHash('sha256').update(buf).digest('hex'),
        bytes: buf.length,
      };
    });
}

export function collectArtifactHashes(root: string): ArtifactHashes {
  const registries = hashDirFiles(root, 'registries', (f) => f.endsWith('.json'));
  const contextManifests: ArtifactHashes['contextManifests'] = [];
  const distDir = join(root, 'packages', 'context', 'dist');
  if (existsSync(distDir)) {
    for (const brand of readdirSync(distDir).sort()) {
      const manifest = join(distDir, brand, 'manifest.json');
      if (!existsSync(manifest)) continue;
      let sourceHash: string | null = null;
      try {
        const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as { sourceHash?: string };
        sourceHash = parsed.sourceHash ?? null;
      } catch {
        // hash still recorded below
      }
      contextManifests.push({
        path: `packages/context/dist/${brand}/manifest.json`,
        sha256: sha256File(manifest),
        sourceHash,
      });
    }
  }
  const releaseArtifacts = hashDirFiles(
    root,
    'release-artifacts',
    (f) => f.endsWith('.tgz') || f === 'release-manifest.json',
  );
  return { registries, contextManifests, releaseArtifacts };
}

export interface ReproducibilityClaim {
  claim: string;
  /** Repo-relative test file that proves the claim. */
  test: string;
  /** Exact test title inside that file. */
  title: string;
  /** True only when the named title is present in the named file right now. */
  verified: boolean;
}

/**
 * The build-twice determinism claims, each tied to the test that enforces it.
 * Verification is structural: the generator greps the named file for the
 * named title; a missing test downgrades the claim to verified:false.
 */
const REPRODUCIBILITY_CLAIMS: Omit<ReproducibilityClaim, 'verified'>[] = [
  {
    claim: '@ds/context emits byte-identical output trees for identical inputs and the same --now.',
    test: 'packages/context/test/determinism.test.ts',
    title: 'same inputs + same --now produce byte-identical output trees',
  },
  {
    claim: 'The @ds/context manifest — hashes and timestamp included — is identical across builds.',
    test: 'packages/context/test/determinism.test.ts',
    title: 'the manifest (including hashes and timestamp) is identical across builds',
  },
  {
    claim: 'Emitted CSS custom properties and the token registry enumerate the identical closed world.',
    test: 'packages/tokens/test/tokens.test.ts',
    title: 'CSS custom properties and the registry enumerate the identical closed world',
  },
  {
    claim: 'Evidence packs themselves are byte-identical across runs given identical inputs and the same --now.',
    test: 'tooling/validate/test/evidence.test.ts',
    title: 'two runs with the same inputs and --now produce byte-identical packs',
  },
];

export function collectReproducibility(root: string): ReproducibilityClaim[] {
  return REPRODUCIBILITY_CLAIMS.map((c) => {
    const p = join(root, c.test);
    let verified = false;
    if (existsSync(p)) {
      try {
        verified = readFileSync(p, 'utf8').includes(c.title);
      } catch {
        verified = false;
      }
    }
    return { ...c, verified };
  });
}
