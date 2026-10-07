import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

const project = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('./static-app', import.meta.url)),
  base: './',
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  plugins: [react()],
  resolve: { alias: { '@': project } },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: {
    outDir: fileURLToPath(new URL('./dist-pages', import.meta.url)),
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        index: fileURLToPath(
          new URL('./static-app/index.html', import.meta.url),
        ),
        performance: fileURLToPath(new URL('./static-app/qa-performance.html', import.meta.url)),
        weapons: fileURLToPath(
          new URL('./static-app/qa-weapons.html', import.meta.url),
        ),
      },
    },
  },
});
