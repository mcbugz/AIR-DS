# @ds/fleet — gauntlet integration (one line, wired by the lead)

`@ds/fleet` never edits `tooling/validate`. It exports the policy verdict as a
clean, dependency-free API so the gauntlet can adopt it without a workspace
cycle (`@ds/fleet` imports nothing from `@ds/validate`; it re-declares the
`MetricsLine` shape of `metrics/history.jsonl`, which is a serialized data
contract, not code).

## The hookup

1. Add the workspace dependency to `tooling/validate/package.json`:

```json
"devDependencies": { "@ds/fleet": "workspace:*" }
```

2. In `tooling/validate/src/gauntlet.ts`, register one step after
   `registry-check` (inside `runGauntlet`, same `record` pattern as every
   other step):

```ts
import { checkPolicy } from '@ds/fleet';

// 6. policy-check — fleet policy-as-code (M3). No-op until the repo commits
// a fleet-policy.json; deterministic breach -> merge-blocking fail.
record('policy-check', () => {
  const verdict = checkPolicy(root);
  if (!verdict.policyPresent) {
    return { status: 'warn', detail: 'no fleet-policy.json — repo is ungoverned (policy check skipped)' };
  }
  return verdict.ok
    ? { status: 'pass', detail: `${verdict.checks.length} policy check(s) satisfied` }
    : {
        status: 'fail',
        detail: verdict.checks
          .filter((c) => !c.ok)
          .map((c) => `${c.id}: expected ${c.expected}; got ${c.actual}${c.detail ? ` (${c.detail})` : ''}`)
          .join('\n'),
      };
});
```

The essential line is `const verdict = checkPolicy(root);` — everything else
is the gauntlet's own step plumbing.

## Semantics the gauntlet inherits

- **No policy file → warn, not fail.** `checkPolicy` returns
  `{ policyPresent: false, ok: true }` so adoption is opt-in per repo.
- **Deterministic.** The verdict is a pure function of
  `<root>/fleet-policy.json`, `<root>/metrics/history.jsonl`, and
  `<root>/brands/*.semantic.json`. No LLM, no network, no clock — safe in the
  merge-blocking path (ADR-005).
- **Machine-readable everywhere.** The same verdict is available standalone:
  `ds-fleet policy-check <repoRoot>` prints the `PolicyVerdict` JSON and
  exits nonzero on breach — usable in CI outside the gauntlet today, before
  the hookup lands.

## Policy contract

`policy.schema.json` (shipped with the package) is the authoritative shape of
`fleet-policy.json`. Checks emitted, each with `expected` / `actual` /
`detail`:

| check id | knob | breach condition |
|---|---|---|
| `token-overrides` | `tokenOverrides.semanticTier` (+ `allowlist`) | semantic-tier overrides in `brands/*.semantic.json` that the policy forbids / doesn't allowlist |
| `min-eval-critical` | `minEvalCritical` | latest eval critical rate below the floor, or no eval ever recorded |
| `min-first-pass` | `minFirstPass` | first-pass gauntlet rate over the full history below the floor, or none recorded |
| `required-gauntlet-steps` | `requiredGauntletSteps` | latest gauntlet run missing any required step |
| `browser-axe` | `browserAxe: "required"` | no stories-axe recording, or its serious/critical gate failed |
| `max-fabrications` | `maxFabrications` | latest snapshot fabrications above the ceiling |

A malformed policy file yields a single failing `policy-shape` check (a bad
policy must block, not silently pass).
