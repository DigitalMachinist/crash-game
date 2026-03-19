# Vitest 3 → 4 Upgrade Specification

**Date:** 2026-03-18
**Status:** Approved
**Motivation:** Stay current with dependencies; resolve 6 high-severity `undici` vulnerabilities in dev tooling

## Background

An `npm audit` revealed 6 high-severity vulnerabilities in `undici` 7.0.0–7.23.0, a transitive dependency of `miniflare` → `wrangler` → `@cloudflare/vitest-pool-workers`. The fix requires upgrading `@cloudflare/vitest-pool-workers` to 0.13.2, which in turn requires Vitest 4.1+.

These vulnerabilities affect dev/CI tooling only (not production Cloudflare Workers), but keeping dependencies current is the project's standard practice.

## Scope

### Dependencies to Upgrade

| Package | Current | Target |
|---------|---------|--------|
| `vitest` | ~3.2.4 | ^4.1.0 |
| `@vitest/coverage-v8` | ~3.2.4 | ^4.1.0 |
| `@cloudflare/vitest-pool-workers` | ^0.12.21 | ^0.13.2 |
| `wrangler` | ^4.72.0 | ^4.75.0 |

### Dependencies NOT Changing

- `@testing-library/svelte` (^5.3.1) — no vitest version coupling
- `@testing-library/jest-dom` (^6.9.1) — optional vitest peer, compatible
- `fast-check` (^4.6.0) — no vitest dependency
- `jsdom` (^24.1.3) — no vitest dependency
- `vite` (7.3.1) — already exceeds Vitest 4's >=6.0.0 requirement

### Prerequisites Already Met

- Node.js >=20.0.0 — project uses v24.14.0
- Vite >=6.0.0 — project uses v7.3.1

## Impact Analysis

### Test Suite Overview

- **37 test files** across 3 vitest configurations
- **18** Svelte component tests (`src/client/components/__tests__/`)
- **10** client library tests (`src/client/lib/__tests__/`)
- **8** server business logic tests (`src/server/__tests__/`)
- **1** Cloudflare worker/Durable Object test (`src/server/__tests__/workers/`)

### Configuration Files

**`vitest.config.ts`** — No changes needed. Uses `jsdom` environment, V8 coverage with explicit includes/thresholds. No deprecated options.

**`vitest.svelte.config.ts`** — No changes needed. Simple config with svelte plugin and @testing-library/svelte/vite plugin.

**`vitest.workers.config.ts`** — Highest risk area. Uses `defineWorkersConfig` from `@cloudflare/vitest-pool-workers/config` with `poolOptions.workers`. This is Cloudflare's custom pool options key (not the built-in Vitest `poolOptions` that was removed in v4), so it may be unaffected. Needs verification after upgrade.

### Why This Project Is Low-Risk for Vitest 4

The project avoids every major Vitest 4 breaking change:

| Vitest 4 Breaking Change | Project Usage | Impact |
|--------------------------|---------------|--------|
| `poolOptions` removed (built-in) | Not used — Cloudflare pool uses its own key | None |
| `mock.getMockName()` returns `"vi.fn()"` | No snapshot assertions on mock names | None |
| `vi.restoreAllMocks` no longer restores automocks | No automock reliance | None |
| `mock.invocationCallOrder` starts at 1 | Not asserted | None |
| `basic` reporter removed | Not used | None |
| `workspace` → `projects` rename | Not used — separate config files via CLI | None |
| Deprecated `deps.external/inline` removed | Not used | None |
| `coverage.all` removed | Not used | None |
| `coverage.ignoreEmptyLines` removed | Not used | None |
| Snapshot shadow root change | No snapshots used (0 occurrences) | None |

### Possible Adjustments

- **Coverage thresholds** (90% lines/functions, 80% branches) may shift slightly due to the new AST-based V8 remapping engine replacing `v8-to-istanbul`. If thresholds fail, adjust to match the new baseline.
- **Workers config shape** — verify `poolOptions.workers` structure is still valid in `@cloudflare/vitest-pool-workers@0.13.2`.

## Verification Plan

After upgrading, run in order:

1. `npm run test` — main server + client lib tests
2. `npm run test:svelte` — Svelte component tests
3. `npm run test:workers` — Cloudflare Durable Object tests
4. `npm run test:coverage` — verify coverage thresholds pass
5. `npm audit` — confirm undici vulnerabilities resolved
6. `npm run typecheck` — verify no type regressions

## Rollback Plan

If the upgrade causes issues that can't be resolved quickly: revert `package.json` and `package-lock.json` to pre-upgrade state. All changes are confined to these two files plus any vitest config adjustments.

## Approach

Big-bang upgrade of all 4 dependencies simultaneously, since they are tightly coupled (`@cloudflare/vitest-pool-workers` requires specific vitest version). Phased approaches add overhead without reducing risk given the coupling.
