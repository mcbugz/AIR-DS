/**
 * Orchestrator: walk → probe → score → frame. Pure local computation.
 */
import { GAP_CATALOG } from './catalog.ts';
import { probeComponents } from './probes/components.ts';
import { probeEnforcement } from './probes/enforcement.ts';
import { probeEvidence } from './probes/evidence.ts';
import { probeFabrication } from './probes/fabrication.ts';
import { probeMachineSurface } from './probes/machine-surface.ts';
import { probeRegistries } from './probes/registries.ts';
import { probeTokens } from './probes/tokens.ts';
import { probeWhiteLabel } from './probes/whitelabel.ts';
import { gradeOf, overallScore, PILLARS, scorePillars, type Findings } from './scoring.ts';
import type { Assessment, Gap, QuickWin } from './types.ts';
import { RepoScan } from './walk.ts';

export const VERSION = '0.1.0';

export function collectFindings(scan: RepoScan): Findings {
  return {
    tokens: probeTokens(scan),
    components: probeComponents(scan),
    machine: probeMachineSurface(scan),
    enforcement: probeEnforcement(scan),
    registries: probeRegistries(scan),
    whitelabel: probeWhiteLabel(scan),
    evidence: probeEvidence(scan),
    fabrication: probeFabrication(scan),
  };
}

export function assess(path: string): Assessment {
  const scan = new RepoScan(path);
  const findings = collectFindings(scan);
  const pillars = scorePillars(findings);
  const score = overallScore(pillars);

  // Gaps: checks ranked by overall points lost (pillar weight * check deficit).
  const gaps: Gap[] = [];
  for (const p of pillars) {
    for (const c of p.checks) {
      const lost = (p.weight / 100) * c.weight * (1 - c.score);
      if (lost < 0.5) continue;
      const framing = GAP_CATALOG[c.id];
      if (framing === undefined) continue;
      gaps.push({
        checkId: c.id,
        pillar: p.id,
        title: c.title,
        lostPoints: Math.round(lost * 10) / 10,
        risk: framing.risk,
        closedBy: framing.closedBy,
      });
    }
  }
  gaps.sort((a, b) => b.lostPoints - a.lostPoints || (a.checkId < b.checkId ? -1 : 1));
  const topGaps = gaps.slice(0, 5);

  const quickWins: QuickWin[] = gaps
    .map((g) => {
      const framing = GAP_CATALOG[g.checkId];
      if (framing?.quickWin === undefined) return null;
      return { checkId: g.checkId, title: g.title, action: framing.quickWin, lostPoints: g.lostPoints };
    })
    .filter((q): q is QuickWin => q !== null)
    .slice(0, 4);

  return {
    tool: '@ds/assess',
    version: VERSION,
    scannedPath: scan.root,
    timestamp: new Date().toISOString(),
    filesScanned: scan.files.length,
    overall: { score, grade: gradeOf(score) },
    fabrication: findings.fabrication,
    pillars,
    gaps: topGaps,
    quickWins,
  };
}

export { PILLARS };
