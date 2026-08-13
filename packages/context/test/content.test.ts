import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseNegativeRules } from '../src/rules.ts';
import { buildBundle, readOut } from './helpers.ts';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');

describe('emitted content contracts', () => {
  const bundle = buildBundle();
  afterAll(() => bundle.cleanup());

  const catalog = parseNegativeRules(
    readFileSync(join(REPO_ROOT, 'docs/specs/negative-rules.md'), 'utf8'),
  );
  const registry = JSON.parse(
    readFileSync(join(REPO_ROOT, 'registries/components-index.json'), 'utf8'),
  ) as { components: { name: string }[] };

  it('the use-system skill embeds the stale-training-data preamble and EVERY negative rule', () => {
    const skill = readOut(bundle.outDir, 'skills/use-system/SKILL.md');
    expect(skill).toContain(catalog.preamble);
    expect(catalog.rules.length).toBeGreaterThanOrEqual(10);
    for (const rule of catalog.rules) {
      expect(skill, `${rule.id} missing from use-system SKILL.md`).toContain(`${rule.id} ${rule.title}`);
    }
  });

  it('every registry component has a markdown twin and a components-slice entry', () => {
    const slice = readOut(bundle.outDir, 'llms-components.txt');
    for (const comp of registry.components) {
      expect(existsSync(join(bundle.outDir, `docs/${comp.name}.md`)), `docs/${comp.name}.md`).toBe(true);
      expect(slice, `slice entry for ${comp.name}`).toContain(`\n## ${comp.name}\n`);
    }
  });

  it('the skills discovery manifest lists all six skills with valid paths', () => {
    const index = JSON.parse(readOut(bundle.outDir, '.well-known/skills/index.json'));
    const names = index.skills.map((s: { name: string }) => s.name).sort();
    expect(names).toEqual([
      'audit-a11y',
      'build-screen',
      'contribute-component',
      'design-to-code',
      'migrate',
      'use-system',
    ]);
    for (const skill of index.skills) {
      expect(existsSync(join(bundle.outDir, skill.path)), skill.path).toBe(true);
    }
  });

  it('the design-to-code router is small, halts on degraded input, and routes to build-screen + the gauntlet', () => {
    const skill = readOut(bundle.outDir, 'skills/design-to-code/SKILL.md');
    expect(skill.length, 'design-to-code SKILL.md must stay a small router').toBeLessThan(4000);
    expect(skill).toContain(catalog.preamble); // stale-training-data preamble
    expect(skill).toContain('**EXTRACT.**');
    expect(skill).toContain('**HALT on degraded input.**');
    expect(skill).toContain('**BUILD.**');
    expect(skill).toContain('**VALIDATE.**');
    expect(skill).toContain('../build-screen/SKILL.md');
    expect(skill).toContain('pnpm validate');
    expect(skill).toContain('validate_usage');
    // credential-free: any design input works; Figma is optional
    expect(skill).toContain('screenshot, written spec, redline');
    expect(skill).toContain('No credentials required');
    // router links every lazy-loaded reference
    for (const ref of ['brief-template.md', 'extraction-checklist.md', 'figma-adapter.md']) {
      expect(skill, ref).toContain(`references/${ref}`);
      expect(
        existsSync(join(bundle.outDir, `skills/design-to-code/references/${ref}`)),
        ref,
      ).toBe(true);
    }
  });

  it('the brief template carries every contract section, registry grounding, and the HALT-not-approximation rule', () => {
    const template = readOut(bundle.outDir, 'skills/design-to-code/references/brief-template.md');
    for (const section of [
      '## 1. Screen',
      '## 2. Layout regions',
      '## 3. Component inventory',
      '## 4. Token mapping',
      '## 5. Interaction inventory',
      '## 6. Accessibility notes',
      '## 7. Open questions (MANDATORY)',
    ]) {
      expect(template, section).toContain(section);
    }
    // closed-world grounding with real registry counts
    expect(template).toContain('registries/components-index.json');
    expect(template).toContain('registries/tokens-index.json');
    expect(template).toContain(`${registry.components.length} exports`);
    // a value with no token match is a HALT, never an approximation
    expect(template).toContain('**A value with no token match is a HALT, not an approximation**');
    // empty open-questions = a positive zero-ambiguity claim
    expect(template).toContain('zero ambiguity');
  });

  it('the extraction checklist encodes the fabricated-tokens failure story and the mapping disciplines', () => {
    const checklist = readOut(bundle.outDir, 'skills/design-to-code/references/extraction-checklist.md');
    expect(checklist).toContain('27 fabricated tokens'); // the cautionary preamble
    expect(checklist).toContain('Measure before mapping');
    expect(checklist).toContain('hover, focus-visible, disabled, invalid, empty, and loading');
    expect(checklist).toContain('NR-003'); // color → intent, never hex-matching
    expect(checklist).toContain('NR-006'); // space tokens are not sizes
    expect(checklist).toContain('NR-009'); // states via data attributes
    expect(checklist).toContain('within 1px'); // spacing tolerance rule
  });

  it('the Figma adapter is a documented client plug-point and never a credential dependency', () => {
    const adapter = readOut(bundle.outDir, 'skills/design-to-code/references/figma-adapter.md');
    expect(adapter).toContain('documented, not implemented');
    expect(adapter).toContain(
      'Requires client Figma credentials; everything else in this skill works without them.',
    );
    expect(adapter).toContain('Figma REST API');
    expect(adapter).toContain('MCP');
    expect(adapter).toContain('registries/tokens-index.json'); // variables → token mapping
    expect(adapter).toContain('Code Connect');
  });

  it('build-screen and the repo routers cross-reference design-to-code', () => {
    expect(readOut(bundle.outDir, 'skills/build-screen/SKILL.md')).toContain(
      '../design-to-code/SKILL.md',
    );
    for (const rel of ['AGENTS.md', 'CLAUDE.md']) {
      expect(readOut(bundle.outDir, rel), rel).toContain('skills/design-to-code/SKILL.md');
    }
    expect(readOut(bundle.outDir, 'llms.txt')).toContain('design-to-code');
  });

  it('all four editor-rule channels carry the same rule set as the skills (single source)', () => {
    const channels = [
      'editor/cursor/.cursor/rules/ds.mdc',
      'editor/copilot/.github/copilot-instructions.md',
      'editor/claude/CLAUDE.md',
      'editor/v0/instructions.md',
    ];
    for (const rel of channels) {
      const text = readOut(bundle.outDir, rel);
      expect(text, rel).toContain(catalog.preamble);
      for (const rule of catalog.rules) {
        expect(text, `${rule.id} missing from ${rel}`).toContain(`${rule.id} ${rule.title}`);
      }
    }
  });

  it('the compiled auditor targets customer usage, embeds the negative rules, and never approves', () => {
    const auditor = readOut(bundle.outDir, 'agents/ds-auditor.md');
    expect(auditor).toContain('name: ds-auditor');
    expect(auditor).toContain('registries/components-index.json');
    expect(auditor).toContain('registries/tokens-index.json');
    expect(auditor).toContain('never approve');
    for (const rule of catalog.rules) expect(auditor).toContain(rule.id);
  });

  it('repo router files exist, are small, and point at skills', () => {
    for (const rel of ['AGENTS.md', 'CLAUDE.md']) {
      const text = readOut(bundle.outDir, rel);
      expect(text.length, `${rel} must stay a small router`).toBeLessThan(4000);
      expect(text).toContain('skills/use-system/SKILL.md');
      expect(text).toContain('.well-known/skills/index.json');
    }
  });

  it('the v0 channel is a project-instructions markdown with the closed-world registry pointer', () => {
    const v0 = readOut(bundle.outDir, 'editor/v0/instructions.md');
    expect(v0).toContain('v0 project instructions');
    expect(v0).toContain('Project Settings > Instructions');
    expect(v0).toContain('registries/components-index.json');
    expect(v0).toContain('registries/tokens-index.json');
    expect(v0).toContain('brand: default');
  });

  it('FB-6: gap-vs-space guidance appears in llms-theming and the use-system token reference', () => {
    for (const rel of ['llms-theming.txt', 'skills/use-system/references/tokens.md']) {
      const text = readOut(bundle.outDir, rel);
      expect(text, rel).toContain('intra-component rhythm');
      expect(text, rel).toContain('space-gap-{sm,md,lg}');
    }
  });

  it('FB-7: the Dialog twin and heading guidance state that Dialog owns its title', () => {
    const twin = readOut(bundle.outDir, 'docs/Dialog.md');
    expect(twin).toContain('Dialog OWNS its title');
    expect(readOut(bundle.outDir, 'llms-components.txt')).toContain('Dialog OWNS its title');
    expect(readOut(bundle.outDir, 'skills/migrate/references/migration-map.md')).toContain(
      'Dialog owns its title',
    );
    expect(readOut(bundle.outDir, 'llms-migration.txt')).toContain('never add a heading element to name a dialog');
  });

  it('contribute-component is compiled from CONTRIBUTING-COMPONENT.md', () => {
    const ref = readOut(bundle.outDir, 'skills/contribute-component/references/contributing.md');
    const source = readFileSync(join(REPO_ROOT, 'packages/react/CONTRIBUTING-COMPONENT.md'), 'utf8');
    expect(ref).toContain(source.trimEnd().split('\n').slice(-1)[0]); // last source line survives
    expect(ref).toContain('## `<Name>.module.css` rules');
  });
});
