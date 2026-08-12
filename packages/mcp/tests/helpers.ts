/**
 * Shared test helpers. All tests run against the REAL workspace registries
 * (registries/ at the repo root) — values are read at runtime, never baked in,
 * so these tests keep passing when the registries are regenerated.
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createDsMcpServer, loadRegistry, loadNegativeRules } from '../src/index.js';
import type { Registry } from '../src/index.js';

export const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(PKG_ROOT, '..', '..');
export const REGISTRY_DIR = path.join(REPO_ROOT, 'registries');
export const NEGATIVE_RULES_FILE = path.join(REPO_ROOT, 'docs', 'specs', 'negative-rules.md');

export function realRegistry(): Registry {
  return loadRegistry(REGISTRY_DIR);
}

export function realCatalog() {
  return loadNegativeRules(REGISTRY_DIR);
}

export interface ConnectedClient {
  client: Client;
  close: () => Promise<void>;
}

/** Connect an MCP client to a freshly created ds-mcp server over an in-memory pair. */
export async function connectClient(): Promise<ConnectedClient> {
  const { server } = createDsMcpServer({ registryDir: REGISTRY_DIR });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'ds-mcp-test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

export interface ToolResult {
  isError: boolean;
  text: string;
  json: () => unknown;
}

export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolResult> {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as Array<{ type: string; text?: string }>;
  const text = content
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('\n');
  return {
    isError: result.isError === true,
    text,
    json: () => JSON.parse(text) as unknown,
  };
}

/** Expand a `--ds-foo-*` glob from the catalog into a real registry token. */
export function expandTokenGlob(registry: Registry, pattern: string): string {
  const prefix = pattern.replace(/\*.*$/, '');
  const match = registry.tokens.tokens.find((t) => t.cssVar.startsWith(prefix));
  if (!match) throw new Error(`No registry token matches glob '${pattern}'`);
  return match.cssVar;
}
