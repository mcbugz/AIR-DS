/**
 * The generative-UI wire format, version 1.0.
 *
 * A document is pure data: an agent (or server) emits it at runtime to
 * describe a screen. It can only NAME things — registry components, layout
 * primitives from a closed vocabulary, text roles, and intent names. It can
 * never carry code, styles, classes, or event handlers. The validator
 * (`validateDocument`) is the deterministic gate; the renderer
 * (`GenUIScreen`) refuses anything the validator refuses.
 *
 * The JSON Schema for this format ships as `genui-schema.json`
 * (`@ds/genui/schema`); these types are its TypeScript mirror.
 */

/** Wire-format version this package validates and renders. */
export const GENUI_VERSION = '1.0';

/** Hard DoS-hygiene limits enforced by the validator. */
export const LIMITS = {
  /** Maximum nesting depth of nodes (screen.nodes is depth 1). */
  maxDepth: 24,
  /** Maximum total node count (component + layout + text nodes). */
  maxNodes: 500,
  /** Maximum length of any string: text, title, or string prop value. */
  maxStringLength: 5000,
} as const;

/**
 * A component node names one registry component. `props` may only use the
 * component's registry surface (own props + enumerated racProps) plus the
 * global structural props (`id`, `aria-*`) and `intent`. Event props are
 * forbidden — interactivity is declared as an intent NAME that the host
 * binds to a function at render time.
 */
export interface ComponentNode {
  component: string;
  props?: Record<string, unknown>;
  children?: GenUIChild[];
  /**
   * Names an element-typed prop of the PARENT component node that this
   * child fills (e.g. `slot: "trigger"` on a Button child of a Dialog).
   * Legal slot names are derived from the registry: any element-typed
   * prop of the parent other than `children`.
   */
  slot?: string;
}

/**
 * Layout primitives are part of the CONTRACT, not fake components — this is
 * the safe answer to NR-001. The vocabulary is closed and token-named:
 * `gap`/`inset` values are the suffixes of the `--ds-space-gap-*` /
 * `--ds-space-inset-*` tokens present in tokens-index.json (plus `none`),
 * never free CSS.
 */
export interface LayoutNode {
  layout: 'stack' | 'row' | 'grid';
  /** Token-vocabulary gap between children (`none` | `sm` | `md` | `lg`). */
  gap?: string;
  /** Token-vocabulary padding inside the region (`none` | `sm` | `md` | `lg`). */
  inset?: string;
  /** Cross-axis alignment of children. */
  align?: 'start' | 'center' | 'end' | 'stretch';
  /** Column count — grid only. */
  columns?: number;
  children: GenUIChild[];
  slot?: string;
}

/**
 * Text nodes are the safe answer to NR-002: typography components do not
 * exist, so documents carry text with a semantic ROLE that the renderer
 * maps to semantic HTML plus `--ds-text-*` tokens.
 */
export interface TextNode {
  text: string;
  /** @default 'body' */
  role?: 'heading2' | 'heading3' | 'body' | 'caption';
  slot?: string;
}

export type GenUINode = ComponentNode | LayoutNode | TextNode;
/** Plain strings are legal children and render as escaped text. */
export type GenUIChild = GenUINode | string;

export interface GenUIScreenDoc {
  title?: string;
  nodes: GenUINode[];
}

export interface GenUIDocument {
  version: string;
  screen: GenUIScreenDoc;
}

/** House-style validation error: every error says where, what, and how to fix. */
export interface GenUIError {
  /** JSON path into the document, e.g. `screen.nodes[0].props.variant`. */
  path: string;
  /** Stable rule id, e.g. `unknown-component`, `event-prop-forbidden`. */
  rule: string;
  message: string;
  fix: string;
}

export interface GenUIValidationResult {
  valid: boolean;
  errors: GenUIError[];
  /** Total nodes walked (component + layout + text). */
  nodeCount: number;
}

/** Host-provided intent bindings: intent name → function. */
export type GenUIBindings = Record<string, (...args: never[]) => void>;
