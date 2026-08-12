import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRegistryContext } from '../src/registry.ts';
import { validateSources } from '../src/validate.ts';
import type { RegistryContext, SourceFile } from '../src/types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const MINI = join(HERE, 'fixtures', 'mini');

/** Hermetic registry snapshot — rules are tested against a frozen contract,
 * never the live registries (sibling builds regenerate those mid-flight). */
function fixtureRegistry(): RegistryContext {
  const raw = JSON.parse(
    readFileSync(join(REPO_ROOT, 'evals', 'registry-fixture.json'), 'utf8'),
  ) as { 'tokens-index': { tokens: never[] }; 'components-index': { components: never[] } };
  return buildRegistryContext(raw['tokens-index'], raw['components-index']);
}

const ctx = fixtureRegistry();

function load(rel: string): SourceFile {
  const path = join(MINI, rel);
  return { path, content: readFileSync(path, 'utf8') };
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

describe('seeded violations are caught (bad fixture -> expected rule)', () => {
  const cases: [string, string, string | null][] = [
    // [fixture, expected primary rule, expected NR mapping (or null)]
    ['bad/css/G1.module.css', 'G1', null],
    ['bad/css/G2-hex.module.css', 'G2', 'NR-003'],
    ['bad/css/G2-px.module.css', 'G2', null],
    ['bad/css/G2-font.module.css', 'G2', null],
    ['bad/css/G2-custom-prop.module.css', 'G2', null],
    ['bad/css/G2-unitless.module.css', 'G2', null],
    ['bad/css/G3-space-as-size.module.css', 'G3', 'NR-006'],
    ['bad/css/G3-radius.module.css', 'G3', null],
    ['bad/css/G3-motion.module.css', 'G3', null],
    ['bad/components/Badge/Badge.module.css', 'G6', 'NR-008'],
    ['bad/css/G8.module.css', 'G8', 'NR-009'],
    ['bad/components/Card/Card.module.css', 'NR-010', 'NR-010'],
    ['bad/code/G5.tsx', 'G5', null],
    ['bad/code/NR-001.tsx', 'G5', 'NR-001'],
    ['bad/code/NR-002.tsx', 'G5', 'NR-002'],
    ['bad/code/NR-004.tsx', 'NR-004', 'NR-004'],
    ['bad/code/NR-005.tsx', 'NR-005', 'NR-005'],
    ['bad/code/G1-inline-style.tsx', 'G1', null],
  ];

  it.each(cases)('%s -> %s', (fixture, rule, nr) => {
    const result = validateSources([load(fixture)], ctx);
    expect(result.ok).toBe(false);
    const hit = result.violations.find((v) => v.rule === rule && (nr === null || v.nr === nr));
    expect(hit, `expected a ${rule}${nr ? `/${nr}` : ''} violation, got: ${JSON.stringify(result.violations)}`).toBeTruthy();
  });

  it('G8 flags all three pseudo-class states', () => {
    const result = validateSources([load('bad/css/G8.module.css')], ctx);
    expect(result.violations.filter((v) => v.rule === 'G8')).toHaveLength(3);
  });

  it('NR-006 fires for every space-token dimension', () => {
    const result = validateSources([load('bad/css/G3-space-as-size.module.css')], ctx);
    expect(result.violations.filter((v) => v.nr === 'NR-006')).toHaveLength(2);
  });
});

describe('clean twins pass (good fixtures produce zero violations)', () => {
  const goodFiles = walk(join(MINI, 'good'));

  it.each(goodFiles.map((f) => [f.slice(MINI.length + 1)] as [string]))('%s', (rel) => {
    const result = validateSources([load(rel)], ctx);
    expect(result.violations, JSON.stringify(result.violations, null, 2)).toHaveLength(0);
  });

  it('whole good mini-package validates in one pass', () => {
    const files = goodFiles.map((f) => ({ path: f, content: readFileSync(f, 'utf8') }));
    expect(validateSources(files, ctx).ok).toBe(true);
  });
});

describe('rule specifics', () => {
  it('G1 maps raw palette fabrications to NR-003 and on-status fabrications to NR-007', () => {
    const css = {
      path: 'x/App.module.css',
      content: '.a { color: var(--ds-blue-500); background: var(--ds-color-text-on-danger); }\n',
    };
    const vio = validateSources([css], ctx).violations;
    expect(vio.some((v) => v.rule === 'G1' && v.nr === 'NR-003')).toBe(true);
    expect(vio.some((v) => v.rule === 'G1' && v.nr === 'NR-007')).toBe(true);
  });

  it('shared field namespace is legal for TextField/TextArea/Select but not others', () => {
    const mk = (comp: string) => ({
      path: `packages/react/src/components/${comp}/${comp}.module.css`,
      content: `.${comp.toLowerCase()} { block-size: var(--ds-field-height); }\n`,
    });
    expect(validateSources([mk('TextField')], ctx).ok).toBe(true);
    expect(validateSources([mk('Select')], ctx).ok).toBe(true);
    const badge = validateSources([mk('Badge')], ctx);
    expect(badge.violations.some((v) => v.rule === 'G6' && v.nr === 'NR-008')).toBe(true);
  });

  it('IconButton may consume the button hook namespace', () => {
    const css = {
      path: 'packages/react/src/components/IconButton/IconButton.module.css',
      content: '.iconbutton { border-radius: var(--ds-button-radius); }\n',
    };
    expect(validateSources([css], ctx).ok).toBe(true);
  });

  it('subcomponent namespaces are legal in their parent directory (Radio in RadioGroup/)', () => {
    // 'radio' must be a component-tier segment for this test to be meaningful;
    // simulate it since the frozen fixture may predate the radio hooks.
    const radioCtx = { ...ctx, componentSegments: new Set([...ctx.componentSegments, 'radio']) };
    const parent = {
      path: 'packages/react/src/components/RadioGroup/RadioGroup.module.css',
      content: '.radio { inline-size: var(--ds-radio-size); }\n',
    };
    const radioVio = validateSources([parent], radioCtx).violations.filter((v) => v.rule === 'G6');
    expect(radioVio).toHaveLength(0);
    const thief = {
      path: 'packages/react/src/components/Badge/Badge.module.css',
      content: '.badge { inline-size: var(--ds-radio-size); }\n',
    };
    const theft = validateSources([thief], radioCtx).violations.filter((v) => v.rule === 'G6');
    expect(theft).toHaveLength(1);
  });

  it('non-component CSS may not consume any component hook namespace', () => {
    const css = {
      path: 'src/app/Shell.module.css',
      content: '.shell { background-color: var(--ds-card-surface); }\n',
    };
    const vio = validateSources([css], ctx).violations;
    expect(vio.some((v) => v.rule === 'G6' && v.nr === 'NR-008')).toBe(true);
  });

  it('wildcard token mentions in comments/prose are not G1 violations', () => {
    const code = {
      path: 'src/doc.ts',
      content: '// customers override --ds-button-* and --ds-alert-* hooks\nexport {};\n',
    };
    expect(validateSources([code], ctx).ok).toBe(true);
  });

  it('@ds/tokens/css subpath import is legal (documented public export)', () => {
    const code = { path: 'src/main.tsx', content: "import '@ds/tokens/css';\nexport {};\n" };
    expect(validateSources([code], ctx).ok).toBe(true);
  });
});
