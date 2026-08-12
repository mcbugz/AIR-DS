---
id: inline-validation
title: Inline validation
components: [Button, TextField]
tokensUsed: [--ds-space-4]
keywords: [validation, error, invalid, field, message, form, required]
---

# Inline validation

A field that announces its own error: `TextField` with `isInvalid` plus
`errorMessage`, so the message renders under the field and is wired to the
input for assistive technology.

Source (shipped code): `packages/react/src/components/TextField/TextField.tsx`
`@example` (lines 62–74) — the `isRequired` + `isInvalid` +
`errorMessage` form; error wiring (`aria-describedby`, invalid-state
announcement) is implemented in the same file via React Aria's `FieldError`.

## When to use

- Server- or submit-time validation results that belong to one specific
  field (taken username, invalid email, wrong format).
- The field must carry its own message — never a detached error paragraph
  the user has to associate by proximity.

Not for: form-wide failures with no single owning field (use the
status-banner pattern with `Alert tone="danger"` above the form).

## Composition rule

Validity is a controlled pair: `isInvalid` (state) + `errorMessage` (copy).
The message renders only while the field is invalid; clearing the state on
change removes it. Never bolt on a separate `<p className="error">` — the
component owns the error slot, its color, and its ARIA wiring. Description
(`description`) and error are different slots: help text teaches, error
copy says what to fix.

## Example

```tsx
import { useState } from 'react';
import { Button, TextField } from '@ds/react';
import styles from './EmailForm.module.css';

export function EmailForm({ submit }: { submit: (email: string) => boolean }) {
  const [email, setEmail] = useState('');
  const [invalid, setInvalid] = useState(false);

  return (
    <form
      className={styles.emailForm}
      onSubmit={(e) => {
        e.preventDefault();
        setInvalid(!submit(email));
      }}
    >
      <TextField
        label="Email"
        type="email"
        isRequired
        value={email}
        onChange={(next) => {
          setEmail(next);
          setInvalid(false);
        }}
        isInvalid={invalid}
        errorMessage="Enter a valid email address."
      />
      <Button type="submit">Subscribe</Button>
    </form>
  );
}
```

```css
/* EmailForm.module.css — token-only */
.emailForm {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--ds-space-4);
}
```

## Anti-pattern (NR-009)

Do not style invalid state with CSS pseudo-classes — `.field input:invalid`
(or `:hover`/`:focus-visible` on the field) is wrong (NR-009). Interaction
and validation states are RAC data attributes (`[data-invalid]`,
`[data-focus-visible]`), and the field's own CSS already consumes them;
drive validity through the `isInvalid` prop only.
