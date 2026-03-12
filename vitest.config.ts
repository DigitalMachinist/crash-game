import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/client/__tests__/setup.ts'],
    include: [
      'src/server/__tests__/*.test.ts',
      'src/client/**/__tests__/*.test.ts',
    ],
    // Exclude workers (separate config) and Svelte components (separate config)
    exclude: [
      'src/server/__tests__/workers/**',
      'src/client/components/__tests__/**',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'src/server/crash-math.ts',
        'src/server/hash-chain.ts',
        'src/server/drand.ts',
        'src/server/game-state.ts',
        'src/client/lib/balance.ts',
        'src/client/lib/verify.ts',
        'src/client/lib/messageHandler.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 80,
      },
    },
  },
});
