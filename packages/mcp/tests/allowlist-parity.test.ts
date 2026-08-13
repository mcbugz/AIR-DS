import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateUsage } from '../src/index.js';
import { realCatalog, realRegistry } from './helpers.js';

/**
 * F5 parity — MCP side. Byte-compares the generated copy of the shared
 * allowed-literal ruleset against its source of truth in @ds/validate, and
 * replays the SAME verdict corpus the gauntlet's parity test replays
 * (tooling/validate/config/allowlist-corpus.json) through validate_usage.
 * Any divergence between the two approvers fails here.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const SOURCE = join(REPO_ROOT, 'tooling', 'validate', 'src', 'rules', 'allowlist.ts');
const COPY = join(HERE, '..', 'src', 'generated', 'allowlist.ts');
const CORPUS = join(REPO_ROOT, 'tooling', 'validate', 'config', 'allowlist-corpus.json');

const registry = realRegistry();
const catalog = realCatalog();

interface CorpusEntry {
  property: string;
  value: string;
  verdict: 'allowed' | 'flagged';
  note?: string;
}

describe('generated allowlist copy', () => {
  it('is byte-identical to tooling/validate/src/rules/allowlist.ts (run pnpm --filter @ds/mcp sync:allowlist)', () => {
    // Monorepo-only check: a shipped standalone build has no source next door.
    if (!existsSync(SOURCE)) return;
    const source = readFileSync(SOURCE, 'utf8');
    const copy = readFileSync(COPY, 'utf8');
    const stripped = copy.replace(/^\/\* GENERATED FILE[\s\S]*?\*\/\n\n/, '');
    expect(stripped).toBe(source);
  });
});

describe('shared allowed-literal corpus — validate_usage verdicts', () => {
  const corpus = JSON.parse(readFileSync(CORPUS, 'utf8')) as { entries: CorpusEntry[] };

  it.each(corpus.entries.map((e) => [`${e.property}: ${e.value}`, e] as [string, CorpusEntry]))(
    '%s -> %s',
    (_label, entry) => {
      const result = validateUsage(registry, catalog, {
        code: '',
        css: `.x { ${entry.property}: ${entry.value}; }\n`,
      });
      const literalHits = result.violations.filter(
        (v) => v.rule === 'raw-value' || v.rule === 'NR-003',
      );
      if (entry.verdict === 'flagged') {
        expect(literalHits.length, `expected raw-value/NR-003 for ${entry.property}: ${entry.value}`).toBeGreaterThan(0);
      } else {
        expect(literalHits, `expected clean for ${entry.property}: ${entry.value}`).toHaveLength(0);
      }
      expect(result.violations.filter((v) => v.rule !== 'raw-value' && v.rule !== 'NR-003')).toHaveLength(0);
    },
  );
});
