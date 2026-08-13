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
/**
 * F6 bundle-shape check: `registriesPresent(dir)` reports whether the
 * tokens/components registries exist under `<dir>/registries` — the gauntlet
 * gates on it, and tooling/ingest calls it to prove a re-emitted customer
 * bundle ships its closed-world contract.
 */
export { registriesPresent } from './registry.ts';
export { checkCssFile } from './rules/css-rules.ts';
export { checkCodeFile } from './rules/code-rules.ts';
export { checkModuleClassRefs, cssModuleClasses } from './rules/module-classes.ts';
// The shared allowed-literal ruleset (single source of truth for @ds/validate
// and @ds/mcp — see rules/allowlist.ts header).
export {
  NAMED_CSS_COLORS,
  COLOR_CAPABLE_CSS_PROP,
  JSX_COLOR_STYLE_PROP,
  JSX_DIMENSION_STYLE_PROP,
  UNITLESS_TOKEN_PROPS,
  camelToKebab,
  extractJsxStyleObjects,
  maskVarCalls,
  scanCssValueLiterals,
  scanJsxStyleValue,
} from './rules/allowlist.ts';
export type { LiteralViolation, LiteralViolationKind } from './rules/allowlist.ts';
export {
  checkDeadHooks,
  checkComponentCoverage,
  headFileHashes,
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
