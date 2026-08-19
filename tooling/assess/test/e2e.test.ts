/**
 * End-to-end assessments:
 *  (a) THIS repo — the self-test: AIR-DS must score high (pillar floors + >=90 overall);
 *  (b) the committed typical-2023-DS fixture — must score poorly with the right gaps named;
 *  (c) an empty directory — graceful F with onboarding framing.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { assess } from '../src/assess.ts';
import { renderMarkdown } from '../src/report.ts';
import type { Assessment, PillarId } from '../src/types.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '../../..');
const FIXTURE = path.join(here, 'fixtures/typical-2023-ds');

function pillar(a: Assessment, id: PillarId): number {
  const p = a.pillars.find((x) => x.id === id);
  if (p === undefined) throw new Error(`missing pillar ${id}`);
  return p.score;
}

describe('self-test: AIR-DS repo', () => {
  const a = assess(REPO_ROOT);

  it('scores >= 90 overall (grade A)', () => {
    expect(a.overall.score).toBeGreaterThanOrEqual(90);
    expect(a.overall.grade).toBe('A');
  });

  it('meets pillar floors', () => {
    expect(pillar(a, 'tokens')).toBeGreaterThanOrEqual(80);
    expect(pillar(a, 'components')).toBeGreaterThanOrEqual(85);
    expect(pillar(a, 'machine-surface')).toBeGreaterThanOrEqual(90);
    expect(pillar(a, 'enforcement')).toBeGreaterThanOrEqual(90);
    expect(pillar(a, 'white-label')).toBeGreaterThanOrEqual(90);
    expect(pillar(a, 'evidence')).toBeGreaterThanOrEqual(90);
  });

  it('measures near-zero fabrication exposure', () => {
    expect(a.fabrication.ratio).not.toBeNull();
    expect(a.fabrication.ratio as number).toBeLessThanOrEqual(0.05);
    expect(a.fabrication.variableRefs).toBeGreaterThan(500);
  });

  it('every check outcome carries evidence', () => {
    for (const p of a.pillars) {
      for (const c of p.checks) {
        expect(c.evidence.length, `${c.id} has no evidence`).toBeGreaterThan(0);
      }
    }
  });

  it('finds the load-bearing artifacts by path', () => {
    const allEvidence = a.pillars
      .flatMap((p) => p.checks)
      .flatMap((c) => c.evidence)
      .map((e) => e.path ?? '');
    expect(allEvidence.some((p) => p.includes('tokens-index.json'))).toBe(true);
    expect(allEvidence.some((p) => p.includes('components-index.json'))).toBe(true);
  });
});

describe('fixture: typical-2023-ds', () => {
  const a = assess(FIXTURE);

  it('scores poorly (D or F, well under 40)', () => {
    expect(a.overall.score).toBeLessThan(40);
    expect(['D', 'F']).toContain(a.overall.grade);
  });

  it('measures high fabrication exposure', () => {
    expect(a.fabrication.ratio as number).toBeGreaterThan(0.7);
    expect(a.fabrication.hardcoded).toBeGreaterThan(10);
  });

  it('names the right gaps: fabrication, no DTCG tokens, untyped variants, no MCP, no contracts', () => {
    const gapIds = a.gaps.map((g) => g.checkId);
    expect(gapIds).toContain('WL-2'); // hard-coded styles
    expect(gapIds).toContain('TOK-1'); // no DTCG token source
    expect(gapIds).toContain('CMP-3'); // untyped/loose props
    expect(gapIds).toContain('MS-1'); // no MCP
  });

  it('still credits what genuinely exists (CI + tailwind values)', () => {
    const enf = a.pillars.find((p) => p.id === 'enforcement');
    const ci = enf?.checks.find((c) => c.id === 'ENF-1');
    expect(ci?.score).toBe(1);
    const tok = a.pillars.find((p) => p.id === 'tokens');
    const pipeline = tok?.checks.find((c) => c.id === 'TOK-2');
    expect(pipeline?.score).toBeCloseTo(0.4);
  });

  it('gaps carry business framing and the closing AIR-DS capability', () => {
    for (const g of a.gaps) {
      expect(g.risk.length).toBeGreaterThan(20);
      expect(g.closedBy).toMatch(/AIR-DS/);
      expect(g.lostPoints).toBeGreaterThan(0);
    }
  });

  it('renders an executive report with grade, exposure, gaps, quick wins', () => {
    const md = renderMarkdown(a);
    expect(md).toContain('## Grade: F');
    expect(md).toContain('## Fabrication exposure');
    expect(md).toContain('## Top 5 gaps');
    expect(md).toContain('## Quick wins');
    expect(md).toContain('button.css');
  });
});

describe('empty directory', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-assess-empty-'));
  afterAll(() => fs.rmSync(empty, { recursive: true, force: true }));

  it('grades F gracefully with onboarding framing, no crash', () => {
    const a = assess(empty);
    expect(a.overall.grade).toBe('F');
    expect(a.overall.score).toBe(0);
    expect(a.filesScanned).toBe(0);
    expect(a.fabrication.ratio).toBeNull();
    const md = renderMarkdown(a);
    expect(md).toContain('cheapest possible moment to start AI-ready');
    expect(md).not.toContain('## Fabrication exposure');
  });
});
