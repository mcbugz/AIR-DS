---
id: choice-group
title: Choice group
components: [Radio, RadioGroup]
tokensUsed: []
keywords: [radio, options, single-select, exclusive, orientation, horizontal]
---

# Choice group

A labeled set of mutually exclusive options: `RadioGroup` with `Radio`
children, vertical by default, `orientation="horizontal"` for short
scannable option rows.

Source (shipped code): `examples/reference-screen/SettingsScreen.tsx` lines
95–104 (the "Digest frequency" group) and
`packages/react/src/components/RadioGroup/RadioGroup.tsx` `@example`
(lines 66–80), including the horizontal and invalid forms.

## When to use

- One value must be chosen from 2–5 visible options and seeing all options
  at once helps the decision (frequency, density, plan).
- Use `orientation="horizontal"` only for few, short labels (e.g. Compact /
  Cozy); default vertical otherwise.

Not for: independent booleans (settings-toggle-group with `Switch`), or
long option lists (use `Select`).

## Composition rule

`RadioGroup` owns the group: visible `label` (the accessible name), optional
`description`, selection state (`value`/`defaultValue` + `onChange`
receiving the selected `Radio`'s `value` string), keyboard behavior, and
orientation — arrow-key navigation adapts automatically. `Radio` children
carry their visible label as children. No custom CSS: layout for both
orientations ships inside the component (`data-orientation`).

## Example

```tsx
import { useState } from 'react';
import { Radio, RadioGroup } from '@ds/react';

export function DigestFrequency() {
  const [digest, setDigest] = useState('weekly');

  return (
    <RadioGroup
      label="Digest frequency"
      description="How often we bundle activity into a summary email."
      value={digest}
      onChange={setDigest}
    >
      <Radio value="daily">Daily</Radio>
      <Radio value="weekly">Weekly</Radio>
      <Radio value="never">Never</Radio>
    </RadioGroup>
  );
}

export function DensityChoice() {
  return (
    <RadioGroup label="Density" orientation="horizontal" defaultValue="cozy">
      <Radio value="compact">Compact</Radio>
      <Radio value="cozy">Cozy</Radio>
    </RadioGroup>
  );
}
```

## Anti-pattern (NR-004)

Do not lay the options out with utility classes — `className="flex gap-2"`
on a wrapper (or on `RadioGroup` itself) is wrong (NR-004): Tailwind-style
utilities are not part of this system, and hand-rolled option rows bypass
the group's orientation-aware keyboard navigation. Use the `orientation`
prop; if surrounding layout is genuinely needed, it is a CSS Module class
consuming `--ds-*` tokens.
