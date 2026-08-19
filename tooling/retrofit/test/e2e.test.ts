/** End-to-end: ds-retrofit over the committed legacy-ds fixture, including
 *  the @ds/context invocation, determinism, and graceful undetectable repos. */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { runRetrofit } from '../src/pipeline.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '../../..');
const FIXTURE = join(REPO, 'examples/legacy-ds');
const NOW = '2026-08-19T00:00:00.000Z';

const tmp = mkdtempSync(join(tmpdir(), 'retrofit-e2e-'));
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('fixture end-to-end (with context compilation)', () => {
  const outDir = join(tmp, 'out');
  const result = runRetrofit(FIXTURE, { outDir, now: NOW });

  it('fires the css + tailwind + component adapters', () => {
    expect(result.detected).toBe(true);
    expect(result.detection.css).toEqual(['styles/atlas.css']);
    expect(result.detection.tailwind).toBe('tailwind.config.js');
    expect(result.detection.dtcg).toEqual([]);
    expect(result.tokensIndex?.count).toBe(44);
    expect(result.componentsIndex?.components).toHaveLength(4);
  });

  it('emits the full artifact set', () => {
    for (const rel of [
      'registries/tokens-index.json',
      'registries/components-index.json',
      'registries/contrast-report.json',
      'brand/meridian-atlas-ui.json',
      'gauntlet.config.json',
      'tailwind-mapping.json',
      'retrofit-report.json',
      'RETROFIT.md',
    ]) {
      expect(existsSync(join(outDir, rel)), `missing ${rel}`).toBe(true);
    }
  });

  it('compiles the @ds/context bundle from the synthesized registries', () => {
    expect(result.contextStatus).toBe('emitted');
    for (const rel of [
      'context/llms.txt',
      'context/llms-components.txt',
      'context/llms-tokens.txt',
      'context/manifest.json',
      'context/AGENTS.md',
      'context/docs/Button.md',
      'context/skills/use-system/SKILL.md',
      'context/editor/cursor/.cursor/rules/ds.mdc',
      'context/registries/tokens-index.json',
    ]) {
      expect(existsSync(join(outDir, rel)), `missing ${rel}`).toBe(true);
    }
    // byte-copies: the bundle ships the SAME synthesized registries
    expect(readFileSync(join(outDir, 'context/registries/tokens-index.json'), 'utf8')).toBe(
      readFileSync(join(outDir, 'registries/tokens-index.json'), 'utf8'),
    );
  });

  it('flags the fixture hardcoded color sins with file:line provenance', () => {
    expect(result.hardcoded.length).toBeGreaterThanOrEqual(4);
    expect(result.hardcoded.every((h) => h.source === 'styles/atlas.css' && h.line > 0)).toBe(true);
  });

  it('gauntlet starter enforces the closed-world checks', () => {
    const gauntlet = JSON.parse(readFileSync(join(outDir, 'gauntlet.config.json'), 'utf8'));
    const g1 = gauntlet.rules.find((r: { id: string }) => r.id === 'G1-closed-world-tokens');
    expect(g1.applies).toBe('enforce');
    expect(g1.config.registry).toBe('registries/tokens-index.json');
    const g5 = gauntlet.rules.find((r: { id: string }) => r.id === 'G5-closed-world-components');
    expect(g5.applies).toBe('enforce');
    expect(g5.config.components).toEqual(['Banner', 'Button', 'Card', 'Input']);
    // Tailwind detected -> utility-class rule must be off with a reason
    const nr4 = gauntlet.rules.find((r: { id: string }) => r.id === 'NR-004-utility-classes');
    expect(nr4.applies).toBe('off');
    expect(typeof nr4.reason).toBe('string');
  });

  it('is deterministic: re-running with the same inputs and --now is byte-identical', () => {
    // Same outdir on purpose: absolute out/brand paths are recorded in the
    // emitted registries/manifest, so determinism is defined per destination.
    const before = treeDigest(outDir, outDir);
    runRetrofit(FIXTURE, { outDir, now: NOW });
    const after = treeDigest(outDir, outDir);
    expect(after).toEqual(before);
  });
});

describe('graceful behavior on undetectable repos', () => {
  it('writes an explanatory report and skips registries/context', () => {
    const emptyRepo = join(tmp, 'empty-repo');
    mkdirSync(emptyRepo, { recursive: true });
    writeFileSync(join(emptyRepo, 'README.txt'), 'nothing here');
    const outDir = join(tmp, 'empty-out');
    const result = runRetrofit(emptyRepo, { outDir });
    expect(result.detected).toBe(false);
    expect(result.contextStatus).toBe('skipped');
    expect(existsSync(join(outDir, 'RETROFIT.md'))).toBe(true);
    expect(existsSync(join(outDir, 'registries'))).toBe(false);
    const md = readFileSync(join(outDir, 'RETROFIT.md'), 'utf8');
    expect(md).toMatch(/Nothing detected/);
    expect(md).toMatch(/Next steps/);
  });

  it('throws a clear error for a missing path', () => {
    expect(() => runRetrofit(join(tmp, 'does-not-exist'), { outDir: join(tmp, 'x') })).toThrow(/not found/);
  });
});

/** rel path -> file contents for every file under dir (deterministic). */
function treeDigest(root: string, dir: string): Array<[string, string]> {
  const acc: Array<[string, string]> = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d).sort()) {
      const abs = join(d, entry);
      if (statSync(abs).isDirectory()) walk(abs);
      else acc.push([abs.slice(root.length), readFileSync(abs, 'utf8')]);
    }
  };
  walk(dir);
  return acc;
}
