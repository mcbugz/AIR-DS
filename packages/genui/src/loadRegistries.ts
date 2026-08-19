/**
 * Node-only registry loading for the CLI. Mirrors the @ds/mcp resolution
 * order so per-brand builds answer with the brand's own registries:
 *
 *   1. explicit `--registry-dir` flag
 *   2. `DS_REGISTRY_DIR` environment variable
 *   3. `<packageRoot>/registries` — shipped layout
 *   4. `<packageRoot>/../../registries` — dev layout (workspace root)
 */

import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ComponentsIndex, GenUIRegistries, TokensIndex } from './registryTypes.js';

function packageRoot(): string {
  // dist/loadRegistries.js → package root is one level up.
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

export function resolveRegistryDir(explicit?: string): string {
  const candidates = [
    explicit,
    process.env['DS_REGISTRY_DIR'],
    path.join(packageRoot(), 'registries'),
    path.resolve(packageRoot(), '..', '..', 'registries'),
  ].filter((c): c is string => typeof c === 'string' && c.length > 0);
  for (const dir of candidates) {
    if (existsSync(path.join(dir, 'components-index.json')) && existsSync(path.join(dir, 'tokens-index.json'))) {
      return dir;
    }
  }
  throw new Error(
    `Could not locate registries (components-index.json + tokens-index.json). Tried: ${candidates.join(', ')}. ` +
      'Pass --registry-dir or set DS_REGISTRY_DIR.',
  );
}

export function loadRegistries(explicitDir?: string): GenUIRegistries {
  const dir = resolveRegistryDir(explicitDir);
  const components = JSON.parse(
    readFileSync(path.join(dir, 'components-index.json'), 'utf8'),
  ) as ComponentsIndex;
  const tokens = JSON.parse(readFileSync(path.join(dir, 'tokens-index.json'), 'utf8')) as TokensIndex;
  return { components, tokens };
}
