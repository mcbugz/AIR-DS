---
id: form-section
title: Form section
components: [Button, Card, CardBody, CardFooter, CardHeader, TextArea, TextField]
tokensUsed: [--ds-space-4, --ds-space-gap-md, --ds-text-size-lg, --ds-text-weight-semibold, --ds-text-leading-tight, --ds-color-text-primary]
keywords: [form, section, fields, actions, footer, save, card, profile]
---

# Form section

A titled group of form fields inside a `Card`, with the section's actions in
the card footer.

Source (shipped code): `examples/reference-screen/SettingsScreen.tsx` lines
49–78 (the "Profile" card) and `examples/reference-screen/SettingsScreen.module.css`
(`.sectionTitle`, `.fieldStack`, `.actionsEnd`).

## When to use

- A screen groups related inputs (profile, billing address, workspace info)
  and each group saves independently.
- You need a visual boundary around a set of fields plus a clear home for
  the "Save"/"Cancel" actions that apply to just that set.

Not for: a single standalone field (use the field component directly) or a
full-page wizard step (the page, not a card, is the boundary).

## Composition rule

`Card elevation="raised"` → `CardHeader` holding a semantic heading (`<h2>`)
→ `CardBody` holding the fields in a vertical flex stack (`gap:
var(--ds-space-4)`) → `CardFooter` holding actions in an end-aligned flex row
(`gap: var(--ds-space-gap-md)`). Headings are plain HTML styled with text
tokens; layout is plain elements with space tokens — there are no layout or
typography components in this system.

## Example

```tsx
import { Button, Card, CardBody, CardFooter, CardHeader, TextArea, TextField } from '@ds/react';
import styles from './ProfileSection.module.css';

export function ProfileSection() {
  return (
    <Card elevation="raised">
      <CardHeader>
        <h2 className={styles.sectionTitle}>Profile</h2>
      </CardHeader>
      <CardBody>
        <div className={styles.fieldStack}>
          <TextField
            label="Display name"
            description="Shown to members everywhere this workspace appears."
            placeholder="Acme Inc."
          />
          <TextArea label="Bio" rows={4} autoGrow />
        </div>
      </CardBody>
      <CardFooter>
        <div className={styles.actionsEnd}>
          <Button onPress={save}>Save changes</Button>
        </div>
      </CardFooter>
    </Card>
  );
}
```

```css
/* ProfileSection.module.css — token-only */
.sectionTitle {
  margin: 0;
  font-size: var(--ds-text-size-lg);
  font-weight: var(--ds-text-weight-semibold);
  line-height: var(--ds-text-leading-tight);
  color: var(--ds-color-text-primary);
}

.fieldStack {
  display: flex;
  flex-direction: column;
  gap: var(--ds-space-4);
}

.actionsEnd {
  display: flex;
  justify-content: flex-end;
  gap: var(--ds-space-gap-md);
}
```

## Anti-pattern (NR-001)

Do not reach for `<Stack gap="md">`, `<Box p={4}>`, or `<Flex justify="end">`
to build the stacks and the footer row — layout primitives do not exist in
this system (NR-001, the most-hallucinated components industry-wide). The
right form is exactly what the example shows: plain `<div>`s with
`display: flex` and space tokens.
