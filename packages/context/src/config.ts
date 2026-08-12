/**
 * Build-time constants (ADR-001). Per-customer builds may rename the npm
 * scope and CSS prefix by changing ONLY these two values — no template edits.
 */
export const DS_SCOPE = '@ds';
export const CSS_PREFIX = '--ds';

export const REACT_PKG = `${DS_SCOPE}/react`;
export const COMPILER_PKG = `${DS_SCOPE}/context`;
export const COMPILER_VERSION = '0.1.0';

export const SYSTEM_NAME = 'the design system';
export const SYSTEM_TITLE = 'Design System';

/** Token-budget ceilings (estimated tokens, chars/4 heuristic). */
export const BUDGETS = {
  index: 2_000, // llms.txt
  slice: 25_000, // each llms-*.txt slice (llms-full.txt is exempt)
} as const;

/** ~4 chars per token — the industry-standard rough estimator. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
