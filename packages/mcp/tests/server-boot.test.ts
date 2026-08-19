/**
 * The BUILT server (dist/cli.js — the `ds-mcp` bin) actually boots against the
 * real registries: full MCP initialize handshake over stdio, tools listed, a
 * tool called. Builds the package first when dist is stale or missing.
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { PKG_ROOT, REGISTRY_DIR } from './helpers.js';

const CLI = path.join(PKG_ROOT, 'dist', 'cli.js');

let client: Client;

beforeAll(async () => {
  if (!existsSync(CLI)) {
    execSync('pnpm build', { cwd: PKG_ROOT, stdio: 'inherit' });
  }
  client = new Client({ name: 'ds-mcp-boot-test', version: '0.0.0' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [CLI, '--registry-dir', REGISTRY_DIR],
      stderr: 'pipe',
    }),
  );
});

afterAll(async () => {
  await client.close();
});

describe('built ds-mcp binary over stdio', () => {
  it('completes the MCP initialize handshake and reports its identity', () => {
    const serverInfo = client.getServerVersion();
    expect(serverInfo?.name).toBe('ds-mcp');
  });

  it('lists the seven tools with input schemas', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'audit_checklist',
      'get_component',
      'get_theming_guide',
      'list_tokens',
      'search_docs',
      'validate_genui',
      'validate_usage',
    ]);
    const search = tools.find((t) => t.name === 'search_docs')!;
    expect(search.inputSchema.type).toBe('object');
    expect((search.inputSchema.properties as Record<string, unknown>)['query']).toBeDefined();
  });

  it('answers a tool call end-to-end', async () => {
    const result = await client.callTool({ name: 'get_theming_guide', arguments: {} });
    const content = result.content as Array<{ type: string; text: string }>;
    const guide = JSON.parse(content[0]!.text) as { activeBrand: { source: string } };
    expect(guide.activeBrand.source.length).toBeGreaterThan(0);
  });

  it('exits with a clear error when the registry dir is invalid', () => {
    const run = spawnSync(process.execPath, [CLI, '--registry-dir', '/nope/registries'], {
      encoding: 'utf8',
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/Could not locate a registry directory/);
  });

  it('rejects unknown CLI arguments', () => {
    const run = spawnSync(process.execPath, [CLI, '--bogus'], { encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/Unknown argument/);
  });
});
