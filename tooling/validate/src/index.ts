/**
 * @ds/validate — deterministic validation gauntlet for AIR-DS (ADR-005).
 * Programmatic API for the CLI, the MCP server's validate_usage tool, the
 * eval runner, and the benchmark scorer.
 */

export { runGauntlet, STEP_ORDER } from './gauntlet.ts';
export { validateFiles, validateSources } from './validate.ts';
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
