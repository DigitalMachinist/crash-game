# Vitest 3 → 4 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade vitest from 3.2.4 to 4.1+, along with @cloudflare/vitest-pool-workers, @vitest/coverage-v8, and wrangler, resolving 6 high-severity undici vulnerabilities.

**Architecture:** Big-bang upgrade of all 4 tightly-coupled dependencies. The Cloudflare pool-workers 0.13.x has a new config API (Vite plugin instead of `defineWorkersConfig`) and new test imports (`cloudflare:workers` instead of `cloudflare:test`). Main and Svelte configs need no structural changes.

**Tech Stack:** Vitest 4.1+, @cloudflare/vitest-pool-workers 0.13.2, @vitest/coverage-v8 4.1+, wrangler 4.75+

**Spec:** `docs/specs/2026-03-18-vitest-4-upgrade.md`

---

## Chunk 1: Dependency Upgrade and Config Migration

### Task 1: Establish baseline, create feature branch, and upgrade dependencies

**Files:**
- Modify: `package.json:32` (@cloudflare/vitest-pool-workers), `package.json:37` (@vitest/coverage-v8), `package.json:45` (vitest), `package.json:46` (wrangler)
- Regenerate: `package-lock.json`

- [ ] **Step 1: Confirm baseline tests pass**

Before making any changes, confirm the test suite is green:

```bash
npm run test:all
```

Expected: All tests pass. If any tests fail, stop and resolve them before proceeding — this is the baseline we're protecting.

- [ ] **Step 2: Create feature branch**

```bash
git checkout -b chore/vitest-4-upgrade
```

- [ ] **Step 3: Update package.json dependency versions**

In `package.json`, change these 4 lines in `devDependencies`:

```json
"@cloudflare/vitest-pool-workers": "^0.13.2",
"@vitest/coverage-v8": "^4.1.0",
"vitest": "^4.1.0",
"wrangler": "^4.75.0"
```

Note: The version specifier for vitest changes from `~` (patch-only) to `^` (minor-compatible) and for @vitest/coverage-v8 from `~` to `^`. This matches the other dependencies' convention and is appropriate since Vitest follows semver.

- [ ] **Step 4: Install updated dependencies**

```bash
nvm use v24.14.0 && npm install
```

Expected: Clean install with no peer dependency warnings. The lockfile will be regenerated.

- [ ] **Step 5: Verify undici vulnerability is resolved**

```bash
npm audit
```

Expected: 0 high-severity vulnerabilities. The `undici` transitive dependency should now be >=7.24.0 (patched).

- [ ] **Step 6: Commit the dependency upgrade**

```bash
git add package.json package-lock.json
git commit -m "chore: upgrade vitest 3→4 dependencies

- vitest ~3.2.4 → ^4.1.0
- @vitest/coverage-v8 ~3.2.4 → ^4.1.0
- @cloudflare/vitest-pool-workers ^0.12.21 → ^0.13.2
- wrangler ^4.72.0 → ^4.75.0
- Resolves 6 high-severity undici vulnerabilities"
```

---

### Task 2: Verify workers config compatibility and migrate if needed

**Files:**
- Possibly modify: `vitest.workers.config.ts`

The spec notes that `defineWorkersConfig` with `poolOptions.workers` is Cloudflare's custom API key (not the built-in Vitest `poolOptions` removed in v4), so it *may* still work in 0.13.x. Verify before migrating.

- [ ] **Step 1: Run worker tests with existing config**

```bash
npm run test:workers
```

**If all worker tests pass:** The existing `defineWorkersConfig` API is still supported in 0.13.x. Skip to Task 4 (no config migration needed).

**If the run fails with a config or import error:** Proceed to Step 2.

- [ ] **Step 2 (conditional): Rewrite vitest.workers.config.ts**

Only perform this step if Step 1 failed. The `@cloudflare/vitest-pool-workers` 0.13.x replaced `defineWorkersConfig` with a `cloudflareTest()` Vite plugin. Before writing, verify the correct import path in the installed package:

```bash
ls node_modules/@cloudflare/vitest-pool-workers/dist/
```

Then replace the entire contents of `vitest.workers.config.ts` with:

```typescript
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
```

Key changes:
- `defineWorkersConfig` → `defineConfig` from `vitest/config` + `cloudflareTest()` plugin
- `poolOptions.workers.wrangler` → plugin option `wrangler`
- `poolOptions.workers.miniflare` → plugin option `miniflare`
- `isolatedStorage: false` removed (option no longer exists in 0.13.x; per-file isolation is the new default). This is safe because there is only 1 worker test file, so per-file vs shared isolation is equivalent.

> **Note:** If `cloudflareTest` is not exported from the main `@cloudflare/vitest-pool-workers` package, check its sub-path exports (e.g., `@cloudflare/vitest-pool-workers/config`) and update the import path accordingly.

- [ ] **Step 3 (conditional): Verify the config file has no TypeScript errors**

Only perform if Step 2 was executed:

```bash
npx tsc --noEmit --strict vitest.workers.config.ts 2>&1 || echo "Note: standalone typecheck may fail due to missing project context — this is verified in the full test run"
```

---

### Task 3: Migrate worker test imports (only if Task 2 migration was performed)

**Files:**
- Possibly modify: `src/server/__tests__/workers/crash-game.do.test.ts:11`

The `cloudflare:test` module is removed in 0.13.x. `SELF` is replaced by the `exports` export from `cloudflare:workers`. Import it aliased as `workerExports` to avoid shadowing the well-known Node.js `exports` global.

- [ ] **Step 1: Update the import statement**

In `src/server/__tests__/workers/crash-game.do.test.ts`, change line 11:

Old:
```typescript
import { SELF } from 'cloudflare:test';
```

New:
```typescript
import { exports as workerExports } from 'cloudflare:workers';
```

- [ ] **Step 2: Update the comment on line 2**

Old:
```typescript
// These exercise the full CrashGame Durable Object lifecycle via SELF.fetch().
```

New:
```typescript
// These exercise the full CrashGame Durable Object lifecycle via workerExports.default.fetch().
```

- [ ] **Step 3: Replace all SELF.fetch() calls with workerExports.default.fetch()**

Search and replace throughout `src/server/__tests__/workers/crash-game.do.test.ts`:

Old: `SELF.fetch(`
New: `workerExports.default.fetch(`

There are 5 code occurrences:
- Line 16: `connectWS` helper function
- Line 66: debug endpoint test
- Line 237: 404 test
- Line 244: non-debug request test
- Line 433: debug endpoint alarm test

- [ ] **Step 4: Commit config and test migration**

```bash
git add vitest.workers.config.ts src/server/__tests__/workers/crash-game.do.test.ts
git commit -m "chore: migrate cloudflare pool-workers config to 0.13.x API

- Migrate defineWorkersConfig → cloudflareTest() Vite plugin
- Migrate SELF import → workerExports.default from cloudflare:workers"
```

---

## Chunk 2: Verification

### Task 4: Run main test suite

- [ ] **Step 1: Run main tests (server + client lib)**

```bash
npm run test
```

Expected: All tests pass. These tests use `jsdom` environment and standard vitest APIs — no breaking changes affect them.

- [ ] **Step 2: If tests fail, diagnose and fix**

Most likely cause of failure: none expected. If `vi.restoreAllMocks` behavior changed for any automocked module, add explicit `vi.resetModules()` in the relevant `beforeEach`.

---

### Task 5: Run Svelte component test suite

- [ ] **Step 1: Run Svelte component tests**

```bash
npm run test:svelte
```

Expected: All 18 component tests pass. Config has no deprecated options and uses standard @testing-library/svelte patterns.

- [ ] **Step 2: If tests fail, diagnose and fix**

Most likely cause: none expected. If `@testing-library/svelte` has a compatibility issue with vitest 4, check for a newer version of `@testing-library/svelte`.

---

### Task 6: Run Cloudflare workers test suite

- [ ] **Step 1: Run worker tests**

```bash
npm run test:workers
```

Expected: All worker integration tests pass with the updated config and `workerExports.default.fetch()` API (if migration was performed).

- [ ] **Step 2: If tests fail, diagnose**

Likely causes:
- **Import error on `cloudflare:workers`**: Verify the import path is exactly `cloudflare:workers` (not `cloudflare:test`)
- **`workerExports.default.fetch` is not a function**: Check if the API surface differs — may need `workerExports.fetch()` instead of `workerExports.default.fetch()`
- **Config validation error**: The `cloudflareTest()` plugin options may have a different shape than documented — check the TypeScript types from the installed package

- [ ] **Step 3: Fix any issues and re-run**

After fixing, re-run: `npm run test:workers`

---

### Task 7: Run coverage and verify thresholds

- [ ] **Step 1: Run coverage**

```bash
npm run test:coverage
```

Expected: Coverage passes with existing thresholds (90% lines/functions, 80% branches). Vitest 4 uses a new AST-based V8 remapping engine which may cause minor shifts in coverage numbers.

- [ ] **Step 2: If thresholds fail, adjust**

If coverage numbers shifted, update thresholds in `vitest.config.ts:27-31` to match the new baseline. Only adjust downward if the delta is small (<5 percentage points) — a large drop indicates a real regression.

---

### Task 8: Run typecheck and lint

- [ ] **Step 1: Run typecheck**

```bash
npm run typecheck
```

Expected: No type errors. The vitest 4 type surface is backward-compatible for the APIs this project uses.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: No lint errors from the dependency changes.

- [ ] **Step 3: Run format check**

```bash
npm run check
```

Expected: Clean. Format any files that need it with `npm run format`.

---

### Task 9: Final verification and commit

- [ ] **Step 1: Run full test suite**

```bash
npm run test:all
```

Expected: All 37 test files across all 3 configs pass.

- [ ] **Step 2: Verify audit is clean**

```bash
npm audit
```

Expected: 0 high-severity vulnerabilities.

- [ ] **Step 3: Commit any fixes from verification**

If any adjustments were needed during verification (coverage thresholds, minor fixes), name the specific files changed:

```bash
git add vitest.config.ts  # list specific files that were adjusted
git commit -m "fix: adjust tests/config for vitest 4 compatibility"
```

- [ ] **Step 4: Run full suite one final time to confirm**

```bash
npm run test:all && npm run typecheck && npm run lint
```

Expected: All green.
