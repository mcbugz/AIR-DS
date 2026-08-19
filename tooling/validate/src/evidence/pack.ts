import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { checkAxeAvailability } from '../benchmark/axe.ts';
import { runEvals, type EvalRunResult } from '../evals/run-evals.ts';
import { runGauntlet } from '../gauntlet.ts';
import { countFabrications, gitCommitTs, registryCounts } from '../metrics/record.ts';
import type { GauntletReport } from '../types.ts';
import { collectDependencyInventory } from './dependencies.ts';
import {
  collectArtifactHashes,
  collectGitProvenance,
  collectReproducibility,
  collectToolchain,
} from './provenance.ts';
import { EVIDENCE_SCHEMA_VERSION, validateEvidenceDoc, type EvidenceDoc } from './schema.ts';
import {
  collectContrastEvidence,
  collectVitestAxeEvidence,
  latestStoriesAxeFile,
  summarizeStoriesAxe,
  type StoriesAxeEvidence,
} from './wcag.ts';

/**
 * The compliance evidence pack (M6): one command -> auditor-ready bundle.
 *
 *   evidence-pack/
 *     .gitignore          "*" — the pack gitignores itself
 *     evidence.json       machine layer (schema EVIDENCE_SCHEMA_VERSION)
 *     EVIDENCE.md         human layer; every claim links to a pack artifact
 *     SHA256SUMS          integrity manifest of every other file in the pack
 *     artifacts/*.json    the raw evidence each claim is linked to
 *
 * Guarantees:
 *  - FRESH EXECUTION: the gauntlet and the eval run are executed during
 *    generation. A failing gauntlet or eval run ABORTS generation before a
 *    single byte is written — evidence of a broken system must not look like
 *    evidence of a working one.
 *  - DETERMINISM: timestamps are pinned (--now, defaulting to the HEAD commit
 *    time, the same pattern as @ds/context and the metrics writer) and timing
 *    fields (durationMs/durations/startedAt) are stripped from evidence
 *    copies, so identical inputs yield byte-identical packs.
 *  - CREDENTIAL-FREE / NO NETWORK: dependency inventory comes from
 *    pnpm-lock.yaml + local disk; the optional chromium only upgrades the
 *    stories-axe evidence from committed-with-staleness-stamp to fresh-run.
 */

export class EvidenceError extends Error {}

export interface EvidenceRunners {
  gauntlet: () => GauntletReport;
  evals: () => EvalRunResult;
  /** Runs the stories-axe CLI; returns the results file to use, or throws. */
  storiesAxe: () => string;
}

export interface EvidenceOptions {
  root: string;
  /** Output directory; default <root>/evidence-pack. */
  outDir?: string;
  /** Pin the evidence timestamp (ISO 8601); default: HEAD commit time. */
  now?: string;
  /**
   * Stories-axe mode: "auto" runs it fresh when a local chromium is present
   * (falling back to the latest committed results with a staleness stamp);
   * "off" never launches a browser.
   */
  browser?: 'auto' | 'off';
  /** Test seam: replace the fresh-execution runners. */
  runners?: Partial<EvidenceRunners>;
  log?: (msg: string) => void;
}

export interface EvidenceResult {
  outDir: string;
  doc: EvidenceDoc;
  files: string[];
}

/** Deep-remove wall-clock timing keys so packs are byte-reproducible. */
export function stripTimings(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripTimings);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === 'durationMs' || k === 'durations' || k === 'startedAt') continue;
      out[k] = stripTimings(v);
    }
    return out;
  }
  return value;
}

function defaultStoriesAxeRunner(root: string, log: (msg: string) => void): () => string {
  return () => {
    log('evidence: running stories-axe fresh (local chromium detected)...');
    const res = spawnSync('pnpm', ['--filter', '@ds/validate', 'run', 'stories-axe', '--', '--no-metrics'], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
      shell: process.platform === 'win32',
      maxBuffer: 64 * 1024 * 1024,
    });
    // Exit 1 = the axe GATE failed; the results file is still written and the
    // evidence must record the failure honestly rather than hide the run.
    if (res.status !== 0 && res.status !== 1) {
      const tail = `${res.stdout ?? ''}${res.stderr ?? ''}`.trimEnd().split('\n').slice(-20).join('\n');
      throw new Error(`stories-axe run failed (exit ${res.status}):\n${tail}`);
    }
    const file = latestStoriesAxeFile(root);
    if (!file) throw new Error('stories-axe ran but produced no results file');
    return file;
  };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function listFilesRecursive(dir: string, base: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) out.push(...listFilesRecursive(abs, base));
    else out.push(relative(base, abs).replace(/\\/g, '/'));
  }
  return out;
}

export function generateEvidence(opts: EvidenceOptions): EvidenceResult {
  const root = opts.root;
  const outDir = opts.outDir ?? join(root, 'evidence-pack');
  const now = opts.now ?? gitCommitTs(root);
  const log = opts.log ?? (() => {});
  if (Number.isNaN(Date.parse(now))) {
    throw new EvidenceError(`evidence: --now must be an ISO 8601 timestamp, got "${now}"`);
  }

  // ------------------------------------------------------------------
  // 1. FRESH EXECUTION FIRST — nothing is written until the system proves
  //    itself. A failing gauntlet or eval run aborts with the old pack (if
  //    any) untouched.
  // ------------------------------------------------------------------
  const runGauntletFresh = opts.runners?.gauntlet ?? (() => runGauntlet({ root }));
  const runEvalsFresh = opts.runners?.evals ?? (() => runEvals(root));

  log('evidence: executing the validation gauntlet fresh...');
  const gauntletReport = runGauntletFresh();
  if (!gauntletReport.ok) {
    const failed = gauntletReport.steps.filter((s) => s.status === 'fail').map((s) => s.step);
    throw new EvidenceError(
      `evidence: gauntlet FAILED (${failed.join(', ') || 'unknown step'}) — refusing to emit an evidence pack. ` +
        'Evidence of a broken system must not look like evidence of a working one.',
    );
  }
  log('evidence: gauntlet passed. executing the eval regression run fresh...');
  const evalResult = runEvalsFresh();
  if (!evalResult.ok) {
    throw new EvidenceError(
      `evidence: eval regression run FAILED (overall ${(evalResult.overallRate * 100).toFixed(1)}%, ` +
        `critical ${(evalResult.criticalRate * 100).toFixed(1)}%) — refusing to emit an evidence pack.`,
    );
  }

  // ------------------------------------------------------------------
  // 2. Collect evidence.
  // ------------------------------------------------------------------
  const contrast = collectContrastEvidence(root);
  const vitestAxe = collectVitestAxeEvidence(root);

  let storiesAxe: StoriesAxeEvidence | null = null;
  const browser = opts.browser ?? 'auto';
  let freshRunError: string | null = null;
  if (browser === 'auto') {
    const runner = opts.runners?.storiesAxe ?? (checkAxeAvailability().available ? defaultStoriesAxeRunner(root, log) : null);
    if (runner) {
      try {
        storiesAxe = summarizeStoriesAxe(runner(), { source: 'fresh-run', now });
      } catch (error) {
        freshRunError = error instanceof Error ? error.message : String(error);
        log(`evidence: fresh stories-axe run failed — falling back to committed results (${freshRunError})`);
      }
    }
  }
  if (!storiesAxe) {
    const committed = latestStoriesAxeFile(root);
    if (committed) {
      storiesAxe = summarizeStoriesAxe(committed, { source: 'committed', now, freshRunError });
    }
  }

  const deps = collectDependencyInventory(root);
  const git = collectGitProvenance(root);
  const toolchain = collectToolchain(root);
  const artifactHashes = collectArtifactHashes(root);
  const reproducibility = collectReproducibility(root);
  const counts = registryCounts(root);

  // ------------------------------------------------------------------
  // 3. Assemble the document (machine layer).
  // ------------------------------------------------------------------
  const gauntletViolations = gauntletReport.steps.flatMap((s) => s.violations ?? []);
  const toolVersion = toolchain.workspacePackages['@ds/validate'] ?? '0.0.0';
  const doc: EvidenceDoc = {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    generatedAt: now,
    tool: `@ds/validate@${toolVersion} evidence`,
    provenance: {
      git,
      toolchain,
      artifacts: artifactHashes,
      reproducibility,
      registryCounts: counts,
      artifact: 'artifacts/provenance.json',
    },
    gauntlet: {
      executed: 'fresh',
      passed: gauntletReport.ok,
      steps: gauntletReport.steps.map((s) => ({ step: s.step, status: s.status })),
      fabrications: countFabrications(gauntletViolations),
      artifact: 'artifacts/gauntlet-report.json',
    },
    evals: {
      executed: 'fresh',
      ok: evalResult.ok,
      overall: evalResult.overallRate,
      critical: evalResult.criticalRate,
      passed: evalResult.passed,
      total: evalResult.total,
      artifact: 'artifacts/evals-report.json',
    },
    wcag: {
      contrast: { ...contrast, artifact: 'artifacts/contrast-report.json' },
      storiesAxe: storiesAxe
        ? (() => {
            const { resultsFile: _omitted, ...rest } = storiesAxe;
            return { ...rest, artifact: 'artifacts/stories-axe.json' };
          })()
        : null,
      vitestAxe: { ...vitestAxe, artifact: 'artifacts/vitest-axe-coverage.json' },
    },
    dependencies: { ...deps, artifact: 'artifacts/dependency-inventory.json' },
  };

  const schemaErrors = validateEvidenceDoc(doc);
  if (schemaErrors.length > 0) {
    throw new EvidenceError(`evidence: generated document failed its own schema check: ${schemaErrors.join(', ')}`);
  }

  // ------------------------------------------------------------------
  // 4. Write the pack.
  // ------------------------------------------------------------------
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, 'artifacts'), { recursive: true });
  writeFileSync(join(outDir, '.gitignore'), '*\n', 'utf8'); // self-gitignoring

  writeJson(join(outDir, 'artifacts', 'gauntlet-report.json'), stripTimings(gauntletReport));
  writeJson(join(outDir, 'artifacts', 'evals-report.json'), evalResult);
  copyFileSync(join(root, 'registries', 'contrast-report.json'), join(outDir, 'artifacts', 'contrast-report.json'));
  if (storiesAxe) {
    writeJson(join(outDir, 'artifacts', 'stories-axe.json'), stripTimings(JSON.parse(readFileSync(storiesAxe.resultsFile, 'utf8'))));
  }
  writeJson(join(outDir, 'artifacts', 'vitest-axe-coverage.json'), vitestAxe);
  writeJson(join(outDir, 'artifacts', 'dependency-inventory.json'), deps);
  writeJson(join(outDir, 'artifacts', 'provenance.json'), {
    git,
    toolchain,
    artifacts: artifactHashes,
    reproducibility,
    registryCounts: counts,
  });
  writeJson(join(outDir, 'evidence.json'), doc);
  writeFileSync(join(outDir, 'EVIDENCE.md'), renderEvidenceMarkdown(doc), 'utf8');

  // SHA256SUMS over every other file in the pack (sorted, sha256sum format).
  const files = listFilesRecursive(outDir, outDir).filter((f) => f !== 'SHA256SUMS');
  const sums = files
    .map((f) => `${createHash('sha256').update(readFileSync(join(outDir, f))).digest('hex')}  ${f}`)
    .join('\n');
  writeFileSync(join(outDir, 'SHA256SUMS'), `${sums}\n`, 'utf8');

  return { outDir, doc, files: [...files, 'SHA256SUMS'] };
}

// ---------------------------------------------------------------------------
// Human layer
// ---------------------------------------------------------------------------

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/** Escape `|` so contrast pair ids survive inside markdown table cells. */
function cell(s: string): string {
  return s.replace(/\|/g, '\\|');
}

export function renderEvidenceMarkdown(doc: EvidenceDoc): string {
  const { provenance: prov, gauntlet, evals, wcag, dependencies: deps } = doc;
  const sa = wcag.storiesAxe;
  const va = wcag.vitestAxe;
  const c = wcag.contrast;
  const lines: string[] = [];
  const push = (...ls: string[]): void => {
    lines.push(...ls);
  };

  push(
    `# Compliance Evidence Pack`,
    ``,
    `Generated ${doc.generatedAt} by ${doc.tool} · schema ${doc.schemaVersion}`,
    ``,
    `## Executive summary`,
    ``,
    `| Check | Result | Evidence |`,
    `|---|---|---|`,
    `| Validation gauntlet (fresh run) | ${gauntlet.passed ? 'PASS' : 'FAIL'} — ${gauntlet.steps.length} step(s), ${gauntlet.fabrications} fabrication(s) | [gauntlet-report.json](${gauntlet.artifact}) |`,
    `| Eval regression run (fresh run) | ${evals.ok ? 'PASS' : 'FAIL'} — ${evals.passed}/${evals.total} (overall ${pct(evals.overall)}, critical ${pct(evals.critical)}) | [evals-report.json](${evals.artifact}) |`,
    `| Contrast audit (${c.standard}) | ${c.allPass ? 'PASS' : 'FAIL'} — ${c.pairCount} pairs, ${c.failures} failure(s) | [contrast-report.json](${c.artifact}) |`,
    sa
      ? `| Browser axe over Storybook (${sa.source === 'fresh-run' ? 'fresh run' : `committed ${sa.resultDate}`}) | ${sa.gatePassed ? 'PASS' : 'FAIL'} — ${sa.stories} stories, ${sa.violations} violation(s)${sa.staleness.stale ? `, STALE ${sa.staleness.ageDays}d` : ''} | [stories-axe.json](${sa.artifact}) |`
      : `| Browser axe over Storybook | NOT AVAILABLE — no fresh run possible and no committed results | — |`,
    `| Unit-level axe coverage (vitest-axe) | ${va.componentsWithAxe}/${va.componentsTotal} components, ${va.totalAssertions} assertions | [vitest-axe-coverage.json](${va.artifact}) |`,
    `| Provenance | ${prov.git.shortSha}${prov.git.tag ? ` (${prov.git.tag})` : ''}${prov.git.dirty ? ` — DIRTY TREE (${prov.git.dirtyFiles} file(s))` : ' — clean tree'} | [provenance.json](${prov.artifact}) |`,
    `| Dependency inventory (lockfile v${deps.lockfileVersion}) | ${deps.entries.length} unique packages, ${deps.licenses.unknown} unknown license(s) | [dependency-inventory.json](${deps.artifact}) |`,
    ``,
    `Integrity: every file in this pack is enumerated in [SHA256SUMS](SHA256SUMS).`,
    ``,
  );

  // WCAG
  push(
    `## 1. WCAG evidence`,
    ``,
    `### 1.1 Contrast audit — ${c.standard} (threshold ${c.threshold}:1)`,
    ``,
    `Brand under audit: \`${c.brand}\`. ${c.pairCount} mandated semantic foreground/background pairs; ${c.failures} failure(s). The alias index verifies ${c.aliasIndex.componentVarsCovered} component-tier color hooks through these pairs. Full pair values and the complete alias index: [contrast-report.json](${c.artifact}).`,
    ``,
    `| Pair | Ratio | Required | Result |`,
    `|---|---|---|---|`,
  );
  for (const p of c.pairs) {
    push(`| \`${cell(p.id)}\` (${p.foregroundValue} on ${p.backgroundValue}) | ${p.ratio} | ${p.required} | ${p.pass ? 'PASS' : 'FAIL'} |`);
  }
  push(
    ``,
    `${c.unaudited.count} component color token(s) are honestly listed as unaudited (non-text edges outside the normal-text gate); each entry carries its reason in the artifact.`,
    ``,
    `### 1.2 Browser-run axe over Storybook stories`,
    ``,
  );
  if (sa) {
    push(
      `Source: **${sa.source === 'fresh-run' ? 'fresh run during evidence generation' : `latest committed results (${sa.resultDate})`}**. ` +
        `${sa.stories} stories scanned: ${sa.clean} clean, ${sa.withViolations} with violations, ${sa.renderErrors} render errors; ` +
        `${sa.violations} total violation(s) (${sa.serious} serious, ${sa.critical} critical), ${sa.allowlisted} allowlisted. ` +
        `Serious/critical gate: ${sa.gatePassed ? 'PASSED' : 'FAILED'}. Per-story results: [stories-axe.json](${sa.artifact}).`,
    );
    if (sa.staleness.note) push(``, `> **Staleness**: ${sa.staleness.note}`);
    if (sa.freshRunError) push(``, `> A fresh run was attempted and failed (${sa.freshRunError}); the committed results above are the best available evidence.`);
  } else {
    push(`No browser-run axe results available: no local chromium and no committed results directory.`);
  }
  push(
    ``,
    `### 1.3 Unit-level axe coverage (vitest-axe)`,
    ``,
    `Derived by scanning the component test files for \`axe(...)\` assertions (files without a \`vitest-axe\` import are not counted). ` +
      `${va.componentsWithAxe} of ${va.componentsTotal} components assert axe in unit tests (${va.totalAssertions} assertions). Full per-state enumeration: [vitest-axe-coverage.json](${va.artifact}).`,
    ``,
    `| Component | Assertions | States covered |`,
    `|---|---|---|`,
  );
  for (const comp of va.components) {
    push(`| ${comp.component} | ${comp.assertions} | ${comp.states.map((s) => s.title).join('; ')} |`);
  }
  if (va.componentsWithoutAxe.length > 0) {
    push(``, `Components without unit-level axe assertions (honest gap; browser axe still covers their stories): ${va.componentsWithoutAxe.join(', ')}.`);
  }

  // Provenance
  push(
    ``,
    `## 2. Provenance`,
    ``,
    `- Commit: \`${prov.git.sha}\` (branch \`${prov.git.branch}\`, ${prov.git.commitTime})`,
    `- Tag: ${prov.git.tag ? `\`${prov.git.tag}\`` : `none at HEAD (nearest: \`${prov.git.describe}\`)`}`,
    `- Working tree: ${prov.git.dirty ? `**DIRTY** — ${prov.git.dirtyFiles} file(s) differ from HEAD; this evidence describes an uncommitted state` : 'clean'}`,
    `- Toolchain: node ${prov.toolchain.node}, ${prov.toolchain.packageManager}`,
    `- Registries: ${prov.registryCounts.tokens} tokens, ${prov.registryCounts.components} components`,
    ``,
    `The gauntlet and eval results in this pack were **executed during evidence generation** (never copied from prior claims); generation aborts if either fails. Full reports: [gauntlet-report.json](${gauntlet.artifact}), [evals-report.json](${evals.artifact}).`,
    ``,
    `### 2.1 Artifact hashes (sha256)`,
    ``,
    `| Artifact | sha256 |`,
    `|---|---|`,
  );
  for (const a of prov.artifacts.registries) push(`| \`${a.path}\` | \`${a.sha256}\` |`);
  for (const m of prov.artifacts.contextManifests) {
    push(`| \`${m.path}\` | \`${m.sha256}\`${m.sourceHash ? ` (sourceHash \`${m.sourceHash}\`)` : ''} |`);
  }
  for (const a of prov.artifacts.releaseArtifacts) push(`| \`${a.path}\` | \`${a.sha256}\` |`);
  push(
    ``,
    `### 2.2 Reproducibility statement`,
    ``,
    `Each determinism claim below names the test that enforces it; "verified" means the named test title was found in the named file at generation time.`,
    ``,
    `| Claim | Test | Verified |`,
    `|---|---|---|`,
  );
  for (const r of prov.reproducibility) {
    push(`| ${r.claim} | \`${r.test}\` — "${r.title}" | ${r.verified ? 'yes' : 'NO — test not found'} |`);
  }

  // Dependencies
  push(
    ``,
    `## 3. Dependency inventory`,
    ``,
    `Derived entirely from \`pnpm-lock.yaml\` (v${deps.lockfileVersion}) plus locally installed package manifests — no registry API, no network. ` +
      `Licenses unreadable locally are reported as **unknown**, never guessed. Full inventory: [dependency-inventory.json](${deps.artifact}).`,
    ``,
    `| Workspace package | Publishable | Direct (prod/dev) | Transitive (prod/dev) | Workspace deps |`,
    `|---|---|---|---|---|`,
  );
  for (const p of deps.packages) {
    push(
      `| ${p.name}@${p.version} (\`${p.path}\`) | ${p.private ? 'no (private)' : 'yes'} | ${p.direct.prod}/${p.direct.dev} | ${p.transitive.prod}/${p.transitive.dev} | ${p.workspaceDeps.join(', ') || '—'} |`,
    );
  }
  const licenseRows = Object.entries(deps.licenses.byLicense);
  push(``, `### 3.1 License summary (${deps.licenses.total} unique packages)`, ``, `| License | Count |`, `|---|---|`);
  for (const [license, count] of licenseRows) push(`| ${license} | ${count} |`);
  if (deps.licenses.unknown > 0) push(`| unknown (not readable locally) | ${deps.licenses.unknown} |`);

  push(
    ``,
    `## 4. Pack integrity`,
    ``,
    `\`SHA256SUMS\` lists the sha256 of every other file in this pack (verify with \`shasum -a 256 -c SHA256SUMS\`). ` +
      `Timing fields are stripped from evidence copies so identical inputs reproduce this pack byte-for-byte; the timestamp above is pinned to the HEAD commit time unless \`--now\` overrode it.`,
    ``,
  );
  return lines.join('\n');
}
