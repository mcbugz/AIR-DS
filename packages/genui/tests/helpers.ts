import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GenUIDocument, GenUINode } from '../src/schema.js';
import type { GenUIRegistries } from '../src/registryTypes.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repo-root registries — tests run against the REAL closed world. */
export const REGISTRY_DIR = path.resolve(here, '..', '..', '..', 'registries');
export const DEMO_DOC_PATH = path.resolve(
  here,
  '..',
  '..',
  '..',
  'examples',
  'genui-demo',
  'settings.genui.json',
);

export function loadTestRegistries(): GenUIRegistries {
  return {
    components: JSON.parse(readFileSync(path.join(REGISTRY_DIR, 'components-index.json'), 'utf8')),
    tokens: JSON.parse(readFileSync(path.join(REGISTRY_DIR, 'tokens-index.json'), 'utf8')),
  };
}

export const registries = loadTestRegistries();

/** Smallest valid document wrapper around a list of nodes. */
export function docOf(...nodes: GenUINode[]): GenUIDocument {
  return { version: '1.0', screen: { nodes } };
}

export function loadDemoDoc(): unknown {
  return JSON.parse(readFileSync(DEMO_DOC_PATH, 'utf8'));
}
