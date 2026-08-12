/**
 * `audit_checklist` — the deterministic pre-PR self-check list, assembled at
 * runtime from the loaded registries, the negative-rule catalog, and the
 * contributing canon (CONTRIBUTING-COMPONENT.md + CLAUDE.md rules). Agents
 * self-check against these items; only deterministic gates approve (ADR-005).
 */

import type { Registry } from './registry.js';
import type { NegativeRuleCatalog } from './negativeRules.js';

export type ChecklistScope =
  | 'all'
  | 'tokens'
  | 'components'
  | 'a11y'
  | 'stories'
  | 'negative-rules';

export const CHECKLIST_SCOPES: ChecklistScope[] = [
  'all',
  'tokens',
  'components',
  'a11y',
  'stories',
  'negative-rules',
];

export interface ChecklistItem {
  id: string;
  category: Exclude<ChecklistScope, 'all'>;
  requirement: string;
  source: string;
}

export function buildChecklist(
  registry: Registry,
  catalog: NegativeRuleCatalog,
  scope: ChecklistScope = 'all',
): { scope: ChecklistScope; items: ChecklistItem[] } {
  const items: ChecklistItem[] = [];

  /* --- token discipline -------------------------------------------------- */
  items.push(
    {
      id: 'tokens-no-raw-values',
      category: 'tokens',
      requirement:
        'Every color, font, size, space, radius, shadow, and motion value in component CSS is var(--ds-*). Allowed literals: 0, 100%, auto, none, currentColor, and layout keywords.',
      source: 'CLAUDE.md rule 2',
    },
    {
      id: 'tokens-semantic-intent',
      category: 'tokens',
      requirement:
        'Token names describe intent, not appearance (--ds-color-surface-raised, never --ds-blue-500 at usage sites). Brand-tier tokens are never referenced by components.',
      source: 'CLAUDE.md rule 4 / ADR-003',
    },
    {
      id: 'tokens-registry-existence',
      category: 'tokens',
      requirement: `Every --ds-* variable used exists in registries/tokens-index.json (${registry.tokens.count} tokens for brand '${registry.tokens.brand}'). A token not in the registry is provably fabricated.`,
      source: 'CLAUDE.md rule 5 / tokens-index.json',
    },
    {
      id: 'tokens-space-vs-size',
      category: 'tokens',
      requirement:
        '--ds-space-* only in margin/padding/gap/inset; box dimensions use --ds-size-control-* / --ds-size-icon-*.',
      source: 'NR-006 / CONTRIBUTING-COMPONENT.md',
    },
    {
      id: 'tokens-own-hooks-only',
      category: 'tokens',
      requirement:
        "Component CSS consumes its own --ds-<component>-* hooks where the registry provides them, semantic-tier tokens otherwise — never another component's hooks.",
      source: 'NR-008 / CONTRIBUTING-COMPONENT.md',
    },
  );

  /* --- registry / component contract ------------------------------------ */
  items.push(
    {
      id: 'components-registry-existence',
      category: 'components',
      requirement: `Every import from '@ds/react' is one of the ${registry.components.components.length} registered components: ${registry.components.components.map((c) => c.name).join(', ')}. Deep-path imports are illegal (NR-005).`,
      source: 'CLAUDE.md rule 5 / components-index.json',
    },
    {
      id: 'components-props-closed',
      category: 'components',
      requirement:
        "Only props listed in the registry (plus the racBase component's own props when racBase is set) are legal. Variant unions are exact literal types — invalid combinations must fail typecheck.",
      source: 'CLAUDE.md rule 6 / components-index.json',
    },
    {
      id: 'components-base-class-canon',
      category: 'components',
      requirement:
        'Base CSS class is the lowercased component name (.button for Button), never .root/.wrapper/.container; one class per variant and per size value.',
      source: 'NR-010 / CONTRIBUTING-COMPONENT.md',
    },
    {
      id: 'components-state-selectors',
      category: 'components',
      requirement:
        'Interaction states styled via RAC data attributes ([data-hovered], [data-focus-visible], [data-disabled]) — never :hover/:focus-visible/:disabled pseudo-classes.',
      source: 'NR-009 / CONTRIBUTING-COMPONENT.md',
    },
  );

  /* --- a11y musts -------------------------------------------------------- */
  items.push(
    {
      id: 'a11y-rac-base',
      category: 'a11y',
      requirement:
        'Interactive components build on the react-aria-components base named in the registry (racBase); keyboard, ARIA, and focus management are never hand-rolled.',
      source: 'CLAUDE.md rule 7',
    },
    {
      id: 'a11y-axe-clean',
      category: 'a11y',
      requirement:
        'Every component test file runs an axe audit and it passes; focus ring uses --ds-border-width-2 + --ds-color-border-focus + --ds-shadow-focus-ring on [data-focus-visible].',
      source: 'CONTRIBUTING-COMPONENT.md',
    },
    {
      id: 'a11y-contrast-pairs',
      category: 'a11y',
      requirement: registry.contrast
        ? `Only foreground/background pairs present in contrast-report.json are used (${registry.contrast.standard}, threshold ${registry.contrast.threshold}; current failures: ${registry.contrast.failures}).`
        : 'Only foreground/background pairs present in contrast-report.json are used (report not found in this registry dir).',
      source: 'contrast-report.json / ADR-003',
    },
    {
      id: 'a11y-reduced-motion',
      category: 'a11y',
      requirement: 'Animations honor @media (prefers-reduced-motion: reduce).',
      source: 'CONTRIBUTING-COMPONENT.md',
    },
  );

  /* --- story / test contract --------------------------------------------- */
  items.push(
    {
      id: 'stories-per-variant',
      category: 'stories',
      requirement:
        'One story per variant value, one sizes showcase, one story per supported interaction state, plus one per variant×state combination that has its own CSS selector.',
      source: 'CLAUDE.md rule 8 / CONTRIBUTING-COMPONENT.md',
    },
    {
      id: 'stories-play-interactions',
      category: 'stories',
      requirement:
        'At least one play-function test asserts the primary event fires, and one asserts the blocked state (disabled/loading) does NOT fire it.',
      source: 'CONTRIBUTING-COMPONENT.md',
    },
    {
      id: 'stories-no-fabricated-wrappers',
      category: 'stories',
      requirement:
        'Story layout wrappers use plain elements with inline var(--ds-*) styles — no <Stack>/<Box> (they do not exist, NR-001).',
      source: 'CONTRIBUTING-COMPONENT.md / NR-001',
    },
  );

  /* --- negative rules (from the live catalog) ----------------------------- */
  for (const rule of catalog.rules.values()) {
    items.push({
      id: `nr-${rule.id.toLowerCase()}`,
      category: 'negative-rules',
      requirement: `${rule.id} ${rule.title} — wrong: ${rule.wrong} → right: ${rule.right}${rule.why ? ` (why: ${rule.why})` : ''}`,
      source: catalog.sourceFile ?? 'docs/specs/negative-rules.md',
    });
  }

  const filtered = scope === 'all' ? items : items.filter((i) => i.category === scope);
  return { scope, items: filtered };
}
