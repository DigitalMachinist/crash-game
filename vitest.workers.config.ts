import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '/tmp/vite-crash-game-workers',
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        bindings: { CRASH_DEBUG: 'true' },
      },
    }),
  ],
  test: {
    include: ['src/server/__tests__/workers/**/*.test.ts'],
  },
});
