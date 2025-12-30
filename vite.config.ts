import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  base: '/',
  server: {
    port: 3000,
    open: true,
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'sound-effects', dest: '.' },
        { src: 'soundtrack', dest: '.' },
        { src: 'texturepack', dest: '.' },
      ],
    }),
  ],
  build: {
    target: 'esnext',
    minify: 'esbuild',
  },
  optimizeDeps: {
    exclude: ['cubiomes'],
  },
});

