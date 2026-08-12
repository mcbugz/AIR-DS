#!/usr/bin/env node
/**
 * ds-ingest — brand ingest pipeline CLI (ADR-006 Phase 4).
 *
 *   ds-ingest validate <intake.json>
 *   ds-ingest generate <intake.json> [-o brands/<name>.json]
 *   ds-ingest run      <intake.json> [--out-root <dir>] [--brand-out <path>]
 *
 * `run` = validate -> generate brand (deterministic OKLCH ramps, WCAG AA
 * pre-checked and auto-repaired) -> isolated tokens build -> context build when
 * @ds/context exists -> customer-builds/<name>/ bundle (brand file, tokens
 * css/ts, registries, context artifacts, intake-report.md, publish-plan.json).
 * The workspace's default-brand registries/ are hash-verified untouched.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { formatErrors, validateIntake } from "./intake.js";
import { generateBrand } from "./brand.js";
import { readIntakeFile, runPipeline, REPO_ROOT } from "./pipeline.js";

function fail(message: string): never {
  console.error(`ds-ingest: ${message}`);
  process.exit(1);
}

function usage(): never {
  console.error(
    [
      "usage:",
      "  ds-ingest validate <intake.json>",
      "  ds-ingest generate <intake.json> [-o <brands/name.json>]",
      "  ds-ingest run      <intake.json> [--out-root <dir>] [--brand-out <path>]",
    ].join("\n"),
  );
  process.exit(2);
}

function cmdValidate(intakePath: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(intakePath, "utf8"));
  } catch (error) {
    fail(`cannot read ${intakePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const result = validateIntake(parsed);
  if (!result.ok) {
    console.error(`INVALID — ${intakePath} (${result.errors.length} error(s)):\n${formatErrors(result.errors)}`);
    process.exit(1);
  }
  console.log(`OK — ${intakePath} is a valid intake for brand "${result.intake.name}".`);
}

function cmdGenerate(intakePath: string, outPath: string | undefined): void {
  const intake = readIntakeFile(intakePath);
  const target = resolve(outPath ?? join(REPO_ROOT, "brands", `${intake.name}.json`));
  const result = generateBrand(intake, REPO_ROOT);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(result.document, null, 2)}\n`, "utf8");
  console.log(`Brand file written: ${relative(process.cwd(), target)}`);
  console.log(`AA pre-check: ${result.aa.pairs.length} pairs @ ${result.aa.threshold}:1 — 0 failures.`);
  if (result.aa.adjustments.length > 0) {
    console.log(`Adjustments (${result.aa.adjustments.length}):`);
    for (const adj of result.aa.adjustments) {
      const pair = adj.pair ? ` [${adj.pair.foreground} on ${adj.pair.background}]` : "";
      console.log(`  ${adj.rampPath}: ${adj.before} -> ${adj.after} (${adj.reason})${pair}`);
    }
  } else {
    console.log("Adjustments: none — all ramps cleared AA as generated.");
  }
  if (result.defaultsUsed.length > 0) {
    console.log(`Defaults applied: ${result.defaultsUsed.join("; ")}`);
  }
}

function cmdRun(intakePath: string, outRoot: string | undefined, brandOut: string | undefined): void {
  const options: Parameters<typeof runPipeline>[1] = {};
  if (outRoot !== undefined) options.outRoot = resolve(outRoot);
  if (brandOut !== undefined) options.brandPath = resolve(brandOut);
  const result = runPipeline(intakePath, options);
  console.log(`ds-ingest run OK — brand "${result.name}"`);
  console.log(`  brand file:  ${relative(process.cwd(), result.brandPath)}`);
  console.log(`  bundle:      ${relative(process.cwd(), result.outDir)}/`);
  console.log(`  tokens:      ${result.tokensBuild.semanticCount} semantic + ${result.tokensBuild.componentCount} component; gate ${result.tokensBuild.contrastPairs} pairs, ${result.tokensBuild.contrastFailures} failures`);
  console.log(`  context:     ${result.contextStatus}`);
  console.log(`  AA fixes:    ${result.generate.aa.adjustments.length}`);
  console.log(`  registries:  workspace default-brand state verified unchanged (${Object.keys(result.registriesBefore).length} files hash-checked)`);
  console.log(`  timings ms:  ${Object.entries(result.timingsMs).map(([k, v]) => `${k}=${v}`).join(" ")}`);
  for (const warning of result.warnings) console.log(`  WARNING: ${warning}`);
  console.log(`  report:      ${relative(process.cwd(), join(result.outDir, "intake-report.md"))}`);
}

function main(): void {
  const argv = process.argv.slice(2);
  const command = argv[0];
  if (!command || command === "--help" || command === "-h") usage();

  try {
    if (command === "validate") {
      const intakePath = argv[1];
      if (!intakePath || argv.length > 2) usage();
      cmdValidate(resolve(intakePath));
      return;
    }
    if (command === "generate") {
      const intakePath = argv[1];
      if (!intakePath) usage();
      let outPath: string | undefined;
      for (let i = 2; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "-o" || arg === "--out") {
          outPath = argv[i + 1];
          if (!outPath) fail(`${arg} requires a path`);
          i += 1;
        } else fail(`unknown argument: ${String(arg)}`);
      }
      cmdGenerate(resolve(intakePath), outPath);
      return;
    }
    if (command === "run") {
      const intakePath = argv[1];
      if (!intakePath) usage();
      let outRoot: string | undefined;
      let brandOut: string | undefined;
      for (let i = 2; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "--out-root") {
          outRoot = argv[i + 1];
          if (!outRoot) fail("--out-root requires a path");
          i += 1;
        } else if (arg === "--brand-out") {
          brandOut = argv[i + 1];
          if (!brandOut) fail("--brand-out requires a path");
          i += 1;
        } else fail(`unknown argument: ${String(arg)}`);
      }
      cmdRun(resolve(intakePath), outRoot, brandOut);
      return;
    }
    usage();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

main();
