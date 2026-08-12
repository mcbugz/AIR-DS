/**
 * Full ingest pipeline: validate -> generate brand -> tokens build (isolated
 * dirs; workspace registries hash-verified untouched) -> context build when the
 * @ds/context package exists -> customer-builds/<name>/ bundle with
 * intake-report.md and publish-plan.json.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatErrors, validateIntake, type Intake } from "./intake.js";
import { generateBrand, type GenerateResult } from "./brand.js";
import { renderIntakeReport, renderPublishPlan, type PipelineReportData, type TokensBuildSummary } from "./report.js";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
/** tooling/ingest/<src|dist>/pipeline.* -> repo root is three levels up. */
export const REPO_ROOT: string = resolve(MODULE_DIR, "..", "..", "..");

export interface PipelineOptions {
  repoRoot?: string;
  /** Where the brand file is written. Default: <repo>/brands/<name>.json. */
  brandPath?: string;
  /** Root for the customer bundle. Default: <repo>/customer-builds. */
  outRoot?: string;
}

export interface PipelineResult {
  name: string;
  brandPath: string;
  outDir: string;
  emittedFiles: string[];
  generate: GenerateResult;
  tokensBuild: TokensBuildSummary;
  contextStatus: ContextStatus;
  registriesBefore: Record<string, string>;
  registriesAfter: Record<string, string>;
  timingsMs: Record<string, number>;
  warnings: string[];
}

export function readIntakeFile(intakePath: string): Intake {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(intakePath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read intake ${intakePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const result = validateIntake(parsed);
  if (!result.ok) {
    throw new Error(`Intake validation failed for ${intakePath}:\n${formatErrors(result.errors)}`);
  }
  return result.intake;
}

/** SHA-256 of every file in <repo>/registries, keyed by relative filename. */
export function hashRegistries(repoRoot: string): Record<string, string> {
  const dir = join(repoRoot, "registries");
  const out: Record<string, string> = {};
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    const filePath = join(dir, name);
    if (!statSync(filePath).isFile()) continue;
    out[name] = createHash("sha256").update(readFileSync(filePath)).digest("hex");
  }
  return out;
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function listFilesRecursive(dir: string, base: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const filePath = join(dir, name);
    if (statSync(filePath).isDirectory()) out.push(...listFilesRecursive(filePath, base));
    else out.push(relative(base, filePath).split("\\").join("/"));
  }
  return out;
}

interface TokensRunnerOutput {
  ok: boolean;
  semanticCount: number;
  componentCount: number;
  contrastFailures: number;
  contrastPairs: number;
}

function runTokensBuildIsolated(repoRoot: string, brandPath: string, outDir: string): TokensBuildSummary {
  const buildModule = join(repoRoot, "packages", "tokens", "src", "build", "build.ts");
  if (!existsSync(buildModule)) {
    throw new Error(`Tokens build module not found at ${buildModule} — @ds/tokens layout changed?`);
  }
  const runnerTs = join(MODULE_DIR, "run-tokens-build.ts");
  const runner = existsSync(runnerTs) ? runnerTs : join(MODULE_DIR, "run-tokens-build.js");
  const distDir = join(outDir, "tokens");
  const registriesDir = join(outDir, "registries");
  let stdout: string;
  try {
    stdout = execFileSync(process.execPath, [runner, buildModule, brandPath, distDir, registriesDir], {
      encoding: "utf8",
      cwd: repoRoot,
    });
  } catch (error) {
    const stderr =
      typeof error === "object" && error !== null && "stderr" in error ? String((error as { stderr: unknown }).stderr) : "";
    throw new Error(
      `Isolated tokens build failed for ${brandPath} — the AA pre-check should have prevented this; investigate before shipping.\n${stderr.trim()}`,
    );
  }
  const lastLine = stdout.trim().split("\n").pop() ?? "";
  const parsed = JSON.parse(lastLine) as TokensRunnerOutput;
  return {
    semanticCount: parsed.semanticCount,
    componentCount: parsed.componentCount,
    contrastPairs: parsed.contrastPairs,
    contrastFailures: parsed.contrastFailures,
  };
}

export type ContextStatus = "built" | "skipped-absent" | "skipped-noncanonical-brand-path";

/**
 * Per-brand context build. The @ds/context compiler reads the brand-built
 * registries from <repo>/registries and the brand file from brands/<name>.json,
 * so we swap the customer's isolated registries in, compile to an isolated
 * --out, and restore the workspace's default-brand registries byte-for-byte in
 * a finally block. The pipeline's end-of-run hash check re-verifies the restore.
 */
function runContextBuild(
  repoRoot: string,
  name: string,
  brandPath: string,
  outDir: string,
  isolatedRegistriesDir: string,
  warnings: string[],
): ContextStatus {
  const contextCli = join(repoRoot, "packages", "context", "src", "cli.ts");
  if (!existsSync(join(repoRoot, "packages", "context", "package.json")) || !existsSync(contextCli)) {
    warnings.push(
      "@ds/context is not in the workspace yet (per-customer AI artifacts pending) — context build skipped; re-run `ds-ingest run` once the sibling package lands.",
    );
    return "skipped-absent";
  }
  const canonicalBrandPath = join(repoRoot, "brands", `${name}.json`);
  if (resolve(brandPath) !== canonicalBrandPath) {
    warnings.push(
      `@ds/context resolves the brand at brands/${name}.json, but this run wrote the brand to ${brandPath} (--brand-out). Context build skipped.`,
    );
    return "skipped-noncanonical-brand-path";
  }

  /* Swap the two brand-specific registries in; components-index is brand-independent. */
  const swapped = new Map<string, Buffer>();
  for (const file of ["tokens-index.json", "contrast-report.json"]) {
    const workspaceFile = join(repoRoot, "registries", file);
    const isolatedFile = join(isolatedRegistriesDir, file);
    if (!existsSync(workspaceFile) || !existsSync(isolatedFile)) {
      throw new Error(`Registry swap for context build: missing ${existsSync(workspaceFile) ? isolatedFile : workspaceFile}`);
    }
    swapped.set(workspaceFile, readFileSync(workspaceFile));
    writeFileSync(workspaceFile, readFileSync(isolatedFile));
  }
  try {
    execFileSync(process.execPath, [contextCli, "--brand", name, "--out", join(outDir, "context")], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr =
      typeof error === "object" && error !== null && "stderr" in error ? String((error as { stderr: unknown }).stderr) : "";
    throw new Error(`@ds/context build failed for brand "${name}" (workspace registries restored):\n${stderr.trim()}`);
  } finally {
    /* Restore the default-brand registries byte-for-byte, whatever happened. */
    for (const [workspaceFile, original] of swapped) writeFileSync(workspaceFile, original);
  }
  return "built";
}

export function runPipeline(intakePath: string, options: PipelineOptions = {}): PipelineResult {
  const repoRoot = resolve(options.repoRoot ?? REPO_ROOT);
  const timingsMs: Record<string, number> = {};
  const warnings: string[] = [];
  const started = Date.now();

  /* 1. Validate. */
  let t = Date.now();
  const intake = readIntakeFile(resolve(intakePath));
  timingsMs["validate"] = Date.now() - t;

  /* 2. Generate the brand file (deterministic ramps + AA pre-check/repair). */
  t = Date.now();
  const generate = generateBrand(intake, repoRoot);
  const brandPath = resolve(options.brandPath ?? join(repoRoot, "brands", `${intake.name}.json`));
  writeJson(brandPath, generate.document);
  timingsMs["generate-brand"] = Date.now() - t;

  const outRoot = resolve(options.outRoot ?? join(repoRoot, "customer-builds"));
  const outDir = join(outRoot, intake.name);
  mkdirSync(outDir, { recursive: true });

  /* 3. Isolated tokens build; workspace registries must not move. */
  const registriesBefore = hashRegistries(repoRoot);
  t = Date.now();
  const tokensBuild = runTokensBuildIsolated(repoRoot, brandPath, outDir);
  timingsMs["tokens-build"] = Date.now() - t;

  /* 4. Context build per brand, when the package exists (registry swap + restore). */
  t = Date.now();
  const contextStatus = runContextBuild(repoRoot, intake.name, brandPath, outDir, join(outDir, "registries"), warnings);
  timingsMs["context-build"] = Date.now() - t;

  /* 5. Bundle: brand copy + reports. */
  t = Date.now();
  writeJson(join(outDir, "brand.json"), generate.document);

  const registriesAfter = hashRegistries(repoRoot);
  const registriesClean = Object.keys({ ...registriesBefore, ...registriesAfter }).every(
    (k) => registriesBefore[k] === registriesAfter[k],
  );
  if (!registriesClean) {
    throw new Error(
      "Workspace registries/ changed during the ingest run. The isolated tokens build must never write there — investigate (a sibling build may also have raced this run).",
    );
  }

  const reportData: PipelineReportData = {
    intake,
    generate,
    brandRelPath: relative(repoRoot, brandPath).split("\\").join("/"),
    outRelDir: relative(repoRoot, outDir).split("\\").join("/"),
    tokensBuild,
    contextStatus,
    emittedFiles: [],
    registriesBefore,
    registriesAfter,
    timingsMs,
    warnings,
  };
  writeJson(join(outDir, "publish-plan.json"), renderPublishPlan(reportData));
  /* Emit the report last so its file list covers everything else. */
  reportData.emittedFiles = [...listFilesRecursive(outDir, outDir), "intake-report.md"].sort();
  timingsMs["bundle"] = Date.now() - t;
  timingsMs["total"] = Date.now() - started;
  writeFileSync(join(outDir, "intake-report.md"), renderIntakeReport(reportData), "utf8");

  return {
    name: intake.name,
    brandPath,
    outDir,
    emittedFiles: reportData.emittedFiles,
    generate,
    tokensBuild,
    contextStatus,
    registriesBefore,
    registriesAfter,
    timingsMs,
    warnings,
  };
}
