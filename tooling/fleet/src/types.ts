/**
 * @ds/fleet shared types.
 *
 * `MetricsLine` mirrors the serialized contract of metrics/history.jsonl as
 * written by @ds/validate (tooling/validate/src/metrics/record.ts). It is a
 * DATA contract over a committed JSONL format, deliberately re-declared here
 * rather than imported: @ds/fleet must stay import-free of @ds/validate so
 * the gauntlet can depend on @ds/fleet's policy API without a workspace
 * dependency cycle.
 */

export interface GauntletMetrics {
  passed: boolean;
  steps: number;
  /** Per-step wall-clock durations in ms, keyed by step name. */
  durations: Record<string, number>;
}

export interface EvalMetrics {
  overall: number;
  critical: number;
  passed: number;
  total: number;
}

export interface BenchmarkSourceAggregate {
  avgTokenCompliance: number;
  fabrications: number;
  gauntletPassRate: number;
}

export interface BenchmarkMetrics {
  mode: string;
  scenarios: number;
  sources: Record<string, BenchmarkSourceAggregate>;
  axe: 'ran' | 'skipped';
}

export interface StoriesAxeMetrics {
  stories: number;
  storiesWithViolations: number;
  violations: number;
  serious: number;
  critical: number;
  gatePassed: boolean;
}

export interface RegistryCounts {
  tokens: number;
  components: number;
}

export interface MetricsLine {
  ts: string;
  git_sha: string;
  source: 'gauntlet' | 'evals' | 'benchmark' | 'stories-axe';
  gauntlet?: GauntletMetrics;
  evals?: EvalMetrics;
  benchmark?: BenchmarkMetrics;
  storiesAxe?: StoriesAxeMetrics;
  fabrications: number;
  registry_counts: RegistryCounts;
}

/* ------------------------------------------------------------------ policy */

export type SemanticTierRule = 'forbidden' | 'allowlist';

export interface TokenOverridesPolicy {
  semanticTier: SemanticTierRule;
  /** Canonical token names (see canonicalTokenName) permitted when semanticTier = "allowlist". */
  allowlist?: string[];
}

/** fleet-policy.json — every knob optional; only declared knobs are checked. */
export interface FleetPolicy {
  tokenOverrides?: TokenOverridesPolicy;
  /** Latest recorded evals.critical must be >= this (typically 1.0). */
  minEvalCritical?: number;
  /** First-pass gauntlet rate over the full history must be >= this. */
  minFirstPass?: number;
  /** Steps that must appear in the latest recorded gauntlet run. */
  requiredGauntletSteps?: string[];
  /** "required": latest stories-axe recording must exist and its gate must pass. */
  browserAxe?: 'required' | 'optional';
  /** Latest snapshot fabrications must be <= this (checked only when present). */
  maxFabrications?: number;
}

export type PolicyCheckId =
  | 'policy-shape'
  | 'token-overrides'
  | 'min-eval-critical'
  | 'min-first-pass'
  | 'required-gauntlet-steps'
  | 'browser-axe'
  | 'max-fabrications';

export interface PolicyCheckResult {
  id: PolicyCheckId;
  ok: boolean;
  expected: string;
  actual: string;
  detail: string;
}

export interface PolicyVerdict {
  repoRoot: string;
  policyPath: string | null;
  policyPresent: boolean;
  ok: boolean;
  checks: PolicyCheckResult[];
}

/* -------------------------------------------------------------- fleet data */

export interface RepoLatest {
  sha: string;
  ts: string;
  gauntletPassed: boolean | null;
  gauntletSteps: string[] | null;
  evals: EvalMetrics | null;
  storiesAxe: StoriesAxeMetrics | null;
  /** system vs baseline avg token compliance from the latest benchmark line. */
  benchmark: { systemCompliance: number | null; baselineCompliance: number | null; axe: string } | null;
  fabrications: number;
  registry: RegistryCounts;
}

export interface RepoRates {
  /** First-pass gauntlet rate over the whole history. */
  gauntletFirstPass: { passed: number; total: number; rate: number | null };
  /** Latest evals as a weighted-ready fraction. */
  evalCompliance: { passed: number; total: number; rate: number } | null;
  /** Sum of fabrications over every recorded line. */
  fabricationsTotal: number;
  /** Total recorded lines (runs) in the history. */
  runsTotal: number;
}

/** Chronological per-release (per git sha) series for sparklines. */
export interface RepoTrend {
  sha: string[];
  ts: string[];
  gauntletPass: (0 | 1 | null)[];
  evalOverall: (number | null)[];
  fabrications: number[];
  tokens: number[];
  components: number[];
}

export interface RepoDeltas {
  evalOverall: number | null;
  fabrications: number | null;
  tokens: number | null;
  components: number | null;
  gauntletPass: number | null;
}

export interface RepoPolicySummary {
  present: boolean;
  ok: boolean;
  failing: PolicyCheckId[];
  checks: PolicyCheckResult[];
}

export interface RepoReport {
  id: string;
  root: string;
  lines: number;
  latest: RepoLatest | null;
  rates: RepoRates;
  trend: RepoTrend;
  deltas: RepoDeltas;
  /** Composite 0..1 health score (see healthScore in rollup.ts for the formula). */
  health: number;
  policy: RepoPolicySummary;
}

export interface FleetHeadline {
  /** Fabrications per recorded run across every line of every repo. */
  hallucinationRate: number | null;
  /** Weighted first-pass gauntlet rate: sum(passed runs) / sum(runs). */
  firstPassRate: number | null;
  /** Weighted eval compliance over latest snapshots: sum(passed) / sum(total). */
  evalCompliance: number | null;
  /** Latest stories-axe: sum(clean stories) / sum(stories) over repos that record it. */
  a11yCleanRate: number | null;
  /** Repos with a policy present AND passing, over all repos. */
  policyCompliance: number | null;
}

export interface FleetDeltas {
  /** Mean per-repo latest-vs-previous eval overall delta (repos with both). */
  evalOverall: number | null;
  /** Sum of per-repo latest-vs-previous fabrication deltas. */
  fabrications: number | null;
  /** Mean per-repo latest-vs-previous gauntlet pass delta. */
  gauntletPass: number | null;
}

export interface FleetRollup {
  headline: FleetHeadline;
  /** Bottom repos by health, worst first. */
  worst: { id: string; health: number }[];
  deltas: FleetDeltas;
  totals: {
    repos: number;
    runs: number;
    fabrications: number;
    tokens: number;
    components: number;
    policiesPresent: number;
    policiesPassing: number;
  };
}

export interface FleetData {
  $schema: 'ds-fleet/fleet-data.v1';
  /** Max line timestamp across the fleet — deterministic for a given input set. */
  generatedAt: string;
  repos: RepoReport[];
  fleet: FleetRollup;
}
