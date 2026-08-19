import { defineConfig } from "vitest/config";

/**
 * Runner choice (documented decision): vitest + happy-dom, not web-test-runner.
 *
 *  - One toolchain: the whole workspace (tokens, react, mcp, context) already
 *    runs vitest; `pnpm -r test` and the gauntlet pick this package up with
 *    zero new runners, reporters, or CI plumbing.
 *  - Credential-free / hermetic rule: web-test-runner's value is real-browser
 *    execution, which means downloading browser binaries — the repo's
 *    zero-credential, zero-download demo posture forbids that as a merge gate.
 *  - happy-dom implements the exact Shadow-DOM surface under test:
 *    attachShadow, slots, CustomElementRegistry, constructable stylesheets
 *    (CSSStyleSheet.replaceSync) and adoptedStyleSheets.
 *
 * Acknowledged limit: not a real browser — rendered focus rings and pixel
 * output are covered by the demo page (examples/wc-demo), not these tests.
 */
export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["test/**/*.test.ts"],
  },
});
