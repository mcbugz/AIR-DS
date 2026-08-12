import { describe, expect, it } from 'vitest';

import {
  loadRegistry,
  resolveRegistryDir,
  tokenCategories,
  nearestNames,
} from '../src/index.js';
import { REGISTRY_DIR, realRegistry } from './helpers.js';

describe('registry loading', () => {
  it('resolves the workspace registries by default (dev layout: <pkg>/../../registries)', () => {
    expect(resolveRegistryDir()).toBe(REGISTRY_DIR);
  });

  it('prefers an explicit --registry-dir over defaults', () => {
    expect(resolveRegistryDir(REGISTRY_DIR)).toBe(REGISTRY_DIR);
  });

  it('throws a clear error for a directory without registries', () => {
    expect(() => loadRegistry('/nonexistent/registry/dir')).toThrow(/--registry-dir/);
  });

  it('loads tokens, components, and the contrast report', () => {
    const registry = realRegistry();
    expect(registry.tokens.tokens.length).toBe(registry.tokens.count);
    expect(registry.tokens.tokens.length).toBeGreaterThan(0);
    expect(registry.components.components.length).toBeGreaterThan(0);
    expect(registry.contrast).not.toBeNull();
    expect(registry.tokenByVar.size).toBe(registry.tokens.tokens.length);
  });

  it('derives component-tier token prefixes from the registry, not from code', () => {
    const registry = realRegistry();
    // every prefix must come from an actual component-tier token
    for (const prefix of registry.componentTokenPrefixes) {
      expect(
        registry.tokens.tokens.some(
          (t) => t.tier === 'component' && t.cssVar.startsWith(`--ds-${prefix}-`),
        ),
      ).toBe(true);
    }
    expect(registry.componentTokenPrefixes.size).toBeGreaterThan(0);
  });

  it('maps components to story files, including sub-components in parent directories', () => {
    const registry = realRegistry();
    for (const component of registry.components.components) {
      expect(registry.storyFiles.has(component.name)).toBe(true);
    }
    const button = registry.storyFiles.get('Button');
    expect(button).toMatch(/Button\.stories\.tsx$/);
    // sub-component without its own directory resolves into the parent's stories
    const cardBody = registry.storyFiles.get('CardBody');
    expect(cardBody).toMatch(/\.stories\.tsx$/);
  });

  it('lists token categories from first name segments', () => {
    const cats = tokenCategories(realRegistry());
    expect(cats).toContain('color');
    expect(cats).toContain('space');
  });

  it('suggests nearest names for closed-world errors', () => {
    expect(nearestNames('Buttn', ['Button', 'Badge', 'Alert'])[0]).toBe('Button');
  });
});
