import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { hashRegistries, runPipeline, REPO_ROOT } from "../src/pipeline.js";

const ACME_INTAKE = join(REPO_ROOT, "brands", "acme-intake.json");
const scratch = mkdtempSync(join(tmpdir(), "ds-ingest-pipeline-"));

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe("runPipeline (acme end-to-end, isolated outputs)", () => {
  // Brand goes to its canonical committed location (brands/acme.json) — the
  // context compiler resolves brands there, and generation is deterministic so
  // the write is byte-identical to the committed file. Bundles go to scratch.
  const registriesBefore = hashRegistries(REPO_ROOT);
  const result = runPipeline(ACME_INTAKE, {
    outRoot: join(scratch, "customer-builds"),
  });
  const registriesAfter = hashRegistries(REPO_ROOT);

  it("leaves the workspace registries in default-brand state (hash before == after)", () => {
    expect(Object.keys(registriesBefore).length).toBeGreaterThan(0);
    expect(registriesAfter).toEqual(registriesBefore);
    expect(result.registriesAfter).toEqual(result.registriesBefore);
  });

  it("emits the full customer bundle", () => {
    const outDir = result.outDir;
    for (const rel of [
      "brand.json",
      "tokens/css/tokens.css",
      "tokens/index.js",
      "tokens/index.d.ts",
      "registries/tokens-index.json",
      "registries/contrast-report.json",
      "publish-plan.json",
      "intake-report.md",
    ]) {
      expect(existsSync(join(outDir, rel)), rel).toBe(true);
    }
    expect(result.emittedFiles).toContain("intake-report.md");
  });

  it("built the tokens for the acme brand with a passing gate", () => {
    expect(result.tokensBuild.contrastFailures).toBe(0);
    expect(result.tokensBuild.semanticCount).toBeGreaterThan(0);
    const css = readFileSync(join(result.outDir, "tokens", "css", "tokens.css"), "utf8");
    expect(css).toContain("brands/acme.json".split("/").pop() as string); // brand label mentions acme.json
    expect(css).toContain("--ds-color-accent-default:");
    // Acme's deep-green accent, not the neutral core blue.
    expect(css).not.toContain("--ds-color-accent-default: #2563eb;");
    const report = JSON.parse(readFileSync(join(result.outDir, "registries", "contrast-report.json"), "utf8")) as {
      failures: number;
      pairs: unknown[];
    };
    expect(report.failures).toBe(0);
  });

  it("handles the context package: built when present, skipped-with-warning when absent", () => {
    const contextExists = existsSync(join(REPO_ROOT, "packages", "context", "package.json"));
    if (contextExists) {
      expect(result.contextStatus).toBe("built");
    } else {
      expect(result.contextStatus).toBe("skipped-absent");
      expect(result.warnings.some((w) => w.includes("@ds/context"))).toBe(true);
    }
  });

  it("publish plan carries the intake's distribution prefs", () => {
    const plan = JSON.parse(readFileSync(join(result.outDir, "publish-plan.json"), "utf8")) as {
      npmScope: string;
      access: string;
      automated: boolean;
    };
    expect(plan.npmScope).toBe("@acme-ds");
    expect(plan.access).toBe("restricted");
    expect(plan.automated).toBe(false);
  });

  it("intake report documents every AA adjustment", () => {
    const md = readFileSync(join(result.outDir, "intake-report.md"), "utf8");
    expect(md).toContain("## WCAG AA pre-check");
    for (const adj of result.generate.aa.adjustments) {
      expect(md).toContain(adj.rampPath);
      expect(md).toContain(adj.after);
    }
    expect(md).toContain("hash-verified untouched");
  });

  it("brand generation is deterministic across runs", () => {
    const second = runPipeline(ACME_INTAKE, {
      brandPath: join(scratch, "brands", "acme-2.json"),
      outRoot: join(scratch, "customer-builds-2"),
    });
    expect(readFileSync(join(scratch, "brands", "acme-2.json"), "utf8")).toBe(
      readFileSync(join(REPO_ROOT, "brands", "acme.json"), "utf8"),
    );
    expect(second.generate.aa.adjustments).toEqual(result.generate.aa.adjustments);
    // A non-canonical --brand-out cannot feed the context compiler: skip, don't lie.
    expect(second.contextStatus).toBe("skipped-noncanonical-brand-path");
  });
});
