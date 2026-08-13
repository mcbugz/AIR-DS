import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diffHashes, hashFiles, headFileHashes } from '../src/workspace.ts';

/**
 * F1 — G7 drift detection must compare against the COMMIT (git show HEAD:),
 * not the working tree: by the time registry-check runs, the gauntlet's build
 * step has already regenerated the files on disk, so a working-tree "before"
 * hash always equals the "after" hash and a stale committed registry passes.
 */

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.email=g7@test', '-c', 'user.name=g7', ...args], {
    cwd,
    stdio: 'pipe',
  });
}

function makeRepo(): { root: string; registry: string } {
  const root = mkdtempSync(join(tmpdir(), 'airds-g7-'));
  git(root, 'init', '-q');
  mkdirSync(join(root, 'registries'));
  const registry = join(root, 'registries', 'tokens-index.json');
  writeFileSync(registry, '{"tokens":[{"cssVar":"--ds-color-text-primary"}]}\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'commit generated registry');
  return { root, registry };
}

describe('headFileHashes (G7 before-state from git show HEAD:)', () => {
  it('matches the disk hash when HEAD and disk agree', () => {
    const { root, registry } = makeRepo();
    const head = headFileHashes(root, [registry]);
    expect(head).not.toBeNull();
    expect(head!.untracked).toHaveLength(0);
    expect(head!.hashes.get(registry)).toBe(hashFiles([registry]).get(registry));
  });

  it('detects a stale COMMITTED registry: HEAD differs from regenerated disk state', () => {
    const { root, registry } = makeRepo();
    // The commit holds the stale content; the "generator" then writes fresh
    // content to disk (this is the state after gauntlet step 3).
    const head = headFileHashes(root, [registry]);
    writeFileSync(registry, '{"tokens":[{"cssVar":"--ds-color-text-primary"},{"cssVar":"--ds-color-text-muted"}]}\n');
    const after = hashFiles([registry]);
    const drift = diffHashes(head!.hashes, after);
    expect(drift).toEqual([registry]);
  });

  it('the OLD working-tree-before scheme would have missed exactly that (before==after)', () => {
    const { root, registry } = makeRepo();
    writeFileSync(registry, '{"tokens":[]}\n'); // regenerated BEFORE hashing, as in the gauntlet
    const before = hashFiles([registry]); // old scheme: working tree, post-rebuild
    const after = hashFiles([registry]);
    expect(diffHashes(before, after)).toEqual([]); // silent pass — the F1 bug
    const head = headFileHashes(root, [registry]);
    expect(diffHashes(head!.hashes, after)).toEqual([registry]); // new scheme catches it
  });

  it('reports files not tracked at HEAD as untracked (warn-skip, not drift)', () => {
    const { root } = makeRepo();
    const fresh = join(root, 'registries', 'components-index.json');
    writeFileSync(fresh, '{"components":[]}\n');
    const head = headFileHashes(root, [fresh]);
    expect(head!.untracked).toEqual([fresh]);
    expect(head!.hashes.has(fresh)).toBe(false);
  });

  it('returns null outside a git work tree (caller warn-skips)', () => {
    const bare = mkdtempSync(join(tmpdir(), 'airds-nogit-'));
    const file = join(bare, 'x.json');
    writeFileSync(file, '{}\n');
    expect(headFileHashes(bare, [file])).toBeNull();
  });
});
