---
id: status-banner
title: Status banner
components: [Alert]
tokensUsed: []
keywords: [alert, banner, status, info, success, warning, danger, announce]
---

# Status banner

A static message strip with status intent: `Alert` with the right `tone`,
which also decides how assistive technology announces it.

Source (shipped code): `packages/react/src/components/Alert/Alert.tsx` —
the tone→role mapping at line 142 (`danger`/`warning` → `role="alert"`,
`info`/`success` → `role="status"`) — and
`examples/reference-screen/SettingsScreen.tsx` lines 116–119 (the danger-zone
banner).

## When to use

- A message about a region or the whole page: operation results, standing
  warnings, degraded-service notices, consequence explanations next to
  destructive controls.
- Pick tone by intent, not color: `info` (neutral note), `success`
  (completed operation), `warning` (caution), `danger` (failure or
  destructive consequence). Interruptive tones (`danger`, `warning`) are
  announced immediately (`role="alert"`); calm tones announce politely
  (`role="status"`).

Not for: field-specific errors (inline-validation pattern) or transient
feedback that should disappear on its own (no toast exists in v1 — keep the
alert until the state resolves).

## Composition rule

One component, zero custom CSS: tone styling (status surface, border, text,
icon) ships inside `Alert` via its `--ds-alert-*` hooks. Add `title` for a
bold heading line; pass `onDismiss` to render the dismiss control — the
caller owns visibility state, the alert never removes itself.

## Example

```tsx
import { useState } from 'react';
import { Alert } from '@ds/react';

export function DeploymentStatus({ failed }: { failed: boolean }) {
  const [showResult, setShowResult] = useState(true);

  if (!showResult) return null;

  return failed ? (
    <Alert tone="danger" title="Deploy failed">
      Build 42 did not pass the release gate — check the build log.
    </Alert>
  ) : (
    <Alert tone="success" title="Deployed" onDismiss={() => setShowResult(false)}>
      Build 42 is live.
    </Alert>
  );
}
```

## Anti-pattern (NR-008)

Do not fake a banner by borrowing Alert's hooks in your own CSS —
`background: var(--ds-alert-surface-info)` outside Alert.module.css is wrong
(NR-008): component-tier tokens belong to their component only, and a
customer override of Alert would silently restyle your copy. If you need a
status strip, render `Alert`; if you need custom status styling elsewhere,
use the semantic `--ds-color-status-*` tokens.
