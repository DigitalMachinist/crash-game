# Crash Game — TDD Implementation Plan

**Date:** 2026-03-11
**Spec:** `2026-03-11-crash-game-mvp-spec.md`
**Intent:** Agent swarm implementation with thorough post-implementation review

---

## Resolved Decisions (from spec Q&A)

| Question | Decision |
|---|---|
| Project location | New sibling repo: `~/Workspace/git/crash-game/` |
| Player identity | Client UUID in localStorage, sent as `playerId` in every `join` |
| Hash chain size | 10,000 games; recompute from `seed[0]` each round (max ~10ms) |
| TypeScript | Full TypeScript everywhere — server, client libs, Svelte `<script lang="ts">` |

---

## Testing Stack

| Layer | Tool |
|---|---|
| Server unit tests (pure functions) | Vitest |
| Server DO integration tests | `@cloudflare/vitest-pool-workers` |
| Client unit tests (pure functions) | Vitest (jsdom environment) |
| Svelte component tests | Vitest + `@testing-library/svelte` |
| Type checking | `tsc --noEmit` |

All tests live in `src/**/__tests__/` adjacent to the file under test.

---

## Architecture Note: Testability

`crash-game.ts` (the Durable Object) is split into two layers to maximise testability:

- **`GameStateMachine`** — a pure class that takes state + event, returns new state + messages to broadcast. No I/O, no timers, no alarms. Fully unit-testable.
- **`CrashGame` (DO class)** — thin orchestration layer that owns storage, alarms, and WebSocket connections; delegates all logic to `GameStateMachine`. Tested via DO integration tests.

---

## Dependency Graph & Parallelism

```
Task 0: Scaffold ──────────────────────────────────────────────────────┐
                                                                        │
Task 0b: config.ts (depends on 0) ──────────────────────────────────┐  │
                                                                     │  │
Task 0c: types.ts (depends on 0) ───────────────────────────────────┤  │
  (shared type definitions — must exist before parallel tasks begin) │  │
                                                                     │  │
         ┌── Task 1a: crash-math.ts (depends on 0b) ───────────────┐│  │
         ├── Task 1b: hash-chain.ts (depends on 0b) ───────────────┤│  │
         │   (parallel)                                             ││  │
         └── Task 1c: balance.ts + verify.ts (depends on 0c) ─────┐││  │
                                                                   │││  │
Task 2: drand.ts (depends on 0b) ──────────────────────────────────┤││  │
                                                                   │││  │
Task 3: GameStateMachine (depends on 0c, 1a, 1b, 2) ─────────────┐│││  │
                                                                  ││││  │
Task 4: CrashGame DO (depends on 3) ──────────────────────────────┤│││  │
                                                                  ││││  │
Task 5: index.ts worker entry (depends on 4) ─────────────────────┘│││  │
                                                                    │││  │
Task 6: stores.ts + socket.ts (depends on 0c) ──────────────────────┘││  │
  (parallel with Tasks 3-5)                                           ││  │
                                                                      ││  │
Tasks 7a-7f: Svelte components (depend on 6) ────────────────────────┘│  │
                                                                       │  │
Task 8: App.svelte integration (depends on 5, 7a-7f) ──────────────────┘  │
                                                                           │
Task 9: E2E smoke test (depends on 8) ──────────────────────────────────────┘
```

Tasks 0b and 0c can run in **parallel** (both depend only on Task 0).
Tasks 1a, 1b, 1c, and 2 can run in **parallel** (1a/1b/2 depend on 0b; 1c depends on 0c).
Tasks 7a–7f (Svelte components) can all run in **parallel**.

---

## Task 0 — Project Scaffold

**Agent: 1 (Bash)**
**Dependencies:** None

### Directory structure to create

```
crash-game/
  src/
    server/
      __tests__/
        workers/         (DO integration tests — separate vitest config)
    client/
      lib/
        __tests__/
      components/
        __tests__/
  public/          (gitignored, Vite output)
  biome.json
  package.json
  tsconfig.json
  tsconfig.server.json
  wrangler.toml
  vitest.config.ts
  vitest.workers.config.ts
  vite.config.ts
  .gitignore
```

### `package.json` scripts

```json
{
  "scripts": {
    "dev:server": "wrangler dev",
    "dev:client": "vite",
    "build:client": "vite build",
    "test": "vitest run",
    "test:workers": "vitest run --config vitest.workers.config.ts",
    "test:all": "npm run test && npm run test:workers",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "typecheck:server": "tsc --project tsconfig.server.json --noEmit",
    "lint": "biome lint src",
    "format": "biome format src --write",
    "check": "biome check src",
    "prepare": "simple-git-hooks"
  }
}
```

### Key dependencies

```json
{
  "dependencies": {
    "partyserver": "latest",
    "partysocket": "latest"
  },
  "devDependencies": {
    "@biomejs/biome": "latest",
    "@cloudflare/vitest-pool-workers": "latest",
    "@cloudflare/workers-types": "latest",
    "@sveltejs/vite-plugin-svelte": "latest",
    "@testing-library/svelte": "latest",
    "@testing-library/jest-dom": "latest",
    "@vitest/coverage-v8": "latest",
    "fast-check": "latest",
    "lint-staged": "latest",
    "simple-git-hooks": "latest",
    "svelte": "latest",
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest",
    "wrangler": "latest"
  },
  "simple-git-hooks": {
    "pre-commit": "npx lint-staged"
  },
  "lint-staged": {
    "src/**/*.{ts,svelte}": ["biome check --apply --no-errors-on-unmatched", "git add"]
  }
}
```

### `biome.json` (lint + format config)

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": { "quoteStyle": "single", "semicolons": "always" }
  }
}
```

### `tsconfig.server.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "noEmit": true
  },
  "include": ["src/server/**/*", "src/config.ts", "src/types.ts"],
  "exclude": ["src/client/**", "public/**", "**/__tests__/**"]
}
```

Explicitly excluding `src/client/**` ensures `tsc --project tsconfig.server.json --noEmit` fails fast if any DOM types, `import.meta.env`, or browser globals leak into server code. Run this separately from the root `typecheck` script.

Add to `package.json` scripts: `"typecheck:server": "tsc --project tsconfig.server.json --noEmit"`

### `wrangler.toml`

```toml
name = "crash-game"
main = "src/server/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "./public"

[[durable_objects.bindings]]
name = "CrashGame"
class_name = "CrashGame"

[[migrations]]
tag = "v1"
new_classes = ["CrashGame"]
```

### `vitest.config.ts` (client + pure server unit tests)

```ts
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/client/__tests__/setup.ts'],
    // Explicit include avoids overlap with workers config glob
    include: [
      'src/server/__tests__/*.test.ts',
      'src/client/**/__tests__/*.test.ts',
    ],
    // Exclude the workers subdirectory — handled by vitest.workers.config.ts
    exclude: ['src/server/__tests__/workers/**'],
    coverage: {
      provider: 'v8',
      // Enforce thresholds on pure function modules only
      // Components excluded: jsdom/RAF limitations make branch coverage noisy
      include: ['src/server/crash-math.ts', 'src/server/hash-chain.ts', 'src/server/drand.ts',
                'src/server/game-state.ts', 'src/client/lib/balance.ts', 'src/client/lib/verify.ts',
                'src/client/lib/messageHandler.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 80,
      },
    },
  },
});
```

Note: The `include` pattern uses `src/server/__tests__/*.test.ts` (single `*`, not `**`) to match only files directly in `__tests__/`, not in the `workers/` subdirectory. This prevents the same test file from matching both configs.

### `vitest.workers.config.ts` (DO integration tests)

```ts
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    // Only the workers subdirectory — does not overlap with vitest.config.ts
    include: ['src/server/__tests__/workers/**/*.test.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
      },
    },
  },
});
```

### Acceptance criteria

- `npm install` completes without errors
- `npm run typecheck` finds no errors (on empty stub files)
- `npm run typecheck:server` finds no errors (server tsconfig excludes client code)
- `npm run test` runs and reports 0 tests (no test files yet)
- `npm run lint` exits 0 (Biome configured and can run)
- `biome.json` exists with formatter and linter config
- `npx simple-git-hooks` installs the pre-commit hook (verify `.git/hooks/pre-commit` exists)
- `fast-check` listed in devDependencies (used in Tasks 1a, 1b for property tests)

---

## Task 0b — `src/config.ts`

**Agent: 1**
**Dependencies:** Task 0

A single shared config module imported by both server and client code. Centralises every value that might need tuning without touching implementation files.

### File: `src/config.ts`

```ts
// ─── Game loop timing ────────────────────────────────────────────────────────
export const WAITING_DURATION_MS   = 10_000   // Countdown before each round
export const CRASHED_DISPLAY_MS    = 5_000    // Results screen duration
export const TICK_INTERVAL_MS      = 100      // Server broadcast interval during RUNNING
export const COUNTDOWN_TICK_MS     = 1_000    // Server broadcast interval during WAITING

// ─── Multiplier curve ────────────────────────────────────────────────────────
/** e^(GROWTH_RATE * t) — places 2x at ~11.5s, 3x at ~18.3s */
export const GROWTH_RATE           = 0.00006

// ─── House edge ──────────────────────────────────────────────────────────────
/** Fraction of wagers retained by the house. 0.01 = 1%. Encoded as (1 - HOUSE_EDGE) * 100 in crash formula. */
export const HOUSE_EDGE            = 0.01

// ─── Hash chain ──────────────────────────────────────────────────────────────
export const CHAIN_LENGTH          = 10_000
/** Generate a new chain when this many games remain */
export const CHAIN_ROTATION_THRESHOLD = 100

// ─── drand quicknet ──────────────────────────────────────────────────────────
export const DRAND_CHAIN_HASH      = '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971'
export const DRAND_GENESIS_TIME    = 1_692_803_367   // Unix seconds
export const DRAND_PERIOD_SECS     = 3
export const DRAND_BASE_URL        = `https://drand.cloudflare.com/${DRAND_CHAIN_HASH}`
export const DRAND_FETCH_TIMEOUT_MS = 2_000

// ─── Game room ───────────────────────────────────────────────────────────────
export const ROOM_ID               = 'crash-main'

// ─── Server state ────────────────────────────────────────────────────────────
/** Number of completed rounds kept in the history broadcast */
export const HISTORY_LENGTH        = 20

// ─── Client ──────────────────────────────────────────────────────────────────
/** Maximum rounds kept in localStorage history */
export const CLIENT_HISTORY_LIMIT  = 50
// Note: multiplier animation is handled via CSS transition matching TICK_INTERVAL_MS,
// not a tweened store. The CSS duration is set directly in Multiplier.svelte as:
//   transition: all ${TICK_INTERVAL_MS}ms linear;
```

### Usage contract

- Server files (`crash-math.ts`, `hash-chain.ts`, `drand.ts`, `crash-game.ts`) import constants from `src/config.ts` — no magic numbers in implementation files.
- Client files (`balance.ts`, `verify.ts`, `stores.ts`, `Multiplier.svelte`) import client-relevant constants from `src/config.ts`.
- Test files may import config values and override them locally using Vitest's module mocking where needed (e.g., to test with a tiny `CHAIN_LENGTH = 5`).
- `config.ts` must NOT import from `types.ts` (types depend on config, not the reverse) and must NOT import from any server/client implementation files.

### No test file required

`config.ts` contains only exported constants — no logic to test. Correctness is validated indirectly through the tests of modules that depend on it.

---

## Task 0c — `src/types.ts`

**Agent: 1**
**Dependencies:** Task 0
**Can run in parallel with:** Task 0b

Shared type definitions used by both server and client. These must exist before any parallel tasks (1a, 1b, 1c, 2, 6) begin, since they import these types.

Extracting types into a separate file:
- Prevents circular imports between `game-state.ts` and `crash-game.ts`
- Allows client code (`stores.ts`, `messageHandler.ts`) to import server protocol types without importing server logic
- Makes the wire protocol explicit and diffable in one place

### File: `src/types.ts`

```ts
// ─── Game phases ─────────────────────────────────────────────────────────────
export type Phase = 'WAITING' | 'STARTING' | 'RUNNING' | 'CRASHED';

// ─── Server-side player (full, internal to server) ───────────────────────────
export interface Player {
  id: string;            // connection ID (changes on reconnect)
  playerId: string;      // client UUID (stable across reconnects)
  name: string;
  wager: number;
  autoCashout: number | null;
  cashedOut: boolean;
  cashoutMultiplier: number | null;
  payout: number | null;
}

// ─── Client-visible player snapshot (broadcast to all clients) ───────────────
export interface PlayerSnapshot {
  id: string;
  playerId: string;
  name: string;
  wager: number;
  cashedOut: boolean;
  cashoutMultiplier: number | null;
  payout: number | null;
  autoCashout: number | null;
}

// ─── Full game state snapshot (sent on connect + phase transitions) ──────────
export interface GameStateSnapshot {
  phase: Phase;
  roundId: number;
  countdown: number;        // ms remaining (WAITING only)
  multiplier: number;       // current multiplier (RUNNING only)
  elapsed: number;          // ms since round start (RUNNING only)
  crashPoint: number | null; // null during WAITING/STARTING/RUNNING; revealed on CRASHED
  players: PlayerSnapshot[];
  chainCommitment: string;
  drandRound: number | null;
  history: HistoryEntry[];
}

// ─── Round history entry ─────────────────────────────────────────────────────
export interface HistoryEntry {
  roundId: number;
  crashPoint: number;
  roundSeed: string;
  drandRound: number;
  drandRandomness: string;
  chainCommitment: string;
}

// ─── Client-side bet/round result (stored in localStorage) ───────────────────
export interface RoundResult {
  roundId: number;
  wager: number;
  payout: number;           // 0 if crashed without cashout
  cashoutMultiplier: number | null;
  crashPoint: number;
  timestamp: number;
}

// ─── Provably fair verification result ───────────────────────────────────────
export interface VerificationResult {
  valid: boolean;
  reason?: string;
  computedCrashPoint?: number;
  chainValid?: boolean;
  drandRound?: number;
  drandRandomness?: string;
}

// ─── Server → Client message union ──────────────────────────────────────────
// CRITICAL SECURITY: crashPoint MUST remain null in 'state' messages during WAITING/STARTING/RUNNING.
// Revealing it before CRASHED allows compromised server state to inform player cashout decisions.
// See spec Section 3: Crash Point Isolation.
export type ServerMessage =
  | { type: 'state'; } & GameStateSnapshot
  | { type: 'tick'; multiplier: number; elapsed: number }
  | { type: 'crashed'; crashPoint: number; elapsed: number; roundSeed: string; drandRound: number; drandRandomness: string; players: PlayerSnapshot[] }
  | { type: 'playerJoined'; id: string; playerId: string; name: string; wager: number; autoCashout: number | null }
  | { type: 'playerCashedOut'; id: string; multiplier: number; payout: number }
  | { type: 'pendingPayout'; roundId: number; wager: number; payout: number; cashoutMultiplier: number; crashPoint: number }
  | { type: 'error'; message: string };

// ─── Client → Server message union ──────────────────────────────────────────
export type ClientMessage =
  | { type: 'join'; playerId: string; wager: number; name?: string; autoCashout?: number | null }
  | { type: 'cashout' };
```

### No test file required

`types.ts` contains only type declarations — no runtime logic. TypeScript's type checker validates all usages at build time.

---

## Task 1a — `src/server/crash-math.ts`

**Agent: 1**
**Dependencies:** Task 0b

All numeric constants (`GROWTH_RATE`, `HOUSE_EDGE`) are imported from `src/config.ts`. This module contains only pure functions.

### Exports

```ts
export function hashToFloat(hex: string): number
export function deriveCrashPoint(effectiveSeed: string): number
export function multiplierAtTime(elapsedMs: number): number
export function crashTimeMs(crashPoint: number): number
```

### Test file: `src/server/__tests__/crash-math.test.ts`

**`hashToFloat`**
- Returns a value in `[0, 1)` for arbitrary hex inputs
- Is deterministic (same input → same output)
- Uses exactly the first 13 hex characters (52 bits)
- Returns `0` for `"0000000000000" + padding`
- Returns a value approaching `1` for `"fffffffffffff" + padding`

**`deriveCrashPoint`**
- Returns `1.00` when `hashToFloat` result is less than `0.01` (instant crash zone)
- Returns exactly `1.00` for the boundary case `h = 0.0` (all-zero effective seed leading chars)
- Returns `2.00` for an effective seed where `h ≈ 0.505` (confirming formula: `floor(99/(1-0.505))/100 = floor(99/0.495)/100 = floor(200)/100 = 2.00`)
- Floors to 2 decimal places (never rounds up)
- Never returns less than `1.00`
- **Property test (fast-check, `numRuns: 1000`):** For all 64-char hex strings, `deriveCrashPoint` returns a value in `[1.00, Infinity)` and has exactly 2 decimal places
- **Property test (fast-check, `numRuns: 1000`):** Is deterministic — same input always produces same output
- Over 100,000 samples with random hex inputs, the fraction returning `1.00` is within `[0.009, 0.011]` (house edge property test)
- Over 100,000 samples, approximately 50% return `≤ 2.00`
- **Edge case:** `h` very close to 1 (effective seed `"ffffffffffffff..."`) — result is a large finite number, not `NaN` or `Infinity`

**`multiplierAtTime`**
- Returns `1.00` at `t = 0`
- Returns a value close to `2.00` at `t = 11552ms` (exact for `GROWTH_RATE = 0.00006`: `ln(2)/0.00006 ≈ 11552`)
- Is strictly monotonically increasing
- Never returns less than `1.00`

**`crashTimeMs`**
- Is the inverse of `multiplierAtTime`: `multiplierAtTime(crashTimeMs(x)) ≈ x` (within floating-point tolerance)
- Returns `0` for `crashPoint = 1.00`
- Returns a positive number for all valid crash points

### Acceptance criteria

- All tests pass
- No TypeScript errors
- `deriveCrashPoint` house edge test passes over 100,000 samples

---

## Task 1b — `src/server/hash-chain.ts`

**Agent: 1**
**Dependencies:** Task 0b

`CHAIN_LENGTH` and `CHAIN_ROTATION_THRESHOLD` are imported from `src/config.ts`.

### Exports

```ts

export function generateRootSeed(): Promise<string>         // crypto random 32 bytes as hex
export function sha256Hex(input: string): Promise<string>   // SHA-256 of hex string, returns hex
export function computeSeedAtIndex(rootSeed: string, index: number): Promise<string>
  // Hashes forward from rootSeed `index` times
  // index 0 → rootSeed itself
  // index 1 → SHA256(rootSeed)
  // index k → SHA256^k(rootSeed)
export function computeTerminalHash(rootSeed: string): Promise<string>
  // = computeSeedAtIndex(rootSeed, CHAIN_LENGTH)
export function verifySeedAgainstHash(seed: string, expectedHash: string): Promise<boolean>
  // SHA256(seed) == expectedHash
export function getChainSeedForGame(rootSeed: string, gameNumber: number): Promise<string>
  // Game 1 uses index CHAIN_LENGTH-1, game 2 uses CHAIN_LENGTH-2, etc.
  // = computeSeedAtIndex(rootSeed, CHAIN_LENGTH - gameNumber)
```

### Test file: `src/server/__tests__/hash-chain.test.ts`

**`generateRootSeed`**
- Returns a 64-character hex string
- Two calls return different values (probabilistic, but astronomically unlikely to collide)

**`sha256Hex`**
- Returns a known correct SHA-256 for a fixed input (use NIST test vector)
- Returns a 64-character hex string
- Is deterministic

**`computeSeedAtIndex`**
- Index 0 returns the root seed unchanged
- Index 1 returns `SHA256(rootSeed)`
- Index 2 returns `SHA256(SHA256(rootSeed))`
- Result at index N matches `computeTerminalHash` for `N = CHAIN_LENGTH`

**`verifySeedAgainstHash`**
- Returns `true` when `SHA256(seed) === expectedHash`
- Returns `false` when seed is tampered
- Returns `false` when hash is tampered
- **Property test (fast-check, `numRuns: 1000`):** For any seed, `verifySeedAgainstHash(seed, SHA256(seed))` returns `true`
- **Property test (fast-check, `numRuns: 1000`):** Tamper detection — flipping any single hex character in the seed produces `false`

**`getChainSeedForGame`**
- Game 1 seed verifies against the terminal hash: `SHA256(game1Seed) === terminalHash`
- Game 2 seed verifies against game 1 seed: `SHA256(game2Seed) === game1Seed`
- Each successive game seed is the pre-image of the previous (forming a verifiable chain)
- **Chain integrity test:** For games 1 through 10, the entire chain verifies forward: each `SHA256(seed[k]) === seed[k-1]` (uses a small chain for speed — mock `CHAIN_LENGTH = 10` via vitest module mock)
- Throws if `gameNumber < 1` or `gameNumber > CHAIN_LENGTH`

### Acceptance criteria

- All tests pass
- Chain integrity property: for any root seed with N=10, all 10 seeds verify as a correct chain

---

## Task 1c — `src/client/lib/balance.ts` and `src/client/lib/verify.ts`

**Agent: 1**
**Dependencies:** Task 0c (imports types from `src/types.ts`)

### `balance.ts` exports

`RoundResult` is imported from `src/types.ts` (Task 0c) — do not redefine locally.

```ts
import type { RoundResult } from '../../types';

export function getOrCreatePlayerId(): string
  // Reads from localStorage 'crashPlayerId', generates UUID v4 if absent, persists and returns
export function getBalance(): number
  // Reads 'crashBalance' from localStorage, returns 0 if absent
export function applyBet(wager: number): number
  // balance -= wager, persists, returns new balance
export function applyCashout(payout: number): number
  // balance += payout, persists, returns new balance
export function addHistoryEntry(entry: RoundResult): void
  // Prepends entry to 'crashHistory' in localStorage, trims to 50 entries
export function getHistory(): RoundResult[]
  // Returns stored history, empty array if absent
export function hasPendingResult(roundId: number): boolean
  // Returns true if roundId appears in history (used to detect already-applied results)
```

### `balance.ts` tests: `src/client/lib/__tests__/balance.test.ts`

**`getOrCreatePlayerId`**
- Returns a valid UUID v4 on first call (matches `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`)
- Returns the same UUID on subsequent calls (persistence)
- Different clients get different UUIDs (two fresh calls with cleared storage)

**`getBalance`**
- Returns `0` when localStorage has no `crashBalance`
- Returns stored numeric value
- Returns `0` on corrupted/non-numeric stored value (graceful)

**`applyBet`**
- Reduces balance by wager
- Balance can go negative
- Persists to localStorage
- Returns the new balance

**`applyCashout`**
- Increases balance by payout
- Persists to localStorage
- Returns the new balance

**`addHistoryEntry`**
- Prepends entry (newest first)
- Trims to 50 entries maximum
- Persists to localStorage

**`hasPendingResult`**
- Returns `false` for unknown round ID
- Returns `true` after `addHistoryEntry` with that round ID

---

### `verify.ts` exports

`VerificationResult` is imported from `src/types.ts` (Task 0c) — do not redefine locally.

```ts
import type { VerificationResult } from '../../types';

export async function computeEffectiveSeed(chainSeed: string, drandRandomness: string): Promise<string>
  // HMAC-SHA256(key=drandRandomness, data=chainSeed), returns hex
  // Inputs: both chainSeed and drandRandomness are hex strings (64 chars each)
  // Implementation: decode hex→Uint8Array for both, use SubtleCrypto importKey(raw) + sign(HMAC-SHA256)
  // Note: drandRandomness is the KEY — the uncontrollable external input holds the privileged position
export async function verifyRound(params: {
  roundSeed: string;
  chainCommitment: string;   // SHA256(roundSeed) should equal this
  drandRound: number;
  drandRandomness: string;
  displayedCrashPoint: number;
}): Promise<VerificationResult>
```

### `verify.ts` tests: `src/client/lib/__tests__/verify.test.ts`

**`computeEffectiveSeed`**
- Returns a 64-character hex string
- Is deterministic for the same inputs
- **Concrete test vector** — verify against `openssl dgst -sha256 -hmac` or an HMAC-SHA256 online calculator:
  - `drandRandomness` (key) = `"0000000000000000000000000000000000000000000000000000000000000002"` (hex-decoded to bytes before use)
  - `chainSeed` (data) = `"0000000000000000000000000000000000000000000000000000000000000001"` (hex-decoded to bytes before use)
  - Expected output: compute once with a reference implementation and pin the expected hex string in the test
- Key and data are correctly ordered (drandRandomness is the HMAC key, chainSeed is the data)

**`verifyRound`**
- Returns `{ valid: true }` when all inputs are consistent (chain link valid, crash point matches)
- Returns `{ valid: false, reason: 'chain link invalid' }` when `SHA256(roundSeed) !== chainCommitment`
- Returns `{ valid: false, reason: 'crash point mismatch' }` when derived crash point differs from `displayedCrashPoint`
- Includes `computedCrashPoint`, `chainValid`, `drandRound`, `drandRandomness` in all results

### Acceptance criteria

- All tests pass
- UUID format validated by regex
- HMAC test vector verified against an external HMAC-SHA256 calculator

---

## Task 2 — `src/server/drand.ts`

**Agent: 1**
**Dependencies:** Task 0b

All drand constants (`DRAND_CHAIN_HASH`, `DRAND_GENESIS_TIME`, `DRAND_PERIOD_SECS`, `DRAND_BASE_URL`, `DRAND_FETCH_TIMEOUT_MS`) are imported from `src/config.ts`. This module contains only functions.

### Exports

```ts
export interface DrandBeacon {
  round: number;
  randomness: string;   // 64-char hex
  signature: string;
}

export class DrandFetchError extends Error {}

export function getCurrentDrandRound(nowMs?: number): number
  // floor((nowMs/1000 - GENESIS_TIME) / PERIOD) + 1
  // Uses Date.now() if nowMs not provided

export function drandRoundTime(round: number): number
  // Unix timestamp (seconds) when this round was produced
  // = GENESIS_TIME + (round - 1) * PERIOD

export async function fetchDrandBeacon(
  round: number,
  timeoutMs?: number   // default 2000
): Promise<DrandBeacon>
  // Fetches /public/{round}, falls back to /public/latest on failure
  // Throws DrandFetchError if both fail

export async function computeEffectiveSeedFromBeacon(
  chainSeed: string,
  beacon: DrandBeacon
): Promise<string>
  // HMAC-SHA256(key=beacon.randomness, data=chainSeed)
  // Note: beacon.randomness is the KEY — matches the trust model in the spec
  // Returns hex string
```

### Test file: `src/server/__tests__/drand.test.ts`

All tests mock `fetch` using Vitest's `vi.stubGlobal('fetch', ...)`.

**`getCurrentDrandRound`**
- Returns round 1 at genesis time
- Returns correct round at genesis + 1 period
- Returns correct round at genesis + 2.5 periods (floor behavior)
- Is consistent with `drandRoundTime`: `drandRoundTime(getCurrentDrandRound(t)) <= t/1000 < drandRoundTime(getCurrentDrandRound(t) + 1)`

**`drandRoundTime`**
- Returns `GENESIS_TIME` for round 1
- Returns `GENESIS_TIME + PERIOD` for round 2
- Is the inverse of `getCurrentDrandRound` (at round boundaries)

**`fetchDrandBeacon`**
- Calls `{DRAND_BASE_URL}/public/{round}` on the first attempt
- Returns parsed `DrandBeacon` on success (round, randomness, signature present)
- Falls back to `/public/latest` when the primary request returns non-200
- Falls back to `/public/latest` when the primary request times out (mock a slow fetch)
- Throws `DrandFetchError` when both requests fail
- Throws `DrandFetchError` when both requests time out
- Passes `AbortSignal` with 2s timeout to the fetch call (verify via mock)

**`computeEffectiveSeedFromBeacon`**
- Returns a 64-character hex string
- Is deterministic for same inputs
- **Concrete test vector** — use the same fixed values as `verify.ts` test vector above:
  - `chainSeed` = `"0000000000000000000000000000000000000000000000000000000000000001"`
  - `beacon.randomness` = `"0000000000000000000000000000000000000000000000000000000000000002"`
  - Expected output must exactly match the `verify.ts` `computeEffectiveSeed` result (same inputs, same function)
- **Cross-module consistency test:** call both `computeEffectiveSeedFromBeacon(chainSeed, { randomness: drandHex, ... })` and `computeEffectiveSeed(chainSeed, drandHex)` with the same inputs; assert both return identical hex strings
- **Encoding contract:** both `chainSeed` and `beacon.randomness` are 64-char hex strings; implementation decodes hex→`Uint8Array` before passing to SubtleCrypto HMAC; output is re-encoded as hex

### Acceptance criteria

- All tests pass using mocked fetch (no real network calls in tests)
- Timeout is enforced via `AbortSignal`, not `setTimeout`

---

## Task 3 — `src/server/game-state.ts` (GameStateMachine)

**Agent: 1**
**Dependencies:** Tasks 0c, 1a, 1b, 2

This is the core game logic extracted as a pure class for testability.

### Types

All shared types (`Phase`, `Player`, `PlayerSnapshot`, `ServerMessage`, `HistoryEntry`) are imported from `src/types.ts` (Task 0c). `game-state.ts` defines only server-internal state:

```ts
import type { Phase, Player, ServerMessage, HistoryEntry } from '../types';

export interface GameState {
  phase: Phase;
  roundId: number;
  countdown: number;          // ms remaining (WAITING only)
  roundStartTime: number | null;
  crashPoint: number | null;
  crashTimeMs: number | null;
  players: Map<string, Player>; // keyed by playerId
  chainSeed: string | null;     // revealed after crash
  drandRound: number | null;
  drandRandomness: string | null;
  chainCommitment: string;      // SHA256(currentRoundSeed) — the public commitment
}

// OutboundMessage is the internal union used within game-state.ts
// (adds targetPlayerId for directed error messages)
export type OutboundMessage =
  | { broadcast: true; message: ServerMessage }
  | { broadcast: false; targetPlayerId: string; message: ServerMessage }
```

### Exports

```ts
export function createInitialState(chainCommitment: string, roundId?: number): GameState

export function handleJoin(
  state: GameState,
  msg: { playerId: string; name?: string; wager: number; autoCashout: number | null },
  connectionId: string
): { state: GameState; messages: ServerMessage[] }
  // Returns error message if phase !== WAITING or wager <= 0
  // Returns playerJoined broadcast otherwise

export function handleCashout(
  state: GameState,
  playerId: string,
  nowMs: number
): { state: GameState; messages: ServerMessage[] }
  // Returns error if phase !== RUNNING
  // Returns error if player not found or already cashed out
  // Computes payout = floor(wager * multiplier * 100) / 100
  // Returns playerCashedOut broadcast

export function handleTick(
  state: GameState,
  nowMs: number
): { state: GameState; messages: ServerMessage[]; shouldCrash: boolean }
  // Elapsed time = nowMs - state.roundStartTime (wall-clock based, NOT tick count)
  // Computes current multiplier from elapsed time: multiplierAtTime(nowMs - roundStartTime)
  // Processes any auto-cashout targets that have been reached
  // Sets shouldCrash = true if multiplier >= crashPoint

export function handleCrash(
  state: GameState,
  chainSeed: string,
  drandRound: number,
  drandRandomness: string,
  nowMs: number
): { state: GameState; messages: ServerMessage[] }
  // Transitions to CRASHED
  // All non-cashed-out players get payout = 0
  // Broadcasts crashed message with full player results + verification data

export function handleStartingComplete(
  state: GameState,
  crashPoint: number,
  chainSeed: string,
  drandRound: number,
  drandRandomness: string,
  nextChainCommitment: string,
  nowMs: number
): { state: GameState; messages: ServerMessage[] }
  // Transitions STARTING → RUNNING
  // Sets crashPoint, crashTimeMs, roundStartTime

export function handleCountdownTick(
  state: GameState,
  nowMs: number
): { state: GameState; messages: ServerMessage[]; shouldStartRound: boolean }
  // Decrements countdown by 1000ms
  // Sets shouldStartRound = true when countdown reaches 0

export function transitionToWaiting(
  state: GameState,
  nextChainCommitment: string,
  nowMs: number
): { state: GameState; messages: ServerMessage[] }
  // Clears players, sets new round ID, resets countdown to 10000ms

export function buildStateSnapshot(state: GameState): StatePayload
  // Returns the full state snapshot for new connections (history not included here)
```

### Test file: `src/server/__tests__/game-state.test.ts`

**`handleJoin`**
- Accepts valid join during WAITING, returns `playerJoined` broadcast
- Returns error message if phase is STARTING
- Returns error message if phase is RUNNING
- Returns error message if phase is CRASHED
- Returns error message if wager is 0
- Returns error message if wager is negative
- Returns error message if wager is NaN
- Returns error message if player (by playerId) is already in the round
- Defaults name to first 8 chars of playerId if name is absent
- Stores player keyed by playerId in returned state
- `autoCashout: null` is stored correctly
- `autoCashout: 2.5` is stored correctly

**`handleCashout`**
- Returns playerCashedOut with correct payout (wager × multiplier, floored to 2dp)
- Returns error if phase is not RUNNING
- Returns error if playerId not in current round
- Returns error if player already cashed out
- Does not allow cashout at exactly the crash point (uses `multiplier < crashPoint`)
- Marks player as cashed out in returned state

**`handleTick`**
- Elapsed time computed as `nowMs - state.roundStartTime` (wall-clock, not tick count)
- Computes correct multiplier for elapsed time
- Triggers auto-cashout for all players whose target has been reached
- Auto-cashout uses the player's exact target multiplier (not the tick multiplier): `payout = floor(wager * player.autoCashout * 100) / 100`
- **Precision test:** tick crosses from 2.49 → 2.51 with autoCashout=2.50; player receives payout at exactly 2.50x, not 2.51x
- Multiple auto-cashouts in a single tick are all processed
- Sets `shouldCrash: true` when multiplier >= crashPoint
- Sets `shouldCrash: false` when multiplier < crashPoint
- Players already cashed out are not re-processed

**`handleCrash`**
- All non-cashed-out players have payout = 0
- Already-cashed-out players retain their payout
- Broadcasts `crashed` message with `crashPoint`, `roundSeed`, `drandRound`, `drandRandomness`
- All player outcomes are included in the crashed message
- Phase transitions to CRASHED

**`handleStartingComplete`**
- Phase transitions to RUNNING
- Sets `crashPoint` and `roundStartTime`
- Does NOT reveal crash point in any broadcast message (it's server-internal)

**`handleCountdownTick`**
- Decrements countdown by ~1000ms
- Sets `shouldStartRound: true` when countdown reaches 0 or below
- Broadcasts updated countdown in state message

**`transitionToWaiting`**
- Clears all players
- Increments roundId
- Resets countdown to 10,000ms
- Phase is WAITING

**Round lifecycle integration test**
- Full sequence: WAITING → handleJoin (2 players) → countdown ticks → STARTING → RUNNING → handleTick (many) → auto-cashout for player 1 → handleCrash → check player 1 has payout, player 2 has payout 0 → WAITING again

### Acceptance criteria

- All tests pass
- No side effects (all functions return new state without mutating input)
- `handleCashout` payout is always floor(wager × multiplier × 100) / 100

---

## Task 4 — `src/server/crash-game.ts` (CrashGame Durable Object)

**Agent: 1**
**Dependencies:** Task 3

This is the DO orchestration layer. It owns storage, alarms, and WebSocket connections. All logic is delegated to `GameStateMachine`.

### DO Test Scope Note

`@cloudflare/vitest-pool-workers` runs code in a real `workerd` runtime, but **you cannot inspect the DO's in-memory state or storage from outside the DO boundary**. You can only observe what it returns over HTTP or WebSocket. DO tests are therefore HTTP-level integration tests, not unit tests of `crash-game.ts` internals.

For this reason, `crash-game.ts` exposes a **debug HTTP endpoint** (`GET /?debug=true`) that returns a JSON snapshot of internal state. This endpoint must be gated behind a `CRASH_DEBUG` environment variable so it is never active in production:

```ts
// In CrashGame.onFetch (or fetch handler):
if (url.searchParams.get('debug') === 'true' && env.CRASH_DEBUG === 'true') {
  return Response.json({
    phase: this.gameState.phase,
    roundId: this.gameState.roundId,
    countdown: this.gameState.countdown,
    playerCount: this.gameState.players.size,
    gameNumber: this.gameNumber,
  });
}
```

In `wrangler.toml` (dev only), set `[vars] CRASH_DEBUG = "true"`. Never set this in production.

All DO integration tests use this endpoint for state assertions rather than parsing WebSocket message streams.

### Responsibilities

- `onStart`: load persisted state (rootSeed, gameNumber, history, chainCommitment) from DO storage; initialize GameState; start alarm loop if no alarm is set
- `onConnect`: send state snapshot + history to new connection
- `onMessage`: parse JSON, route to handleJoin or handleCashout on GameStateMachine, broadcast results
- `onAlarm`: drive countdown ticks, initiate STARTING phase (fetch drand), tick during RUNNING, transition CRASHED→WAITING
- `onClose`: if player had an active (non-cashed-out) bet during RUNNING, their auto-cashout remains active; no-op otherwise
- Persist `gameNumber` and `rootSeed` to storage after each round

### Pending payouts (auto-cashout on disconnect)

The DO maintains a `pendingPayouts: Map<string, RoundResult>` keyed by `playerId`. When a disconnected player's auto-cashout triggers, the result is stored here. When that `playerId` connects again (sends a `join` with the same `playerId`), the DO sends them a `pendingPayout` message before the join is processed.

Add to server → client protocol:
```json
{
  "type": "pendingPayout",
  "roundId": 41,
  "wager": 100,
  "payout": 185,
  "cashoutMultiplier": 1.85,
  "crashPoint": 2.37
}
```

### Test file: `src/server/__tests__/workers/crash-game.do.test.ts`

Uses `@cloudflare/vitest-pool-workers`. Tests use HTTP requests + the `?debug=true` endpoint for state assertions. WebSocket-heavy scenarios are tested through `GameStateMachine` pure function tests (Task 3) instead.

**Storage and initialization**
- On first DO request (no stored state), `GET /?debug=true` returns `phase: "WAITING"` and a valid `chainCommitment`
- Posting a round-start HTTP trigger: game number increments in debug snapshot
- `GET /?debug=true` after second DO initialization (storage seeded) restores same game number

**Round start and phase transitions (HTTP flows)**
- `POST /debug/start-waiting` (test-only route) — triggers WAITING → STARTING transition
- After trigger + mocked drand, `GET /?debug=true` shows `phase: "RUNNING"`
- After crash alarm (manually triggered via `POST /debug/trigger-crash`), phase is `"CRASHED"`
- After crashed display delay, phase returns to `"WAITING"` and roundId has incremented

**Join and error handling (HTTP + WebSocket)**
- WebSocket connection receives `state` message with `phase: "WAITING"`
- Sending `join` via WebSocket during WAITING: debug endpoint shows `playerCount: 1`
- Sending `join` during RUNNING: WebSocket receives `error` message; `playerCount` unchanged
- **STARTING phase isolation:** trigger WAITING → STARTING (drand mocked to delay 500ms); during the delay, send `join` via WebSocket; verify player receives `error` and `playerCount` remains 0 — confirms `blockConcurrencyWhile` is active

**Persistence across restart (MVP: abandon in-progress round)**
- Seed a round, note game number from debug endpoint
- Force DO eviction (destroy + recreate DO instance)
- Reconnect, `GET /?debug=true` — game number, chainCommitment match (loaded from storage)
- If eviction happened mid-RUNNING: DO restarts in WAITING phase (round abandoned); `gameNumber` unchanged until next round completes

**Void round**
- Mock drand to fail both attempts; trigger WAITING → STARTING
- DO transitions directly to WAITING; game number unchanged in debug snapshot
- No `crashed` message broadcast; no `roundSeed` revealed
- Next round reuses the same chain seed (verify chainCommitment unchanged)

**Pending payout delivery**
- `pendingPayouts` are stored in DO durable storage (`this.ctx.storage.put('pendingPayouts', serializedMap)`), not in-memory Map — survives DO hibernation
- Player joins + auto-cashout set; player WebSocket closes; trigger crash; debug snapshot shows pendingPayouts count = 1
- Same playerId reconnects; first message is `pendingPayout`; pendingPayouts count drops to 0

**Debug endpoint security**
- `GET /?debug=true` response NEVER includes `crashPoint`, `chainSeed`, or `drandRandomness` — add a test asserting these keys are absent from the response even when the round is in RUNNING or CRASHED phase

### Acceptance criteria

- All tests pass in `@cloudflare/vitest-pool-workers` environment
- `CRASH_DEBUG=true` is set in test environment via `wrangler.toml` `[vars]`
- DO restarts cleanly from storage (verified via eviction test)
- `blockConcurrencyWhile` isolation test passes — join during STARTING returns error
- No WebSocket multiplexing tests — covered by Task 3 GameStateMachine pure tests

---

## Task 5 — `src/server/index.ts` (Worker entry)

**Agent: 1**
**Dependencies:** Task 4

### Responsibilities

- Export `CrashGame` Durable Object class
- `fetch` handler routes WebSocket upgrades to the `CrashGame` DO via `routePartykitRequest`
- Non-WebSocket requests for unmatched paths return static assets (handled by Cloudflare Workers static asset binding automatically)

### Test file: `src/server/__tests__/workers/index.test.ts`

- WebSocket upgrade request to `/parties/CrashGame/crash-main` is routed to the DO
- HTTP GET to `/` returns 200 (served from static assets)
- Unknown API path returns 404

### Acceptance criteria

- `wrangler dev` starts without errors
- WebSocket connection via `wscat` reaches the DO

---

## Task 6 — `src/client/lib/stores.ts`, `socket.ts`, `messageHandler.ts`, `commands.ts`

**Agent: 1**
**Dependencies:** Task 0c (imports `Phase`, `PlayerSnapshot`, `GameStateSnapshot`, `HistoryEntry` from `src/types.ts`)

This task implements four focused modules instead of a monolithic `socket.ts`. See spec Section 8 for rationale.

### `stores.ts`

```ts
import { writable, derived } from 'svelte/store';
import type { Phase, PlayerSnapshot, GameStateSnapshot, HistoryEntry } from '../../types';

export const gameState = writable<GameStateSnapshot | null>(null);
// Players keyed by playerId for O(1) lookup on playerJoined/playerCashedOut updates
export const players = writable<Record<string, PlayerSnapshot>>({});
export const history = writable<HistoryEntry[]>([]);
export const phase = derived(gameState, $s => ($s?.phase ?? 'WAITING') as Phase);
export const countdown = derived(gameState, $s => $s?.countdown ?? 10000);
// writable instead of tweened — CSS transition handles animation; see multiplierAnimating
export const displayMultiplier = writable(1.0);
export const multiplierAnimating = writable(false);
export const myPlayerId = writable<string>('');
export const balance = writable<number>(0);
// 'reconnecting' covers PartySocket's exponential-backoff retry state (disconnect → reconnect attempt)
export const connectionStatus = writable<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('connecting');
// Derived store for components that iterate the players Record
export const playersList = derived(players, $p => Object.values($p));
export const isInRound = derived(
  [phase, players, myPlayerId],
  ([$phase, $players, $id]) =>
    ($phase === 'RUNNING' || $phase === 'STARTING') &&
    $id in $players &&
    !$players[$id].cashedOut
);
```

### `socket.ts`

Owns the `PartySocket` instance — nothing else. Exports:
```ts
export function connect(): void       // creates PartySocket, imports handleMessage from messageHandler.ts, wires socket.onmessage
export function disconnect(): void    // closes and nulls the socket
export function getRawSocket(): PartySocket | null
```

**No circular import:** `socket.ts` imports `handleMessage` from `messageHandler.ts`. `messageHandler.ts` does NOT import from `socket.ts`. `commands.ts` imports `getRawSocket` from `socket.ts`.

Wiring inside `connect()`:
```ts
socket.addEventListener('message', (e) => handleMessage(JSON.parse(e.data)));
```

Connection state transitions:
- `connect()` called → `connectionStatus('connecting')`
- socket `open` event → `connectionStatus('connected')`
- socket `close` event (PartySocket retrying) → `connectionStatus('reconnecting')`, `multiplierAnimating(false)`
- socket `open` event after reconnect → `connectionStatus('connected')`
- `disconnect()` called explicitly → `connectionStatus('disconnected')`

### `messageHandler.ts`

Maps incoming server messages to store updates. No socket import — receives parsed messages only. Pure function, easy to unit test.

```ts
export function handleMessage(msg: ServerMessage): void
```

Routing:
- `state` → update `gameState`, set `players` from snapshot array (converted to Record keyed by playerId)
- `tick` → set `multiplierAnimating(true)`, `displayMultiplier.set(msg.multiplier)`
- `crashed` → set `multiplierAnimating(false)`, then `displayMultiplier.set(msg.crashPoint)`, update `players` with outcomes, append to `history`
- `playerJoined` → add player to `players` Record
- `playerCashedOut` → update matching player in `players` Record
- `pendingPayout` → dispatches `new CustomEvent('crash:pendingPayout', { detail: msg })` on `document`; App.svelte registers `document.addEventListener('crash:pendingPayout', ...)` in `onMount` and removes in `onDestroy`
- `error` → dispatches `new CustomEvent('crash:error', { detail: { message: msg.message } })` on `document`; BetForm.svelte listens for this event to display inline error messages

### `commands.ts`

Thin wrappers that serialize client messages and write to the socket. Imports `getRawSocket()` from `socket.ts` and `get(myPlayerId)` from stores.

```ts
export function sendJoin(wager: number, name: string, autoCashout: number | null): void
export function sendCashout(): void
```

### Test file: `src/client/lib/__tests__/stores.test.ts`

- `phase` derived store reflects `gameState` phase
- `countdown` derived store reflects `gameState` countdown
- `displayMultiplier` is a writable (not tweened) — can be set directly
- `multiplierAnimating` starts as `false`
- `connectionStatus` starts as `'connecting'`
- `isInRound` returns `true` only when phase is RUNNING and current playerId is in players Record without cashout
- `isInRound` returns `false` when phase is RUNNING but player is not in Record
- `players` Record lookup is O(1): `$players[playerId]` works directly

### Test file: `src/client/lib/__tests__/messageHandler.test.ts`

No socket mock needed — call `handleMessage()` directly with typed message objects.
- `state` message updates `gameState` store and converts players array to Record
- `tick` message sets `multiplierAnimating` to true and calls `displayMultiplier.set()`
- `crashed` message sets `multiplierAnimating` to false before updating displayMultiplier (snap, not animate)
- `crashed` message sets each player's outcome in the players Record
- `playerJoined` adds new entry to players Record
- `playerCashedOut` updates correct entry in players Record (by id)
- `pendingPayout` dispatches `CustomEvent('crash:pendingPayout')` on `document` with `event.detail` matching the message payload; test listens via `document.addEventListener('crash:pendingPayout', handler)`
- Unknown message type does not throw

### Test file: `src/client/lib/__tests__/socket.test.ts`

Mock `partysocket`. Verify:
- `connect()` creates a `PartySocket` with correct host/room/party params
- `connect()` sets `connectionStatus` to `'connecting'`
- Socket `open` event sets `connectionStatus` to `'connected'`
- Socket `close` event sets `connectionStatus` to `'disconnected'` and `multiplierAnimating` to `false`
- Incoming messages are forwarded to `handleMessage()`
- `disconnect()` closes the socket

### Test file: `src/client/lib/__tests__/commands.test.ts`

Mock `getRawSocket()` to return a fake socket with a `send` spy.
- `sendJoin()` sends correctly structured JSON with playerId from `get(myPlayerId)`
- `sendCashout()` sends `{ type: 'cashout' }`

### Acceptance criteria

- All tests pass
- No real WebSocket connections in tests (all mocked)
- `players` is a `Record<string, PlayerSnapshot>` throughout — no array iteration for lookup

---

## Tasks 7a–7f — Svelte Components

Each component can be implemented by a separate agent in parallel. All depend on Task 6 (stores).

Use `@testing-library/svelte` for all component tests.

---

### Task 7a — `Multiplier.svelte`

**Props:** none (reads `displayMultiplier`, `multiplierAnimating`, and `phase` from stores)

**Tests:**
- Renders `1.00x` initially
- Updates displayed value when `displayMultiplier` store changes
- Applies a CSS `animating` class when `multiplierAnimating` is true (enables CSS transition)
- Does NOT apply the `animating` class when `multiplierAnimating` is false (no transition on crash snap)
- **Mid-flight interrupt:** set `multiplierAnimating(true)` then immediately set `multiplierAnimating(false)` and update `displayMultiplier`; verify the `animating` class is absent and the displayed value is the new one (no lingering transition class)
- Applies a "live" CSS class during `RUNNING` phase
- Applies a "crashed" CSS class during `CRASHED` phase
- Shows "STARTING..." text during `STARTING` phase instead of a multiplier value

---

### Task 7b — `BetForm.svelte` and `CashoutButton.svelte`

Splitting the former `Controls.svelte` into two focused components reduces conditional logic and makes each component independently testable.

**`BetForm.svelte` props:** none (reads `phase` store, calls `sendJoin` from commands.ts)

**`BetForm.svelte` tests:**
- Renders wager input and join button only during WAITING
- Hidden (or not rendered) during STARTING, RUNNING, CRASHED
- Join button disabled when wager is empty or 0
- Auto-cashout input is optional (empty = no auto-cashout, sends `null`)
- Clicking join calls `sendJoin` with correct wager, name, autoCashout
- Error messages dispatched via DOM event are displayed inside the form

**`CashoutButton.svelte` props:** none (reads `phase` and `isInRound` stores, calls `sendCashout`)

**`CashoutButton.svelte` tests:**
- Button visible and enabled during RUNNING when `isInRound` is true
- Button hidden or disabled when not RUNNING
- Button hidden or disabled when `isInRound` is false (player not in round)
- Clicking cashout calls `sendCashout`

---

### Task 7c — `GameStatus.svelte`

**Props:** none (reads stores)

**Tests:**
- Shows countdown in seconds during WAITING
- Shows "Round starting..." during STARTING
- Shows "LIVE" indicator during RUNNING
- Shows crash point (e.g. "Crashed at 2.37x") during CRASHED
- Shows "No players" note when player list is empty during CRASHED

---

### Task 7d — `PlayerList.svelte`

**Props:** none (reads `players` and `myPlayerId` from stores)

**Tests:**
- Renders one row per player
- Shows player name and wager
- Shows cashout multiplier for cashed-out players
- Shows "Lost" for non-cashed-out players after crash (CRASHED phase)
- Highlights the current player's row (matching myPlayerId)
- Shows "Auto: Nx" badge if autoCashout is set (note: autoCashout is not broadcast in spec — see clarification below)
- Empty list renders without error

**Clarification:** `playerJoined` includes `autoCashout` in the spec. Displaying it is a UX decision — it tells other players your exit strategy. Include it for MVP.

---

### Task 7e — `History.svelte`

**Props:** none (reads `history` from stores)

**Tests:**
- Renders one row per history entry
- Shows round ID and crash point
- Most recent round is first
- Empty history renders without error
- Each entry has a "Verify" button that opens `VerifyModal` with the round's data

---

### Task 7f — `VerifyModal.svelte`

**Props:** `entry: HistoryEntry` (round seed, chain commitment, drand round, crash point)

**Tests:**
- Initially shows input fields pre-filled with round data
- "Verify" button triggers `verifyRound()` from `verify.ts`
- Shows "✓ Verified" with computed crash point on success
- Shows "✗ Chain link invalid" on chain mismatch
- Shows "✗ Crash point mismatch" on derivation mismatch
- Shows loading state while verification is in progress
- Close button dismisses modal

---

## Task 8 — `App.svelte`

**Dependencies:** Tasks 7a–7f, Task 5

Root component. Composes all child components. Manages WebSocket lifecycle.

### Responsibilities

- On mount: call `getOrCreatePlayerId()`, set `myPlayerId` store, load `getBalance()` into balance store, call `connect()`
- On destroy: call `disconnect()`
- On `pendingPayout` DOM event (dispatched by messageHandler): call `applyCashout(payout)`, update balance store, show toast notification, call `addHistoryEntry` so the round is not double-applied
- On `crashed` DOM event: look up own playerId in the crashed players list; if found and round not already in history (`hasPendingResult(roundId)` returns false), call `applyCashout(payout)` or simply call `addHistoryEntry` for a loss (wager already deducted at join)

**`hasPendingResult` race note:** The spec's `hasPendingResult` check is necessary because a player may receive both a `pendingPayout` (from a previous session's auto-cashout) and a `crashed` message for the same round in the same reconnection. The localStorage history check prevents double-counting. The server balance field in `state`/`crashed` messages (if added in future) would make this check unnecessary — but for MVP, the localStorage guard is sufficient.

### Layout

```
┌─────────────────────────────────────┐
│  GameStatus     Balance: +42.50     │
├─────────────────────────────────────┤
│                                     │
│         Multiplier (big)            │
│                                     │
├─────────────────────────────────────┤
│  BetForm (WAITING only)             │
│  CashoutButton (RUNNING + isInRound)│
├─────────────────────────────────────┤
│  PlayerList                         │
├─────────────────────────────────────┤
│  History (recent rounds)            │
└─────────────────────────────────────┘
```

### Tests

- Calls `connect()` on mount
- Calls `disconnect()` on destroy
- Displays balance from balance store
- Shows `pendingPayout` toast when message received
- Balance updates correctly on `crashed` message for own player

### Acceptance criteria

- Page renders in browser without console errors
- WebSocket connects on load
- Join → cashout flow works end-to-end in `wrangler dev`

---

## Task 9 — E2E Smoke Test

**Dependencies:** Task 8, running `wrangler dev`

This is a manual checklist, not an automated test.

### Checklist

- [ ] Page loads at `http://localhost:8787`
- [ ] Countdown visible, counting down from 10
- [ ] Can enter wager and click Join
- [ ] Player appears in player list
- [ ] "Round starting..." appears briefly after countdown
- [ ] Multiplier begins climbing from 1.00x
- [ ] Cashout button is clickable during RUNNING
- [ ] Clicking cashout updates player row with cashout multiplier
- [ ] Crash occurs, results screen shows 5 seconds
- [ ] New WAITING phase begins
- [ ] History shows the completed round
- [ ] "Verify" opens modal, shows "✓ Verified" for the round
- [ ] Balance reflects net position correctly
- [ ] Refresh page, balance and playerId are preserved from localStorage
- [ ] Open two browser tabs — both show same game state
- [ ] Auto-cashout: set target 2x, join, do not click cashout manually — confirm auto-cashout triggers at 2x

---

## Post-Implementation Review Checklist

After all tasks are complete, the reviewing agent should verify:

### Correctness

- [ ] `npm run test:all` — all tests pass
- [ ] `npm run typecheck` — zero TypeScript errors
- [ ] `npm run typecheck:server` — zero errors with server tsconfig (no DOM leakage)
- [ ] `npm run lint` — Biome reports no lint errors
- [ ] `npm run test:coverage` — coverage thresholds met (90% lines/functions, 80% branches on pure modules)
- [ ] `npm run build:client` — Vite build succeeds, no warnings
- [ ] Statistical test: run `deriveCrashPoint` on 100,000 random inputs, verify house edge is within ±0.1% of 1%
- [ ] Property tests pass — fast-check reports no counterexamples after 1,000 runs (`numRuns: 1000` set in all property tests)
- [ ] HMAC-SHA256 test vectors verified: run `openssl dgst -sha256 -mac HMAC -macopt hexkey:<drand_hex> -` with chainSeed as data; pin expected output and assert match in test
- [ ] SHA-256 chain test vectors verified against NIST test vectors in hash-chain.test.ts
- [ ] Cross-module HMAC check: `computeEffectiveSeedFromBeacon` (server) and `computeEffectiveSeed` (client) return identical output for same inputs

### Protocol compliance (check against spec Section 6)

- [ ] All server→client message types present: `state`, `tick`, `crashed`, `playerJoined`, `playerCashedOut`, `error`, `pendingPayout`
- [ ] `state` message includes: `phase`, `roundId`, `countdown`, `multiplier`, `elapsed`, `crashPoint` (null during RUNNING), `players`, `chainCommitment`, `drandRound` (null until CRASHED), `history`
- [ ] `crashed` message includes: `crashPoint`, `elapsed`, `roundSeed`, `drandRound`, `drandRandomness`, `players` (full outcomes)
- [ ] `join` message requires `playerId` field
- [ ] `join` messages during STARTING/RUNNING/CRASHED return error, not silent drop

### Security properties

- [ ] `crashPoint` does not appear in any message until the CRASHED phase
- [ ] `chainSeed` (roundSeed) does not appear in any message until CRASHED
- [ ] `crashPoint` is not stored in the `state` message during RUNNING
- [ ] STARTING phase uses `blockConcurrencyWhile()` — not a bare `await`
- [ ] HMAC ordering: `computeEffectiveSeedFromBeacon` uses `key=beacon.randomness, data=chainSeed`
- [ ] STARTING phase transitions correctly: bets locked before drand fetch begins

### Auto-cashout precision

- [ ] Auto-cashout uses exact player target multiplier, not the tick multiplier
- [ ] Payout = `floor(wager × autoCashout × 100) / 100` (not `wager × currentMultiplier`)
- [ ] A disconnected player's auto-cashout still fires server-side

### Hash chain

- [ ] `SHA256(game1Seed) === terminalHash` — chain verifiable from first game
- [ ] Each successive game seed is pre-image of previous: `SHA256(gameNSeed) === game(N-1)Seed`
- [ ] `gameNumber` does NOT increment on void round
- [ ] Chain rotates correctly when `gameNumber === CHAIN_LENGTH`

### Persistence

- [ ] `rootSeed`, `gameNumber`, `chainCommitment`, `history` survive DO eviction (written to storage after each round)
- [ ] DO restart begins a fresh WAITING phase without losing round history
- [ ] `playerId` and `balance` persist across browser refresh

### Client balance accounting

- [ ] `applyBet` is called when join is accepted (not when join is submitted)
- [ ] `applyCashout` is called exactly once per round per player (idempotent via `hasPendingResult`)
- [ ] Loss (no cashout) results in no balance change after `applyBet` (wager already deducted)

---

## Known Gaps / Future Work

Items explicitly deferred from MVP scope:

- BLS signature verification of drand beacons (currently trust the Cloudflare relay)
- Player seed contribution (beyond drand mixing)
- Server-side balance tracking and anti-cheat
- Round history persistence beyond the last 20 rounds
- Chat
- Multiplier chart / curve visualization
- Sound design
- Mobile-responsive layout
- Multi-room / concurrent games
