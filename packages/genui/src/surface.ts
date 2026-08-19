/**
 * The per-component DOCUMENT surface, computed from components-index.json at
 * runtime. Nothing here is hand-enumerated per component: which props are
 * legal, which are events, which are element-typed (and therefore slots or
 * children), and which are required all come from the registry's extracted
 * prop types. A regenerated registry changes the document contract with no
 * code change.
 */

import type { ComponentEntry, ComponentsIndex, PropEntry } from './registryTypes.js';

/* --------------------------------------------------------- global props -- */

/**
 * Structural props legal on EVERY component node. `id` is how RAC-collection
 * components (Tab/TabPanel) are wired together; the aria-* trio names things
 * for assistive technology. Deliberately tiny — everything else must be in
 * the registry surface.
 */
export const GLOBAL_PROPS: Record<string, 'string' | 'string-or-number'> = {
  id: 'string-or-number',
  'aria-label': 'string',
  'aria-labelledby': 'string',
  'aria-describedby': 'string',
};

/**
 * Escape hatches that exist in code but are FORBIDDEN in documents:
 * documents may name design intents, never styling. (`className` is a legal
 * component prop for application code; a generated document granting itself
 * arbitrary classes would reopen the styling surface the contract closes.)
 */
export const STYLING_PROPS = new Set(['className', 'style']);

/* ------------------------------------------------------- classification -- */

export function isFunctionType(type: string): boolean {
  return type.includes('=>');
}

export function isEventPropName(name: string): boolean {
  return /^on[A-Z]/.test(name);
}

export function isElementType(type: string): boolean {
  return /\bReact(Node|Element)\b/.test(type);
}

export interface ComponentSurface {
  entry: ComponentEntry;
  /** All enumerated props (own + racProps), by name. Own props win. */
  props: Map<string, PropEntry>;
  /** Prop names that are function-typed or on[A-Z]-named — forbidden in documents. */
  eventProps: Set<string>;
  /** Element-typed props other than `children` — fillable via child `slot`. */
  slotProps: Set<string>;
  /** Whether `children` is element-typed and singular (ReactElement, e.g. Tooltip trigger). */
  requiresSingleElementChild: boolean;
  /** Whether `children` is required (by any name) — node must have children. */
  requiresChildren: boolean;
  /** Required, non-element, non-event props that must appear in `props`. */
  requiredProps: string[];
  /** Whether the component accepts any intent (has at least one event prop). */
  intentCapable: boolean;
}

export function buildSurface(entry: ComponentEntry): ComponentSurface {
  const props = new Map<string, PropEntry>();
  for (const p of entry.racProps ?? []) props.set(p.name, p);
  for (const p of entry.props) props.set(p.name, p); // own props override

  const eventProps = new Set<string>();
  const slotProps = new Set<string>();
  const requiredProps: string[] = [];
  let requiresSingleElementChild = false;
  let requiresChildren = false;

  for (const p of props.values()) {
    const isEvent = isFunctionType(p.type) || isEventPropName(p.name);
    const isElement = isElementType(p.type);
    if (isEvent) {
      eventProps.add(p.name);
      continue;
    }
    if (isElement) {
      if (p.name === 'children') {
        if (/\bReactElement\b/.test(p.type)) requiresSingleElementChild = true;
        if (p.required) requiresChildren = true;
      } else {
        slotProps.add(p.name);
      }
      continue;
    }
    if (p.required) requiredProps.push(p.name);
  }

  return {
    entry,
    props,
    eventProps,
    slotProps,
    requiresSingleElementChild,
    requiresChildren,
    requiredProps,
    intentCapable: eventProps.size > 0,
  };
}

export function buildSurfaces(index: ComponentsIndex): Map<string, ComponentSurface> {
  const map = new Map<string, ComponentSurface>();
  for (const entry of index.components) map.set(entry.name, buildSurface(entry));
  return map;
}

/* ----------------------------------------------------------- type check -- */

export interface TypeCheckResult {
  ok: boolean;
  /** For literal unions: the legal values, for error messages. */
  legalValues?: string[];
  expected: string;
}

const LITERAL = /^"([^"]*)"$/;

/**
 * Check a JSON value against an extracted registry type string. Handles the
 * shapes that actually occur in components-index.json: literal unions,
 * primitives (+ `null`, `Key`), and the typed-items array of Select.
 * Element and function types never reach here (excluded earlier).
 */
export function checkValueAgainstType(type: string, value: unknown): TypeCheckResult {
  const parts = splitTopLevelUnion(type);
  const literals = parts
    .map((p) => LITERAL.exec(p)?.[1])
    .filter((v): v is string => v !== undefined);

  for (const part of parts) {
    const lit = LITERAL.exec(part)?.[1];
    if (lit !== undefined) {
      if (value === lit) return { ok: true, expected: type };
      continue;
    }
    switch (part) {
      case 'string':
        if (typeof value === 'string') return { ok: true, expected: type };
        break;
      case 'number':
        if (typeof value === 'number' && Number.isFinite(value)) return { ok: true, expected: type };
        break;
      case 'boolean':
        if (typeof value === 'boolean') return { ok: true, expected: type };
        break;
      case 'null':
        if (value === null) return { ok: true, expected: type };
        break;
      case 'Key': // react-aria Key = string | number
        if (typeof value === 'string' || typeof value === 'number') return { ok: true, expected: type };
        break;
      default:
        if (part.endsWith('[]') && part.startsWith('{')) {
          if (checkItemsArray(part, value)) return { ok: true, expected: type };
        }
        break;
    }
  }
  const result: TypeCheckResult = { ok: false, expected: type };
  if (literals.length > 0 && literals.length === parts.length) result.legalValues = literals;
  return result;
}

/** Split a union type on top-level `|` (never inside braces/parens/quotes). */
function splitTopLevelUnion(type: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString = false;
  let current = '';
  for (const ch of type) {
    if (ch === '"') inString = !inString;
    if (!inString) {
      if (ch === '{' || ch === '(' || ch === '[' || ch === '<') depth++;
      if (ch === '}' || ch === ')' || ch === ']' || ch === '>') depth--;
      if (ch === '|' && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Validate a typed-items array (`{ id: string | number; label: string;
 * isDisabled?: boolean; }[]`) by parsing the member list out of the type
 * string, so a registry change to the item shape changes the check.
 */
function checkItemsArray(type: string, value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const body = type.slice(type.indexOf('{') + 1, type.lastIndexOf('}'));
  const members = new Map<string, { optional: boolean; type: string }>();
  for (const raw of body.split(';')) {
    const m = /^\s*([A-Za-z_$][\w$-]*)(\?)?\s*:\s*(.+)$/.exec(raw);
    if (m) members.set(m[1] as string, { optional: m[2] === '?', type: (m[3] as string).trim() });
  }
  if (members.size === 0) return false;
  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return false;
    const obj = item as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (!members.has(key)) return false; // closed item shape
    }
    for (const [key, spec] of members) {
      const v = obj[key];
      if (v === undefined) {
        if (!spec.optional) return false;
        continue;
      }
      if (!checkValueAgainstType(spec.type, v).ok) return false;
    }
  }
  return true;
}
