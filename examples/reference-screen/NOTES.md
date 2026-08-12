# Reference screen — build notes

Built strictly from the shipped machine-readable artifacts under
`packages/context/dist/default/` (never the source packages), following the
`use-system` and `build-screen` skills.

## Artifacts consulted

- `llms.txt` — entry point, ground rules
- `skills/use-system/SKILL.md` + `references/tokens.md`, `references/negative-rules.md`
- `skills/build-screen/SKILL.md` + `references/checklist.md`
- `registries/components-index.json` — component closed world (21 exports)
- `llms-tokens.txt` — token closed world (229 tokens, resolved values)
- `registries/contrast-report.json` — audited color pairs
- `docs/Dialog.md` — confirmation-dialog usage detail

## Components used (all imported from `@ds/react`)

`Alert`, `Button`, `Card`, `CardBody`, `CardFooter`, `CardHeader`, `Dialog`,
`Radio`, `RadioGroup`, `Switch`, `TextArea`, `TextField`

## Tokens referenced (all verified against the registry)

- Color: `--ds-color-surface-default`, `--ds-color-text-primary`, `--ds-color-text-secondary`
- Font: `--ds-font-family-sans`
- Text: `--ds-text-size-2xl`, `--ds-text-size-lg`, `--ds-text-size-md`,
  `--ds-text-weight-semibold`, `--ds-text-leading-tight`, `--ds-text-leading-normal`
- Space: `--ds-space-0`, `--ds-space-1`, `--ds-space-4`, `--ds-space-7`, `--ds-space-gap-md`
- Size: `--ds-size-control-md` (via `calc`, see below)

## Decisions the artifacts forced

- **One primary action per view**: Button docs say `primary` is "the single
  main action of a view", so only "Save changes" is primary; the destructive
  actions use `variant="danger"`, the dialog's cancel is `secondary`.
- **Confirmation dialog**: copied the `trigger` + render-prop `close` pattern
  verbatim from `docs/Dialog.md`.
- **Layout**: plain semantic HTML + CSS Module, flex column stacks, space
  tokens only in margin/padding/gap (NR-001, NR-006). No state pseudo-classes
  needed because every interactive element is a registry component (NR-009).

## Feedback: unclear or contradictory points in the artifacts

1. **No page/container width token.** The size tier has only
   `--ds-size-control-*` and `--ds-size-icon-*`; there is no token or
   documented rule for a content column's max width, and space tokens are
   explicitly banned from dimensions (NR-006). I derived
   `max-inline-size: calc(var(--ds-size-control-md) * 16)`, mirroring how the
   system itself derives `dialog.width.lg` ("16x the md control height"), but
   that derivation convention is only visible in token *descriptions*, not
   stated as a rule consumers may use. A `--ds-size-container-*` group or an
   explicit "derive widths by calc from control heights" rule would close this gap.
2. **Alert tone is coupled to ARIA role.** A static danger-zone explainer
   wants danger *visuals* but gets interruptive `role="alert"` (announced
   immediately on page load) because the role is derived from `tone`. There is
   no way to get danger styling with the polite `role="status"`. Worth either
   documenting the recommended pattern for permanent danger notices or
   decoupling role from tone.
3. **Inherited RAC props are under-specified.** `value`/`onChange` on
   `TextField`, `TextArea`, and `RadioGroup` are not in each component's
   `props` list; they are only legal via the registry's top-level `racBase`
   note plus prose in the descriptions. An agent that greps the `props` arrays
   alone would conclude controlled usage is impossible. Enumerating the most
   common inherited props (or linking a per-racBase prop table) would help.
4. **NR-010 scope is ambiguous for consumers.** "Base class is the lowercased
   component name" is written for the system's own components (`.button`,
   `.card`); whether it binds consumer screen CSS, and what "lowercased" means
   for multiword names (`settingsscreen` vs `settingsScreen`), is unstated. I
   used `.settingsScreen` camelCase as the root class.
5. **Contrast-report closed world vs component surfaces.** The checklist says
   text/background combinations must be limited to pairs in
   `contrast-report.json`, but text placed inside a `Card` sits on
   `--ds-card-surface`, which is not a pair key in the report (its resolved
   value equals `color.surface.raised`, which *is* audited). Strictly read,
   putting any custom text in a Card is unverifiable. The report should either
   include component surfaces or document the value-equivalence.
6. **`space.gap.*` vs plain space tokens in `gap`.** `space.gap.lg` tops out
   at 16px, while section-level separation plausibly needs 32px+. The rules
   allow any space token in `gap`, but it is unclear whether `gap:` should
   *prefer* the dedicated `space.gap.*` trio; I used `--ds-space-7` for the
   section stack and `space.gap.*`/`--ds-space-4` for smaller stacks.
7. **Heading sizes.** `text.size.xl` is described as "section headings and
   dialog titles", but Dialog renders its own title, and it is unclear whether
   card-level section headings should be `xl` or `lg`. I used `2xl` for the
   page heading (documented as "page headings") and `lg` for card headings.
8. **Validation not run.** The skills end with `pnpm validate`, but this
   exercise forbade running repo commands, and `examples/` is presumably not
   wired into the workspace gauntlet. The deterministic gate has therefore
   not approved this screen.
