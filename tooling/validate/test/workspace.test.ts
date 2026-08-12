import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRegistryContext } from '../src/registry.ts';
import { checkDeadHooks, diffHashes } from '../src/workspace.ts';
import type { TokensIndex } from '../src/types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(HERE, 'fixtures', 'workspace');

function ctxWith(tokens: { cssVar: string; tier: string }[]) {
  const idx: TokensIndex = {
    tokens: tokens.map((t, i) => ({ name: `t${i}`, cssVar: t.cssVar, tier: t.tier, type: 'color' })),
  };
  return buildRegistryContext(idx, { components: [] });
}

describe('G4 dead-hook check', () => {
  it('flags a registered component hook that no CSS consumes', () => {
    const ctx = ctxWith([
      { cssVar: '--ds-badge-surface-info', tier: 'component' }, // consumed by fixture Badge css
      { cssVar: '--ds-badge-surface-mystery', tier: 'component' }, // dead
    ]);
    const violations = checkDeadHooks(WORKSPACE, ctx, { deadHookWaivers: [] });
    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toBe('G4');
    expect(violations[0]?.message).toContain('--ds-badge-surface-mystery');
  });

  it('honors the waiver list', () => {
    const ctx = ctxWith([{ cssVar: '--ds-badge-surface-mystery', tier: 'component' }]);
    const violations = checkDeadHooks(WORKSPACE, ctx, {
      deadHookWaivers: ['--ds-badge-surface-mystery'],
    });
    expect(violations).toHaveLength(0);
  });

  it('maps the shared field namespace onto TextField/TextArea/Select', () => {
    const ctx = ctxWith([
      { cssVar: '--ds-field-height', tier: 'component' }, // consumed by fixture TextField css
      { cssVar: '--ds-field-ghost-hook', tier: 'component' }, // dead
    ]);
    const violations = checkDeadHooks(WORKSPACE, ctx, { deadHookWaivers: [] });
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toContain('--ds-field-ghost-hook');
  });

  it('maps subcomponent namespaces onto the parent directory (radio -> RadioGroup/)', () => {
    const ctx = ctxWith([
      { cssVar: '--ds-radio-size', tier: 'component' }, // consumed by fixture RadioGroup css
      { cssVar: '--ds-radio-dead-hook', tier: 'component' }, // dead
    ]);
    const violations = checkDeadHooks(WORKSPACE, ctx, { deadHookWaivers: [] });
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toContain('--ds-radio-dead-hook');
    expect(violations[0]?.file).toContain('RadioGroup');
  });

  it('skips namespaces with no shipped component directory', () => {
    const ctx = ctxWith([{ cssVar: '--ds-datagrid-surface', tier: 'component' }]);
    expect(checkDeadHooks(WORKSPACE, ctx, { deadHookWaivers: [] })).toHaveLength(0);
  });

  it('ignores semantic-tier tokens entirely', () => {
    const ctx = ctxWith([{ cssVar: '--ds-color-text-primary', tier: 'semantic' }]);
    expect(checkDeadHooks(WORKSPACE, ctx, { deadHookWaivers: [] })).toHaveLength(0);
  });
});

describe('G7 drift detection primitives', () => {
  it('diffHashes reports changed, added, and removed files', () => {
    const before = new Map([
      ['a.json', '111'],
      ['b.json', '222'],
      ['gone.json', '333'],
    ]);
    const after = new Map([
      ['a.json', '111'],
      ['b.json', 'CHANGED'],
      ['new.json', '444'],
    ]);
    const changed = diffHashes(before, after);
    expect(changed).toContain('b.json');
    expect(changed).toContain('new.json');
    expect(changed).toContain('gone.json');
    expect(changed).not.toContain('a.json');
  });
});
