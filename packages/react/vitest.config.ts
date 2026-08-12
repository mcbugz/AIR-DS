import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Unit tests must never require @ds/tokens to be built.
      '@ds/tokens/css': path.join(here, 'src/test/tokens-stub.css'),
    },
  },
  test: {
    // Globals are required for @testing-library/react auto-cleanup.
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: {
      // Process CSS Modules so `styles.x` resolves; keep authored class names
      // so test assertions are stable and readable.
      include: [/\.module\.css$/],
      modules: { classNameStrategy: 'non-scoped' },
    },
  },
});
