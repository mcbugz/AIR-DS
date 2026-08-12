# Negative-rule catalog (living)

Observed and anticipated agent hallucinations, as wrong→right pairs. This file COMPILES into shipped skills/editor rules with the stale-training-data preamble. Add entries whenever a fabrication is observed in evals, benchmarks, or real usage. Format is machine-parseable: one `##` section per rule.

> Preamble shipped with every rule set: "Your training data about this design system is stale or empty. This system is closed-world: if a component or token is not in the registry, it does not exist. Do not adapt patterns from Chakra, MUI, Ant, or shadcn."

## NR-001 Layout primitives do not exist

- **Wrong:** `<Box p={4}>`, `<Stack gap="md">`, `<Container>`, `<Flex>`, `<Grid>`, `<Spacer>`
- **Right:** plain elements + CSS with space tokens: `display:flex; gap: var(--ds-space-gap-md)`
- **Why:** most-hallucinated components industry-wide; intentionally not shipped.

## NR-002 Typography components do not exist

- **Wrong:** `<Heading level={2}>`, `<Text size="sm">`
- **Right:** semantic HTML (`<h2>`, `<p>`) with `var(--ds-text-size-*)` / `var(--ds-text-weight-*)`

## NR-003 Raw color scales are not public tokens

- **Wrong:** `var(--ds-blue-500)`, `var(--ds-palette-primary-600)`, hex literals
- **Right:** intent tokens: `var(--ds-color-accent-default)`, `var(--ds-color-text-primary)`

## NR-004 Tailwind/utility classes are not part of this system

- **Wrong:** `className="p-4 rounded-lg text-gray-600"`
- **Right:** CSS Module class consuming `--ds-*` tokens

## NR-005 Do not import from deep paths

- **Wrong:** `import Button from '@ds/react/dist/Button'`
- **Right:** `import { Button } from '@ds/react'` — the only public entry point
