#!/usr/bin/env node
/**
 * ds-retrofit — retrofit ingestion CLI (Mandate v2, M2).
 *
 *   ds-retrofit <path-to-their-repo> -o <outdir> [--name <brand>]
 *               [--components <glob[,glob]>] [--now <ISO>] [--no-context]
 *
 * Their existing design system in (CSS custom properties / Tailwind config /
 * DTCG source / React components) -> the AIR-DS AI layer out: synthesized
 * closed-world registries, compiled context bundle, gauntlet starter config,
 * and a RETROFIT.md report — on top of THEIR components, no rewrite.
 */

import { relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { runRetrofit } from './pipeline.js';

function usage(): never {
  console.error(
    [
      'usage: ds-retrofit <path-to-their-repo> -o <outdir> [options]',
      '',
      '  -o, --out <dir>        output directory (REQUIRED; cleaned before writing)',
      '  --name <brand>         brand name for the context bundle (default: sanitized package name)',
      '  --components <globs>   comma-separated repo-relative globs selecting component sources',
      '  --now <ISO>            fixed timestamp for byte-identical context builds',
      '  --no-context           emit registries + report only, skip @ds/context compilation',
    ].join('\n'),
  );
  process.exit(2);
}

function main(): void {
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        out: { type: 'string', short: 'o' },
        name: { type: 'string' },
        components: { type: 'string' },
        now: { type: 'string' },
        'no-context': { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (error) {
    console.error(`ds-retrofit: ${error instanceof Error ? error.message : String(error)}`);
    usage();
  }
  const { values, positionals } = parsed;
  if (values.help || positionals.length !== 1 || values.out === undefined) usage();

  const repo = positionals[0] as string;
  try {
    const result = runRetrofit(repo, {
      outDir: values.out,
      ...(values.name !== undefined ? { name: values.name } : {}),
      ...(values.components !== undefined ? { componentsGlob: values.components } : {}),
      ...(values.now !== undefined ? { now: values.now } : {}),
      context: values['no-context'] === true ? false : true,
    });

    const out = relative(process.cwd(), resolve(values.out)) || '.';
    if (!result.detected) {
      console.log(`ds-retrofit: nothing detected in ${repo} — see ${out}/RETROFIT.md for what the scan looked for.`);
      return;
    }
    console.log(`ds-retrofit OK — ${result.componentsIndex?.package ?? repo} -> ${out}/`);
    console.log(`  tokens:      ${result.tokensIndex?.count ?? 0} synthesized (css=${result.tokensIndex?.tokens.filter((t) => t.provenance.adapter === 'css-custom-properties').length ?? 0} tailwind=${result.tokensIndex?.tokens.filter((t) => t.provenance.adapter === 'tailwind').length ?? 0} dtcg=${result.tokensIndex?.tokens.filter((t) => t.provenance.adapter === 'dtcg').length ?? 0})`);
    console.log(`  components:  ${result.componentsIndex?.components.length ?? 0} indexed (closed world)`);
    console.log(`  contrast:    ${result.contrastReport?.pairs.length ?? 0} pairs, ${result.contrastReport?.failures ?? 0} failures, ${result.contrastReport?.unaudited.length ?? 0} unaudited`);
    console.log(`  hardcoded:   ${result.hardcoded.length} color literal(s) flagged`);
    console.log(`  context:     ${result.contextStatus}${result.contextStatus === 'emitted' ? ` (${result.contextFiles} files)` : ''}`);
    console.log(`  gauntlet:    gauntlet.config.json (closed-world token + component checks enforceable today)`);
    console.log(`  report:      ${out}/RETROFIT.md`);
    for (const w of result.warnings) console.log(`  WARNING: ${w}`);
    if (result.contextStatus === 'failed') {
      console.error(`  context error: ${result.contextError ?? 'unknown'}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`ds-retrofit: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
