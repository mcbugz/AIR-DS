/**
 * `<GenUIScreen>` — renders a VALIDATED generative-UI document with the real
 * @ds/react components.
 *
 * Fail-closed at every joint:
 *  - the document is re-validated on render; an invalid document THROWS
 *    (`GenUIValidationError`) rather than best-effort rendering,
 *  - the component map is built from the REGISTRY names against the @ds/react
 *    barrel exports; a registry name the barrel cannot answer for throws,
 *  - interactivity exists only through host `bindings`; an intent with no
 *    binding renders the control disabled (or inert) with a dev warning —
 *    a document can never smuggle behavior in.
 */

import { useMemo, type CSSProperties, type ComponentType, type ReactNode } from 'react';
import * as barrel from '@ds/react';
import type {
  ComponentNode,
  GenUIBindings,
  GenUIChild,
  GenUIDocument,
  GenUIError,
  LayoutNode,
  TextNode,
} from './schema.js';
import type { ComponentsIndex, GenUIRegistries } from './registryTypes.js';
import { validateDocument } from './validate.js';
import { buildSurfaces, type ComponentSurface } from './surface.js';
import { SCREEN_TITLE_TOKENS, TEXT_ROLES } from './vocab.js';
import { INTENT_EVENTS } from './intents.js';

export class GenUIValidationError extends Error {
  readonly errors: GenUIError[];
  constructor(errors: GenUIError[]) {
    super(
      `GenUI document failed validation with ${errors.length} error(s):\n` +
        errors.map((e) => `  [${e.rule}] ${e.path}: ${e.message}`).join('\n'),
    );
    this.name = 'GenUIValidationError';
    this.errors = errors;
  }
}

/* --------------------------------------------------------- component map -- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>;

/**
 * Dynamic map from registry names to the @ds/react barrel exports (NR-005:
 * the barrel is the only public entry point). Fail closed on any gap: a
 * registry that promises a component the barrel does not export is a
 * contract violation, not something to skip quietly.
 */
export function buildComponentMap(components: ComponentsIndex): Map<string, AnyComponent> {
  const map = new Map<string, AnyComponent>();
  const missing: string[] = [];
  for (const c of components.components) {
    const exported = (barrel as Record<string, unknown>)[c.name];
    // Function components are functions; forwardRef/memo components are objects.
    if (typeof exported === 'function' || (typeof exported === 'object' && exported !== null)) {
      map.set(c.name, exported as AnyComponent);
    } else {
      missing.push(c.name);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `GenUI fail-closed: registry components with no @ds/react barrel export: ${missing.join(', ')}. ` +
        'The registry and the barrel are generated from the same filesystem — regenerate with `pnpm generate`.',
    );
  }
  return map;
}

/* ---------------------------------------------------------------- styles -- */

const ALIGN_CSS: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

function spaceVar(family: 'gap' | 'inset', value: string | undefined): string | 0 | undefined {
  if (value === undefined) return undefined;
  if (value === 'none') return 0;
  return `var(--ds-space-${family}-${value})`;
}

function layoutStyle(node: LayoutNode): CSSProperties {
  const style: CSSProperties = {};
  const gap = spaceVar('gap', node.gap ?? 'md');
  const inset = spaceVar('inset', node.inset);
  if (gap !== undefined) style.gap = gap;
  if (inset !== undefined) style.padding = inset;
  if (node.align !== undefined) style.alignItems = ALIGN_CSS[node.align];
  switch (node.layout) {
    case 'stack':
      style.display = 'flex';
      style.flexDirection = 'column';
      break;
    case 'row':
      style.display = 'flex';
      style.flexDirection = 'row';
      style.flexWrap = 'wrap';
      if (node.align === undefined) style.alignItems = 'center';
      break;
    case 'grid':
      style.display = 'grid';
      style.gridTemplateColumns = `repeat(${node.columns ?? 2}, minmax(0, 1fr))`;
      break;
  }
  return style;
}

function textStyle(role: keyof typeof TEXT_ROLES): CSSProperties {
  const spec = TEXT_ROLES[role];
  if (!spec) throw new Error(`GenUI fail-closed: unknown text role '${String(role)}' reached the renderer.`);
  const style: CSSProperties = {
    margin: 0,
    fontSize: `var(${spec.tokens.fontSize})`,
    fontWeight: `var(${spec.tokens.fontWeight})` as CSSProperties['fontWeight'],
    lineHeight: `var(${spec.tokens.lineHeight})`,
  };
  if (spec.tokens.color) style.color = `var(${spec.tokens.color})`;
  return style;
}

/* -------------------------------------------------------------- renderer -- */

export interface GenUIScreenProps {
  /** The document to render. Validated on every render; invalid throws. */
  doc: unknown;
  /** The closed world the document is checked against. */
  registries: GenUIRegistries;
  /**
   * Host intent bindings: intent name → function. Documents reference intents
   * by name only; this is the single point where behavior enters. An intent
   * with no binding renders its control disabled/inert with a dev warning.
   */
  bindings?: GenUIBindings;
}

interface RenderContext {
  componentMap: Map<string, AnyComponent>;
  surfaces: Map<string, ComponentSurface>;
  bindings: GenUIBindings;
}

function warnDev(message: string): void {
  if (typeof process === 'undefined' || process.env['NODE_ENV'] !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(`[genui] ${message}`);
  }
}

function renderChild(ctx: RenderContext, child: GenUIChild, key: number): ReactNode {
  if (typeof child === 'string') return child; // React escapes strings — inert by construction
  if ('text' in child) return renderText(child as TextNode, key);
  if ('layout' in child) return renderLayout(ctx, child as LayoutNode, key);
  return renderComponent(ctx, child as ComponentNode, key);
}

function renderText(node: TextNode, key: number): ReactNode {
  const role = node.role ?? 'body';
  const spec = TEXT_ROLES[role];
  if (!spec) throw new Error(`GenUI fail-closed: unknown text role '${role}' reached the renderer.`);
  const Tag = spec.tag;
  return (
    <Tag key={key} style={textStyle(role)}>
      {node.text}
    </Tag>
  );
}

function renderLayout(ctx: RenderContext, node: LayoutNode, key: number): ReactNode {
  return (
    <div key={key} style={layoutStyle(node)}>
      {node.children.map((c, i) => renderChild(ctx, c, i))}
    </div>
  );
}

function renderComponent(ctx: RenderContext, node: ComponentNode, key: number): ReactNode {
  const name = node.component;
  const Component = ctx.componentMap.get(name);
  const surface = ctx.surfaces.get(name);
  if (!Component || !surface) {
    // Unreachable after validation; kept as a hard stop, never a silent skip.
    throw new Error(`GenUI fail-closed: component '${name}' reached the renderer without a registry entry.`);
  }

  const props: Record<string, unknown> = {};
  const { intent, ...rest } = node.props ?? {};
  Object.assign(props, rest);

  /* intent → host binding */
  if (typeof intent === 'string') {
    const target = INTENT_EVENTS[name];
    if (!target) {
      throw new Error(
        `GenUI fail-closed: <${name}> is intent-capable per the registry but has no INTENT_EVENTS entry.`,
      );
    }
    const binding = ctx.bindings[intent];
    if (binding) {
      props[target.event] = binding;
    } else {
      warnDev(
        `intent "${intent}" on <${name}> has no host binding; rendering the control ${
          target.disableWhenUnbound ? 'disabled' : 'inert'
        }.`,
      );
      if (target.disableWhenUnbound) props['isDisabled'] = true;
    }
  }

  /* children: slotted children fill element-typed props; the rest are React children */
  const children = node.children ?? [];
  const plain: GenUIChild[] = [];
  children.forEach((child, i) => {
    if (typeof child !== 'string' && child.slot && surface.slotProps.has(child.slot)) {
      props[child.slot] = renderChild(ctx, child, i);
    } else {
      plain.push(child);
    }
  });

  if (plain.length === 0) return <Component key={key} {...props} />;
  if (surface.requiresSingleElementChild) {
    // e.g. Tooltip: children is ONE ReactElement, not an array.
    return (
      <Component key={key} {...props}>
        {renderChild(ctx, plain[0] as GenUIChild, 0)}
      </Component>
    );
  }
  return (
    <Component key={key} {...props}>
      {plain.map((c, i) => renderChild(ctx, c, i))}
    </Component>
  );
}

export function GenUIScreen({ doc, registries, bindings = {} }: GenUIScreenProps): ReactNode {
  const { document, ctx } = useMemo(() => {
    const result = validateDocument(doc, registries);
    if (!result.valid) throw new GenUIValidationError(result.errors);
    return {
      document: doc as GenUIDocument,
      ctx: {
        componentMap: buildComponentMap(registries.components),
        surfaces: buildSurfaces(registries.components),
        bindings,
      } satisfies Omit<RenderContext, 'bindings'> & { bindings: GenUIBindings },
    };
  }, [doc, registries, bindings]);

  const titleStyle: CSSProperties = {
    margin: 0,
    fontSize: `var(${SCREEN_TITLE_TOKENS.fontSize})`,
    fontWeight: `var(${SCREEN_TITLE_TOKENS.fontWeight})` as CSSProperties['fontWeight'],
    lineHeight: `var(${SCREEN_TITLE_TOKENS.lineHeight})`,
  };

  return (
    <section
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-gap-lg)' }}
      data-genui-screen=""
    >
      {document.screen.title !== undefined ? <h1 style={titleStyle}>{document.screen.title}</h1> : null}
      {document.screen.nodes.map((node, i) => renderChild(ctx, node, i))}
    </section>
  );
}
