/**
 * CLI wrapper for the @ds/tokens build.
 *
 * Usage: node src/build/cli.ts [--brand <path-to-brand.json>]
 * Default brand: ../../brands/default.json (repo brands/ dir).
 * Exits nonzero on any error, including WCAG AA contrast failures.
 */

import { resolve } from "node:path";
import { buildTokens, ContrastError, type BuildOptions } from "./build.ts";

function parseArgs(argv: readonly string[]): BuildOptions {
  const options: BuildOptions = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--brand") {
      const value = argv[i + 1];
      if (value === undefined) throw new Error("--brand requires a path argument");
      options.brandPath = resolve(process.cwd(), value);
      i += 1;
    } else if (arg !== undefined && arg.startsWith("--brand=")) {
      options.brandPath = resolve(process.cwd(), arg.slice("--brand=".length));
    } else {
      throw new Error(`Unknown argument: ${String(arg)}`);
    }
  }
  return options;
}

try {
  const result = buildTokens(parseArgs(process.argv.slice(2)));
  console.log(
    [
      `@ds/tokens build OK (brand: ${result.contrast.brand})`,
      `  semantic tokens:  ${result.semanticCount}`,
      `  component tokens: ${result.componentCount}`,
      `  css:              ${result.files.css}`,
      `  ts entry:         ${result.files.indexJs} (+ index.d.ts)`,
      `  registry:         ${result.files.tokensIndex}`,
      `  contrast:         ${result.files.contrastReport} (${result.contrast.pairs.length} pairs, 0 failures)`,
    ].join("\n"),
  );
} catch (error) {
  if (error instanceof ContrastError) {
    console.error(`\nBUILD FAILED — accessibility gate:\n${error.message}`);
  } else {
    console.error(`\nBUILD FAILED: ${error instanceof Error ? error.message : String(error)}`);
  }
  process.exit(1);
}
