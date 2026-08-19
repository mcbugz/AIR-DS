import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  canonicalTokenName,
  checkPolicy,
  semanticOverrideNames,
  validatePolicyShape,
} from '../src/policy.ts';

const here = join(fileURLToPath(import.meta.url), '..');
const repoDir = (id: string) => join(here, '..', 'fixtures', 'repos', id);

const tmp = mkdtempSync(join(tmpdir(), 'ds-fleet-policy-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('canonicalTokenName', () => {
  it('normalizes CSS var, DTCG dot and kebab spellings to one form', () => {
    expect(canonicalTokenName('--ds-color-text-link')).toBe('color.text.link');
    expect(canonicalTokenName('ds.color.text.link')).toBe('color.text.link');
    expect(canonicalTokenName('color/text/link')).toBe('color.text.link');
    expect(canonicalTokenName('Color-Text-Link')).toBe('color.text.link');
  });
});

describe('semanticOverrideNames', () => {
  it('flattens nested DTCG override files ($-keys skipped, $value objects are leaves)', () => {
    expect(semanticOverrideNames(repoDir('orion-console'))).toEqual([
      'color.accent.default',
      'color.surface.raised',
    ]);
  });
  it('reads flat CSS-var-keyed files', () => {
    expect(semanticOverrideNames(repoDir('comet-storefront'))).toEqual([
      'color.surface.raised',
      'color.text.link',
    ]);
  });
  it('empty when the repo declares no overrides', () => {
    expect(semanticOverrideNames(repoDir('atlas-checkout'))).toEqual([]);
  });
});

describe('validatePolicyShape', () => {
  it('accepts every committed fixture policy', () => {
    for (const id of ['atlas-checkout', 'orion-console', 'nova-billing', 'quasar-admin', 'comet-storefront']) {
      const verdict = checkPolicy(repoDir(id));
      expect(verdict.checks.find((c) => c.id === 'policy-shape')).toBeUndefined();
    }
  });
  it('rejects unknown keys, bad enums, out-of-range numbers', () => {
    expect(validatePolicyShape({ minFirstPass: 1.5 })).toHaveLength(1);
    expect(validatePolicyShape({ browserAxe: 'always' })).toHaveLength(1);
    expect(validatePolicyShape({ tokenOverrides: { semanticTier: 'maybe' } })).toHaveLength(1);
    expect(validatePolicyShape({ maxFabrications: -1 })).toHaveLength(1);
    expect(validatePolicyShape({ surprise: true })).toHaveLength(1);
    expect(validatePolicyShape('nope')).toEqual(['policy must be a JSON object']);
    expect(validatePolicyShape({ minEvalCritical: 1, browserAxe: 'required' })).toEqual([]);
  });
});

describe('checkPolicy verdicts per fixture repo', () => {
  it('atlas-checkout: all six checks pass', () => {
    const v = checkPolicy(repoDir('atlas-checkout'));
    expect(v.policyPresent).toBe(true);
    expect(v.ok).toBe(true);
    expect(v.checks).toHaveLength(6);
    expect(v.checks.every((c) => c.ok)).toBe(true);
  });

  it('orion-console: semantic overrides allowed because both are allowlisted', () => {
    const v = checkPolicy(repoDir('orion-console'));
    expect(v.ok).toBe(true);
    const t = v.checks.find((c) => c.id === 'token-overrides');
    expect(t?.ok).toBe(true);
    expect(t?.actual).toContain('2 override(s), 0 outside policy');
  });

  it('nova-billing: drifting but compliant (minFirstPass 0.6 vs actual 0.6667; no fabrication ceiling declared)', () => {
    const v = checkPolicy(repoDir('nova-billing'));
    expect(v.ok).toBe(true);
    expect(v.checks.map((c) => c.id)).not.toContain('max-fabrications');
    expect(v.checks.find((c) => c.id === 'min-first-pass')?.actual).toContain('66.7%');
  });

  it('quasar-admin: failing axe gate is not a breach when browserAxe is optional', () => {
    const v = checkPolicy(repoDir('quasar-admin'));
    expect(v.ok).toBe(true);
    expect(v.checks.map((c) => c.id)).not.toContain('browser-axe');
  });

  it('comet-storefront: breaches all six declared checks', () => {
    const v = checkPolicy(repoDir('comet-storefront'));
    expect(v.ok).toBe(false);
    expect(v.checks).toHaveLength(6);
    expect(v.checks.every((c) => !c.ok)).toBe(true);
    const byId = Object.fromEntries(v.checks.map((c) => [c.id, c]));
    expect(byId['token-overrides']?.detail).toContain('color.text.link');
    expect(byId['min-eval-critical']?.actual).toBe('85.7%');
    expect(byId['min-first-pass']?.actual).toContain('(2/6)');
    expect(byId['required-gauntlet-steps']?.detail).toBe('missing: registry-check');
    expect(byId['browser-axe']?.actual).toBe('no stories-axe run recorded');
    expect(byId['max-fabrications']?.actual).toBe('5');
  });

  it('lyra-onboarding: no policy file -> vacuously compliant, flagged absent', () => {
    const v = checkPolicy(repoDir('lyra-onboarding'));
    expect(v).toMatchObject({ policyPresent: false, ok: true, policyPath: null, checks: [] });
  });
});

describe('checkPolicy failure modes', () => {
  it('malformed JSON yields a single failing policy-shape check', () => {
    const root = join(tmp, 'bad-json');
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, 'fleet-policy.json'), '{ not json', 'utf8');
    const v = checkPolicy(root);
    expect(v.ok).toBe(false);
    expect(v.checks).toHaveLength(1);
    expect(v.checks[0]?.id).toBe('policy-shape');
  });

  it('shape problems block instead of silently passing', () => {
    const root = join(tmp, 'bad-shape');
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, 'fleet-policy.json'), JSON.stringify({ minFirstPass: 2 }), 'utf8');
    const v = checkPolicy(root);
    expect(v.ok).toBe(false);
    expect(v.checks[0]?.detail).toContain('minFirstPass');
  });

  it('declared floors breach when the repo has never recorded the metric', () => {
    const root = join(tmp, 'empty-repo');
    mkdirSync(root, { recursive: true });
    writeFileSync(
      join(root, 'fleet-policy.json'),
      JSON.stringify({ minEvalCritical: 1, minFirstPass: 0.5, browserAxe: 'required' }),
      'utf8',
    );
    const v = checkPolicy(root);
    expect(v.ok).toBe(false);
    expect(v.checks.filter((c) => !c.ok).map((c) => c.id).sort()).toEqual([
      'browser-axe',
      'min-eval-critical',
      'min-first-pass',
    ]);
  });
});
