/**
 * `validateDocument` — fully deterministic validation of a generative-UI
 * document against the loaded registries. No LLM anywhere in this path
 * (ADR-005 / CLAUDE.md rule 9): every check is a set lookup or type match
 * against the closed world in components-index.json + tokens-index.json,
 * loaded at runtime — nothing is baked in.
 *
 * Pure and importable (browser-safe: no fs, no network); also exposed via
 * the `ds-genui validate <file>` CLI.
 */

import {
  GENUI_VERSION,
  LIMITS,
  type GenUIError,
  type GenUIValidationResult,
} from './schema.js';
import type { GenUIRegistries } from './registryTypes.js';
import {
  GLOBAL_PROPS,
  STYLING_PROPS,
  buildSurfaces,
  checkValueAgainstType,
  isEventPropName,
  type ComponentSurface,
} from './surface.js';
import {
  ALIGN_VALUES,
  GRID_COLUMNS,
  LAYOUT_KINDS,
  TEXT_ROLE_NAMES,
  deriveLayoutVocabulary,
  type LayoutVocabulary,
} from './vocab.js';
import { nearestNames } from './nearest.js';

/* NR-001 / NR-002: the industry-wide hallucinated primitives. In documents
   they have a SAFE landing: layout nodes and text nodes. */
const LAYOUT_PRIMITIVES = new Set(['Box', 'Stack', 'Container', 'Flex', 'Grid', 'Spacer']);
const TYPOGRAPHY_PRIMITIVES = new Set(['Heading', 'Text']);

const DOC_KEYS = new Set(['version', 'screen']);
const SCREEN_KEYS = new Set(['title', 'nodes']);
const COMPONENT_NODE_KEYS = new Set(['component', 'props', 'children', 'slot']);
const LAYOUT_NODE_KEYS = new Set(['layout', 'gap', 'inset', 'align', 'columns', 'children', 'slot']);
const TEXT_NODE_KEYS = new Set(['text', 'role', 'slot']);

interface WalkState {
  errors: GenUIError[];
  nodeCount: number;
  nodeLimitHit: boolean;
  depthLimitHit: boolean;
  surfaces: Map<string, ComponentSurface>;
  componentNames: string[];
  vocab: LayoutVocabulary;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateDocument(
  doc: unknown,
  registries: GenUIRegistries,
): GenUIValidationResult {
  const state: WalkState = {
    errors: [],
    nodeCount: 0,
    nodeLimitHit: false,
    depthLimitHit: false,
    surfaces: buildSurfaces(registries.components),
    componentNames: registries.components.components.map((c) => c.name),
    vocab: deriveLayoutVocabulary(registries.tokens),
  };
  const err = (path: string, rule: string, message: string, fix: string): void => {
    state.errors.push({ path, rule, message, fix });
  };

  if (!isPlainObject(doc)) {
    err('$', 'doc-shape', 'The document must be a JSON object.', 'Emit { "version": "1.0", "screen": { "nodes": [...] } }.');
    return finish(state);
  }
  for (const key of Object.keys(doc)) {
    if (!DOC_KEYS.has(key)) {
      err(key, 'unknown-key', `Unknown document key '${key}'.`, 'A document has exactly two keys: version and screen.');
    }
  }
  if (doc['version'] !== GENUI_VERSION) {
    err(
      'version',
      'doc-version',
      `Unsupported document version ${JSON.stringify(doc['version'])}; this validator implements version "${GENUI_VERSION}".`,
      `Set "version": "${GENUI_VERSION}".`,
    );
  }
  const screen = doc['screen'];
  if (!isPlainObject(screen)) {
    err('screen', 'doc-shape', 'screen must be an object with a nodes array.', 'Emit "screen": { "title"?: string, "nodes": [...] }.');
    return finish(state);
  }
  for (const key of Object.keys(screen)) {
    if (!SCREEN_KEYS.has(key)) {
      err(`screen.${key}`, 'unknown-key', `Unknown screen key '${key}'.`, 'screen has exactly two keys: title (optional) and nodes.');
    }
  }
  if (screen['title'] !== undefined) checkString(state, 'screen.title', screen['title'], 'screen title');
  const nodes = screen['nodes'];
  if (!Array.isArray(nodes)) {
    err('screen.nodes', 'doc-shape', 'screen.nodes must be an array of nodes.', 'Emit "nodes": [] at minimum.');
    return finish(state);
  }
  nodes.forEach((node, i) => {
    if (typeof node === 'string') {
      err(`screen.nodes[${i}]`, 'doc-shape', 'Top-level screen nodes must be node objects, not bare strings.', 'Wrap the string in a text node: { "text": "...", "role": "body" }.');
      return;
    }
    walkNode(state, node, `screen.nodes[${i}]`, 1, null);
  });
  return finish(state);
}

function finish(state: WalkState): GenUIValidationResult {
  return { valid: state.errors.length === 0, errors: state.errors, nodeCount: state.nodeCount };
}

function checkString(state: WalkState, path: string, value: unknown, what: string): boolean {
  if (typeof value !== 'string') {
    state.errors.push({
      path,
      rule: 'doc-shape',
      message: `${what} must be a string (got ${Array.isArray(value) ? 'array' : typeof value}).`,
      fix: `Emit a JSON string for ${what}.`,
    });
    return false;
  }
  if (value.length > LIMITS.maxStringLength) {
    state.errors.push({
      path,
      rule: 'size-limit',
      message: `${what} is ${value.length} characters; the limit is ${LIMITS.maxStringLength}.`,
      fix: `Shorten the string to at most ${LIMITS.maxStringLength} characters.`,
    });
    return false;
  }
  return true;
}

/* ------------------------------------------------------------- the walk -- */

function walkNode(
  state: WalkState,
  node: unknown,
  path: string,
  depth: number,
  parentSurface: ComponentSurface | null,
): void {
  const err = (rule: string, message: string, fix: string): void => {
    state.errors.push({ path, rule, message, fix });
  };

  if (state.nodeLimitHit) return;
  state.nodeCount += 1;
  if (state.nodeCount > LIMITS.maxNodes) {
    state.nodeLimitHit = true;
    err(
      'size-limit',
      `The document exceeds the ${LIMITS.maxNodes}-node limit.`,
      `Split the screen into smaller documents; a document may hold at most ${LIMITS.maxNodes} nodes.`,
    );
    return;
  }
  if (depth > LIMITS.maxDepth) {
    if (!state.depthLimitHit) {
      state.depthLimitHit = true;
      err(
        'depth-limit',
        `Nodes are nested deeper than the ${LIMITS.maxDepth}-level limit.`,
        `Flatten the tree; nodes may nest at most ${LIMITS.maxDepth} levels deep.`,
      );
    }
    return;
  }

  if (!isPlainObject(node)) {
    err('doc-shape', `A node must be an object (got ${Array.isArray(node) ? 'array' : typeof node}).`, 'Emit a component, layout, or text node object.');
    return;
  }

  const discriminants = (['component', 'layout', 'text'] as const).filter((k) => k in node);
  if (discriminants.length !== 1) {
    err(
      'doc-shape',
      discriminants.length === 0
        ? `A node must have exactly one of 'component', 'layout', or 'text' (found none; keys: ${Object.keys(node).join(', ') || 'none'}).`
        : `A node must have exactly one of 'component', 'layout', or 'text' (found: ${discriminants.join(', ')}).`,
      'Emit exactly one discriminant key per node.',
    );
    return;
  }

  /* slot legality — checked here so it applies to every node kind. */
  const slot = node['slot'];
  if (slot !== undefined) {
    if (!checkString(state, `${path}.slot`, slot, 'slot')) return;
    if (parentSurface === null) {
      state.errors.push({
        path: `${path}.slot`,
        rule: 'unknown-slot',
        message: `slot "${String(slot)}" is illegal here: slots only exist on direct children of a component node that declares a matching element-typed prop.`,
        fix: 'Remove the slot, or move this node under the component that owns the slot.',
      });
    } else if (!parentSurface.slotProps.has(slot as string)) {
      const legal = [...parentSurface.slotProps];
      state.errors.push({
        path: `${path}.slot`,
        rule: 'unknown-slot',
        message: `<${parentSurface.entry.name}> has no slot "${String(slot)}".${legal.length > 0 ? ` Legal slots: ${legal.join(', ')}.` : ' It declares no slots.'}`,
        fix: legal.length > 0 ? `Use one of: ${legal.join(', ')}.` : 'Remove the slot.',
      });
    } else if (discriminants[0] !== 'component') {
      state.errors.push({
        path: `${path}.slot`,
        rule: 'slot-not-component',
        message: `slot "${String(slot)}" must be filled by a component node — <${parentSurface.entry.name}> expects an element there (e.g. a Button trigger).`,
        fix: 'Make the slotted child a component node.',
      });
    }
  }

  switch (discriminants[0]) {
    case 'component':
      walkComponentNode(state, node, path, depth);
      return;
    case 'layout':
      walkLayoutNode(state, node, path, depth);
      return;
    case 'text':
      walkTextNode(state, node, path);
      return;
  }
}

/* -------------------------------------------------------- component node -- */

function walkComponentNode(
  state: WalkState,
  node: Record<string, unknown>,
  path: string,
  depth: number,
): void {
  const err = (p: string, rule: string, message: string, fix: string): void => {
    state.errors.push({ path: p, rule, message, fix });
  };

  for (const key of Object.keys(node)) {
    if (!COMPONENT_NODE_KEYS.has(key)) {
      err(`${path}.${key}`, 'unknown-key', `Unknown component-node key '${key}'.`, 'A component node has: component, props?, children?, slot?.');
    }
  }

  const name = node['component'];
  if (!checkString(state, `${path}.component`, name, 'component name')) return;

  if (LAYOUT_PRIMITIVES.has(name as string)) {
    err(
      `${path}.component`,
      'layout-primitive',
      `<${String(name)}> is not part of this design system — layout primitives do not exist as components (NR-001). In documents, layout lives in the contract itself.`,
      'Emit a layout node instead: { "layout": "stack" | "row" | "grid", "gap": "md", "children": [...] }.',
    );
    return;
  }
  if (TYPOGRAPHY_PRIMITIVES.has(name as string)) {
    err(
      `${path}.component`,
      'typography-primitive',
      `<${String(name)}> is not part of this design system — typography components do not exist (NR-002).`,
      'Emit a text node instead: { "text": "...", "role": "heading2" | "heading3" | "body" | "caption" }.',
    );
    return;
  }

  const surface = state.surfaces.get(name as string);
  if (!surface) {
    const nearest = nearestNames(name as string, state.componentNames);
    err(
      `${path}.component`,
      'unknown-component',
      `'${String(name)}' is not in the component registry (closed world: a component not in the registry does not exist). Did you mean: ${nearest.join(', ')}?`,
      `Use one of the registered components: ${state.componentNames.join(', ')}.`,
    );
    return;
  }

  /* props */
  const props = node['props'];
  if (props !== undefined && !isPlainObject(props)) {
    err(`${path}.props`, 'doc-shape', 'props must be an object.', 'Emit "props": { ... }.');
  } else if (props) {
    checkProps(state, surface, props, path);
  }

  /* required non-element props */
  const given = isPlainObject(props) ? props : {};
  for (const required of surface.requiredProps) {
    if (!(required in given)) {
      err(
        `${path}.props.${required}`,
        'missing-required-prop',
        `<${surface.entry.name}> requires prop '${required}' (${surface.props.get(required)?.type ?? 'unknown'}).`,
        `Add "${required}" to the node's props.`,
      );
    }
  }

  /* children */
  const children = node['children'];
  if (children !== undefined && !Array.isArray(children)) {
    err(`${path}.children`, 'doc-shape', 'children must be an array of nodes and/or strings.', 'Emit "children": [...].');
    return;
  }
  const childArray = (children as unknown[] | undefined) ?? [];

  if (surface.requiresChildren && childArray.length === 0) {
    err(
      `${path}.children`,
      'missing-children',
      `<${surface.entry.name}> requires children (its registry 'children' prop is required).`,
      'Add at least one child node or string.',
    );
  }
  if (surface.requiresSingleElementChild) {
    const componentChildren = childArray.filter(
      (c) => isPlainObject(c) && 'component' in c,
    );
    if (childArray.length !== 1 || componentChildren.length !== 1) {
      err(
        `${path}.children`,
        'single-element-child',
        `<${surface.entry.name}> takes exactly ONE component node as its child (its registry 'children' prop is a single ReactElement — the focusable trigger).`,
        'Emit exactly one component node (e.g. a Button) as the only child.',
      );
    }
  }

  /* duplicate slots */
  const seenSlots = new Map<string, number>();
  childArray.forEach((child, i) => {
    if (isPlainObject(child) && typeof child['slot'] === 'string') {
      const s = child['slot'];
      const prev = seenSlots.get(s);
      if (prev !== undefined) {
        err(
          `${path}.children[${i}].slot`,
          'duplicate-slot',
          `slot "${s}" is already filled by children[${prev}]; a slot takes exactly one child.`,
          'Keep a single child per slot.',
        );
      } else {
        seenSlots.set(s, i);
      }
    }
  });

  childArray.forEach((child, i) => {
    const childPath = `${path}.children[${i}]`;
    if (typeof child === 'string') {
      checkString(state, childPath, child, 'text child');
      return;
    }
    walkNode(state, child, childPath, depth + 1, surface);
  });
}

function checkProps(
  state: WalkState,
  surface: ComponentSurface,
  props: Record<string, unknown>,
  path: string,
): void {
  const err = (p: string, rule: string, message: string, fix: string): void => {
    state.errors.push({ path: p, rule, message, fix });
  };
  const name = surface.entry.name;

  for (const [key, value] of Object.entries(props)) {
    const propPath = `${path}.props.${key}`;

    if (STYLING_PROPS.has(key)) {
      err(
        propPath,
        'styling-forbidden',
        `'${key}' is forbidden in documents: generated UI may name intents and registry props, never styling. (className/style are code-only escape hatches.)`,
        'Remove it. Spacing and arrangement belong in layout nodes; appearance belongs to the brand tier.',
      );
      continue;
    }
    if (surface.eventProps.has(key) || isEventPropName(key)) {
      err(
        propPath,
        'event-prop-forbidden',
        `'${key}' is an event prop; documents carry no code — a document that could bind handlers would be remote code execution.`,
        `Declare "intent": "<name>" instead and let the host pass bindings: { "<name>": fn } to <GenUIScreen>.`,
      );
      continue;
    }
    if (key === 'intent') {
      if (typeof value !== 'string') {
        err(propPath, 'intent-not-allowed', `intent must be a string naming a host binding (got ${typeof value}).`, 'Emit "intent": "confirm-delete"-style names.');
      } else if (!surface.intentCapable) {
        err(
          propPath,
          'intent-not-allowed',
          `<${name}> is not interactive — its registry surface has no event props, so an intent can never fire.`,
          'Remove the intent, or attach it to an interactive component (e.g. Button).',
        );
      } else {
        checkString(state, propPath, value, `intent on <${name}>`);
      }
      continue;
    }
    const global = GLOBAL_PROPS[key];
    if (global) {
      const ok = global === 'string' ? typeof value === 'string' : typeof value === 'string' || typeof value === 'number';
      if (!ok) {
        err(propPath, 'prop-type', `'${key}' must be a ${global === 'string' ? 'string' : 'string or number'}.`, `Emit a ${global === 'string' ? 'string' : 'string or number'} for '${key}'.`);
      } else if (typeof value === 'string') {
        checkString(state, propPath, value, `'${key}'`);
      }
      continue;
    }

    const entry = surface.props.get(key);
    if (!entry) {
      const legal = [
        ...surface.props.keys(),
      ].filter((p) => !surface.eventProps.has(p));
      const nearest = nearestNames(key, [...legal, ...Object.keys(GLOBAL_PROPS), 'intent']);
      err(
        propPath,
        'unknown-prop',
        `<${name}> has no prop '${key}' in its registry surface (closed world: own props + enumerated racProps). Did you mean: ${nearest.join(', ')}?`,
        `Legal document props for <${name}>: ${[...legal, 'intent', ...Object.keys(GLOBAL_PROPS)].join(', ')}.`,
      );
      continue;
    }
    if (key === 'children' || surface.slotProps.has(key)) {
      err(
        propPath,
        'element-prop-forbidden',
        `'${key}' is element-typed (${entry.type}); documents cannot carry React elements as prop values.`,
        key === 'children'
          ? "Use the node's \"children\" array instead."
          : `Use a child node with "slot": "${key}" instead.`,
      );
      continue;
    }
    const check = checkValueAgainstType(entry.type, value);
    if (!check.ok) {
      if (check.legalValues) {
        err(
          propPath,
          'prop-type',
          `<${name}> prop '${key}' got ${JSON.stringify(value)}; legal values: ${check.legalValues.map((v) => `"${v}"`).join(' | ')}.`,
          `Use one of: ${check.legalValues.join(', ')}.`,
        );
      } else {
        err(
          propPath,
          'prop-type',
          `<${name}> prop '${key}' got ${JSON.stringify(value)}; expected ${entry.type}.`,
          `Emit a value matching the registry type: ${entry.type}.`,
        );
      }
      continue;
    }
    if (typeof value === 'string') checkString(state, propPath, value, `'${key}'`);
  }
}

/* ----------------------------------------------------------- layout node -- */

function walkLayoutNode(
  state: WalkState,
  node: Record<string, unknown>,
  path: string,
  depth: number,
): void {
  const err = (p: string, rule: string, message: string, fix: string): void => {
    state.errors.push({ path: p, rule, message, fix });
  };
  const vocab = state.vocab;

  for (const key of Object.keys(node)) {
    if (!LAYOUT_NODE_KEYS.has(key)) {
      err(`${path}.${key}`, 'unknown-key', `Unknown layout-node key '${key}'.`, 'A layout node has: layout, gap?, inset?, align?, columns? (grid), children, slot?.');
    }
  }

  const kind = node['layout'];
  if (typeof kind !== 'string' || !(LAYOUT_KINDS as readonly string[]).includes(kind)) {
    err(
      `${path}.layout`,
      'token-vocab',
      `layout ${JSON.stringify(kind)} is not in the closed layout set.`,
      `Use one of: ${LAYOUT_KINDS.join(', ')}.`,
    );
    return;
  }
  const gap = node['gap'];
  if (gap !== undefined && (typeof gap !== 'string' || !vocab.gap.includes(gap))) {
    err(
      `${path}.gap`,
      'token-vocab',
      `gap ${JSON.stringify(gap)} is not in the token vocabulary; legal values map to the --ds-space-gap-* tokens: ${vocab.gap.join(', ')}. Free CSS never enters a document.`,
      `Use one of: ${vocab.gap.join(', ')}.`,
    );
  }
  const inset = node['inset'];
  if (inset !== undefined && (typeof inset !== 'string' || !vocab.inset.includes(inset))) {
    err(
      `${path}.inset`,
      'token-vocab',
      `inset ${JSON.stringify(inset)} is not in the token vocabulary; legal values map to the --ds-space-inset-* tokens: ${vocab.inset.join(', ')}.`,
      `Use one of: ${vocab.inset.join(', ')}.`,
    );
  }
  const align = node['align'];
  if (align !== undefined && (typeof align !== 'string' || !(ALIGN_VALUES as readonly string[]).includes(align))) {
    err(
      `${path}.align`,
      'token-vocab',
      `align ${JSON.stringify(align)} is not in the closed alignment set.`,
      `Use one of: ${ALIGN_VALUES.join(', ')}.`,
    );
  }
  const columns = node['columns'];
  if (columns !== undefined) {
    if (kind !== 'grid') {
      err(`${path}.columns`, 'token-vocab', `columns is grid-only; this node is a ${kind}.`, 'Remove columns, or make the node { "layout": "grid" }.');
    } else if (typeof columns !== 'number' || !(GRID_COLUMNS as readonly number[]).includes(columns)) {
      err(
        `${path}.columns`,
        'token-vocab',
        `columns ${JSON.stringify(columns)} is not in the closed set.`,
        `Use one of: ${GRID_COLUMNS.join(', ')}.`,
      );
    }
  }

  const children = node['children'];
  if (!Array.isArray(children)) {
    err(`${path}.children`, 'doc-shape', 'A layout node requires a children array.', 'Emit "children": [...].');
    return;
  }
  children.forEach((child, i) => {
    const childPath = `${path}.children[${i}]`;
    if (typeof child === 'string') {
      checkString(state, childPath, child, 'text child');
      return;
    }
    walkNode(state, child, childPath, depth + 1, null);
  });
}

/* ------------------------------------------------------------- text node -- */

function walkTextNode(state: WalkState, node: Record<string, unknown>, path: string): void {
  const err = (p: string, rule: string, message: string, fix: string): void => {
    state.errors.push({ path: p, rule, message, fix });
  };
  for (const key of Object.keys(node)) {
    if (!TEXT_NODE_KEYS.has(key)) {
      err(`${path}.${key}`, 'unknown-key', `Unknown text-node key '${key}'.`, 'A text node has: text, role?, slot?.');
    }
  }
  checkString(state, `${path}.text`, node['text'], 'text');
  const role = node['role'];
  if (role !== undefined && (typeof role !== 'string' || !TEXT_ROLE_NAMES.includes(role))) {
    err(
      `${path}.role`,
      'text-role',
      `text role ${JSON.stringify(role)} is not in the closed role set; roles map to semantic HTML + --ds-text-* tokens (NR-002: typography components do not exist).`,
      `Use one of: ${TEXT_ROLE_NAMES.join(', ')}.`,
    );
  }
}
