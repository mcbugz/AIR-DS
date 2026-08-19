/**
 * Per-tool happy paths and closed-world rejections, exercised through a real
 * MCP client/server pair over an in-memory transport.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { callTool, connectClient, realRegistry, type ConnectedClient } from './helpers.js';
import type { SearchHit, ThemingGuide, ChecklistItem, TokenEntry } from '../src/index.js';

let session: ConnectedClient;

beforeAll(async () => {
  session = await connectClient();
});

afterAll(async () => {
  await session.close();
});

describe('tool registration', () => {
  it('exposes exactly the seven contract tools', async () => {
    const { tools } = await session.client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'audit_checklist',
      'get_component',
      'get_theming_guide',
      'list_tokens',
      'search_docs',
      'validate_genui',
      'validate_usage',
    ]);
    for (const tool of tools) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.description?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('search_docs', () => {
  it('finds components, ranked, with kind and snippet', async () => {
    const result = await callTool(session.client, 'search_docs', { query: 'danger button' });
    expect(result.isError).toBe(false);
    const { hits } = result.json() as { hits: SearchHit[] };
    expect(hits.length).toBeGreaterThan(0);
    const first = hits[0]!;
    expect(['component', 'token', 'prop']).toContain(first.kind);
    expect(first.snippet.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.name === 'Button' || h.name.startsWith('Button.'))).toBe(true);
    // ranked: scores non-increasing
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i]!.score).toBeLessThanOrEqual(hits[i - 1]!.score);
    }
  });

  it('finds tokens by concept keywords', async () => {
    const result = await callTool(session.client, 'search_docs', { query: 'focus ring shadow' });
    const { hits } = result.json() as { hits: SearchHit[] };
    expect(hits.some((h) => h.kind === 'token' && h.name === '--ds-shadow-focus-ring')).toBe(true);
  });

  it('finds props by name', async () => {
    const result = await callTool(session.client, 'search_docs', { query: 'onDismiss' });
    const { hits } = result.json() as { hits: SearchHit[] };
    expect(hits.some((h) => h.kind === 'prop' && h.name === 'Alert.onDismiss')).toBe(true);
  });

  it('returns no hits for gibberish', async () => {
    const result = await callTool(session.client, 'search_docs', { query: 'zzqx9 wibblefrob' });
    const { hits } = result.json() as { hits: SearchHit[] };
    expect(hits).toEqual([]);
  });
});

describe('get_component', () => {
  it('returns the full contract for a registered component', async () => {
    const result = await callTool(session.client, 'get_component', { name: 'Button' });
    expect(result.isError).toBe(false);
    const contract = result.json() as {
      name: string;
      racBase: string | null;
      racBaseNote: string;
      props: Array<{ name: string; type: string }>;
      example: string;
      storyFile: string | null;
    };
    expect(contract.name).toBe('Button');
    expect(contract.racBase).toBe('Button');
    expect(contract.racBaseNote).toMatch(/ALSO legal/);
    expect(contract.props.length).toBeGreaterThan(0);
    expect(contract.example).toContain('<Button');
    expect(contract.storyFile).toMatch(/Button\.stories\.tsx$/);
  });

  it('states that static components have no RAC base', async () => {
    const result = await callTool(session.client, 'get_component', { name: 'Badge' });
    const contract = result.json() as { racBase: string | null; racBaseNote: string };
    expect(contract.racBase).toBeNull();
    expect(contract.racBaseNote).toMatch(/Static component/);
  });

  it('rejects unknown components with the valid list and a nearest suggestion (no fuzzy silent match)', async () => {
    const result = await callTool(session.client, 'get_component', { name: 'Buton' });
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/closed-world/);
    expect(result.text).toContain('Did you mean');
    expect(result.text).toContain('Button');
    // the full closed world is enumerated
    for (const c of realRegistry().components.components) {
      expect(result.text).toContain(c.name);
    }
  });

  it('rejects hallucinated primitives like Box', async () => {
    const result = await callTool(session.client, 'get_component', { name: 'Box' });
    expect(result.isError).toBe(true);
  });
});

describe('list_tokens', () => {
  it('enumerates all tokens with resolved values for the active brand', async () => {
    const result = await callTool(session.client, 'list_tokens', {});
    const data = result.json() as { brand: string; count: number; tokens: TokenEntry[] };
    const registry = realRegistry();
    expect(data.brand).toBe(registry.tokens.brand);
    expect(data.count).toBe(registry.tokens.count);
    const accent = data.tokens.find((t) => t.cssVar === '--ds-color-accent-default');
    expect(accent).toBeDefined();
    // theme-aware: value matches whatever the registry currently resolves to
    expect(accent!.value).toBe(registry.tokenByVar.get('--ds-color-accent-default')!.value);
  });

  it('filters by category and tier', async () => {
    const result = await callTool(session.client, 'list_tokens', {
      category: 'color',
      tier: 'semantic',
    });
    const data = result.json() as { tokens: TokenEntry[] };
    expect(data.tokens.length).toBeGreaterThan(0);
    for (const t of data.tokens) {
      expect(t.name.startsWith('color.')).toBe(true);
      expect(t.tier).toBe('semantic');
    }
  });

  it('rejects unknown categories with the valid list', async () => {
    const result = await callTool(session.client, 'list_tokens', { category: 'colours' });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('Valid categories');
  });
});

describe('audit_checklist', () => {
  it('returns structured items across all categories, sourced from canon', async () => {
    const result = await callTool(session.client, 'audit_checklist', {});
    const data = result.json() as { scope: string; items: ChecklistItem[] };
    expect(data.scope).toBe('all');
    const categories = new Set(data.items.map((i) => i.category));
    expect(categories).toEqual(
      new Set(['tokens', 'components', 'a11y', 'stories', 'negative-rules']),
    );
    for (const item of data.items) {
      expect(item.id.length).toBeGreaterThan(0);
      expect(item.requirement.length).toBeGreaterThan(0);
      expect(item.source.length).toBeGreaterThan(0);
    }
  });

  it('includes one item per negative rule from the live catalog', async () => {
    const result = await callTool(session.client, 'audit_checklist', { scope: 'negative-rules' });
    const data = result.json() as { items: ChecklistItem[] };
    // the catalog currently carries NR-001..NR-010; assert against the parsed file, not a constant
    const { realCatalog } = await import('./helpers.js');
    const catalog = realCatalog();
    expect(data.items.length).toBe(catalog.rules.size);
    for (const rule of catalog.rules.values()) {
      expect(data.items.some((i) => i.requirement.startsWith(rule.id))).toBe(true);
    }
  });

  it('filters by scope', async () => {
    const result = await callTool(session.client, 'audit_checklist', { scope: 'a11y' });
    const data = result.json() as { items: ChecklistItem[] };
    expect(data.items.length).toBeGreaterThan(0);
    for (const item of data.items) expect(item.category).toBe('a11y');
  });

  it('rejects unknown scopes at the schema layer', async () => {
    const result = await callTool(session.client, 'audit_checklist', { scope: 'vibes' });
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/Input validation error|Invalid enum value/);
  });
});

describe('get_theming_guide', () => {
  it('describes the three-tier model with the active brand resolved values', async () => {
    const result = await callTool(session.client, 'get_theming_guide', {});
    const guide = result.json() as ThemingGuide;
    expect(guide.model.tiers.map((t) => t.tier)).toEqual(['brand', 'semantic', 'component']);
    const registry = realRegistry();
    expect(guide.activeBrand.source).toBe(registry.tokens.brand);
    expect(guide.activeBrand.tokenCount).toBe(registry.tokens.count);
    // theme-aware: key values come from the loaded registry, not constants
    expect(guide.activeBrand.keyResolvedValues['--ds-color-accent-default']).toBe(
      registry.tokenByVar.get('--ds-color-accent-default')!.value,
    );
    expect(guide.contrast).not.toBeNull();
    expect(guide.contrast!.pairCount).toBeGreaterThan(0);
    expect(guide.overrides.allowed.length).toBeGreaterThan(0);
    expect(guide.overrides.notAllowed.join(' ')).toMatch(/NR-008/);
  });
});

describe('validate_genui', () => {
  it('accepts a valid document and rejects a fabricated component', async () => {
    const good = await callTool(session.client, 'validate_genui', {
      document: JSON.stringify({
        version: '1.0',
        screen: { title: 'Test', nodes: [{ component: 'Badge', props: { tone: 'info' }, children: ['Hi'] }] },
      }),
    });
    expect((good.json() as { valid: boolean }).valid).toBe(true);

    const bad = await callTool(session.client, 'validate_genui', {
      document: JSON.stringify({ version: '1.0', screen: { nodes: [{ component: 'Wizard', props: {} }] } }),
    });
    const parsed = bad.json() as { valid: boolean; errors: Array<{ rule: string }> };
    expect(parsed.valid).toBe(false);
    expect(parsed.errors.map((e) => e.rule)).toContain('unknown-component');

    const box = await callTool(session.client, 'validate_genui', {
      document: JSON.stringify({ version: '1.0', screen: { nodes: [{ component: 'Box', props: {} }] } }),
    });
    const boxParsed = box.json() as { valid: boolean; errors: Array<{ rule: string }> };
    expect(boxParsed.valid).toBe(false);
    expect(boxParsed.errors.map((e) => e.rule)).toContain('layout-primitive');
  });

  it('returns a doc-shape error for non-JSON input', async () => {
    const res = await callTool(session.client, 'validate_genui', { document: 'not json {' });
    const parsed = res.json() as { valid: boolean; errors: Array<{ rule: string }> };
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]!.rule).toBe('doc-shape');
  });
});
