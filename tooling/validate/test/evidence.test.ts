import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  canonicalId,
  collectDependencyInventory,
  parseLockfileYaml,
  transitiveClosure,
  type LockMap,
} from '../src/evidence/dependencies.ts';
import { EvidenceError, generateEvidence, stripTimings } from '../src/evidence/pack.ts';
import { collectReproducibility } from '../src/evidence/provenance.ts';
import { EVIDENCE_SCHEMA_VERSION, validateEvidenceDoc } from '../src/evidence/schema.ts';
import { collectVitestAxeEvidence, scanTestFileForAxe } from '../src/evidence/wcag.ts';
import type { EvalRunResult } from '../src/evals/run-evals.ts';
import { findRepoRoot } from '../src/registry.ts';
import type { GauntletReport } from '../src/types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, 'fixtures', 'evidence', 'repo');
const REAL_ROOT = findRepoRoot(HERE);
const NOW = '2026-08-19T12:00:00Z';

const tmp = mkdtempSync(join(tmpdir(), 'air-ds-evidence-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

// --------------------------------------------------------------------------
// Stub runners — evidence tests must NEVER execute the real gauntlet (it runs
// `pnpm -r test`, which would recurse into this very suite).
// --------------------------------------------------------------------------

const passingGauntlet = (): GauntletReport => ({
  ok: true,
  root: FIXTURE,
  startedAt: '2026-08-19T00:00:00Z',
  durationMs: 42,
  steps: [
    { step: 'typecheck', status: 'pass', durationMs: 10 },
    { step: 'lint', status: 'pass', durationMs: 5 },
    { step: 'build', status: 'pass', durationMs: 12 },
    { step: 'test', status: 'pass', durationMs: 10 },
    { step: 'registry-check', status: 'pass', durationMs: 5 },
  ],
});

const failingGauntlet = (): GauntletReport => ({
  ok: false,
  root: FIXTURE,
  startedAt: '2026-08-19T00:00:00Z',
  durationMs: 42,
  steps: [
    { step: 'typecheck', status: 'pass', durationMs: 10 },
    { step: 'lint', status: 'fail', durationMs: 5, detail: '1 violation' },
  ],
});

const passingEvals = (): EvalRunResult => ({
  total: 21,
  passed: 21,
  overallRate: 1,
  criticalTotal: 12,
  criticalPassed: 12,
  criticalRate: 1,
  ok: true,
  cases: [],
});

const failingEvals = (): EvalRunResult => ({
  ...passingEvals(),
  passed: 18,
  overallRate: 18 / 21,
  ok: false,
});

const runFixture = (outDir: string, overrides: Parameters<typeof generateEvidence>[0]['runners'] = {}) =>
  generateEvidence({
    root: FIXTURE,
    outDir,
    now: NOW,
    browser: 'off',
    runners: { gauntlet: passingGauntlet, evals: passingEvals, ...overrides },
  });

describe('evidence pack (M6): schema', () => {
  const outDir = join(tmp, 'pack-schema');
  const result = runFixture(outDir);

  it('emits a schema-valid evidence.json (self-check + explicit validation)', () => {
    const doc = JSON.parse(readFileSync(join(outDir, 'evidence.json'), 'utf8')) as unknown;
    expect(validateEvidenceDoc(doc)).toEqual([]);
    expect((doc as { schemaVersion: string }).schemaVersion).toBe(EVIDENCE_SCHEMA_VERSION);
    expect((doc as { generatedAt: string }).generatedAt).toBe(NOW);
  });

  it('rejects malformed documents (validator is not a rubber stamp)', () => {
    expect(validateEvidenceDoc({}).length).toBeGreaterThan(5);
    const doc = JSON.parse(readFileSync(join(outDir, 'evidence.json'), 'utf8')) as Record<string, unknown>;
    (doc['gauntlet'] as Record<string, unknown>)['passed'] = false; // a pack must never claim a failing gauntlet
    expect(validateEvidenceDoc(doc)).toContain('gauntlet.passed');
    delete doc['dependencies'];
    expect(validateEvidenceDoc(doc)).toContain('dependencies');
  });

  it('ships machine layer, human layer, SHA256SUMS, and a self-gitignore', () => {
    expect(result.files).toContain('evidence.json');
    expect(result.files).toContain('EVIDENCE.md');
    expect(result.files).toContain('SHA256SUMS');
    expect(result.files).toContain('.gitignore');
    expect(readFileSync(join(outDir, '.gitignore'), 'utf8')).toBe('*\n');
    for (const artifact of [
      'artifacts/contrast-report.json',
      'artifacts/stories-axe.json',
      'artifacts/vitest-axe-coverage.json',
      'artifacts/gauntlet-report.json',
      'artifacts/evals-report.json',
      'artifacts/dependency-inventory.json',
      'artifacts/provenance.json',
    ]) {
      expect(result.files).toContain(artifact);
    }
  });

  it('SHA256SUMS covers every other file with correct hashes', () => {
    const lines = readFileSync(join(outDir, 'SHA256SUMS'), 'utf8').trimEnd().split('\n');
    const listed = new Map(lines.map((l) => [l.slice(66), l.slice(0, 64)]));
    expect([...listed.keys()].sort()).toEqual(result.files.filter((f) => f !== 'SHA256SUMS').sort());
    for (const [file, hash] of listed) {
      expect(createHash('sha256').update(readFileSync(join(outDir, file))).digest('hex')).toBe(hash);
    }
  });

  it('every evidence section links to an artifact file that exists in the pack', () => {
    const doc = result.doc;
    const links = [
      doc.provenance.artifact,
      doc.gauntlet.artifact,
      doc.evals.artifact,
      doc.wcag.contrast.artifact,
      doc.wcag.storiesAxe?.artifact,
      doc.wcag.vitestAxe.artifact,
      doc.dependencies.artifact,
    ];
    for (const link of links) {
      expect(link).toBeTruthy();
      expect(existsSync(join(outDir, link as string))).toBe(true);
    }
  });
});

describe('evidence pack (M6): fresh-execution guarantee', () => {
  it('a failing gauntlet ABORTS generation before anything is written', () => {
    const outDir = join(tmp, 'pack-broken');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'previous-evidence.txt'), 'old pack must survive an aborted run\n');
    expect(() => runFixture(outDir, { gauntlet: failingGauntlet })).toThrow(EvidenceError);
    expect(() => runFixture(outDir, { gauntlet: failingGauntlet })).toThrow(/refusing to emit/i);
    // Nothing written, prior contents untouched: broken-system evidence must
    // never masquerade as working-system evidence.
    expect(existsSync(join(outDir, 'evidence.json'))).toBe(false);
    expect(existsSync(join(outDir, 'previous-evidence.txt'))).toBe(true);
  });

  it('a failing eval run also aborts generation', () => {
    const outDir = join(tmp, 'pack-broken-evals');
    expect(() => runFixture(outDir, { evals: failingEvals })).toThrow(EvidenceError);
    expect(existsSync(join(outDir, 'evidence.json'))).toBe(false);
  });

  it('rejects a non-ISO --now instead of emitting garbage timestamps', () => {
    expect(() =>
      generateEvidence({
        root: FIXTURE,
        outDir: join(tmp, 'pack-bad-now'),
        now: 'yesterday-ish',
        browser: 'off',
        runners: { gauntlet: passingGauntlet, evals: passingEvals },
      }),
    ).toThrow(/ISO 8601/);
  });
});

describe('evidence pack (M6): determinism', () => {
  it('two runs with the same inputs and --now produce byte-identical packs', () => {
    const a = join(tmp, 'pack-det-a');
    const b = join(tmp, 'pack-det-b');
    const ra = runFixture(a);
    const rb = runFixture(b);
    expect(ra.files).toEqual(rb.files);
    for (const f of ra.files) {
      expect(readFileSync(join(a, f), 'utf8'), `file ${f} differs between runs`).toBe(
        readFileSync(join(b, f), 'utf8'),
      );
    }
  });

  it('stripTimings removes wall-clock noise and nothing else', () => {
    const stripped = stripTimings({
      ok: true,
      startedAt: 'x',
      durationMs: 9,
      steps: [{ step: 'lint', durationMs: 3, status: 'pass' }],
      durations: { lint: 3 },
      date: '2026-08-01',
    }) as Record<string, unknown>;
    expect(stripped).toEqual({ ok: true, steps: [{ step: 'lint', status: 'pass' }], date: '2026-08-01' });
  });

  it('the gauntlet artifact copy carries verdicts but no timing fields', () => {
    const outDir = join(tmp, 'pack-schema'); // reuse the pack from the schema block
    const report = JSON.parse(readFileSync(join(outDir, 'artifacts', 'gauntlet-report.json'), 'utf8')) as Record<string, unknown>;
    expect(report['ok']).toBe(true);
    expect(report['durationMs']).toBeUndefined();
    expect(report['startedAt']).toBeUndefined();
    expect((report['steps'] as Record<string, unknown>[])[0]?.['durationMs']).toBeUndefined();
  });
});

describe('evidence pack (M6): WCAG evidence', () => {
  const outDir = join(tmp, 'pack-wcag');
  const { doc } = runFixture(outDir);

  it('summarizes the contrast report per pair with pass values and alias coverage', () => {
    const c = doc.wcag.contrast;
    expect(c.standard).toBe('WCAG 2.2 AA (normal text)');
    expect(c.pairCount).toBe(2);
    expect(c.failures).toBe(0);
    expect(c.allPass).toBe(true);
    expect(c.pairs[0]).toMatchObject({ id: 'color.text.primary|color.surface.default', ratio: 21, pass: true });
    expect(c.pairs[0]?.coveredVars).toEqual({ foreground: 1, background: 2 });
    expect(c.aliasIndex.componentVarsCovered).toBe(2);
    expect(c.unaudited.count).toBe(1);
    expect(c.unaudited.entries[0]?.reason).toMatch(/non-text edge/);
  });

  it('stamps committed stories-axe results with honest staleness (fixture path)', () => {
    const sa = doc.wcag.storiesAxe;
    expect(sa?.source).toBe('committed');
    expect(sa?.resultDate).toBe('2026-08-01');
    expect(sa?.staleness.ageDays).toBe(18); // 2026-08-01 -> 2026-08-19
    expect(sa?.staleness.stale).toBe(true);
    expect(sa?.staleness.note).toMatch(/predate/);
    expect(sa?.stories).toBe(3);
    expect(sa?.gatePassed).toBe(true);
  });

  it('labels an injected fresh run as fresh (no staleness flag)', () => {
    const fresh = generateEvidence({
      root: FIXTURE,
      outDir: join(tmp, 'pack-fresh-axe'),
      now: NOW,
      browser: 'auto',
      runners: {
        gauntlet: passingGauntlet,
        evals: passingEvals,
        storiesAxe: () => join(FIXTURE, 'tooling', 'validate', 'stories-axe-results', '2026-08-01.json'),
      },
    });
    expect(fresh.doc.wcag.storiesAxe?.source).toBe('fresh-run');
    expect(fresh.doc.wcag.storiesAxe?.staleness.stale).toBe(false);
  });

  it('counts vitest-axe coverage honestly: which components, which states', () => {
    const va = doc.wcag.vitestAxe;
    expect(va.componentsTotal).toBe(2);
    expect(va.componentsWithAxe).toBe(1);
    expect(va.componentsWithoutAxe).toEqual(['Card']);
    expect(va.totalAssertions).toBe(2);
    const button = va.components[0];
    expect(button?.component).toBe('Button');
    expect(button?.states.map((s) => s.title)).toEqual([
      'has no axe violations (default)',
      'has no axe violations (loading)',
    ]);
  });

  it('ignores axe-shaped calls in files that do not import vitest-axe', () => {
    expect(scanTestFileForAxe(`const axe = (x) => x; it('fake', () => axe(1));`)).toEqual([]);
    expect(collectVitestAxeEvidence(FIXTURE).components.every((c) => c.component !== 'Card')).toBe(true);
  });
});

describe('evidence pack (M6): dependency inventory (lockfile only)', () => {
  it('parses the pnpm-lock.yaml subset (importers, packages, snapshots)', () => {
    const lock = parseLockfileYaml(readFileSync(join(FIXTURE, 'pnpm-lock.yaml'), 'utf8'));
    expect(lock['lockfileVersion']).toBe('9.0');
    const importers = lock['importers'] as LockMap;
    expect(Object.keys(importers).sort()).toEqual(['.', 'packages/alpha', 'packages/beta']);
    const alpha = importers['packages/alpha'] as LockMap;
    const leftPad = (alpha['dependencies'] as LockMap)['left-pad'] as LockMap;
    expect(leftPad['version']).toBe('1.3.0');
    const snapshots = lock['snapshots'] as LockMap;
    expect(((snapshots['left-pad@1.3.0'] as LockMap)['dependencies'] as LockMap)['chain-dep']).toBe('0.5.0');
    expect(snapshots['base-lib@2.0.0']).toBe('{}');
  });

  it('strips peer suffixes when canonicalizing ids', () => {
    expect(canonicalId('tiny-dev', '1.0.0(peer-x@2.0.0)')).toBe('tiny-dev@1.0.0');
    expect(canonicalId('left-pad', '1.3.0')).toBe('left-pad@1.3.0');
  });

  it('computes direct + transitive counts with prod/dev separation and workspace links', () => {
    const inv = collectDependencyInventory(FIXTURE);
    expect(inv.lockfileVersion).toBe('9.0');
    const alpha = inv.packages.find((p) => p.name === '@fx/alpha');
    expect(alpha).toMatchObject({
      private: false,
      direct: { prod: 2, dev: 1 }, // left-pad + workspace link; tiny-dev
      transitive: { prod: 3, dev: 2 }, // left-pad, chain-dep, base-lib (via @fx/beta); tiny-dev, peer-x
      workspaceDeps: ['packages/beta'],
    });
    const ids = inv.entries.map((e) => e.id);
    expect(ids).toEqual(['base-lib@2.0.0', 'chain-dep@0.5.0', 'left-pad@1.3.0', 'peer-x@2.0.0', 'tiny-dev@1.0.0']);
    // prod scope = reachable from a publishable package's production graph
    expect(inv.entries.find((e) => e.name === 'tiny-dev')?.scope).toBe('dev');
    expect(inv.entries.find((e) => e.name === 'base-lib')?.scope).toBe('prod');
  });

  it('marks licenses unknown when they cannot be read locally — never guessed', () => {
    const inv = collectDependencyInventory(FIXTURE); // fixture has no node_modules
    expect(inv.licenses.unknown).toBe(inv.entries.length);
    expect(Object.keys(inv.licenses.byLicense)).toEqual([]);
  });

  it('transitiveClosure walks the real lockfile graph without a network', () => {
    const lock = parseLockfileYaml(readFileSync(join(REAL_ROOT, 'pnpm-lock.yaml'), 'utf8'));
    const importers = lock['importers'] as LockMap;
    expect(importers['tooling/validate']).toBeTruthy();
    const dev = transitiveClosure(lock, importers, 'tooling/validate', 'dev');
    expect(dev.external.size).toBeGreaterThan(10); // vitest + playwright pull a real tree
    expect([...dev.external].some((id) => id.startsWith('typescript@'))).toBe(true);
  });

  it('resolves real licenses from the local store on the actual repo', () => {
    const inv = collectDependencyInventory(REAL_ROOT);
    expect(inv.entries.length).toBeGreaterThan(50);
    const ts = inv.entries.find((e) => e.name === 'typescript');
    expect(ts?.license).toBe('Apache-2.0');
    expect(inv.licenses.unknown).toBeLessThan(inv.entries.length); // most licenses readable locally
  });
});

describe('evidence pack (M6): provenance', () => {
  it('verifies every reproducibility claim against its named test file (real repo)', () => {
    const claims = collectReproducibility(REAL_ROOT);
    expect(claims.length).toBeGreaterThanOrEqual(4);
    for (const c of claims) {
      expect(c.verified, `claim not backed by a present test: ${c.test} — "${c.title}"`).toBe(true);
    }
  });

  it('reports unbacked claims as unverified instead of asserting them', () => {
    const claims = collectReproducibility(FIXTURE); // fixture has none of the cited tests
    expect(claims.every((c) => c.verified === false)).toBe(true);
  });
});
