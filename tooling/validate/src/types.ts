/**
 * Shared types for the AIR-DS validation gauntlet (@ds/validate).
 *
 * Rule inventory (deterministic, no LLM — ADR-005):
 *   G1  token-closed-world        every var(--ds-*) must exist in registries/tokens-index.json
 *   G2  css-literal-discipline    component *.module.css values are var(--ds-*) + a fixed literal allowlist
 *   G3  property-category         --ds-space-* / --ds-size-* / --ds-radius-* / --ds-z-* / --ds-motion-*
 *                                 only appear on their legal CSS properties
 *   G4  dead-hook                 every registered --ds-<component>-* hook is consumed by that component's CSS
 *   G5  component-closed-world    imports from '@ds/react' must exist in registries/components-index.json
 *   G6  cross-hook-borrowing      component CSS may not consume another component's --ds-<component>-* hooks
 *   G7  generator-drift           `pnpm --filter @ds/react generate` must be a no-op against the working tree
 *   G8  state-selector            no :hover/:active/:focus/:focus-visible/:focus-within/:disabled in module.css
 *   NR-004 tailwind-classnames    utility-class strings in className are not part of this system
 *   NR-005 deep-import            only '@ds/react' root entry point is public
 *   NR-010 base-class-canon       no .root/.wrapper/.container base classes in component CSS
 *
 * Violations additionally carry an `nr` mapping to the negative-rule catalog
 * (docs/specs/negative-rules.md) when a G-rule detection matches a documented
 * hallucination shape (e.g. G1 on `--ds-blue-500` maps to NR-003).
 */

export type RuleId =
  | 'G1'
  | 'G2'
  | 'G3'
  | 'G4'
  | 'G5'
  | 'G6'
  | 'G7'
  | 'G8'
  | 'NR-004'
  | 'NR-005'
  | 'NR-010';

export type NrId =
  | 'NR-001'
  | 'NR-002'
  | 'NR-003'
  | 'NR-004'
  | 'NR-005'
  | 'NR-006'
  | 'NR-007'
  | 'NR-008'
  | 'NR-009'
  | 'NR-010';

export interface Violation {
  rule: RuleId;
  /** Negative-rule catalog id when the detection matches a documented hallucination shape. */
  nr: NrId | null;
  file: string;
  line: number;
  message: string;
}

export interface SourceFile {
  path: string;
  content: string;
}

export interface TokenEntry {
  name: string;
  cssVar: string;
  tier: 'semantic' | 'component' | string;
  type: string;
  description?: string;
  value?: string;
}

export interface TokensIndex {
  tokens: TokenEntry[];
}

export interface ComponentEntry {
  name: string;
  props?: { name: string }[];
}

export interface ComponentsIndex {
  components: ComponentEntry[];
}

/** Resolved registry context every rule checks against (always re-read fresh per run). */
export interface RegistryContext {
  /** All registered CSS custom property names, e.g. "--ds-color-text-primary". */
  tokenVars: Set<string>;
  /** Component-tier namespace segments, e.g. "button", "field", "alert". */
  componentSegments: Set<string>;
  /** Component-tier tokens grouped by segment. */
  componentTokensBySegment: Map<string, string[]>;
  /** Registered component names from components-index.json. */
  componentNames: Set<string>;
}

export interface ValidateResult {
  ok: boolean;
  violations: Violation[];
  filesChecked: number;
}

export type StepStatus = 'pass' | 'fail' | 'skip' | 'warn';

export interface StepResult {
  step: string;
  status: StepStatus;
  durationMs: number;
  detail?: string;
  violations?: Violation[];
}

export interface GauntletReport {
  ok: boolean;
  root: string;
  startedAt: string;
  durationMs: number;
  steps: StepResult[];
}

export interface GauntletOptions {
  root?: string;
  /** Step names to skip (e.g. ['typecheck']). */
  skip?: string[];
  /** If set, run only these steps (still in canonical order). */
  only?: string[];
  /** Stream child-process output to the console. */
  verbose?: boolean;
}
