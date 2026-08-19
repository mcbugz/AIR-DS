/**
 * Probe unit tests over synthetic mini-repos written to a temp dir, plus
 * pure-function units for the CSS declaration scanner and scoring math.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { countScssVarRefs, countVarRefs, cssDecls } from '../src/css-scan.ts';
import { probeComponents } from '../src/probes/components.ts';
import { probeEnforcement } from '../src/probes/enforcement.ts';
import { probeFabrication } from '../src/probes/fabrication.ts';
import { probeMachineSurface } from '../src/probes/machine-surface.ts';
import { probeRegistries } from '../src/probes/registries.ts';
import { probeTokens, RAW_SCALE_RE } from '../src/probes/tokens.ts';
import { probeWhiteLabel } from '../src/probes/whitelabel.ts';
import { gradeOf, PILLARS, CHECKS } from '../src/scoring.ts';
import { GAP_CATALOG } from '../src/catalog.ts';
import { RepoScan } from '../src/walk.ts';

const tmpRoots: string[] = [];

function mkRepo(files: Record<string, string>): RepoScan {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-assess-probe-'));
  tmpRoots.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return new RepoScan(root);
}

afterAll(() => {
  for (const root of tmpRoots) fs.rmSync(root, { recursive: true, force: true });
});

describe('rubric invariants', () => {
  it('pillar weights sum to 100', () => {
    expect(PILLARS.reduce((s, p) => s + p.weight, 0)).toBe(100);
  });

  it('check weights sum to 100 within every pillar', () => {
    for (const p of PILLARS) {
      const sum = CHECKS.filter((c) => c.pillar === p.id).reduce((s, c) => s + c.weight, 0);
      expect(sum, p.id).toBe(100);
    }
  });

  it('every check has gap framing (risk + closing capability)', () => {
    for (const c of CHECKS) {
      const framing = GAP_CATALOG[c.id];
      expect(framing, c.id).toBeDefined();
      expect(framing?.risk.length).toBeGreaterThan(20);
      expect(framing?.closedBy).toMatch(/AIR-DS/);
    }
  });

  it('grades band correctly', () => {
    expect(gradeOf(95)).toBe('A');
    expect(gradeOf(90)).toBe('A');
    expect(gradeOf(85)).toBe('B');
    expect(gradeOf(72)).toBe('C');
    expect(gradeOf(61)).toBe('D');
    expect(gradeOf(10)).toBe('F');
  });
});

describe('css-scan', () => {
  it('iterates declarations and skips media-query preludes', () => {
    const decls = cssDecls(
      '@media (min-width: 768px) { .a { color: #fff; padding: var(--ds-space-2); } }',
    );
    const props = decls.map((d) => d.prop);
    expect(props).not.toContain('min-width');
    expect(props).toContain('color');
    expect(countVarRefs(decls.find((d) => d.prop === 'padding')?.value ?? '')).toBe(1);
  });

  it('counts scss variables', () => {
    expect(countScssVarRefs('solid $border-color $x')).toBe(2);
  });

  it('recognizes raw-scale names', () => {
    expect(RAW_SCALE_RE.test('--blue-500')).toBe(true);
    expect(RAW_SCALE_RE.test('--ds-palette-primary-600')).toBe(true);
    expect(RAW_SCALE_RE.test('--ds-color-surface-raised')).toBe(false);
    expect(RAW_SCALE_RE.test('--acme-blue')).toBe(false);
  });
});

describe('token probe', () => {
  it('detects DTCG source, css vars, prefix consistency, and registry', () => {
    const tokens = Array.from({ length: 25 }, (_, i) => ({
      name: `t${i}`,
      value: `#00000${i % 10}`,
    }));
    const scan = mkRepo({
      'tokens/color.json': JSON.stringify({
        color: { a: { $value: '#fff' }, b: { $value: '#000' }, c: { $value: '#111' } },
      }),
      'dist/tokens.css': `:root{${Array.from({ length: 30 }, (_, i) => `--ds-x-${i}: 1px;`).join('')}}`,
      'registry/tokens-index.json': JSON.stringify({ tokens }),
      'package.json': JSON.stringify({ name: 'my-tokens', scripts: { build: 'x' } }),
    });
    const t = probeTokens(scan);
    expect(t.dtcgTokenCount).toBe(3);
    expect(t.tokenPackage).toBe('package.json');
    expect(t.cssVarNames.length).toBe(30);
    expect(t.dominantPrefix?.prefix).toBe('ds');
    expect(t.dominantPrefix?.share).toBe(1);
    expect(probeRegistries(scan).tokenRegistry?.entries).toBe(25);
  });

  it('tolerates absence of everything', () => {
    const scan = mkRepo({ 'README.md': 'hi' });
    const t = probeTokens(scan);
    expect(t.dtcgTokenCount).toBe(0);
    expect(t.styleDictionary).toBeNull();
    expect(t.tailwindConfig).toBeNull();
    expect(t.cssVarNames).toEqual([]);
    expect(t.dominantPrefix).toBeNull();
  });

  it('detects tailwind config and style-dictionary dependency', () => {
    const scan = mkRepo({
      'tailwind.config.js': 'module.exports = {}',
      'package.json': JSON.stringify({ name: 'x', devDependencies: { 'style-dictionary': '^4' } }),
    });
    const t = probeTokens(scan);
    expect(t.tailwindConfig).toBe('tailwind.config.js');
    expect(t.styleDictionary).toBe('package.json');
  });
});

describe('component probe', () => {
  it('counts typed components, unions vs loose strings, barrel, stories', () => {
    const scan = mkRepo({
      'src/Button.tsx':
        "export interface ButtonProps { variant: 'solid' | 'ghost'; size?: 'sm' | 'md'; }\nexport const Button = (p: ButtonProps) => null;",
      'src/Chip.tsx':
        'export interface ChipProps { tone: string; }\nexport const Chip = (p: ChipProps) => null;',
      'src/Legacy.jsx': 'export const Legacy = () => null;',
      'src/index.ts': Array.from({ length: 6 }, (_, i) => `export { x${i} } from './x${i}';`).join('\n'),
      'src/Button.stories.tsx': 'export default {};',
    });
    const c = probeComponents(scan);
    expect(c.componentFiles).toBe(3);
    expect(c.typedShare).toBeCloseTo(2 / 3);
    expect(c.propsDecls).toBe(2);
    expect(c.variantUnionProps).toBe(2); // variant + size
    expect(c.variantLooseProps).toBe(1); // tone: string
    expect(c.barrel?.exports).toBe(6);
    expect(c.storyFiles).toBe(1);
  });

  it('ignores generated and test material', () => {
    const scan = mkRepo({
      'dist/Button.tsx': 'export interface ButtonProps { variant: string }',
      '__tests__/Helper.tsx': 'export interface HelperProps { size: string }',
    });
    const c = probeComponents(scan);
    expect(c.componentFiles).toBe(0);
    expect(c.propsDecls).toBe(0);
  });
});

describe('machine-surface probe', () => {
  it('finds llms family, agent files, mcp, skills, editor rules', () => {
    const scan = mkRepo({
      'docs/llms.txt': 'index',
      'docs/llms-full.txt': 'full',
      'CLAUDE.md': 'router',
      '.mcp.json': '{}',
      'context/.well-known/skills/index.json': '{}',
      '.cursor/rules/ds.mdc': 'rules',
    });
    const m = probeMachineSurface(scan);
    expect(m.llmsTxt).toBe('docs/llms.txt');
    expect(m.llmsFull).toBe('docs/llms-full.txt');
    expect(m.rootAgentFile).toBe(true);
    expect(m.mcp).toBe('.mcp.json');
    expect(m.skills).toContain('.well-known');
    expect(m.editorRules).toEqual(['.cursor/rules/ds.mdc']);
  });

  it('detects an MCP server via SDK dependency', () => {
    const scan = mkRepo({
      'server/package.json': JSON.stringify({
        name: 'their-server',
        dependencies: { '@modelcontextprotocol/sdk': '^1' },
      }),
    });
    expect(probeMachineSurface(scan).mcp).toBe('server/package.json');
  });

  it('reports absence as nulls, not crashes', () => {
    const m = probeMachineSurface(mkRepo({ 'a.txt': '' }));
    expect(m.llmsTxt).toBeNull();
    expect(m.mcp).toBeNull();
    expect(m.skills).toBeNull();
    expect(m.agentFiles).toEqual([]);
  });
});

describe('enforcement probe', () => {
  it('finds CI, stylelint, a11y deps, evals, tests, quality scripts', () => {
    const scan = mkRepo({
      '.github/workflows/ci.yml': 'name: ci',
      '.stylelintrc.json': '{}',
      'package.json': JSON.stringify({
        name: 'x',
        scripts: { validate: 'run-checks' },
        devDependencies: { 'jest-axe': '^8' },
      }),
      'evals/evals.json': '[]',
      'src/a.test.ts': '',
      'src/b.spec.tsx': '',
    });
    const e = probeEnforcement(scan);
    expect(e.ciConfigs).toEqual(['.github/workflows/ci.yml']);
    expect(e.styleLint).toBe('.stylelintrc.json');
    expect(e.a11yTooling).toBe('package.json');
    expect(e.evalFiles).toContain('evals/evals.json');
    expect(e.testFiles).toBe(2);
    expect(e.qualityScripts.length).toBe(1);
  });

  it('detects a custom token validator package', () => {
    const scan = mkRepo({
      'tools/check/package.json': JSON.stringify({ name: '@x/validate', description: 'token lint' }),
      'tools/check/src/rules.ts': "if (v.includes('var(--')) violations.push('rule broken');",
    });
    expect(probeEnforcement(scan).customValidator).toBe('tools/check/package.json');
  });
});

describe('fabrication probe', () => {
  it('computes an honest hardcoded-vs-variable ratio', () => {
    const scan = mkRepo({
      'src/App.module.css':
        '.a { color: #ff0000; padding: 12px; margin: var(--ds-space-2); background: var(--ds-color-surface-default); }',
    });
    const f = probeFabrication(scan);
    expect(f.sampledFiles).toBe(1);
    expect(f.hardcoded).toBe(2);
    expect(f.variableRefs).toBe(2);
    expect(f.ratio).toBeCloseTo(0.5);
  });

  it('excludes token-definition files and generated/test material', () => {
    const scan = mkRepo({
      'src/tokens.css': ':root { --a: #fff; --b: 4px; --c: 8px; }',
      'dist/app.css': '.x { color: #123456; }',
      'test/fixture.css': '.x { color: #123456; }',
    });
    const f = probeFabrication(scan);
    expect(f.sampledFiles).toBe(0);
    expect(f.ratio).toBeNull();
  });

  it('scans inline JSX style objects', () => {
    const scan = mkRepo({
      'src/Card.jsx': 'export const C = () => <div style={{ background: "#fff", gap: "var(--ds-space-2)" }} />;',
    });
    const f = probeFabrication(scan);
    expect(f.hardcoded).toBe(1);
    expect(f.variableRefs).toBe(1);
  });
});

describe('white-label probe', () => {
  it('finds brand data tiers', () => {
    const scan = mkRepo({
      'brands/default.json': '{}',
      'brands/acme.json': '{}',
      'src/code.ts': '',
    });
    const w = probeWhiteLabel(scan);
    expect(w.brandFiles.length).toBe(2);
    expect(w.brandDirs).toEqual(['brands']);
  });

  it('is empty when no brand tier exists', () => {
    expect(probeWhiteLabel(mkRepo({ 'src/a.ts': '' })).brandFiles).toEqual([]);
  });
});
