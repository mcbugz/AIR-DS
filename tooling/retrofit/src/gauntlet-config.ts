/** Gauntlet starter config for a retrofit target: which AIR-DS lint rules
 *  apply meaningfully to THEIR codebase, configured against the SYNTHESIZED
 *  registries. The crown jewel is the closed-world token check — after
 *  retrofit, an agent can no longer fabricate THEIR tokens. */

import type { RetrofitResult } from './types.js';

export interface GauntletRuleConfig {
  id: string;
  title: string;
  applies: 'enforce' | 'advisory' | 'off';
  reason: string;
  config?: Record<string, unknown>;
}

export interface GauntletStarterConfig {
  $description: string;
  target: string;
  registries: string;
  steps: string[];
  rules: GauntletRuleConfig[];
}

/** Distinct leading prefixes across the synthesized vars, delimiter preserved
 *  (`--btn_`, `--atlas-`); delimiter-less camelCase vars are listed whole. */
export function detectVarPrefixes(cssVars: string[]): string[] {
  const prefixes = new Set<string>();
  for (const v of cssVars) {
    const m = /^--[A-Za-z0-9]+[-_]/.exec(v);
    prefixes.add(m !== null ? m[0] : v);
  }
  return [...prefixes].sort();
}

export function buildGauntletConfig(result: RetrofitResult): GauntletStarterConfig {
  const tokens = result.tokensIndex?.tokens ?? [];
  const shipped = tokens.filter((t) => t.provenance.proposed !== true);
  const proposed = tokens.length - shipped.length;
  const pkg = result.componentsIndex?.package ?? 'unknown';
  const tailwindDetected = result.detection.tailwind !== null;

  const rules: GauntletRuleConfig[] = [
    {
      id: 'G1-closed-world-tokens',
      title: 'Closed-world token check (crown jewel)',
      applies: 'enforce',
      reason:
        'Every var(--*) reference in CSS/JSX must exist in the synthesized registries/tokens-index.json. ' +
        'A custom property not in the registry is provably fabricated — this deterministically ends token ' +
        'hallucination for THIS design system without rewriting a single component.',
      config: {
        registry: 'registries/tokens-index.json',
        mode: 'all-custom-properties',
        detectedVarPrefixes: detectVarPrefixes(shipped.map((t) => t.cssVar)),
        shippedTokens: shipped.length,
        proposedTokens: proposed,
        note: proposed > 0
          ? 'Proposed (tailwind/DTCG) vars are flagged provenance.proposed=true — exclude them from enforcement until adopted in shipped CSS.'
          : undefined,
      },
    },
    {
      id: 'G5-closed-world-components',
      title: 'Closed-world component check',
      applies: 'enforce',
      reason:
        `Named imports from "${pkg}" must exist in the synthesized registries/components-index.json — ` +
        'an unlisted component name is provably fabricated.',
      config: {
        registry: 'registries/components-index.json',
        package: pkg,
        components: (result.componentsIndex?.components ?? []).map((c) => c.name),
      },
    },
    {
      id: 'no-hardcoded-colors',
      title: 'No hard-coded color literals in component CSS',
      applies: 'advisory',
      reason:
        `The scan found ${result.hardcoded.length} hard-coded color literal(s) in non-token declarations ` +
        '(listed in RETROFIT.md). Enforce after the team tokenizes or waives each one — enabling it cold ' +
        'would fail the existing codebase, not just new agent output.',
      config: { currentViolations: result.hardcoded.length },
    },
    {
      id: 'NR-003-raw-palette-scales',
      title: 'No raw palette-scale tokens at usage sites',
      applies: 'advisory',
      reason:
        'The target mixes semantic and raw-palette custom properties (both are registered). Adopt semantic-name ' +
        'aliases first; then flip this to enforce so new code stops consuming raw scales directly.',
    },
    {
      id: 'NR-004-utility-classes',
      title: 'No Tailwind-style utility classes in component code',
      applies: tailwindDetected ? 'off' : 'advisory',
      reason: tailwindDetected
        ? 'Tailwind IS part of this target (tailwind config detected) — utility classes are intentional here. ' +
          'Revisit only if the team migrates off Tailwind.'
        : 'No Tailwind detected; utility-class strings in component code would be drift worth flagging.',
    },
    {
      id: 'NR-005-deep-imports',
      title: 'No deep package imports',
      applies: 'off',
      reason: `The public subpath layout of "${pkg}" was not analyzed — configure the allowed subpaths before enabling.`,
    },
    {
      id: 'NR-008-cross-hook-borrowing',
      title: 'No cross-component token borrowing',
      applies: 'off',
      reason: 'No component-tier token namespaces exist in the synthesized registry (all tokens are best-effort semantic).',
    },
    {
      id: 'NR-009-state-selectors',
      title: 'States via react-aria data attributes, not pseudo-classes',
      applies: 'off',
      reason: 'The target does not use react-aria-components — its pseudo-class state styling is its own convention.',
    },
    {
      id: 'NR-010-base-class-canon',
      title: 'Component base-class naming canon',
      applies: 'off',
      reason: 'The target\'s CSS class convention was not analyzed; the AIR-DS canon does not transfer as-is.',
    },
    {
      id: 'NR-013-motion-gating',
      title: 'Movement gated behind prefers-reduced-motion',
      applies: 'advisory',
      reason: 'Applies to any CSS; audit the target\'s transitions/animations before enforcing.',
    },
  ];

  return {
    $description:
      'GENERATED gauntlet starter config synthesized by @ds/retrofit. Declares which AIR-DS validation rules ' +
      'apply meaningfully to this retrofit target, configured against the SYNTHESIZED registries in ./registries. ' +
      'enforce = safe to gate merges today; advisory = report, do not block (existing code would fail); ' +
      'off = does not transfer to this target (reason given). Wire the enforce rules into CI first — the ' +
      'closed-world checks are deterministic and need no code changes in the target.',
    target: pkg,
    registries: './registries',
    steps: ['lint', 'registry-check'],
    rules,
  };
}
