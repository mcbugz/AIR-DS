# ADR-001: Naming and prefix

**Status:** Accepted · **Phase:** 0 · **Date:** 2026-08-12

## Decision

- System codename: **AIR-DS** (internal). Shipped artifacts are vendor-neutral.
- npm scope: `@ds/*` (`@ds/tokens`, `@ds/react`, `@ds/mcp`, `@ds/context`, `@ds/validate`). The scope is a build-time constant (`DS_SCOPE`) so per-customer builds can publish to a private scope (e.g. `@acme-ds/*`) without code changes.
- CSS custom property prefix: `--ds-`. Also a build-time constant.
- Component export names are unprefixed (`Button`, not `DsButton`) — the package scope provides the namespace; agent registries enumerate exact exports.

## Rationale

Brief §4.5: neutral voice everywhere, renamable at build. Keeping the rename surface to two build-time constants (scope, CSS prefix) makes per-customer re-emission a pipeline parameter, not a refactor.

## Consequences

No hardcoded `@ds/` or `--ds-` strings outside the token build and context compiler configuration; templates interpolate the constants.
