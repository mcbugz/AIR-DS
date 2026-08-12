#!/usr/bin/env node
/**
 * `ds-mcp` — AIR-DS MCP server over stdio.
 *
 *   ds-mcp [--registry-dir <path>] [--rules-file <path>]
 *
 * Registry resolution: --registry-dir → DS_REGISTRY_DIR → <pkg>/registries
 * (shipped per-customer layout) → <pkg>/../../registries (dev workspace).
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createDsMcpServer } from './server.js';

function parseArgs(argv: string[]): { registryDir?: string; rulesFile?: string } {
  const options: { registryDir?: string; rulesFile?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--registry-dir') {
      const value = argv[++i];
      if (!value) fail('--registry-dir requires a path');
      options.registryDir = value;
    } else if (arg?.startsWith('--registry-dir=')) {
      options.registryDir = arg.slice('--registry-dir='.length);
    } else if (arg === '--rules-file') {
      const value = argv[++i];
      if (!value) fail('--rules-file requires a path');
      options.rulesFile = value;
    } else if (arg?.startsWith('--rules-file=')) {
      options.rulesFile = arg.slice('--rules-file='.length);
    } else if (arg === '--help' || arg === '-h') {
      process.stderr.write(
        'ds-mcp — AIR-DS MCP server (stdio)\n\nOptions:\n  --registry-dir <path>  Directory containing tokens-index.json / components-index.json / contrast-report.json\n  --rules-file <path>    negative-rules.md catalog (default: resolved next to the registries)\n',
      );
      process.exit(0);
    } else {
      fail(`Unknown argument '${arg}'. See ds-mcp --help.`);
    }
  }
  return options;
}

function fail(message: string): never {
  process.stderr.write(`ds-mcp: ${message}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  let ds;
  try {
    ds = createDsMcpServer(options);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  // stdout is the MCP channel — diagnostics go to stderr only.
  process.stderr.write(
    `ds-mcp: serving registries from ${ds.registry.registryDir} (brand: ${ds.registry.tokens.brand}, ${ds.registry.tokens.count} tokens, ${ds.registry.components.components.length} components, negative rules: ${ds.catalog.rules.size})\n`,
  );
  await ds.server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
