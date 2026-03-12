// Svelte component tests — requires Node >=21 due to @sveltejs/vite-plugin-svelte@6.x
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
  plugins: [svelte({ hot: false }), svelteTesting()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/client/__tests__/setup.ts'],
    include: ['src/client/components/__tests__/**/*.test.ts'],
  },
});
