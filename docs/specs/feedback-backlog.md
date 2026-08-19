# Machine-surface feedback backlog

Findings from consumer-side testing of the compiled artifacts (first source: the Phase 2 acceptance run, examples/reference-screen/NOTES.md). Each item follows the promotion path: observed friction → spec/artifact fix → deterministic check where applicable.

| # | Finding | Proposed fix | Owner area |
|---|---|---|---|
| FB-1 | No container/page-width vocabulary — size tier is controls/icons only; NR-006 bans space-as-dimension, so content column widths have no legal token | Add semantic `size.container-{sm,md,lg}` (or document the `calc(control × n)` convention as a consumer-facing rule) | tokens |
| FB-2 | Alert couples `tone="danger"` to interruptive `role="alert"` — a permanent danger-zone explainer re-announces on every load | Add `role` override or an `isLive?: boolean` escape (default keeps current mapping); document | react/Alert |
| FB-3 | Inherited RAC props (`value`/`onChange` etc.) absent from per-component props arrays; only legal via the racBase prose note — a strict props-array reader concludes controlled usage is impossible | Emit a `racProps` summary (or at least the common controlled-usage props) per registry entry; MCP team requested `tokenPrefix`/`storyFile` fields too | react/generate + context |
| FB-4 | NR-010 (base class = lowercased component name) is written for system components; scope for consumer screens/multiword names unstated | Scope the rule text: applies to `@ds/react` components; consumer code follows local convention | negative rules |
| FB-5 | Component-tier surface hooks (e.g. `--ds-card-surface`) aren't contrast-report keys, so custom text on a Card is strictly unverifiable against the closed-world checklist | Contrast report gains alias resolution: report entries list the component hooks that resolve to each audited surface | tokens |
| FB-6 | `space.gap.*` trio (max 16px) vs plain space steps for larger separations — preference undocumented | One line in llms-theming/use-system: gap trio for intra-component rhythm, space steps for section-level | context |
| FB-7 | Heading-size guidance overlaps Dialog's self-rendered title | Clarify in component docs that Dialog owns its title typography | context |

Also queued (from build-stream reports):
- Ingest↔context: native `--registries-dir`/`--brand-path` on context compile (drop swap/restore); pinned `--now` for byte-reproducible customer bundles; manifest hash into publish-plan.json
- Per-customer MCP metadata stage in the ingest pipeline
- RAC deprecations: `Switch` → SwitchField/SwitchButton, `Radio` → RadioField/RadioButton (upgrade path decision before next RAC major)
- Benchmark axe column needs a rendering harness (currently n/a)
- Brand asset pipeline (logo copy/optimization); semantic-override layer (ADR-006 §4)

## Round 2 (closing audit + contribution-flow + live MCP acceptance, 2026-08-12)

| # | Finding | Proposed fix | Owner area |
|---|---|---|---|
| FB-8 | No thin-dimension vocabulary — a 4–8px progress track / divider / slider rail is inexpressible (contribution test A1); NR-006 correctly blocks the workarounds but no right answer exists | Add `size.rail-{sm,md,lg}` (or border-ramp extension) in v1.1 alongside `progressbar.*` hooks | tokens |
| FB-9 | Play functions are never machine-executed (contribution test B3) — stories are "contract artifacts" but a wrong play test ships green; stories-axe covers a11y only | Storybook test-runner or portable-stories vitest bridge as an optional `--browser` gauntlet extension | validate |
| FB-10 | `@ds/context` native-inputs parity test is non-hermetic (reads live `registries/`), flaked twice during the contribution run and implicates the contributor | Fixture-copy the registries in that test | context |
| FB-11 | Extension-points contract never says HOW a customer legally expresses a hook override (`--ds-alert-gap: 12px` in consumer CSS is flagged as a raw value — correct, but the sanctioned route is undocumented) | One paragraph in the theming guide + extension-points.json `howToOverride` field | context |
| FB-12 | Newcomer components cannot be granted component-tier hooks through the contribution flow (hooks are born in @ds/tokens, out of contributor scope, no request procedure) | Document the hook-request step in CONTRIBUTING; consider a `tokens/src/component/_proposals/` convention | tokens + docs |
| FB-13 | Icons have no Storybook gallery story (visual QA gap; stories-axe can't see them) | Icons.stories.tsx gallery, one story all-icons + sizes | react |
| FB-14 | v1 API inventory procedure for post-freeze components is undefined (contribution test A4: the API spec "comes from nowhere") | v1.1 inventory RFC template in docs/specs | docs |
| FB-15 | Retrofit bundles: @ds/context prose templates say "Import from @ds/react" / `--ds-*` even when compiled for a retrofitted foreign system (registries/docs are target-true, prose isn't) | Context compiler gains a package-name/prefix parameter sourced from the retrofit manifest | context |
