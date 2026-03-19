import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [svelte({ configFile: resolve(__dirname, 'svelte.config.js') })],
  root: 'src/client',
  build: {
    outDir: '../../public',
    emptyOutDir: true,
  },
});
