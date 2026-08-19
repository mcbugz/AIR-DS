/**
 * @ds/assess — shared types.
 *
 * Everything here is deterministic data: probes read files, findings carry
 * evidence (paths + counts), checks turn findings into 0..1 scores, pillars
 * aggregate checks, the assessment aggregates pillars. No vibes anywhere —
 * every score line is traceable to files on disk.
 */

/** One piece of proof behind a score line. */
export interface Evidence {
  /** Human-readable statement of what was (or was not) found. */
  detail: string;
  /** Repo-relative path backing the statement, when one exists. */
  path?: string;
  /** Count backing the statement, when one exists. */
  count?: number;
}

export type PillarId =
  | 'tokens'
  | 'components'
  | 'machine-surface'
  | 'enforcement'
  | 'white-label'
  | 'evidence';

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

/** What a check's run() returns. */
export interface CheckOutcome {
  /** Achieved fraction of the check's weight, 0..1. */
  score: number;
  evidence: Evidence[];
}

export interface CheckResult extends CheckOutcome {
  id: string;
  title: string;
  /** Points within the pillar; a pillar's check weights sum to 100. */
  weight: number;
  /** Points actually earned (weight * score), rounded to 0.1. */
  earned: number;
}

export interface PillarResult {
  id: PillarId;
  name: string;
  /** Pillar weight in the overall score; all pillar weights sum to 100. */
  weight: number;
  /** Which of the brief §5 ten practices this pillar operationalizes. */
  practices: number[];
  /** 0..100. */
  score: number;
  checks: CheckResult[];
}

/** Honest fabrication-exposure sample over the repo's own styles. */
export interface FabricationExposure {
  /** Style files sampled (component-ish styles; tests/fixtures/generated excluded). */
  sampledFiles: number;
  /** Design-token references found (var(--*), $scss-vars). */
  variableRefs: number;
  /** Hard-coded values found (hex/colors-fn/named colors, non-zero px/rem/em/ms). */
  hardcoded: number;
  /** hardcoded / (hardcoded + variableRefs); null when nothing was sampled. */
  ratio: number | null;
  /** Worst offenders, for the report. */
  worstFiles: Array<{ path: string; hardcoded: number; variableRefs: number }>;
}

export interface Gap {
  checkId: string;
  pillar: PillarId;
  title: string;
  /** Overall points lost to this gap (pillar weight * check deficit). */
  lostPoints: number;
  risk: string;
  /** The AIR-DS capability that closes the gap. */
  closedBy: string;
}

export interface QuickWin {
  checkId: string;
  title: string;
  action: string;
  lostPoints: number;
}

export interface Assessment {
  tool: '@ds/assess';
  version: string;
  scannedPath: string;
  timestamp: string;
  filesScanned: number;
  overall: { score: number; grade: Grade };
  fabrication: FabricationExposure;
  pillars: PillarResult[];
  gaps: Gap[];
  quickWins: QuickWin[];
}
