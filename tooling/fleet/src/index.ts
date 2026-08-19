/**
 * @ds/fleet public API.
 *
 * `checkPolicy` is the clean integration point for the @ds/validate gauntlet
 * (see INTEGRATION.md): verdict of a repo's recorded metrics + config against
 * its committed fleet-policy.json. Everything else supports the collector
 * (`ds-fleet collect`) and the static dashboard (`ds-fleet render`).
 */

export { historyPath, readHistory, groupBySha, type ShaGroup } from './history.ts';
export {
  fleetDeltas,
  fleetHeadline,
  fleetRollup,
  healthScore,
  repoDeltas,
  repoLatest,
  repoRates,
  repoTrend,
} from './rollup.ts';
export {
  POLICY_FILE,
  canonicalTokenName,
  checkPolicy,
  policyPath,
  runPolicyChecks,
  semanticOverrideNames,
  validatePolicyShape,
  type CheckPolicyOptions,
  type PolicyCheckInputs,
} from './policy.ts';
export {
  collectFleet,
  collectRepo,
  readManifest,
  refsFromPaths,
  type RepoRef,
} from './collect.ts';
export { buildDashboard, type RenderOptions } from './render/build.ts';
export type * from './types.ts';
