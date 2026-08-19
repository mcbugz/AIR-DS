/**
 * @ds/assess — AI-readiness assessment scanner (Mandate v2 / M1).
 * Programmatic API: assess a local path, get the scored, evidence-backed
 * assessment; render it as executive markdown.
 */
export { assess, collectFindings, PILLARS, VERSION } from './assess.ts';
export { renderMarkdown } from './report.ts';
export { CHECKS, gradeOf, overallScore, scorePillars } from './scoring.ts';
export type { Findings, PillarDef } from './scoring.ts';
export { GAP_CATALOG } from './catalog.ts';
export type { GapFraming } from './catalog.ts';
export { RepoScan, isGenerated, isTestish } from './walk.ts';
export type { RepoFile } from './walk.ts';
export type {
  Assessment,
  CheckOutcome,
  CheckResult,
  Evidence,
  FabricationExposure,
  Gap,
  Grade,
  PillarId,
  PillarResult,
  QuickWin,
} from './types.ts';
