---
id: destructive-confirmation
title: Destructive confirmation
components: [Alert, Button, Dialog]
tokensUsed: [--ds-space-4, --ds-space-gap-md, --ds-text-size-md, --ds-text-leading-normal, --ds-color-text-primary]
keywords: [delete, destructive, confirm, dialog, danger, irreversible, modal]
---

# Destructive confirmation

A `danger` `Button` that opens a confirmation `Dialog` before an
irreversible action runs; the dialog's render-prop `close` callback wires
both the cancel and the confirm paths.

Source (shipped code): `examples/reference-screen/SettingsScreen.tsx` lines
110–152 (the "Danger zone" card) and
`packages/react/src/components/Dialog/Dialog.tsx` `@example` (lines 71–79).

## When to use

- The action permanently destroys data or is otherwise unrecoverable
  (delete workspace, revoke all tokens, cancel subscription).
- One deliberate extra step is warranted; the surrounding screen may also
  carry a standing `Alert tone="danger"` explaining the consequences.

Not for: easily reversible actions (archiving, muting) — confirmation
fatigue trains users to click through the one dialog that matters.

## Composition rule

Pass the `danger` `Button` as the Dialog's `trigger` — the Dialog owns the
open state, focus trap, Escape, and backdrop dismissal. Inside, use the
render-prop form `{({ close }) => …}`: a `secondary` "Cancel" button calls
`close` alone; the `danger` confirm button performs the action, then calls
`close`. The confirm label names the action ("Delete workspace"), never
"OK". Body copy and action rows are plain elements with space/text tokens.

## Example

```tsx
import { Button, Dialog } from '@ds/react';
import styles from './DeleteWorkspace.module.css';

export function DeleteWorkspace({ onDelete }: { onDelete: () => void }) {
  return (
    <Dialog
      title="Delete workspace"
      size="sm"
      trigger={<Button variant="danger">Delete workspace…</Button>}
    >
      {({ close }) => (
        <div className={styles.dialogBody}>
          <p className={styles.dialogText}>
            This permanently deletes the workspace and everything in it.
            There is no way to recover it afterwards.
          </p>
          <div className={styles.actionsEnd}>
            <Button variant="secondary" onPress={close}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onPress={() => {
                onDelete();
                close();
              }}
            >
              Delete workspace
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
```

```css
/* DeleteWorkspace.module.css — token-only */
.dialogBody {
  display: flex;
  flex-direction: column;
  gap: var(--ds-space-4);
}

.dialogText {
  margin: 0;
  font-size: var(--ds-text-size-md);
  line-height: var(--ds-text-leading-normal);
  color: var(--ds-color-text-primary);
}

.actionsEnd {
  display: flex;
  justify-content: flex-end;
  gap: var(--ds-space-gap-md);
}
```

## Anti-pattern (NR-007)

Do not hand-style the confirm area as a solid danger fill with a fabricated
`var(--ds-color-text-on-danger)` — there is no `on-status` text token
(NR-007); `on-accent` exists, so agents extrapolate `on-<anything>`. The
danger treatment already ships inside `Button variant="danger"`; solid
status fills pair only with `var(--ds-color-text-inverse)`, and only for
pairs present in `registries/contrast-report.json`.
