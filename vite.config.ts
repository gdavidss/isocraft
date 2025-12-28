import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
  },
  optimizeDeps: {
    exclude: ['cubiomes'],
  },
});

