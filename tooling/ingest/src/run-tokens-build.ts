#!/usr/bin/env node
/**
 * Subprocess runner for the @ds/tokens build, kept dependency-free and
 * self-contained so it runs identically from src/ (node type-stripping) and
 * dist/ (compiled), and identically under vitest (which would otherwise pull
 * the tokens build source through its own transform pipeline).
 *
 * The tokens build's public API (packages/tokens/src/build/build.ts#buildTokens)
 * accepts brandPath / distDir / registriesDir, so an ingest run builds into an
 * ISOLATED customer directory and the workspace's default-brand dist/ and
 * registries/ are never written. We import it dynamically at a path passed in
 * by the pipeline — no static coupling to the sibling package's file layout.
 *
 * Usage: node run-tokens-build.js <build-module-path> <brand.json> <distDir> <registriesDir>
 * Prints a single JSON line on success; exits 1 with the error message on failure.
 */

interface TokensBuildModule {
  buildTokens: (options: { brandPath: string; distDir: string; registriesDir: string }) => {
    semanticCount: number;
    componentCount: number;
    contrast: { failures: number; pairs: unknown[] };
    files: Record<string, string>;
  };
}

async function main(): Promise<void> {
  const [modulePath, brandPath, distDir, registriesDir] = process.argv.slice(2);
  if (!modulePath || !brandPath || !distDir || !registriesDir) {
    throw new Error("usage: run-tokens-build <build-module-path> <brand.json> <distDir> <registriesDir>");
  }
  const { pathToFileURL } = await import("node:url");
  const mod = (await import(pathToFileURL(modulePath).href)) as TokensBuildModule;
  if (typeof mod.buildTokens !== "function") {
    throw new Error(`${modulePath} does not export buildTokens() — tokens build API changed?`);
  }
  const result = mod.buildTokens({ brandPath, distDir, registriesDir });
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      semanticCount: result.semanticCount,
      componentCount: result.componentCount,
      contrastFailures: result.contrast.failures,
      contrastPairs: result.contrast.pairs.length,
      files: result.files,
    })}\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
