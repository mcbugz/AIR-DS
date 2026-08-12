/**
 * @ds/validate — deterministic validation gauntlet for AIR-DS (ADR-005).
 * Programmatic API for the CLI, the MCP server's validate_usage tool, the
 * eval runner, and the benchmark scorer.
 */

export { runGauntlet, STEP_ORDER } from './gauntlet.ts';
export { validateFiles, validateSources } from './validate.ts';
export {
  appendMetricsLine,
  buildMetricsLine,
  countFabrications,
  gauntletMetricsFromReport,
  gitCommitTs,
  gitSha,
  historyPath,
  readHistory,
  registryCounts,
} from './metrics/record.ts';
export { groupBySha, renderReport } from './metrics/report.ts';
export type {
  BenchmarkMetrics,
  EvalMetrics,
  GauntletMetrics,
  MetricsLine,
  RegistryCounts,
} from './metrics/record.ts';
export { buildRegistryContext, findRepoRoot, loadRegistryContext } from './registry.ts';
export { checkCssFile } from './rules/css-rules.ts';
export { checkCodeFile } from './rules/code-rules.ts';
export {
  checkDeadHooks,
  checkComponentCoverage,
  loadWaivers,
  reactSourceFiles,
  componentDirs,
} from './workspace.ts';
export type {
  GauntletOptions,
  GauntletReport,
  StepResult,
  StepStatus,
  RegistryContext,
  RuleId,
  NrId,
  SourceFile,
  TokensIndex,
  ComponentsIndex,
  ValidateResult,
  Violation,
} from './types.ts';
