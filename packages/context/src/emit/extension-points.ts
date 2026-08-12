import { COMPILER_PKG, CSS_PREFIX, REACT_PKG, SYSTEM_TITLE } from '../config.ts';
import { sortedComponents } from '../render.ts';
import type { RenderCtx } from '../render.ts';
import type { ComponentEntry } from '../types.ts';

/**
 * extension-points.json (ADR-006 §4): the machine contract for allowlisted
 * customization — token overrides, slots, composition — plus the explicit
 * forbidden list citing negative-rule ids. Everything is DERIVED from the
 * registries (deterministic); nothing here is hand-authored.
 */
export function emitExtensionPoints(ctx: RenderCtx): Map<string, string> {
  const { tokensIndex, patternsIndex, brand, ruleCatalog } = ctx.inputs;

  // Component-tier hooks: every component-tier cssVar in the token registry.
  const componentHooks = tokensIndex.tokens
    .filter((t) => t.tier === 'component')
    .map((t) => t.cssVar)
    .sort();

  // NR ids are cited only when they exist in the parsed catalog (no dangling cites).
  const knownRules = new Set(ruleCatalog.rules.map((r) => r.id));
  const cite = (...ids: string[]) => ids.filter((id) => knownRules.has(id));

  const contract = {
    $description:
      `GENERATED machine contract for allowlisted customization of ${SYSTEM_TITLE} (ADR-006 §4) — ` +
      `compiled by ${COMPILER_PKG} from the registries, do not edit. ` +
      `Anything not allowlisted here is closed. Source hash sha256:${ctx.sourceHash.slice(0, 16)}.`,
    brand,
    tokenOverrides: {
      /** The brand tier is the wholesale replacement surface (brands/<name>.json). */
      brandTier: 'full',
      /** Semantic mappings are replaced values-only via an allowlisted override layer agreed per engagement. */
      semanticTier: 'by-engagement',
      /** Per-component custom-property hooks — the component-tier override surface. */
      componentHooks,
    },
    composition: {
      slots: deriveSlots(ctx),
      patterns:
        patternsIndex === null
          ? []
          : patternsIndex.patterns.map((p) => ({
              name: p.name,
              ...(p.title !== undefined ? { title: p.title } : {}),
              ...(p.description !== undefined ? { description: p.description } : {}),
              ...(p.components !== undefined ? { components: [...p.components].sort() } : {}),
              ...(p.docFile !== undefined ? { docFile: p.docFile } : {}),
            })),
    },
    forbidden: [
      {
        surface: 'component-internals',
        detail:
          'Component source and component CSS are never forked, patched, or restyled; internals (including anything reached via non-public paths) are not an override surface.',
        rules: cite('NR-005', 'NR-009'),
      },
      {
        surface: 'base-classes',
        detail:
          'Component base classes (the lowercased component name) are internal styling contracts, not customization hooks — never target them from consumer CSS.',
        rules: cite('NR-010'),
      },
      {
        surface: 'deep-imports',
        detail: `Import only from \`${REACT_PKG}\`; deep dist paths are not public API.`,
        rules: cite('NR-005'),
      },
      {
        surface: 'cross-component-hooks',
        detail: `A component's \`${CSS_PREFIX}-<component>-*\` hooks style that component ONLY — overriding one component must never restyle another.`,
        rules: cite('NR-008'),
      },
    ],
  };

  return new Map([['extension-points.json', JSON.stringify(contract, null, 2) + '\n']]);
}

export interface SlotEntry {
  component: string;
  kind: 'children-slots' | 'render-prop' | 'dismiss-hook';
  parts?: string[];
  prop?: string;
  type?: string;
}

/**
 * Composition slots derived from the component registry:
 * - children-slots: family components (shared name stem) rendered as JSX
 *   children inside the parent's own registry example (Card -> CardBody/…,
 *   RadioGroup -> Radio, Tabs -> Tab/TabList/TabPanel);
 * - render-prop: props typed as ReactElement/ReactNode (Dialog `trigger`);
 * - dismiss-hook: `onDismiss` callbacks (Alert).
 */
function deriveSlots(ctx: RenderCtx): SlotEntry[] {
  const components = sortedComponents(ctx);
  const slots: SlotEntry[] = [];

  const stem = (name: string): string => name.replace(/s$/, '');
  const related = (parent: ComponentEntry, child: ComponentEntry): boolean =>
    child.name.startsWith(stem(parent.name)) || parent.name.startsWith(stem(child.name));

  const firstJsxIndex = (example: string, name: string): number =>
    example.search(new RegExp(`<${name}[\\s/>]`));

  for (const comp of components) {
    // A part must be a related (shared name stem) component whose FIRST JSX use
    // in the parent's example comes after the parent's own opening tag — this
    // keeps wrapper context out (CardBody's example wraps in <Card>, but Card
    // is CardBody's container, not its slot).
    const selfIdx = firstJsxIndex(comp.example, comp.name);
    const parts = components
      .filter((other) => {
        if (other.name === comp.name || !related(comp, other)) return false;
        const otherIdx = firstJsxIndex(comp.example, other.name);
        return selfIdx >= 0 && otherIdx > selfIdx;
      })
      .map((other) => other.name)
      .sort();
    if (parts.length > 0) slots.push({ component: comp.name, kind: 'children-slots', parts });

    for (const prop of comp.props) {
      if (/\bReact(Element|Node)\b/.test(prop.type)) {
        slots.push({
          component: comp.name,
          kind: 'render-prop',
          prop: prop.name,
          type: prop.type.includes('ReactElement') ? 'ReactElement' : 'ReactNode',
        });
      } else if (prop.name === 'onDismiss') {
        slots.push({ component: comp.name, kind: 'dismiss-hook', prop: prop.name });
      }
    }
  }

  return slots.sort(
    (a, b) =>
      a.component.localeCompare(b.component) ||
      a.kind.localeCompare(b.kind) ||
      (a.prop ?? '').localeCompare(b.prop ?? ''),
  );
}
