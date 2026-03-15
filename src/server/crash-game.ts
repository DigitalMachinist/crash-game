/**
 * `CrashGame` Durable Object — the authoritative game server.
 *
 * Extends `partyserver.Server` to handle WebSocket connections, the game alarm
 * loop, and HTTP debug requests. Delegates all pure state transitions to
 * `game-state.ts` and uses `hash-chain.ts`, `drand.ts`, and `crash-math.ts`
 * for provably fair seed and crash point computation.
 *
 * @see docs/project-architecture.md §1.4
 * @see docs/game-state-machine.md
 */
import { type Connection, type ConnectionContext, Server } from 'partyserver';
import {
  CHAIN_LENGTH,
  CHAIN_ROTATION_THRESHOLD,
  COUNTDOWN_TICK_MS,
  CRASHED_DISPLAY_MS,
  MAX_PENDING_PAYOUTS,
  TICK_INTERVAL_MS,
  WAITING_DURATION_MS,
} from '../config';
import type { DrandBeacon, GameStateSnapshot, ServerMessage } from '../types';
import { deriveCrashPoint } from './crash-math';
import { computeEffectiveSeedFromBeacon, fetchDrandBeacon, getCurrentDrandRound } from './drand';
import {
  buildStateSnapshot,
  createInitialState,
  type GameState,
  handleCashout,
  handleCountdownTick,
  handleCrash,
  handleJoin,
  handleStartingComplete,
  handleTick,
  type OutboundMessage,
  type RoundIngredients,
  transitionToWaiting,
} from './game-state';
import {
  computeNextChainCommitment,
  computeTerminalHash,
  generateRootSeed,
  getChainSeedForGame,
} from './hash-chain';
import { isValidClientMessage, isValidStoredGameData } from './validation';

interface Env {
  CRASH_DEBUG?: string;
}

interface PendingPayout {
  roundId: number;
  wager: number;
  payout: number;
  cashoutMultiplier: number;
  crashPoint: number;
}

export class CrashGame extends Server<Env> {
  private gameState!: GameState;
  private rootSeed!: string;
  private gameNumber!: number;
  /** Transient in-memory map; lost on DO eviction. Scoped to DO lifetime (~5 min idle). */
  private pendingPayouts: Map<string, PendingPayout> = new Map();
  /** Maps connectionId → playerId to support cashout from reconnected connections. [Phase 4.6] */
  private connectionToPlayer: Map<string, string> = new Map();
  private cachedSnapshot: GameStateSnapshot | null = null;

  /** Invalidates the cached snapshot so the next read rebuilds from current state. */
  private invalidateSnapshot(): void {
    this.cachedSnapshot = null;
  }

  /** Returns cached snapshot if valid; otherwise rebuilds and caches it. */
  private getSnapshot(): GameStateSnapshot {
    if (this.cachedSnapshot === null) {
      this.cachedSnapshot = buildStateSnapshot(this.gameState, Date.now());
    }
    return this.cachedSnapshot;
  }

  // partyserver calls this when the DO is initialized (replaces constructor)
  override async onStart(): Promise<void> {
    try {
      // Load persisted state, validating structure before use [High-3]
      const stored = await this.ctx.storage.get('gameData');

      if (stored && isValidStoredGameData(stored)) {
        this.rootSeed = stored.rootSeed;
        this.gameNumber = stored.gameNumber;
        this.pendingPayouts = new Map(stored.pendingPayouts ?? []);
        this.gameState = createInitialState(stored.chainCommitment, stored.gameNumber + 1);
        this.gameState = { ...this.gameState, history: stored.history ?? [] };
      } else {
        if (stored) {
          console.warn('CrashGame: stored state failed validation, reinitializing from scratch');
        }
        // First run or corrupted state — generate hash chain
        this.rootSeed = generateRootSeed();
        this.gameNumber = 0;
        const terminalHash = await computeTerminalHash(this.rootSeed);
        this.gameState = createInitialState(terminalHash);
        await this.persistState();
      }

      // Start the alarm loop if not already running, or if the stored alarm is stale (past timestamp from a previous wrangler dev run)
      const alarm = await this.ctx.storage.getAlarm();
      const now = Date.now();
      if (alarm === null || alarm <= now) {
        await this.ctx.storage.setAlarm(now + COUNTDOWN_TICK_MS);
      }
    } catch (error) {
      console.error('CrashGame initialization failed:', error);
      // Attempt to initialize fresh state so the game loop can continue [Backend-3]
      try {
        this.rootSeed = generateRootSeed();
        this.gameNumber = 0;
        const terminalHash = await computeTerminalHash(this.rootSeed);
        this.gameState = createInitialState(terminalHash);
        await this.persistState();
        const now = Date.now();
        await this.ctx.storage.setAlarm(now + COUNTDOWN_TICK_MS);
      } catch (fallbackError) {
        // If even fresh initialization fails, log and let the DO restart naturally
        console.error('CrashGame fallback initialization also failed:', fallbackError);
      }
    }
  }

  override async onConnect(conn: Connection, ctx: ConnectionContext): Promise<void> {
    // Register connection→player mapping immediately if playerId is in the URL query string.
    // This lets reconnecting players cashout without re-sending a join. [Phase 4.6]
    const url = new URL(ctx.request.url);
    const playerId = url.searchParams.get('playerId');
    if (playerId && this.gameState.players.has(playerId)) {
      this.connectionToPlayer.set(conn.id, playerId);
    }

    // Send current game state snapshot to the newly connected client (use cache)
    const snapshot = this.getSnapshot();
    conn.send(JSON.stringify({ type: 'state', ...snapshot } satisfies ServerMessage));
  }

  override async onMessage(conn: Connection, message: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
      conn.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' } satisfies ServerMessage));
      return;
    }

    // Runtime validation — reject malformed messages before processing [High-1][High-4]
    if (!isValidClientMessage(parsed)) {
      console.warn('[onMessage] rejected invalid message', {
        connId: conn.id,
        type:
          typeof parsed === 'object' && parsed !== null
            ? (parsed as Record<string, unknown>).type
            : undefined,
      });
      conn.send(
        JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        } satisfies ServerMessage),
      );
      return;
    }

    const msg = parsed;

    if (msg.type === 'join') {
      // Check for pending payout before processing join
      const pending = this.pendingPayouts.get(msg.playerId);
      if (pending) {
        this.pendingPayouts.delete(msg.playerId);
        conn.send(
          JSON.stringify({
            type: 'pendingPayout',
            ...pending,
          } satisfies ServerMessage),
        );
        await this.persistState();
      }

      const result = handleJoin(
        this.gameState,
        {
          playerId: msg.playerId,
          ...(msg.name !== undefined ? { name: msg.name } : {}),
          wager: msg.wager,
          autoCashout: msg.autoCashout ?? null,
        },
        conn.id,
      );
      this.gameState = result.state;
      const joinSucceeded = result.messages.some(
        (m) => m.broadcast && m.message.type === 'playerJoined',
      );
      // Invalidate cache if state changed (player was added successfully)
      if (joinSucceeded) {
        this.invalidateSnapshot();
      }

      // Update connection→player mapping whenever the player is in the game,
      // including RUNNING-phase reconnects where the join itself is rejected. [Phase 4.6]
      if (this.gameState.players.has(msg.playerId)) {
        this.connectionToPlayer.set(conn.id, msg.playerId);
      }

      // Persist player join so DO eviction does not lose the wager [Backend-1]
      if (joinSucceeded) {
        await this.persistState();
      }

      this.dispatchMessages(result.messages, conn);
    } else if (msg.type === 'cashout') {
      // Resolve playerId via connection mapping to support reconnected players. [Phase 4.6]
      const playerId = this.connectionToPlayer.get(conn.id);
      if (!playerId || !this.gameState.players.has(playerId)) {
        conn.send(
          JSON.stringify({
            type: 'error',
            message: 'Not in current round',
          } satisfies ServerMessage),
        );
        return;
      }

      const result = handleCashout(this.gameState, playerId, Date.now());
      this.gameState = result.state;
      const cashoutSucceeded = result.messages.some(
        (m) => m.broadcast && m.message.type === 'playerCashedOut',
      );
      // Invalidate cache if state changed (cashout was accepted)
      if (cashoutSucceeded) {
        this.invalidateSnapshot();
      }

      // Persist cashout so DO eviction does not lose the payout record [Backend-2]
      if (cashoutSucceeded) {
        await this.persistState();
      }

      this.dispatchMessages(result.messages, conn);
    }
  }

  /**
   * Intentional no-op. Disconnected players' entries persist in `gameState.players`
   * so that server-side auto-cashout processing continues to fire on every alarm
   * tick. If an auto-cashout fires for a disconnected player, the payout is stored
   * in `pendingPayouts` (keyed by `playerId`) and delivered on their next `join`.
   *
   * @see docs/game-state-machine.md §3.5
   */
  override onClose(conn: Connection, _code: number, _reason: string, _wasClean: boolean): void {
    // Clean up the connection→player mapping. [Phase 4.6]
    // The player entry persists in gameState.players so auto-cashout continues to fire.
    this.connectionToPlayer.delete(conn.id);
  }

  /**
   * Game loop driver. Dispatches to the appropriate phase handler:
   * - WAITING → `handleCountdownTick`; triggers `startRound` when countdown = 0.
   * - STARTING → safety reschedule (alarm fired while `blockConcurrencyWhile` in progress).
   * - RUNNING → `handleTick`; triggers `crashRound` when multiplier ≥ crashPoint.
   * - CRASHED → `beginNextRound` after display timer.
   *
   * Wrapped in try/catch so that any unexpected error is logged and the game loop
   * is always rescheduled via the finally block. [Backend-4]
   *
   * @see docs/game-state-machine.md §3.1
   */
  override async onAlarm(): Promise<void> {
    const now = Date.now();
    // Track whether we are in the CRASHED→WAITING transition so the finally
    // block can skip rescheduling if beginNextRound() already scheduled the alarm.
    let alarmScheduled = false;

    try {
      if (this.gameState.phase === 'WAITING') {
        const result = handleCountdownTick(this.gameState);
        this.gameState = result.state;
        // Countdown changed (or phase transitioned to STARTING); invalidate cache
        this.invalidateSnapshot();

        this.dispatchMessages(result.messages);

        if (result.shouldStartRound) {
          // Transition to STARTING — use blockConcurrencyWhile for isolation
          await this.ctx.blockConcurrencyWhile(async () => {
            await this.startRound();
          });
          alarmScheduled = true; // startRound() schedules its own alarm
        } else {
          await this.ctx.storage.setAlarm(now + COUNTDOWN_TICK_MS);
          alarmScheduled = true;
        }
      } else if (this.gameState.phase === 'RUNNING') {
        const result = handleTick(this.gameState, now);
        this.gameState = result.state;
        // Invalidate if any auto-cashouts fired (player state changed)
        if (result.messages.some((m) => m.broadcast && m.message.type === 'playerCashedOut')) {
          this.invalidateSnapshot();
        }

        this.dispatchMessages(result.messages);

        if (result.shouldCrash) {
          await this.crashRound(now);
          alarmScheduled = true; // crashRound() schedules its own alarm
        } else {
          await this.ctx.storage.setAlarm(now + TICK_INTERVAL_MS);
          alarmScheduled = true;
        }
      } else if (this.gameState.phase === 'CRASHED') {
        // Display timer expired — transition to WAITING
        await this.beginNextRound();
        alarmScheduled = true; // beginNextRound() schedules its own alarm
      } else if (this.gameState.phase === 'STARTING') {
        // Alarm fired while still in STARTING (drand fetch in progress or failed).
        // Reschedule and wait for blockConcurrencyWhile to complete or retry.
        await this.ctx.storage.setAlarm(now + COUNTDOWN_TICK_MS);
        alarmScheduled = true;
      } else {
        // Exhaustive check — TypeScript will error here if a new Phase is added [High-13]
        const _exhaustive: never = this.gameState.phase;
        throw new Error(`Unhandled phase: ${_exhaustive}`);
      }
    } catch (error) {
      console.error('CrashGame alarm error:', error);
      // Broadcast error to all connected clients so they can display a retry indicator.
      // Wrapped in try/catch: a broken connection must not throw out of the catch block,
      // which would cause the CF output gate to roll back the finally block's setAlarm().
      try {
        this.broadcast(
          JSON.stringify({
            type: 'error',
            message: 'Server error \u2014 retrying',
          } satisfies ServerMessage),
        );
      } catch (broadcastError) {
        console.error('CrashGame: failed to broadcast error to clients:', broadcastError);
      }
    } finally {
      // Always reschedule the alarm unless the successful handler already did so,
      // ensuring the game loop never freezes after an unexpected error. [Backend-4]
      if (!alarmScheduled) {
        try {
          const recoveryInterval =
            this.gameState.phase === 'RUNNING' ? TICK_INTERVAL_MS : COUNTDOWN_TICK_MS;
          await this.ctx.storage.setAlarm(Date.now() + recoveryInterval);
        } catch (rescheduleError) {
          console.error('CrashGame: failed to reschedule alarm after error:', rescheduleError);
        }
      }
    }
  }

  /**
   * Transitions from STARTING to RUNNING. Runs inside `blockConcurrencyWhile`
   * so no WebSocket messages can interleave during the drand fetch and crash
   * point computation. On `DrandFetchError`, rewinds `gameNumber` and resets
   * to WAITING (void round).
   *
   * @see docs/provably-fair.md §2.4
   * @see docs/game-state-machine.md §3.2 (void rounds)
   */
  private async startRound(): Promise<void> {
    // STARTING phase: fetch drand beacon and compute crash point.
    // Runs inside blockConcurrencyWhile so no messages can interleave.
    this.gameNumber += 1;

    // Rotate chain if we are within CHAIN_ROTATION_THRESHOLD games of exhausting it
    if (this.gameNumber > CHAIN_LENGTH - CHAIN_ROTATION_THRESHOLD) {
      this.rootSeed = generateRootSeed();
      this.gameNumber = 1;
    }

    const chainSeed = await getChainSeedForGame(this.rootSeed, this.gameNumber);
    const nextChainCommitment = await computeNextChainCommitment(chainSeed);

    let beacon: DrandBeacon;
    let drandRound: number;
    let drandRandomness: string;

    try {
      const round = getCurrentDrandRound();
      beacon = await fetchDrandBeacon(round);
      drandRound = beacon.round;
      drandRandomness = beacon.randomness;
    } catch (drandErr) {
      // Void round — drand fetch failed; rewind game number and return to WAITING
      console.warn('[startRound] drand fetch failed, voiding round:', drandErr);
      this.gameNumber -= 1;
      this.gameState = { ...this.gameState, phase: 'WAITING', countdown: WAITING_DURATION_MS };
      this.invalidateSnapshot();
      await this.persistState();
      await this.ctx.storage.setAlarm(Date.now() + COUNTDOWN_TICK_MS);
      return;
    }

    const effectiveSeed = await computeEffectiveSeedFromBeacon(chainSeed, beacon);
    const crashPoint = deriveCrashPoint(effectiveSeed);
    const now = Date.now();

    const ingredients: RoundIngredients = {
      crashPoint,
      chainSeed,
      drandRound,
      drandRandomness,
      nextChainCommitment,
    };
    const result = handleStartingComplete(this.gameState, ingredients, now);
    this.gameState = result.state;
    this.invalidateSnapshot();

    // Broadcast full state update to all connections so clients know the round started
    this.broadcast(
      JSON.stringify({ type: 'state', ...this.getSnapshot() } satisfies ServerMessage),
    );

    await this.persistState();
    await this.ctx.storage.setAlarm(now + TICK_INTERVAL_MS);
  }

  /**
   * Transitions from RUNNING to CRASHED. Broadcasts a `state{phase:'CRASHED'}` message with
   * provably-fair ingredients, then stores pending payouts for any auto-cashed-out
   * players who are no longer connected. A `Map<connectionId, Connection>` is
   * built once from `this.getConnections()` so disconnection checks are O(1) per
   * player rather than O(n) — keeping the overall loop O(n) instead of O(n²).
   *
   * @see docs/game-state-machine.md §3.8 (balance management)
   * @see docs/game-state-machine.md §3.5 (disconnect semantics)
   */
  private async crashRound(now: number): Promise<void> {
    if (
      !this.gameState.chainSeed ||
      this.gameState.drandRound === null ||
      !this.gameState.drandRandomness
    ) {
      // Throw instead of returning silently: the caller (onAlarm) sets
      // alarmScheduled = true AFTER this method returns, so a silent return
      // without scheduling an alarm would kill the alarm loop. Throwing
      // ensures the catch/finally recovery path fires instead.
      throw new Error(
        'crashRound: missing provably-fair ingredients (chainSeed, drandRound, or drandRandomness)',
      );
    }

    const result = handleCrash(this.gameState, now);
    this.gameState = result.state;
    this.invalidateSnapshot();

    // Build a connection lookup map once (O(n)) to avoid O(n²) getConnections().some() per player
    const connectionMap = new Map<string, Connection>();
    for (const conn of this.getConnections()) {
      connectionMap.set(conn.id, conn);
    }

    // Store pending payouts for auto-cashed-out players who are disconnected
    for (const [, player] of this.gameState.players) {
      if (player.cashedOut && player.payout !== null && player.cashoutMultiplier !== null) {
        // O(1) lookup instead of O(n) scan per player
        const isConnected = connectionMap.has(player.id);
        if (!isConnected) {
          // Evict oldest entry if the map is at capacity [High-10]
          if (this.pendingPayouts.size >= MAX_PENDING_PAYOUTS) {
            const oldestPlayerId = this.pendingPayouts.keys().next().value as string;
            this.pendingPayouts.delete(oldestPlayerId);
            console.warn(`Evicting stale pending payout for ${oldestPlayerId}`);
          }
          this.pendingPayouts.set(player.playerId, {
            roundId: this.gameState.roundId,
            wager: player.wager,
            payout: player.payout,
            cashoutMultiplier: player.cashoutMultiplier,
            crashPoint: this.gameState.crashPoint ?? 1,
          });
        }
      }
    }

    this.dispatchMessages(result.messages);

    await this.persistState();
    await this.ctx.storage.setAlarm(now + CRASHED_DISPLAY_MS);
  }

  private async beginNextRound(): Promise<void> {
    const result = transitionToWaiting(this.gameState, this.gameState.chainCommitment);
    this.gameState = result.state;
    this.invalidateSnapshot();

    this.dispatchMessages(result.messages);

    await this.persistState();
    await this.ctx.storage.setAlarm(Date.now() + COUNTDOWN_TICK_MS);
  }

  /**
   * Dispatches all outbound messages: broadcasts are sent to every connection;
   * targeted messages are routed to the specific player via `sendToTarget`.
   * Pass `conn` (the sender) when targeted messages may be present (join/cashout).
   */
  private dispatchMessages(messages: OutboundMessage[], conn?: Connection): void {
    for (const outbound of messages) {
      if (outbound.broadcast) {
        this.broadcast(JSON.stringify(outbound.message));
      } else if (conn) {
        this.sendToTarget(outbound.targetPlayerId, conn).send(JSON.stringify(outbound.message));
      }
    }
  }

  /**
   * Resolves a targeted outbound message to the correct connection. [High-15]
   * Looks up the target player's current connection by playerId; falls back to
   * `fallback` (the sender) if the player is not found or disconnected.
   */
  private sendToTarget(targetPlayerId: string, fallback: Connection): Connection {
    const player = this.gameState.players.get(targetPlayerId);
    if (player) {
      // O(n) scan is acceptable here: called only for individual targeted ACKs
      // (join/cashout), never inside the tick loop. n ≤ MAX_PLAYERS_PER_ROUND.
      const target = Array.from(this.getConnections()).find((c) => c.id === player.id);
      if (target) return target;
    }
    return fallback;
  }

  /**
   * Persists all durable game state under the single key `'gameData'`.
   * Called after every crash, void round, and pending payout consumption.
   * Not called on every tick to avoid unnecessary storage writes.
   *
   * @see docs/game-state-machine.md §3.9
   */
  private async persistState(): Promise<void> {
    await this.ctx.storage.put('gameData', {
      rootSeed: this.rootSeed,
      gameNumber: this.gameNumber,
      chainCommitment: this.gameState.chainCommitment,
      history: this.gameState.history,
      pendingPayouts: Array.from(this.pendingPayouts.entries()),
    });
  }

  /**
   * Debug HTTP endpoint. Returns a JSON snapshot of non-sensitive game state.
   * Gated by `CRASH_DEBUG === 'true'` env var — disabled in production.
   * `crashPoint`, `chainSeed`, and `drandRandomness` are intentionally omitted
   * from the response to prevent leaking provably-fair ingredients.
   *
   * @see docs/project-architecture.md §1.7
   */
  override async onRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.searchParams.get('debug') === 'true' && this.env.CRASH_DEBUG === 'true') {
      return Response.json({
        phase: this.gameState.phase,
        roundId: this.gameState.roundId,
        countdown: this.gameState.countdown,
        playerCount: this.gameState.players.size,
        gameNumber: this.gameNumber,
        // SECURITY: crashPoint, chainSeed, and drandRandomness are intentionally omitted
      });
    }

    return new Response('Not found', { status: 404 });
  }
}
