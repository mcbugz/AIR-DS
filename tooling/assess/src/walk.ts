/**
 * Local filesystem walker. Reads NOTHING outside the given root, makes no
 * network calls, needs no credentials. Collects a flat file inventory once;
 * probes filter it and lazily read contents through a shared cache.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Directories never worth scanning (VCS internals, dependency stores). */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  '.turbo',
  '.cache',
  '.pnpm-store',
  '.yarn',
  '.venv',
  '__pycache__',
]);

/** Path segments that mark GENERATED output (excluded from style sampling). */
const GENERATED_SEGS = new Set([
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.output',
  'storybook-static',
  'coverage',
  'public',
  'vendor',
  'generated',
  '__generated__',
  'release-artifacts',
]);

/** Path segments that mark TEST/FIXTURE/DEMO material (not shipped styles). */
const TEST_SEGS = new Set([
  'test',
  'tests',
  '__tests__',
  '__mocks__',
  'fixture',
  'fixtures',
  '__fixtures__',
  'e2e',
  'spec',
  'specs',
  'benchmark',
  'benchmarks',
  'benchmark-results',
  'recordings',
  'example',
  'examples',
  'demo',
  'demos',
  'sample',
  'samples',
  '.axe-harness',
]);

const MAX_FILES = 60_000;
const MAX_READ_BYTES = 2_000_000;

export interface RepoFile {
  /** Absolute path. */
  abs: string;
  /** Root-relative path with forward slashes. */
  rel: string;
  /** Basename. */
  base: string;
  /** Extension including dot, lowercased ('' when none). */
  ext: string;
  /** Directory segments of rel (excluding basename). */
  segs: string[];
  size: number;
}

export function isGenerated(f: RepoFile): boolean {
  return f.segs.some((s) => GENERATED_SEGS.has(s));
}

export function isTestish(f: RepoFile): boolean {
  return (
    f.segs.some((s) => TEST_SEGS.has(s)) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(f.base) ||
    /\.stories\.[cm]?[jt]sx?$/.test(f.base)
  );
}

export class RepoScan {
  readonly root: string;
  readonly files: RepoFile[];
  /** True when the walk hit the file cap and the inventory is partial. */
  readonly truncated: boolean;
  private readonly contents = new Map<string, string | null>();

  constructor(root: string) {
    this.root = path.resolve(root);
    const files: RepoFile[] = [];
    let truncated = false;
    const stack: string[] = [this.root];
    while (stack.length > 0) {
      const dir = stack.pop() as string;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue; // never follow links out of the root
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!SKIP_DIRS.has(entry.name)) stack.push(abs);
          continue;
        }
        if (!entry.isFile()) continue;
        if (files.length >= MAX_FILES) {
          truncated = true;
          continue;
        }
        let size = 0;
        try {
          size = fs.statSync(abs).size;
        } catch {
          continue;
        }
        const rel = path.relative(this.root, abs).split(path.sep).join('/');
        const base = entry.name;
        const dot = base.lastIndexOf('.');
        files.push({
          abs,
          rel,
          base,
          ext: dot > 0 ? base.slice(dot).toLowerCase() : '',
          segs: rel.split('/').slice(0, -1),
          size,
        });
      }
    }
    files.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
    this.files = files;
    this.truncated = truncated;
  }

  /** Files whose extension is in `exts` (dots included, lowercase). */
  byExt(...exts: string[]): RepoFile[] {
    const set = new Set(exts);
    return this.files.filter((f) => set.has(f.ext));
  }

  /** Files whose basename matches `re`. */
  byBase(re: RegExp): RepoFile[] {
    return this.files.filter((f) => re.test(f.base));
  }

  /** Read a file as UTF-8 (cached). Returns null for oversized/unreadable files. */
  read(f: RepoFile): string | null {
    const hit = this.contents.get(f.abs);
    if (hit !== undefined) return hit;
    let text: string | null = null;
    if (f.size <= MAX_READ_BYTES) {
      try {
        text = fs.readFileSync(f.abs, 'utf8');
      } catch {
        text = null;
      }
    }
    this.contents.set(f.abs, text);
    return text;
  }

  /** Parse a JSON file; null on read/parse failure. */
  json(f: RepoFile): unknown {
    const text = this.read(f);
    if (text === null) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  }
}
