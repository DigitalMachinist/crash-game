import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  cacheDir: '/tmp/vite-crash-game-workers',
  test: {
    include: ['src/server/__tests__/workers/**/*.test.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        isolatedStorage: false,
      },
    },
  },
});
