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

  it('the skills discovery manifest lists all five skills with valid paths', () => {
    const index = JSON.parse(readOut(bundle.outDir, '.well-known/skills/index.json'));
    const names = index.skills.map((s: { name: string }) => s.name).sort();
    expect(names).toEqual(['audit-a11y', 'build-screen', 'contribute-component', 'migrate', 'use-system']);
    for (const skill of index.skills) {
      expect(existsSync(join(bundle.outDir, skill.path)), skill.path).toBe(true);
    }
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
