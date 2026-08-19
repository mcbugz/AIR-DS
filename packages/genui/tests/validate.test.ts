/**
 * Every validator rule gets a wrong/right pair: the wrong document produces
 * exactly that rule (with house-style path/rule/message/fix), and the
 * minimally corrected document passes clean. All checks run against the REAL
 * registries — nothing is mocked.
 */

import { describe, expect, it } from 'vitest';
import { validateDocument } from '../src/validate.js';
import { LIMITS } from '../src/schema.js';
import type { GenUINode } from '../src/schema.js';
import { docOf, registries } from './helpers.js';

function rulesOf(doc: unknown): string[] {
  return validateDocument(doc, registries).errors.map((e) => e.rule);
}

function expectValid(doc: unknown): void {
  const result = validateDocument(doc, registries);
  expect(result.errors).toEqual([]);
  expect(result.valid).toBe(true);
}

function expectRule(doc: unknown, rule: string): void {
  const result = validateDocument(doc, registries);
  expect(result.valid).toBe(false);
  expect(result.errors.map((e) => e.rule)).toContain(rule);
  // house style: every error carries path, rule, message, fix
  for (const e of result.errors) {
    expect(e.path.length).toBeGreaterThan(0);
    expect(e.rule.length).toBeGreaterThan(0);
    expect(e.message.length).toBeGreaterThan(0);
    expect(e.fix.length).toBeGreaterThan(0);
  }
}

describe('document shape', () => {
  it('doc-shape: wrong — non-object document', () => {
    expectRule('not a doc', 'doc-shape');
    expectRule(null, 'doc-shape');
  });
  it('doc-shape: wrong — node with no discriminant / two discriminants', () => {
    expectRule(docOf({} as unknown as GenUINode), 'doc-shape');
    expectRule(docOf({ component: 'Button', text: 'x' } as unknown as GenUINode), 'doc-shape');
  });
  it('doc-shape: right — the minimal document', () => {
    expectValid({ version: '1.0', screen: { nodes: [] } });
  });

  it('doc-version: wrong — missing or alien version', () => {
    expectRule({ screen: { nodes: [] } }, 'doc-version');
    expectRule({ version: '2.0', screen: { nodes: [] } }, 'doc-version');
  });
  it('doc-version: right — "1.0"', () => {
    expectValid({ version: '1.0', screen: { nodes: [] } });
  });

  it('unknown-key: wrong — stray keys on document, screen, and nodes', () => {
    expectRule({ version: '1.0', screen: { nodes: [] }, theme: 'dark' }, 'unknown-key');
    expectRule({ version: '1.0', screen: { nodes: [], css: 'body{}' } }, 'unknown-key');
    expectRule(docOf({ component: 'Badge', onRender: 'x' } as unknown as GenUINode), 'unknown-key');
    expectRule(docOf({ layout: 'stack', children: [], padding: '4px' } as unknown as GenUINode), 'unknown-key');
    expectRule(docOf({ text: 'x', size: 'lg' } as unknown as GenUINode), 'unknown-key');
  });
  it('unknown-key: right — only contract keys', () => {
    expectValid(docOf({ component: 'Badge', props: { tone: 'info' }, children: ['New'] }));
  });
});

describe('closed component world', () => {
  it('unknown-component: wrong — fabricated name gets a nearest suggestion', () => {
    const result = validateDocument(docOf({ component: 'Buton', children: ['Save'] }), registries);
    expect(result.valid).toBe(false);
    const error = result.errors.find((e) => e.rule === 'unknown-component');
    expect(error).toBeDefined();
    expect(error?.path).toBe('screen.nodes[0].component');
    expect(error?.message).toContain('Button');
    expect(error?.message).toContain('closed world');
  });
  it('unknown-component: right — a registry name', () => {
    expectValid(docOf({ component: 'Button', children: ['Save'] }));
  });

  it('layout-primitive (NR-001): wrong — hallucinated Box/Stack/Flex/Grid components', () => {
    for (const name of ['Box', 'Stack', 'Flex', 'Grid', 'Container', 'Spacer']) {
      const result = validateDocument(docOf({ component: name, children: [] }), registries);
      expect(result.errors.map((e) => e.rule)).toContain('layout-primitive');
      expect(result.errors[0]?.fix).toContain('layout node');
    }
  });
  it('layout-primitive: right — layout lives in the contract', () => {
    expectValid(
      docOf({ layout: 'stack', gap: 'md', children: [{ component: 'Badge', children: ['Hi'] }] }),
    );
  });

  it('typography-primitive (NR-002): wrong — hallucinated Heading/Text components', () => {
    expectRule(docOf({ component: 'Heading', props: {}, children: ['Title'] }), 'typography-primitive');
    expectRule(docOf({ component: 'Text', children: ['Body'] }), 'typography-primitive');
  });
  it('typography-primitive: right — text nodes with roles', () => {
    expectValid(docOf({ text: 'Title', role: 'heading2' }));
  });
});

describe('closed prop surface', () => {
  it('unknown-prop: wrong — invented prop gets nearest suggestion', () => {
    const result = validateDocument(
      docOf({ component: 'Button', props: { varient: 'primary' }, children: ['Go'] }),
      registries,
    );
    const error = result.errors.find((e) => e.rule === 'unknown-prop');
    expect(error?.path).toBe('screen.nodes[0].props.varient');
    expect(error?.message).toContain('variant');
  });
  it('unknown-prop: right — registry surface props, racProps included', () => {
    expectValid(
      docOf({
        component: 'Button',
        props: { variant: 'secondary', size: 'lg', isDisabled: true, name: 'action', value: 'go' },
        children: ['Go'],
      }),
    );
  });

  it('prop-type: wrong — literal-union violation lists the legal values', () => {
    const result = validateDocument(
      docOf({ component: 'Button', props: { variant: 'link' }, children: ['Go'] }),
      registries,
    );
    const error = result.errors.find((e) => e.rule === 'prop-type');
    expect(error?.message).toContain('"danger" | "primary" | "secondary" | "ghost"');
    expect(error?.fix).toContain('danger');
  });
  it('prop-type: wrong — primitive mismatches', () => {
    expectRule(docOf({ component: 'Button', props: { isLoading: 'yes' }, children: ['Go'] }), 'prop-type');
    expectRule(docOf({ component: 'TextArea', props: { label: 'Notes', rows: 'three' } }), 'prop-type');
    expectRule(
      docOf({
        component: 'Select',
        props: { label: 'Region', items: [{ id: 'eu', label: 'Europe', href: 'x' }] },
      }),
      'prop-type',
    );
  });
  it('prop-type: right — matching primitives and typed items', () => {
    expectValid(
      docOf(
        { component: 'Button', props: { isLoading: true }, children: ['Go'] },
        { component: 'TextArea', props: { label: 'Notes', rows: 5 } },
        {
          component: 'Select',
          props: {
            label: 'Region',
            items: [
              { id: 'eu', label: 'Europe' },
              { id: 1, label: 'Other', isDisabled: true },
            ],
          },
        },
      ),
    );
  });

  it('missing-required-prop: wrong — Dialog without title, Select without items', () => {
    expectRule(docOf({ component: 'Dialog', children: [{ text: 'Body' }] }), 'missing-required-prop');
    expectRule(docOf({ component: 'Select', props: { label: 'Region' } }), 'missing-required-prop');
    expectRule(docOf({ component: 'IconButton' }), 'missing-required-prop');
  });
  it('missing-required-prop: right — required props present', () => {
    expectValid(
      docOf({ component: 'Dialog', props: { title: 'Confirm' }, children: [{ text: 'Body' }] }),
    );
  });
});

describe('no code in documents', () => {
  it('event-prop-forbidden: wrong — handlers, registry-listed or invented', () => {
    expectRule(docOf({ component: 'Button', props: { onPress: 'doSave()' }, children: ['Go'] }), 'event-prop-forbidden');
    expectRule(docOf({ component: 'Alert', props: { onDismiss: 'close' }, children: ['Hi'] }), 'event-prop-forbidden');
    expectRule(docOf({ component: 'Badge', props: { onClick: 'x' }, children: ['Hi'] }), 'event-prop-forbidden');
  });
  it('event-prop-forbidden: right — intent names instead of handlers', () => {
    expectValid(docOf({ component: 'Button', props: { intent: 'save' }, children: ['Go'] }));
  });

  it('styling-forbidden: wrong — className/style in documents', () => {
    expectRule(docOf({ component: 'Button', props: { className: 'p-4' }, children: ['Go'] }), 'styling-forbidden');
    expectRule(docOf({ component: 'Card', props: { style: { color: 'red' } } }), 'styling-forbidden');
  });
  it('styling-forbidden: right — appearance comes from variants and layout nodes', () => {
    expectValid(docOf({ component: 'Button', props: { variant: 'ghost' }, children: ['Go'] }));
  });

  it('intent-not-allowed: wrong — intent on a non-interactive component', () => {
    expectRule(docOf({ component: 'Badge', props: { intent: 'boom' }, children: ['Hi'] }), 'intent-not-allowed');
    expectRule(docOf({ component: 'CardBody', props: { intent: 'x' } }), 'intent-not-allowed');
    expectRule(docOf({ component: 'Button', props: { intent: 42 }, children: ['Go'] }), 'intent-not-allowed');
  });
  it('intent-not-allowed: right — intent on interactive components', () => {
    expectValid(
      docOf(
        { component: 'Switch', props: { intent: 'toggle' }, children: ['Dark mode'] },
        { component: 'Alert', props: { intent: 'dismiss-alert' }, children: ['Saved'] },
      ),
    );
  });

  it('element-prop-forbidden: wrong — React elements as prop values', () => {
    expectRule(
      docOf({
        component: 'Dialog',
        props: { title: 'X', trigger: { component: 'Button' } },
        children: [{ text: 'Body' }],
      }),
      'element-prop-forbidden',
    );
    expectRule(docOf({ component: 'Checkbox', props: { children: 'Accept' } }), 'element-prop-forbidden');
  });
  it('element-prop-forbidden: right — elements arrive as children/slots', () => {
    expectValid(
      docOf({
        component: 'Dialog',
        props: { title: 'X' },
        children: [
          { component: 'Button', slot: 'trigger', children: ['Open'] },
          { text: 'Body' },
        ],
      }),
    );
  });
});

describe('slots', () => {
  it('unknown-slot: wrong — slot at root, on layout parents, or unknown name', () => {
    expectRule(docOf({ component: 'Button', slot: 'trigger', children: ['Go'] }), 'unknown-slot');
    expectRule(
      docOf({
        layout: 'stack',
        children: [{ component: 'Button', slot: 'trigger', children: ['Go'] }],
      }),
      'unknown-slot',
    );
    expectRule(
      docOf({
        component: 'Card',
        children: [{ component: 'Button', slot: 'header', children: ['Go'] }],
      }),
      'unknown-slot',
    );
  });
  it('slot-not-component: wrong — a text node cannot be a trigger', () => {
    expectRule(
      docOf({
        component: 'Dialog',
        props: { title: 'X' },
        children: [{ text: 'open', slot: 'trigger' }],
      }),
      'slot-not-component',
    );
  });
  it('duplicate-slot: wrong — two children fill the same slot', () => {
    expectRule(
      docOf({
        component: 'Dialog',
        props: { title: 'X' },
        children: [
          { component: 'Button', slot: 'trigger', children: ['A'] },
          { component: 'Button', slot: 'trigger', children: ['B'] },
        ],
      }),
      'duplicate-slot',
    );
  });
  it('slots: right — one component node per registry-derived slot', () => {
    expectValid(
      docOf({
        component: 'Dialog',
        props: { title: 'X' },
        children: [{ component: 'Button', slot: 'trigger', children: ['Open'] }, { text: 'Body' }],
      }),
    );
  });
});

describe('children contracts', () => {
  it('missing-children: wrong — Radio/RadioGroup with no children', () => {
    expectRule(
      docOf({
        component: 'RadioGroup',
        props: { label: 'Density' },
      }),
      'missing-children',
    );
    expectRule(
      docOf({
        component: 'RadioGroup',
        props: { label: 'Density' },
        children: [{ component: 'Radio', props: { value: 'compact' } }],
      }),
      'missing-children',
    );
  });
  it('single-element-child: wrong — Tooltip with zero or two children, or a bare string', () => {
    expectRule(docOf({ component: 'Tooltip', props: { content: 'Hi' } }), 'single-element-child');
    expectRule(
      docOf({
        component: 'Tooltip',
        props: { content: 'Hi' },
        children: [
          { component: 'Button', children: ['A'] },
          { component: 'Button', children: ['B'] },
        ],
      }),
      'single-element-child',
    );
    expectRule(
      docOf({ component: 'Tooltip', props: { content: 'Hi' }, children: ['not an element'] }),
      'single-element-child',
    );
  });
  it('children: right — labeled Radio options and a single Tooltip trigger', () => {
    expectValid(
      docOf(
        {
          component: 'RadioGroup',
          props: { label: 'Density' },
          children: [{ component: 'Radio', props: { value: 'compact' }, children: ['Compact'] }],
        },
        {
          component: 'Tooltip',
          props: { content: 'Hi' },
          children: [{ component: 'Button', children: ['Hover me'] }],
        },
      ),
    );
  });
});

describe('token vocabulary (layout + text)', () => {
  it('token-vocab: wrong — free CSS never enters a document', () => {
    expectRule(docOf({ layout: 'stack', gap: '13px', children: [] }), 'token-vocab');
    expectRule(docOf({ layout: 'stack', gap: 'var(--ds-space-4)', children: [] }), 'token-vocab');
    expectRule(docOf({ layout: 'row', inset: '2rem', children: [] }), 'token-vocab');
    expectRule(
      docOf({ layout: 'row', align: 'space-between', children: [] } as unknown as GenUINode),
      'token-vocab',
    );
    expectRule(docOf({ layout: 'masonry', children: [] } as unknown as GenUINode), 'token-vocab');
    expectRule(docOf({ layout: 'grid', columns: 12, children: [] }), 'token-vocab');
    expectRule(docOf({ layout: 'stack', columns: 2, children: [] }), 'token-vocab');
  });
  it('token-vocab: the gap error names the token family it derives from', () => {
    const result = validateDocument(docOf({ layout: 'stack', gap: 'xl', children: [] }), registries);
    const error = result.errors.find((e) => e.rule === 'token-vocab');
    expect(error?.message).toContain('--ds-space-gap-*');
    expect(error?.message).toContain('sm');
  });
  it('token-vocab: right — the derived vocabulary', () => {
    expectValid(
      docOf(
        { layout: 'stack', gap: 'lg', inset: 'sm', align: 'start', children: [] },
        { layout: 'grid', columns: 3, gap: 'md', children: [] },
        { layout: 'row', gap: 'none', children: [] },
      ),
    );
  });

  it('text-role: wrong — fabricated roles', () => {
    expectRule(docOf({ text: 'Hi', role: 'display' } as unknown as GenUINode), 'text-role');
    expectRule(docOf({ text: 'Hi', role: 'heading1' } as unknown as GenUINode), 'text-role');
  });
  it('text-role: right — the closed role set', () => {
    expectValid(
      docOf(
        { text: 'Title', role: 'heading2' },
        { text: 'Sub', role: 'heading3' },
        { text: 'Body' },
        { text: 'Fine print', role: 'caption' },
      ),
    );
  });
});

describe('DoS hygiene', () => {
  it('depth-limit: wrong — a nesting bomb', () => {
    let node: GenUINode = { text: 'deep' };
    for (let i = 0; i < LIMITS.maxDepth + 5; i++) {
      node = { layout: 'stack', children: [node] };
    }
    expectRule(docOf(node), 'depth-limit');
  });
  it('size-limit: wrong — a node-count bomb', () => {
    const nodes: GenUINode[] = [];
    for (let i = 0; i < LIMITS.maxNodes + 10; i++) {
      nodes.push({ component: 'Badge', children: ['x'] });
    }
    expectRule(docOf(...nodes), 'size-limit');
  });
  it('size-limit: wrong — an oversized string', () => {
    expectRule(docOf({ text: 'a'.repeat(LIMITS.maxStringLength + 1) }), 'size-limit');
    expectRule(
      docOf({
        component: 'TextField',
        props: { label: 'x'.repeat(LIMITS.maxStringLength + 1) },
      }),
      'size-limit',
    );
  });
  it('limits: right — realistic documents are nowhere near them', () => {
    const nodes: GenUINode[] = [];
    for (let i = 0; i < 50; i++) nodes.push({ component: 'Badge', children: [`item ${i}`] });
    expectValid(docOf({ layout: 'grid', columns: 4, gap: 'sm', children: nodes }));
  });
});

describe('error report shape', () => {
  it('one document can carry several independent errors', () => {
    const rules = rulesOf(
      docOf(
        { component: 'Buton', children: ['x'] },
        { component: 'Button', props: { variant: 'link', onPress: 'f()' }, children: ['x'] },
        { layout: 'stack', gap: 'huge', children: [] },
      ),
    );
    expect(rules).toContain('unknown-component');
    expect(rules).toContain('prop-type');
    expect(rules).toContain('event-prop-forbidden');
    expect(rules).toContain('token-vocab');
  });
});
