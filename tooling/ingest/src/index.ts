/** @ds/ingest public API. */
export { validateIntake, formatErrors, PALETTE_FAMILIES } from "./intake.js";
export type { Intake, PaletteInput, DistributionInput, ValidationError, ValidationResult, PaletteFamily } from "./intake.js";
export { generateRamp, RAMP_STEPS } from "./ramp.js";
export type { Ramp, RampStep, RampKind } from "./ramp.js";
export { contrastRatio, relativeLuminance, hexToOklch, oklchToHex, normalizeHex } from "./oklch.js";
export type { Oklch } from "./oklch.js";
export { fixPalette, evaluatePairs, loadMandatedPairs, loadSemanticColorRefs, FALLBACK_THRESHOLD } from "./aa.js";
export type { Palette, AaAdjustment, AaFixResult, MandatedPair, MandatedPairSet, PairResult, PaletteRef } from "./aa.js";
export { generateBrand } from "./brand.js";
export type { GenerateResult, RampSource } from "./brand.js";
export { runPipeline, readIntakeFile, hashRegistries, REPO_ROOT } from "./pipeline.js";
export type { PipelineOptions, PipelineResult } from "./pipeline.js";
export { renderIntakeReport, renderPublishPlan } from "./report.js";
export type { PipelineReportData, TokensBuildSummary } from "./report.js";
