import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { componentIndex, matchGlob, synthesizeExample } from '../src/components.js';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '../../../examples/legacy-ds');

describe('componentIndex over the legacy-ds fixture', () => {
  const { index, confidence } = componentIndex(FIXTURE);

  it('indexes exactly the four fixture components, sorted', () => {
    expect(index.components.map((c) => c.name)).toEqual(['Banner', 'Button', 'Card', 'Input']);
    expect(index.package).toBe('@meridian/atlas-ui');
  });

  it('extracts typed props with literal unions, requiredness, defaults', () => {
    const button = index.components.find((c) => c.name === 'Button');
    const variant = button?.props.find((p) => p.name === 'variant');
    expect(variant?.type).toBe('"primary" | "secondary" | "danger"');
    expect(variant?.required).toBe(false);
    const input = index.components.find((c) => c.name === 'Input');
    const label = input?.props.find((p) => p.name === 'label');
    expect(label?.required).toBe(true);
    expect(label?.type).toBe('string');
  });

  it('marks the retrofit nulls and the closed-world statement', () => {
    for (const c of index.components) {
      expect(c.racBase).toBeNull();
      expect(c.racPropsNote).toBeNull();
      expect(c.racProps).toBeNull();
      expect(c.tokenPrefix).toBeNull();
      expect(typeof c.example).toBe('string');
    }
    expect(index.$description).toMatch(/Any component not listed here does not exist/);
  });

  it('detects co-located story files and omits the field otherwise', () => {
    const button = index.components.find((c) => c.name === 'Button');
    expect(button?.storyFile).toBe('src/components/Button.stories.tsx');
    const card = index.components.find((c) => c.name === 'Card');
    expect('storyFile' in (card ?? {})).toBe(false);
  });

  it('grades typing confidence, flagging the untyped .jsx component low', () => {
    const banner = confidence.find((c) => c.name === 'Banner');
    expect(banner?.typing).toBe('untyped');
    const button = confidence.find((c) => c.name === 'Button');
    expect(button?.typing).toBe('typed');
  });
});

describe('matchGlob', () => {
  it('supports *, ** and comma alternatives', () => {
    expect(matchGlob('src/**/*.tsx', 'src/components/Button.tsx')).toBe(true);
    expect(matchGlob('src/*.tsx', 'src/components/Button.tsx')).toBe(false);
    expect(matchGlob('lib/*.ts,src/**/*.jsx', 'src/components/Banner.jsx')).toBe(true);
  });
});

describe('synthesizeExample', () => {
  it('uses first union literals and required strings, deterministic', () => {
    expect(
      synthesizeExample('Button', [
        { name: 'variant', type: '"primary" | "secondary"', required: false, defaultValue: null, description: '' },
        { name: 'children', type: 'ReactNode', required: false, defaultValue: null, description: '' },
      ]),
    ).toBe('<Button variant="primary">…</Button>');
    expect(
      synthesizeExample('Input', [
        { name: 'label', type: 'string', required: true, defaultValue: null, description: '' },
      ]),
    ).toBe('<Input label="…" />');
  });
});
