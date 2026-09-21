import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const project = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('./src', import.meta.url)),
  base: '',
  resolve: {
    alias: {
      '@': project,
    },
  },
  build: {
    outDir: fileURLToPath(new URL('.', import.meta.url)),
    emptyOutDir: false,
    target: 'es2017',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
      },
    },
    rollupOptions: {
      input: fileURLToPath(new URL('./src/main.ts', import.meta.url)),
      output: {
        entryFileNames: 'game.js',
        format: 'cjs',
        inlineDynamicImports: true,
      },
    },
    chunkSizeWarningLimit: 20000,
  },
  define: {
    'import.meta.env.BASE_URL': JSON.stringify(''),
  },
});
