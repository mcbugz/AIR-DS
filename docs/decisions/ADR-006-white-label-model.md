# ADR-006: White-label model — customer = theme file

**Status:** Accepted · **Phase:** 0 · **Date:** 2026-08-12

## Decision

1. **Customer = one brand-tier token file** in `brands/<customer>.json` + optional semantic overrides. Zero component code changes for standard engagements.
2. **Brand ingest pipeline** (Phase 4): intake from brand guidelines/Figma → generate brand tier → automated contrast/a11y validation of every semantic mapping → build. Target ≤ 5 working days intake-to-shipped.
3. **AI artifacts rebuild per customer:** context compiler runs with `--brand <customer>`; llms.txt, MCP metadata, skills, and editor rules are re-emitted with the customer's values and component set, published to a private npm scope per customer.
4. **Allowlisted extension points only:** token overrides, slots, composition — declared in a generated `extension-points.json`. Negative rules name what may not be overridden (gated walled garden).
5. **Distribution default: gated** (private per-customer scopes). Public crawlability of docs is an explicit per-customer decision at intake.

## Consequences

The neutral core (`brands/default.json`) is itself just the first customer of the pipeline — if re-theming the default is painful, the pipeline is broken and we find out immediately.
