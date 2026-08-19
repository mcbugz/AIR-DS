#!/usr/bin/env node
/**
 * ds-genui — CLI face of the generative-UI validator.
 *
 *   ds-genui validate <file> [--registry-dir <dir>] [--json]
 *
 * Exit codes: 0 valid · 1 invalid document · 2 usage/IO error.
 * Deterministic: the same document + registries always yield the same
 * verdict; no LLM in this path.
 */

import { readFileSync, statSync } from 'node:fs';
import { loadRegistries } from './loadRegistries.js';
import { validateDocument } from './validate.js';
import { GENUI_VERSION } from './schema.js';

/** DoS hygiene: refuse absurd files before JSON.parse sees them. */
const MAX_FILE_BYTES = 1024 * 1024; // 1 MiB

function usage(): void {
  process.stderr.write(
    [
      'ds-genui — deterministic generative-UI document validator (closed world, no LLM)',
      '',
      'Usage:',
      '  ds-genui validate <file.genui.json> [--registry-dir <dir>] [--json]',
      '',
      `Wire format version: ${GENUI_VERSION}`,
      'Registries resolve via --registry-dir, DS_REGISTRY_DIR, <package>/registries, then the workspace root.',
      '',
    ].join('\n'),
  );
}

function main(argv: string[]): number {
  const args = [...argv];
  const command = args.shift();
  if (command !== 'validate') {
    usage();
    return command === undefined || command === '--help' || command === '-h' ? 0 : 2;
  }

  let file: string | undefined;
  let registryDir: string | undefined;
  let json = false;
  while (args.length > 0) {
    const arg = args.shift() as string;
    if (arg === '--registry-dir') registryDir = args.shift();
    else if (arg === '--json') json = true;
    else if (arg.startsWith('-')) {
      process.stderr.write(`Unknown flag: ${arg}\n`);
      return 2;
    } else if (file === undefined) file = arg;
    else {
      process.stderr.write('Exactly one document file expected.\n');
      return 2;
    }
  }
  if (!file) {
    usage();
    return 2;
  }

  let doc: unknown;
  try {
    const size = statSync(file).size;
    if (size > MAX_FILE_BYTES) {
      process.stderr.write(`${file}: ${size} bytes exceeds the ${MAX_FILE_BYTES}-byte document limit.\n`);
      return 2;
    }
    doc = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    process.stderr.write(`${file}: ${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }

  let result;
  try {
    result = validateDocument(doc, loadRegistries(registryDir));
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.valid ? 0 : 1;
  }

  if (result.valid) {
    process.stdout.write(`✓ ${file}: valid genui ${GENUI_VERSION} document (${result.nodeCount} nodes).\n`);
    return 0;
  }
  process.stdout.write(`✗ ${file}: ${result.errors.length} error(s)\n\n`);
  for (const error of result.errors) {
    process.stdout.write(`  [${error.rule}] at ${error.path}\n`);
    process.stdout.write(`    ${error.message}\n`);
    process.stdout.write(`    fix: ${error.fix}\n\n`);
  }
  return 1;
}

process.exit(main(process.argv.slice(2)));
