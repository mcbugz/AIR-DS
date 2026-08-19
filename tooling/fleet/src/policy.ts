import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { historyPath, readHistory } from './history.ts';
import { repoLatest, repoRates } from './rollup.ts';
import type {
  FleetPolicy,
  MetricsLine,
  PolicyCheckResult,
  PolicyVerdict,
  RepoLatest,
  RepoRates,
} from './types.ts';

/**
 * Policy-as-code (Mandate v2 / M3): a repo declares fleet-policy.json at its
 * root; `checkPolicy` renders a deterministic verdict of the repo's current
 * recorded metrics + config against that policy. Pure function over inputs —
 * no network, no LLM, no clock. The published contract is policy.schema.json
 * next to this package's package.json.
 */

export const POLICY_FILE = 'fleet-policy.json';

export function policyPath(repoRoot: string): string {
  return join(repoRoot, POLICY_FILE);
}

/* ----------------------------------------------------------- shape checks */

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

/**
 * Validate the parsed policy JSON against the schema contract by hand —
 * deterministic, dependency-free, and tested. Returns problem strings
 * (empty = valid).
 */
export function validatePolicyShape(v: unknown): string[] {
  const problems: string[] = [];
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    return ['policy must be a JSON object'];
  }
  const o = v as Record<string, unknown>;
  const known = new Set([
    '$schema',
    'tokenOverrides',
    'minEvalCritical',
    'minFirstPass',
    'requiredGauntletSteps',
    'browserAxe',
    'maxFabrications',
  ]);
  for (const key of Object.keys(o)) {
    if (!known.has(key)) problems.push(`unknown property "${key}"`);
  }
  if (o.tokenOverrides !== undefined) {
    const t = o.tokenOverrides;
    if (typeof t !== 'object' || t === null || Array.isArray(t)) {
      problems.push('tokenOverrides must be an object');
    } else {
      const to = t as Record<string, unknown>;
      if (to.semanticTier !== 'forbidden' && to.semanticTier !== 'allowlist') {
        problems.push('tokenOverrides.semanticTier must be "forbidden" or "allowlist"');
      }
      if (to.allowlist !== undefined && !isStringArray(to.allowlist)) {
        problems.push('tokenOverrides.allowlist must be an array of strings');
      }
    }
  }
  for (const key of ['minEvalCritical', 'minFirstPass'] as const) {
    const n = o[key];
    if (n !== undefined && (typeof n !== 'number' || n < 0 || n > 1)) {
      problems.push(`${key} must be a number between 0 and 1`);
    }
  }
  if (o.requiredGauntletSteps !== undefined && !isStringArray(o.requiredGauntletSteps)) {
    problems.push('requiredGauntletSteps must be an array of strings');
  }
  if (o.browserAxe !== undefined && o.browserAxe !== 'required' && o.browserAxe !== 'optional') {
    problems.push('browserAxe must be "required" or "optional"');
  }
  if (
    o.maxFabrications !== undefined &&
    (typeof o.maxFabrications !== 'number' || o.maxFabrications < 0 || !Number.isInteger(o.maxFabrications))
  ) {
    problems.push('maxFabrications must be a non-negative integer');
  }
  return problems;
}

/* ------------------------------------------------------- semantic overrides */

/**
 * Canonical token name: "--ds-color-text-link", "ds.color.text.link" and
 * "color-text-link" all normalize to "color.text.link" so policy allowlists
 * and override files can use either spelling.
 */
export function canonicalTokenName(name: string): string {
  let n = name.trim().toLowerCase();
  n = n.replace(/^--/, '');
  n = n.replace(/[-/]/g, '.');
  n = n.replace(/^ds\./, '');
  return n;
}

/**
 * Discover semantic-tier token overrides declared by a repo: every
 * brands/*.semantic.json file, flattened to canonical token names. This is
 * the M3 contract for "optional semantic overrides" (ADR-003/ADR-006): a
 * customer's semantic re-mapping lives in a dedicated, machine-checkable
 * file — never inside component code.
 */
export function semanticOverrideNames(repoRoot: string): string[] {
  const dir = join(repoRoot, 'brands');
  if (!existsSync(dir)) return [];
  const names = new Set<string>();
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.semantic.json')) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    } catch {
      continue;
    }
    for (const key of flattenKeys(parsed)) names.add(canonicalTokenName(key));
  }
  return [...names].sort();
}

/** Flatten a nested object into dot-joined leaf key paths ($-keys skipped). */
function flattenKeys(v: unknown, prefix = ''): string[] {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    return prefix ? [prefix] : [];
  }
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).filter((k) => !k.startsWith('$'));
  if (keys.length === 0) return prefix ? [prefix] : [];
  const out: string[] = [];
  for (const k of keys) {
    const child = o[k];
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof child === 'object' && child !== null && !Array.isArray(child) && !('$value' in (child as object))) {
      out.push(...flattenKeys(child, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

/* ----------------------------------------------------------------- checks */

export interface PolicyCheckInputs {
  latest: RepoLatest | null;
  rates: RepoRates;
  /** Canonical semantic-tier override names declared by the repo. */
  semanticOverrides: string[];
}

const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;

/** Pure verdict core: policy + observed inputs -> check results. */
export function runPolicyChecks(policy: FleetPolicy, inputs: PolicyCheckInputs): PolicyCheckResult[] {
  const checks: PolicyCheckResult[] = [];
  const { latest, rates, semanticOverrides } = inputs;

  if (policy.tokenOverrides) {
    const { semanticTier } = policy.tokenOverrides;
    const allow = new Set((policy.tokenOverrides.allowlist ?? []).map(canonicalTokenName));
    const offending =
      semanticTier === 'forbidden'
        ? semanticOverrides
        : semanticOverrides.filter((n) => !allow.has(n));
    checks.push({
      id: 'token-overrides',
      ok: offending.length === 0,
      expected:
        semanticTier === 'forbidden'
          ? 'no semantic-tier token overrides'
          : `semantic-tier overrides limited to allowlist (${allow.size} name(s))`,
      actual:
        semanticOverrides.length === 0
          ? 'no semantic-tier overrides declared'
          : `${semanticOverrides.length} override(s), ${offending.length} outside policy`,
      detail: offending.length === 0 ? '' : `offending: ${offending.join(', ')}`,
    });
  }

  if (policy.minEvalCritical !== undefined) {
    const critical = latest?.evals?.critical ?? null;
    checks.push({
      id: 'min-eval-critical',
      ok: critical !== null && critical >= policy.minEvalCritical,
      expected: `latest eval critical pass rate >= ${pct(policy.minEvalCritical)}`,
      actual: critical === null ? 'no eval run recorded' : pct(critical),
      detail: critical === null ? 'run the eval suite and record metrics to satisfy this policy' : '',
    });
  }

  if (policy.minFirstPass !== undefined) {
    const rate = rates.gauntletFirstPass.rate;
    checks.push({
      id: 'min-first-pass',
      ok: rate !== null && rate >= policy.minFirstPass,
      expected: `first-pass gauntlet rate >= ${pct(policy.minFirstPass)}`,
      actual:
        rate === null
          ? 'no gauntlet run recorded'
          : `${pct(rate)} (${rates.gauntletFirstPass.passed}/${rates.gauntletFirstPass.total})`,
      detail: '',
    });
  }

  if (policy.requiredGauntletSteps && policy.requiredGauntletSteps.length > 0) {
    const ran = new Set(latest?.gauntletSteps ?? []);
    const missing = policy.requiredGauntletSteps.filter((s) => !ran.has(s));
    checks.push({
      id: 'required-gauntlet-steps',
      ok: latest?.gauntletSteps !== null && latest !== null && missing.length === 0,
      expected: `latest gauntlet ran: ${policy.requiredGauntletSteps.join(', ')}`,
      actual:
        !latest || latest.gauntletSteps === null
          ? 'no gauntlet run recorded'
          : latest.gauntletSteps.join(', '),
      detail: missing.length > 0 ? `missing: ${missing.join(', ')}` : '',
    });
  }

  if (policy.browserAxe === 'required') {
    const axe = latest?.storiesAxe ?? null;
    checks.push({
      id: 'browser-axe',
      ok: axe !== null && axe.gatePassed,
      expected: 'stories-axe recorded and serious/critical gate passed',
      actual:
        axe === null
          ? 'no stories-axe run recorded'
          : `${axe.stories} stories, ${axe.violations} violation(s) (${axe.serious} serious, ${axe.critical} critical), gate ${axe.gatePassed ? 'passed' : 'FAILED'}`,
      detail: '',
    });
  }

  if (policy.maxFabrications !== undefined) {
    const fabrications = latest ? latest.fabrications : null;
    checks.push({
      id: 'max-fabrications',
      ok: fabrications !== null && fabrications <= policy.maxFabrications,
      expected: `latest snapshot fabrications <= ${policy.maxFabrications}`,
      actual: fabrications === null ? 'no metrics recorded' : String(fabrications),
      detail: '',
    });
  }

  return checks;
}

/* -------------------------------------------------------------- filesystem */

export interface CheckPolicyOptions {
  /** Override the policy file location (defaults to <repoRoot>/fleet-policy.json). */
  policyFile?: string;
  /** Pre-read history lines (defaults to reading <repoRoot>/metrics/history.jsonl). */
  lines?: MetricsLine[];
}

/**
 * The clean integration API: verdict of a repo's current recorded metrics +
 * config against its committed policy. A repo without a policy file is
 * vacuously compliant (policyPresent: false, ok: true) so the gauntlet
 * hookup is a no-op until a policy is adopted.
 */
export function checkPolicy(repoRoot: string, opts: CheckPolicyOptions = {}): PolicyVerdict {
  const file = opts.policyFile ?? policyPath(repoRoot);
  if (!existsSync(file)) {
    return { repoRoot, policyPath: null, policyPresent: false, ok: true, checks: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    return {
      repoRoot,
      policyPath: file,
      policyPresent: true,
      ok: false,
      checks: [
        {
          id: 'policy-shape',
          ok: false,
          expected: 'valid JSON matching policy.schema.json',
          actual: 'unparseable JSON',
          detail: err instanceof Error ? err.message : String(err),
        },
      ],
    };
  }

  const problems = validatePolicyShape(parsed);
  if (problems.length > 0) {
    return {
      repoRoot,
      policyPath: file,
      policyPresent: true,
      ok: false,
      checks: [
        {
          id: 'policy-shape',
          ok: false,
          expected: 'policy matching policy.schema.json',
          actual: `${problems.length} shape problem(s)`,
          detail: problems.join('; '),
        },
      ],
    };
  }

  const policy = parsed as FleetPolicy;
  const lines = opts.lines ?? readHistory(historyPath(repoRoot));
  const checks = runPolicyChecks(policy, {
    latest: repoLatest(lines),
    rates: repoRates(lines),
    semanticOverrides: semanticOverrideNames(repoRoot),
  });
  return {
    repoRoot,
    policyPath: file,
    policyPresent: true,
    ok: checks.every((c) => c.ok),
    checks,
  };
}
