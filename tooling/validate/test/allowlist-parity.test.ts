import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRegistryContext } from '../src/registry.ts';
import { checkCssFile } from '../src/rules/css-rules.ts';
import type { RegistryContext } from '../src/types.ts';

/**
 * F5 parity — gauntlet side. The shared verdict corpus
 * (config/allowlist-corpus.json) is replayed through checkCssFile; the twin
 * test in packages/mcp/tests/allowlist-parity.test.ts replays the SAME file
 * through validate_usage and byte-compares @ds/mcp's generated copy of
 * rules/allowlist.ts against the source of truth. Together they prove both
 * approvers return identical literal verdicts.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

interface CorpusEntry {
  property: string;
  value: string;
  verdict: 'allowed' | 'flagged';
  note?: string;
}

const corpus = JSON.parse(
  readFileSync(join(HERE, '..', 'config', 'allowlist-corpus.json'), 'utf8'),
) as { entries: CorpusEntry[] };

function fixtureRegistry(): RegistryContext {
  const raw = JSON.parse(
    readFileSync(join(REPO_ROOT, 'evals', 'registry-fixture.json'), 'utf8'),
  ) as { 'tokens-index': { tokens: never[] }; 'components-index': { components: never[] } };
  return buildRegistryContext(raw['tokens-index'], raw['components-index']);
}

const ctx = fixtureRegistry();

describe('shared allowed-literal corpus — gauntlet verdicts', () => {
  it.each(corpus.entries.map((e) => [`${e.property}: ${e.value}`, e] as [string, CorpusEntry]))(
    '%s -> %s',
    (_label, entry) => {
      const cssText = `.x { ${entry.property}: ${entry.value}; }\n`;
      const violations = checkCssFile('corpus/App.module.css', cssText, ctx);
      const literalHits = violations.filter((v) => v.rule === 'G2');
      if (entry.verdict === 'flagged') {
        expect(literalHits.length, `expected G2 for ${entry.property}: ${entry.value}`).toBeGreaterThan(0);
      } else {
        expect(literalHits, `expected clean for ${entry.property}: ${entry.value}`).toHaveLength(0);
      }
      // Corpus entries must not trip unrelated rules — the corpus isolates
      // the literal ruleset.
      expect(violations.filter((v) => v.rule !== 'G2')).toHaveLength(0);
    },
  );
});

describe('generated copy in @ds/mcp is byte-identical to the source of truth', () => {
  it('packages/mcp/src/generated/allowlist.ts matches rules/allowlist.ts (run pnpm --filter @ds/mcp sync:allowlist)', () => {
    const source = readFileSync(join(HERE, '..', 'src', 'rules', 'allowlist.ts'), 'utf8');
    const copyPath = join(REPO_ROOT, 'packages', 'mcp', 'src', 'generated', 'allowlist.ts');
    expect(existsSync(copyPath), `missing generated copy at ${copyPath}`).toBe(true);
    const copy = readFileSync(copyPath, 'utf8');
    const stripped = copy.replace(/^\/\* GENERATED FILE[\s\S]*?\*\/\n\n/, '');
    expect(stripped).toBe(source);
  });
});
