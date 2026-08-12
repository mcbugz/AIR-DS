import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ComponentsIndex, RegistryContext, TokensIndex } from './types.ts';

/** Walk upward from `start` to the pnpm workspace root (falls back to `start`). */
export function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

/**
 * Build a RegistryContext from raw registry JSON objects.
 * Used directly by the eval runner (hermetic fixture registries) and by
 * loadRegistryContext (live workspace registries).
 */
export function buildRegistryContext(
  tokensIndex: TokensIndex,
  componentsIndex: ComponentsIndex,
): RegistryContext {
  const tokenVars = new Set<string>();
  const componentSegments = new Set<string>();
  const componentTokensBySegment = new Map<string, string[]>();

  for (const t of tokensIndex.tokens ?? []) {
    tokenVars.add(t.cssVar);
    if (t.tier === 'component') {
      const m = /^--ds-([a-z0-9]+)-/.exec(t.cssVar);
      if (m && m[1]) {
        const seg = m[1];
        componentSegments.add(seg);
        const list = componentTokensBySegment.get(seg) ?? [];
        list.push(t.cssVar);
        componentTokensBySegment.set(seg, list);
      }
    }
  }

  const componentNames = new Set<string>();
  for (const c of componentsIndex.components ?? []) componentNames.add(c.name);

  return { tokenVars, componentSegments, componentTokensBySegment, componentNames };
}

/**
 * Read registries/tokens-index.json + registries/components-index.json fresh
 * from disk (sibling processes regenerate them; never cache across runs).
 */
export function loadRegistryContext(root: string): RegistryContext {
  const tokensPath = join(root, 'registries', 'tokens-index.json');
  const componentsPath = join(root, 'registries', 'components-index.json');
  const tokensIndex: TokensIndex = existsSync(tokensPath)
    ? (JSON.parse(readFileSync(tokensPath, 'utf8')) as TokensIndex)
    : { tokens: [] };
  const componentsIndex: ComponentsIndex = existsSync(componentsPath)
    ? (JSON.parse(readFileSync(componentsPath, 'utf8')) as ComponentsIndex)
    : { components: [] };
  return buildRegistryContext(tokensIndex, componentsIndex);
}

export function registriesPresent(root: string): { tokens: boolean; components: boolean } {
  return {
    tokens: existsSync(join(root, 'registries', 'tokens-index.json')),
    components: existsSync(join(root, 'registries', 'components-index.json')),
  };
}
