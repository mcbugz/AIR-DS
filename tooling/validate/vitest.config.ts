import { defineConfig } from 'vitest/config';

// test/fixtures/** contains *.test.tsx files that are SCANNED as text by the
// evidence collectors (vitest-axe coverage) — they must never be executed.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/fixtures/**', 'node_modules/**', 'dist/**'],
  },
});
