/**
 * Evidence probe (brief practice 9 + auditability): does the repo keep
 * PROOF artifacts — a11y/contrast reports, metrics/benchmark history —
 * alongside the code, and can quality gates be re-run from a script?
 */
import type { RepoScan } from '../walk.ts';

export interface EvidenceFindings {
  a11yArtifacts: string[];
  metricsHistory: string[];
}

export function probeEvidence(scan: RepoScan): EvidenceFindings {
  const a11yArtifacts = scan.files
    .filter(
      (f) =>
        (f.ext === '.json' || f.ext === '.sarif') &&
        /(contrast|a11y|axe|accessibility|wcag)/i.test(f.base) &&
        !f.segs.includes('node_modules'),
    )
    .map((f) => f.rel);

  const metricsHistory = scan.files
    .filter(
      (f) =>
        f.ext === '.jsonl' ||
        /^(history|metrics)[-.].*\.(json|jsonl|csv)$/i.test(f.base) ||
        ((f.ext === '.json' || f.ext === '.csv') &&
          f.segs.some((s) => /^(metrics|benchmark-results)$/i.test(s))),
    )
    .map((f) => f.rel);

  return { a11yArtifacts, metricsHistory };
}
