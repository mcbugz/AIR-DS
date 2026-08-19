import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Hermetic tests: run against @ds/react SOURCE (no build required) and
      // stub the token CSS exactly like @ds/react's own test rig does.
      '@ds/tokens/css': path.join(here, 'src/test/tokens-stub.css'),
      '@ds/react': path.join(here, '../react/src/index.ts'),
    },
  },
  test: {
    // Globals are required for @testing-library/react auto-cleanup.
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    testTimeout: 20000,
    hookTimeout: 60000,
    css: {
      include: [/\.module\.css$/],
      modules: { classNameStrategy: 'non-scoped' },
    },
  },
});
