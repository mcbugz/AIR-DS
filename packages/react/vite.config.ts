import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { libInjectCss } from 'vite-plugin-lib-inject-css';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    libInjectCss(),
    dts({ tsconfigPath: path.join(here, 'tsconfig.build.json') }),
  ],
  build: {
    sourcemap: true,
    lib: {
      entry: {
        index: path.join(here, 'src/index.ts'),
        'icons/index': path.join(here, 'src/icons/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      // Peers and the token layer stay external; `import '@ds/tokens/css'`
      // is preserved in the emitted ESM so consumers get tokens automatically.
      external: [
        /^react($|\/)/,
        /^react-dom($|\/)/,
        /^react-aria($|\/)/,
        /^react-aria-components($|\/)/,
        /^@ds\/tokens($|\/)/,
      ],
    },
  },
});
