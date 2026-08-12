---
id: settings-toggle-group
title: Settings toggle group
components: [Card, CardBody, CardHeader, Switch]
tokensUsed: [--ds-space-gap-md, --ds-text-size-lg, --ds-text-weight-semibold, --ds-text-leading-tight, --ds-color-text-primary]
keywords: [settings, toggles, switches, preferences, on-off, notifications]
---

# Settings toggle group

A titled `Card` containing a vertical stack of `Switch` controls, one per
independently togglable preference.

Source (shipped code): `examples/reference-screen/SettingsScreen.tsx` lines
81–94 (the "Notifications" card) and
`examples/reference-screen/SettingsScreen.module.css` (`.toggleStack`,
`.sectionTitle`).

## When to use

- A set of boolean preferences that take effect immediately (notifications,
  privacy flags, feature opt-ins).
- Each row is independent — flipping one never disables or implies another.

Not for: mutually exclusive options (use the choice-group pattern with
`RadioGroup`) or settings that only apply after an explicit save (use
`Checkbox` inside a form-section with a footer action).

## Composition rule

`Card elevation="raised"` → `CardHeader` with a plain `<h2>` styled by text
tokens → `CardBody` holding the switches in a vertical flex stack with
`gap: var(--ds-space-gap-md)`. Each `Switch` gets its visible label as
children — the label is the accessible name; never wrap a Switch in an extra
`<label>`. Switch state stays controlled per row (`isSelected` +
`onChange`).

## Example

```tsx
import { useState } from 'react';
import { Card, CardBody, CardHeader, Switch } from '@ds/react';
import styles from './NotificationSettings.module.css';

export function NotificationSettings() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);

  return (
    <Card elevation="raised">
      <CardHeader>
        <h2 className={styles.sectionTitle}>Notifications</h2>
      </CardHeader>
      <CardBody>
        <div className={styles.toggleStack}>
          <Switch isSelected={emailEnabled} onChange={setEmailEnabled}>
            Email notifications
          </Switch>
          <Switch isSelected={pushEnabled} onChange={setPushEnabled}>
            Push notifications
          </Switch>
        </div>
      </CardBody>
    </Card>
  );
}
```

```css
/* NotificationSettings.module.css — token-only */
.sectionTitle {
  margin: 0;
  font-size: var(--ds-text-size-lg);
  font-weight: var(--ds-text-weight-semibold);
  line-height: var(--ds-text-leading-tight);
  color: var(--ds-color-text-primary);
}

.toggleStack {
  display: flex;
  flex-direction: column;
  gap: var(--ds-space-gap-md);
}
```

## Anti-pattern (NR-002)

Do not invent `<Heading level={2}>` or `<Text weight="semibold">` for the
card title — typography components do not exist in this system (NR-002). The
section title is a semantic `<h2>` styled with `var(--ds-text-*)` tokens, as
shown above.
