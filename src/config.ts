/**
 * Central configuration for the Crash Game. All tunable constants live here.
 *
 * Note: `HOUSE_EDGE` is used in `src/server/crash-math.ts` but the equivalent
 * value is hardcoded as `99` in `src/client/lib/verify.ts`. Both files must
 * be updated in sync when changing the house edge.
 *
 * @see docs/project-architecture.md §1.5
 */
// ─── Game loop timing ────────────────────────────────────────────────────────
export const WAITING_DURATION_MS = 10_000; // Countdown before each round
export const CRASHED_DISPLAY_MS = 5_000; // Results screen duration
export const TICK_INTERVAL_MS = 100; // Server broadcast interval during RUNNING
export const COUNTDOWN_TICK_MS = 1_000; // Server broadcast interval during WAITING

// ─── Multiplier curve ────────────────────────────────────────────────────────
/** e^(GROWTH_RATE * t) — places 2x at ~11.5s, 3x at ~18.3s */
export const GROWTH_RATE = 0.00006;

// ─── House edge ──────────────────────────────────────────────────────────────
/** Fraction of wagers retained by the house. 0.01 = 1%. Encoded as (1 - HOUSE_EDGE) * 100 in crash formula. */
export const HOUSE_EDGE = 0.01;

// ─── Hash chain ──────────────────────────────────────────────────────────────
export const CHAIN_LENGTH = 10_000;
/** Generate a new chain when this many games remain */
export const CHAIN_ROTATION_THRESHOLD = 100;

// ─── drand quicknet ──────────────────────────────────────────────────────────
export const DRAND_CHAIN_HASH = '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971';
export const DRAND_GENESIS_TIME = 1_692_803_367; // Unix seconds
export const DRAND_PERIOD_SECS = 3;
export const DRAND_BASE_URL = `https://drand.cloudflare.com/${DRAND_CHAIN_HASH}`;
export const DRAND_FETCH_TIMEOUT_MS = 2_000;

// ─── Input validation ────────────────────────────────────────────────────────
/** Maximum length of a playerId string (DoS prevention). */
export const MAX_PLAYER_ID_LENGTH = 256;

// ─── Game room ───────────────────────────────────────────────────────────────
export const ROOM_ID = 'crash-main';

// ─── Server state ────────────────────────────────────────────────────────────
/** Number of completed rounds kept in the history broadcast */
export const HISTORY_LENGTH = 20;

// ─── Client ──────────────────────────────────────────────────────────────────
/** Maximum rounds kept in localStorage history */
export const CLIENT_HISTORY_LIMIT = 50;
// Note: multiplier animation is handled via CSS transition matching TICK_INTERVAL_MS,
// not a tweened store. The CSS duration is set directly in Multiplier.svelte as:
//   transition: all ${TICK_INTERVAL_MS}ms linear;
