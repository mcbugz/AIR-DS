# Component inventory v1 — FROZEN (Phase 0 gate)

14 foundational components. Each ships with: typed API (discriminated unions for variant combinations), react-aria-components base, token-only CSS Module, TSDoc on every public prop, Storybook stories for every variant × state with interaction tests, axe test, and registry entry.

| # | Component | React Aria base | Variants / notes |
|---|---|---|---|
| 1 | `Button` | `Button` | `variant: primary\|secondary\|ghost\|danger` · `size: sm\|md\|lg` · loading state |
| 2 | `IconButton` | `Button` | requires `aria-label` (typed-required) · same sizes |
| 3 | `TextField` | `TextField` | label, description, error; `invalid` state via validation props |
| 4 | `TextArea` | `TextField` | auto-grow optional |
| 5 | `Select` | `Select` | single-select v1; typed options |
| 6 | `Checkbox` | `Checkbox` | indeterminate supported |
| 7 | `RadioGroup` | `RadioGroup` | horizontal/vertical orientation |
| 8 | `Switch` | `Switch` | |
| 9 | `Badge` | — (static) | `tone: neutral\|info\|success\|warning\|danger` |
| 10 | `Card` | — (static) | slots: header/body/footer; `elevation: flat\|raised` |
| 11 | `Dialog` | `Dialog`+`Modal` | sizes; focus trap + scroll lock from RAC |
| 12 | `Tooltip` | `Tooltip` | hover/focus trigger; never holds interactive content |
| 13 | `Tabs` | `Tabs` | |
| 14 | `Alert` | — (static, `role` set by tone) | `tone` like Badge; dismissible optional |

## Explicit non-components (negative-rule seeds)

We do NOT ship `Box`, `Stack`, `Container`, `Flex`, `Grid`, `Heading`, `Text`, `Spacer`. Layout is plain CSS with space tokens. These are the industry's most-hallucinated components (Ant Design finding); their absence is intentional and named in the negative-rule catalog.

## API conventions

- Props extend the RAC base props; we narrow, never widen.
- Variant unions are string literals; incompatible combinations expressed as discriminated unions (e.g. `IconButton` has no `children`-optional escape: `aria-label` required).
- Every component exports `<Name>Props` and appears in `components-index.json` with exact prop shapes generated from the code.
