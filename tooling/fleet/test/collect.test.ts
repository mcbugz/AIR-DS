import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { collectFleet, collectRepo, readManifest, refsFromPaths } from '../src/collect.ts';

/**
 * Collector normalization + fleet rollups over the committed fixture fleet.
 * All expected numbers are hand-computed from the fixture history.jsonl
 * files (see each fixture's line-by-line design); the six synthetic repos
 * are frozen, so exact assertions are stable. The seventh (this repo's live
 * metrics) is only asserted loosely — its history grows.
 */

const here = join(fileURLToPath(import.meta.url), '..');
const fixtures = join(here, '..', 'fixtures');
const repoDir = (id: string) => join(fixtures, 'repos', id);

const SYNTHETIC = [
  'atlas-checkout',
  'orion-console',
  'nova-billing',
  'quasar-admin',
  'comet-storefront',
  'lyra-onboarding',
];

describe('readManifest / refsFromPaths', () => {
  it('resolves manifest roots relative to the manifest file, including this repo as 7th', () => {
    const refs = readManifest(join(fixtures, 'fleet-manifest.json'));
    expect(refs.map((r) => r.id)).toEqual([...SYNTHETIC, 'air-ds']);
    expect(refs[6]?.root).toBe(join(fixtures, '..', '..', '..'));
  });

  it('derives ids from path basenames', () => {
    expect(refsFromPaths([repoDir('atlas-checkout')])[0]?.id).toBe('atlas-checkout');
  });
});

describe('collectRepo normalization (per fixture)', () => {
  it('atlas-checkout: exemplary — 12 runs, 6/6 gauntlet, evals 26/26, axe clean, policy passing', () => {
    const r = collectRepo({ id: 'atlas-checkout', root: repoDir('atlas-checkout') });
    expect(r.lines).toBe(12);
    expect(r.rates.gauntletFirstPass).toEqual({ passed: 6, total: 6, rate: 1 });
    expect(r.latest?.sha).toBe('a5e2a39');
    expect(r.latest?.evals).toMatchObject({ passed: 26, total: 26, critical: 1 });
    expect(r.latest?.storiesAxe).toMatchObject({ stories: 110, gatePassed: true });
    expect(r.latest?.benchmark).toEqual({ systemCompliance: 1, baselineCompliance: 0, axe: 'ran' });
    expect(r.latest?.registry).toEqual({ tokens: 240, components: 23 });
    expect(r.rates.fabricationsTotal).toBe(0);
    expect(r.health).toBe(1);
    expect(r.policy).toMatchObject({ present: true, ok: true, failing: [] });
    // registry adoption trend: 232 -> 232 -> 236 -> 238 -> 240
    expect(r.trend.tokens).toEqual([232, 232, 236, 238, 240]);
    expect(r.deltas.tokens).toBe(2);
  });

  it('nova-billing: drifting — first-pass 6/9, fabrications creeping, still within its policy', () => {
    const r = collectRepo({ id: 'nova-billing', root: repoDir('nova-billing') });
    expect(r.lines).toBe(13);
    expect(r.rates.gauntletFirstPass).toEqual({ passed: 6, total: 9, rate: 0.6667 });
    expect(r.trend.gauntletPass).toEqual([1, 1, 0, 0, 0]); // one failing run taints the release
    expect(r.trend.evalOverall).toEqual([1, null, 0.96, null, 0.92]);
    expect(r.latest?.fabrications).toBe(2); // max within the latest sha group
    expect(r.rates.fabricationsTotal).toBe(2);
    // health: 0.4*0.6667 + 0.3*0.92 + 0.2*0.8 + 0.1*1 = 0.8027
    expect(r.health).toBe(0.8027);
    expect(r.policy).toMatchObject({ present: true, ok: true });
  });

  it('quasar-admin: drifting — axe gate failing but policy declares browserAxe optional', () => {
    const r = collectRepo({ id: 'quasar-admin', root: repoDir('quasar-admin') });
    expect(r.rates.gauntletFirstPass).toEqual({ passed: 4, total: 6, rate: 0.6667 });
    expect(r.latest?.storiesAxe).toMatchObject({ serious: 1, gatePassed: false });
    expect(r.latest?.fabrications).toBe(1);
    // health: 0.4*0.6667 + 0.3*0.9 + 0.2*0.9 + 0.1*0 = 0.7167
    expect(r.health).toBe(0.7167);
    expect(r.policy).toMatchObject({ present: true, ok: true });
  });

  it('comet-storefront: failing — every policy knob breached', () => {
    const r = collectRepo({ id: 'comet-storefront', root: repoDir('comet-storefront') });
    expect(r.rates.gauntletFirstPass).toEqual({ passed: 2, total: 6, rate: 0.3333 });
    expect(r.rates.fabricationsTotal).toBe(9);
    expect(r.latest?.fabrications).toBe(5);
    expect(r.latest?.gauntletSteps).toEqual(['typecheck', 'lint', 'build', 'test']); // registry-check dropped
    // health: 0.4*0.3333 + 0.3*0.864 + 0.2*0.5 + 0.1*0.5 = 0.5425
    expect(r.health).toBe(0.5425);
    expect(r.policy.present).toBe(true);
    expect(r.policy.ok).toBe(false);
    expect([...r.policy.failing].sort()).toEqual([
      'browser-axe',
      'max-fabrications',
      'min-eval-critical',
      'min-first-pass',
      'required-gauntlet-steps',
      'token-overrides',
    ]);
  });

  it('lyra-onboarding: sparse/new — one release, no axe, no policy', () => {
    const r = collectRepo({ id: 'lyra-onboarding', root: repoDir('lyra-onboarding') });
    expect(r.lines).toBe(2);
    expect(r.rates.gauntletFirstPass).toEqual({ passed: 1, total: 1, rate: 1 });
    expect(r.latest?.storiesAxe).toBeNull();
    expect(r.deltas.evalOverall).toBeNull(); // single release: no deltas
    // health: 0.4 + 0.3 + 0.2 + 0.1*0.5 = 0.95
    expect(r.health).toBe(0.95);
    expect(r.policy).toEqual({ present: false, ok: true, failing: [], checks: [] });
  });
});

describe('fleet rollups over the six synthetic repos (hand-computed)', () => {
  const data = collectFleet(SYNTHETIC.map((id) => ({ id, root: repoDir(id) })));
  const h = data.fleet.headline;

  it('runs total 55, fabrications total 12', () => {
    expect(data.fleet.totals.runs).toBe(55);
    expect(data.fleet.totals.fabrications).toBe(12);
  });
  it('hallucination rate 12/55 = 0.2182 per run', () => {
    expect(h.hallucinationRate).toBe(0.2182);
  });
  it('first-pass rate 23/32 = 0.7188', () => {
    expect(h.firstPassRate).toBe(0.7188);
  });
  it('eval compliance 116/123 = 0.9431', () => {
    expect(h.evalCompliance).toBe(0.9431);
  });
  it('a11y clean rate 355/360 = 0.9861', () => {
    expect(h.a11yCleanRate).toBe(0.9861);
  });
  it('policy compliance 4/6 = 0.6667', () => {
    expect(h.policyCompliance).toBe(0.6667);
  });
  it('worst-3 by health: comet, quasar, nova', () => {
    expect(data.fleet.worst).toEqual([
      { id: 'comet-storefront', health: 0.5425 },
      { id: 'quasar-admin', health: 0.7167 },
      { id: 'nova-billing', health: 0.8027 },
    ]);
  });
  it('deterministic generatedAt = max observed line ts', () => {
    expect(data.generatedAt).toBe('2026-08-18T16:05:00-05:00');
  });
  it('fleet deltas: fabrications sum 5, gauntletPass mean 0.2, evalOverall null (no adjacent pairs)', () => {
    expect(data.fleet.deltas).toEqual({ evalOverall: null, fabrications: 5, gauntletPass: 0.2 });
  });
});

describe('full 7-repo manifest (live repo asserted loosely)', () => {
  it('collects this repo as the 7th without error', () => {
    const data = collectFleet(readManifest(join(fixtures, 'fleet-manifest.json')));
    expect(data.repos).toHaveLength(7);
    const air = data.repos.find((r) => r.id === 'air-ds');
    expect(air).toBeDefined();
    expect(air?.lines).toBeGreaterThanOrEqual(16);
    expect(air?.rates.gauntletFirstPass.total).toBeGreaterThanOrEqual(8);
    expect(air?.policy.present).toBe(false); // this repo has not adopted a policy yet
  });

  it('rejects duplicate repo ids and empty ref lists', () => {
    const ref = { id: 'x', root: repoDir('atlas-checkout') };
    expect(() => collectFleet([ref, ref])).toThrow(/duplicate repo id/);
    expect(() => collectFleet([])).toThrow(/no repos/);
  });
});
