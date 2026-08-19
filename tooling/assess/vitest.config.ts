import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The typical-2023-ds fixture contains a decoy jest test on purpose —
    // it is scan MATERIAL, not part of this package's suite.
    include: ['test/*.test.ts'],
    exclude: ['test/fixtures/**', 'node_modules/**', 'dist/**'],
  },
});
