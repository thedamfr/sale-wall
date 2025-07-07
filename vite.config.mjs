// vite.config.mjs
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig(({ command, ssrBuild }) => ({
  root: 'client',
  build: {
    outDir: '../server/dist/client',
    emptyOutDir: true,
    ssrManifest: true,
    ...(ssrBuild ? { ssr: 'src/main.js' } : {})
  },
  plugins: [svelte()]
}));