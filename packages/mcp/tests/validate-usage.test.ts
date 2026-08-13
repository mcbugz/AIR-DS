/**
 * validate_usage catches every NR class in docs/specs/negative-rules.md.
 *
 * The wrong→right pairs are PARSED from the catalog file at test time — not
 * copied into this file — so the suite fails if the catalog and the validator
 * drift apart. Each rule has a builder that wraps the catalog's raw snippets
 * into a { code, css } input the way an agent would emit them.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { parseNegativeRules, validateUsage } from '../src/index.js';
import type { NegativeRule, Registry, ValidateInput } from '../src/index.js';
import { NEGATIVE_RULES_FILE, expandTokenGlob, realCatalog, realRegistry } from './helpers.js';

const registry = realRegistry();
const catalog = realCatalog();
const parsed = parseNegativeRules(readFileSync(NEGATIVE_RULES_FILE, 'utf8'), NEGATIVE_RULES_FILE);

function run(input: ValidateInput) {
  return validateUsage(registry, catalog, input);
}

function rulesHit(input: ValidateInput): string[] {
  return run(input).violations.map((v) => v.rule);
}

/** Replace any `--ds-…-*` glob in a catalog snippet with a real registry token. */
function deglob(snippet: string, reg: Registry): string {
  return snippet.replace(/--ds-[a-z0-9-]*\*/g, (glob) => expandTokenGlob(reg, glob));
}

type PairBuilder = {
  /** wrap each Wrong code span into validator input(s) */
  wrong: (rule: NegativeRule) => ValidateInput[];
  /** wrap each Right code span into validator input(s) that must NOT trigger the rule */
  right: (rule: NegativeRule) => ValidateInput[];
};

const css = (text: string): ValidateInput => ({ code: '', css: text });
const code = (text: string): ValidateInput => ({ code: text });

const builders: Record<string, PairBuilder> = {
  'NR-001': {
    wrong: (r) => r.wrongSnippets.map((s) => code(s)),
    right: (r) => r.rightSnippets.filter((s) => s.includes(':')).map((s) => css(s)),
  },
  'NR-002': {
    wrong: (r) => r.wrongSnippets.map((s) => code(s)),
    right: (r) => [
      {
        code: r.rightSnippets.filter((s) => s.startsWith('<')).join(''),
        css: `font-size: var(${deglob('--ds-text-size-*', registry)});`,
      },
    ],
  },
  'NR-003': {
    wrong: (r) => r.wrongSnippets.map((s) => css(`color: ${s};`)),
    right: (r) => r.rightSnippets.filter((s) => s.startsWith('var(')).map((s) => css(`color: ${s};`)),
  },
  'NR-004': {
    wrong: (r) => r.wrongSnippets.map((s) => code(`<div ${s} />`)),
    right: () => [
      {
        code: '<div className={styles.card} />',
        css: '.card { color: var(--ds-color-text-primary); }',
      },
    ],
  },
  'NR-005': {
    wrong: (r) => r.wrongSnippets.filter((s) => s.startsWith('import')).map((s) => code(s)),
    right: (r) => r.rightSnippets.filter((s) => s.startsWith('import')).map((s) => code(s)),
  },
  'NR-006': {
    wrong: (r) => r.wrongSnippets.map((s) => css(`${s};`)),
    right: (r) =>
      r.rightSnippets
        .filter((s) => s.startsWith('var('))
        .map((s) => css(`inline-size: ${s};`)),
  },
  'NR-007': {
    wrong: (r) => r.wrongSnippets.map((s) => css(`color: ${s};`)),
    right: (r) => r.rightSnippets.filter((s) => s.startsWith('var(')).map((s) => css(`color: ${s};`)),
  },
  'NR-008': {
    // catalog context: the wrong snippet appears inside Badge.module.css
    wrong: (r) =>
      r.wrongSnippets.map((s) => css(`.badge { background: ${s}; }`)),
    right: (r) =>
      r.rightSnippets
        .filter((s) => s.startsWith('--ds-'))
        .map((s) => css(`.badge { background: var(${deglob(s, registry)}); }`)),
  },
  'NR-009': {
    wrong: (r) =>
      r.wrongSnippets.map((s) => css(`${s} { color: var(--ds-color-text-primary); }`)),
    right: (r) =>
      r.rightSnippets
        .filter((s) => s.startsWith('.') || s.startsWith('['))
        .map((s) => css(`${s} { color: var(--ds-color-text-primary); }`)),
  },
  'NR-010': {
    // The kebab detection is registry-driven (kebab of a REGISTERED
    // CamelCase component). The catalog's example ProgressBar is not in this
    // registry build, so kebab wrong-snippets are exercised through a
    // registered multi-hump component's kebab form instead.
    wrong: (r) =>
      r.wrongSnippets
        .filter((s) => s.startsWith('.'))
        .map((s) => (s.includes('-') ? kebabOfRegisteredComponent() : s))
        .map((s) => css(`${s} { gap: var(--ds-space-gap-sm); }`)),
    right: (r) =>
      r.rightSnippets
        .filter((s) => s.startsWith('.'))
        .map((s) => css(`${s} { gap: var(--ds-space-gap-sm); }`)),
  },
  'NR-011': {
    // Right bullet carries no code spans — inputs are built structurally:
    // a styles.<x> reference against a stylesheet that does/does not define x.
    wrong: () => [
      {
        code: '<span className={styles.message}>Saved</span>',
        css: '.chip { color: var(--ds-color-text-primary); }',
      },
    ],
    right: () => [
      {
        code: '<span className={styles.message}>Saved</span>',
        css: '.chip { color: var(--ds-color-text-primary); }\n.message { color: var(--ds-color-text-secondary); }',
      },
    ],
  },
  'NR-012': {
    wrong: (r) =>
      r.wrongSnippets.filter((s) => s.includes('z-index')).map((s) => css(s)),
    right: (r) =>
      r.rightSnippets.filter((s) => s.startsWith('style=')).map((s) => code(`<div ${s} />`)),
  },
  'NR-013': {
    // Catalog spans are prose fragments; inputs are built structurally.
    wrong: () => [
      css(
        '.spinner { animation: spin var(--ds-motion-duration-slow) linear infinite; }\n@keyframes spin { to { rotate: 360deg; } }',
      ),
      css(
        '.drawer { transition: transform var(--ds-motion-duration-fast) var(--ds-motion-easing-standard); }',
      ),
    ],
    right: () => [
      css(
        '.spinner { animation: spin var(--ds-motion-duration-slow) linear infinite; }\n@keyframes spin { to { rotate: 360deg; } }\n@media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }',
      ),
      css('.chip { transition: background-color var(--ds-motion-duration-fast) var(--ds-motion-easing-standard); }'),
    ],
  },
};

/** Kebab form of a registered multi-hump component (e.g. IconButton -> .icon-button). */
function kebabOfRegisteredComponent(): string {
  const comp = registry.components.components.find((c) =>
    /[a-z0-9][A-Z]/.test(c.name),
  );
  if (!comp) throw new Error('no multi-hump component registered');
  return `.${comp.name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;
}

describe('negative-rule catalog sync', () => {
  it('parses the catalog with wrong→right pairs for every rule', () => {
    expect(parsed.rules.size).toBeGreaterThan(0);
    for (const rule of parsed.rules.values()) {
      expect(rule.wrong.length).toBeGreaterThan(0);
      expect(rule.right.length).toBeGreaterThan(0);
    }
    expect(parsed.preamble).toMatch(/closed-world/);
  });

  it('has a validator wiring for EVERY rule in the catalog (fails when a new NR lands unwired)', () => {
    for (const id of parsed.rules.keys()) {
      expect(builders[id], `missing validate_usage wiring/test builder for ${id}`).toBeDefined();
    }
  });

  for (const [id, builder] of Object.entries(builders)) {
    describe(id, () => {
      it('flags each Wrong snippet from the catalog', () => {
        const rule = parsed.rules.get(id);
        expect(rule, `${id} missing from catalog`).toBeDefined();
        const inputs = builder.wrong(rule!);
        expect(inputs.length).toBeGreaterThan(0);
        for (const input of inputs) {
          expect(rulesHit(input), `${id} not flagged for ${JSON.stringify(input)}`).toContain(id);
        }
      });

      it('passes each paired Right snippet', () => {
        const rule = parsed.rules.get(id);
        const inputs = builder.right(rule!);
        expect(inputs.length).toBeGreaterThan(0);
        for (const input of inputs) {
          expect(rulesHit(input), `${id} wrongly flagged for ${JSON.stringify(input)}`).not.toContain(id);
        }
      });

      it('carries the catalog wrong→right text in the violation message', () => {
        const rule = parsed.rules.get(id)!;
        const input = builder.wrong(rule)[0]!;
        const violation = run(input).violations.find((v) => v.rule === id)!;
        expect(violation.message).toContain(rule.title);
        expect(violation.fix.length).toBeGreaterThan(0);
      });
    });
  }
});

describe('validate_usage — registry checks beyond the NR catalog', () => {
  it('accepts a fully legal snippet', () => {
    const result = run({
      code: "import { Button, Card } from '@ds/react';\nexport const X = () => <Card><Button variant=\"primary\">Save</Button></Card>;",
      css: '.card { padding: var(--ds-card-padding); background: var(--ds-card-surface); }',
    });
    expect(result.violations).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('flags fabricated tokens with nearest suggestions (closed world)', () => {
    const result = run({ code: '', css: 'color: var(--ds-color-text-primry);' });
    expect(result.valid).toBe(false);
    const violation = result.violations.find((v) => v.rule === 'unknown-token');
    expect(violation).toBeDefined();
    expect(violation!.message).toContain('--ds-color-text-primary');
  });

  it('flags unregistered component imports with nearest suggestions', () => {
    const result = run({ code: "import { Buttn } from '@ds/react';" });
    const violation = result.violations.find((v) => v.rule === 'unknown-component');
    expect(violation).toBeDefined();
    expect(violation!.message).toContain('Button');
  });

  it('flags raw px literals but allows the CLAUDE.md allowlist, angles, and --trigger-width', () => {
    const bad = run({ code: '', css: '.button { padding: 12px; }' });
    expect(bad.violations.some((v) => v.rule === 'raw-value')).toBe(true);

    const good = run({
      code: '',
      css: [
        '.select {',
        '  inline-size: var(--trigger-width);',
        '  margin: 0;',
        '  max-inline-size: 100%;',
        '  background: transparent;',
        '  transform: rotate(45deg) rotate(1turn);',
        '  border: none;',
        '  color: currentColor;',
        '}',
      ].join('\n'),
    });
    expect(good.violations).toEqual([]);
  });

  it('flags every var(--ds-*) that is not in the token registry, in code as well as css', () => {
    const result = run({
      code: "const style = 'var(--ds-totally-made-up)';",
    });
    expect(result.valid).toBe(false);
    expect(result.violations[0]!.rule).toBe('unknown-token');
  });

  it('reports multiple violations at once', () => {
    const result = run({
      code: "import Button from '@ds/react/dist/Button';\nconst x = <Stack gap=\"md\"><Heading level={2}>Hi</Heading></Stack>;",
      css: '.root:hover { height: var(--ds-space-6); color: #dc2626; }',
    });
    const hit = new Set(result.violations.map((v) => v.rule));
    for (const id of ['NR-001', 'NR-002', 'NR-005', 'NR-006', 'NR-009', 'NR-010', 'NR-003']) {
      expect(hit, `expected ${id} in ${[...hit].join(',')}`).toContain(id);
    }
  });
});
