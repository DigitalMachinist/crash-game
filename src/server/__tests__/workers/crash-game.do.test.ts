// DO integration tests using @cloudflare/vitest-pool-workers.
// These exercise the full CrashGame Durable Object lifecycle via SELF.fetch().
//
// URL routing note: partyserver converts the DO binding name "CrashGame" to
// kebab-case "crash-game", so WebSocket/HTTP party requests go to
// /parties/crash-game/<room-name>.
//
// Each test uses a unique room name to get a fresh DO instance (DO state is
// isolated per unique room name via idFromName).

import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

// Helper: open a WebSocket to the DO and return the accepted client socket.
async function connectWS(room: string): Promise<WebSocket> {
  const resp = await SELF.fetch(`http://localhost/parties/crash-game/${room}`, {
    headers: { Upgrade: 'websocket' },
  });
  if (resp.status !== 101) {
    const body = await resp.text();
    throw new Error(`Expected 101, got ${resp.status}: ${body}`);
  }
  const ws = resp.webSocket!;
  ws.accept();
  return ws;
}

// Helper: collect all messages received on `ws` for `durationMs` milliseconds.
function collectMessages(ws: WebSocket, durationMs: number): Promise<string[]> {
  const msgs: string[] = [];
  return new Promise<string[]>((resolve) => {
    ws.addEventListener('message', (e) => {
      msgs.push(e.data as string);
    });
    setTimeout(() => resolve(msgs), durationMs);
  });
}

// Helper: wait for the first message on `ws` (with a timeout).
function waitForMessage(ws: WebSocket, timeoutMs = 2000): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for message')), timeoutMs);
    ws.addEventListener('message', (e) => {
      clearTimeout(timer);
      resolve(e.data as string);
    });
  });
}

describe('CrashGame DO (integration)', () => {
  // ── 1. Debug HTTP endpoint ──────────────────────────────────────────────────
  it('debug endpoint returns initial game state', async () => {
    const resp = await SELF.fetch('http://localhost/parties/crash-game/debug-test-1?debug=true');
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as {
      phase: string;
      roundId: number;
      playerCount: number;
      gameNumber: number;
    };
    expect(data.phase).toBe('WAITING');
    expect(data.playerCount).toBe(0);
    expect(typeof data.roundId).toBe('number');
    expect(typeof data.gameNumber).toBe('number');
  });

  // ── 2. WebSocket connect receives `state` message ─────────────────────────
  it('sends state message on WebSocket connect', async () => {
    const ws = await connectWS('ws-connect-test-1');

    const raw = await waitForMessage(ws);
    const parsed = JSON.parse(raw) as { type: string; phase: string };
    expect(parsed.type).toBe('state');
    expect(parsed.phase).toBe('WAITING');

    ws.close();
  });

  // ── 3. State message contains all required GameStateSnapshot fields ────────
  it('state message includes all required snapshot fields', async () => {
    const ws = await connectWS('ws-snapshot-test-1');

    const raw = await waitForMessage(ws);
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(parsed.type).toBe('state');
    expect(parsed.phase).toBe('WAITING');
    expect(typeof parsed.roundId).toBe('number');
    expect(typeof parsed.countdown).toBe('number');
    expect(typeof parsed.multiplier).toBe('number');
    expect(typeof parsed.elapsed).toBe('number');
    // crashPoint must be null during WAITING (security: never reveal before CRASHED)
    expect(parsed.crashPoint).toBeNull();
    expect(Array.isArray(parsed.players)).toBe(true);
    expect(Array.isArray(parsed.history)).toBe(true);

    ws.close();
  });

  // ── 4. State message includes chainCommitment (64-char SHA-256 hex) ────────
  it('state message includes a chainCommitment hash', async () => {
    const ws = await connectWS('ws-commitment-test-1');

    const raw = await waitForMessage(ws);
    const parsed = JSON.parse(raw) as { chainCommitment: string };

    expect(typeof parsed.chainCommitment).toBe('string');
    expect(parsed.chainCommitment.length).toBe(64); // SHA-256 hex
    expect(/^[0-9a-f]{64}$/.test(parsed.chainCommitment)).toBe(true);

    ws.close();
  });

  // ── 5. Joining during WAITING broadcasts `playerJoined` ───────────────────
  it('join during WAITING broadcasts playerJoined', async () => {
    const ws = await connectWS('ws-join-test-1');

    // Wait for initial state message first
    await waitForMessage(ws);

    // Start collecting subsequent messages
    const pending = collectMessages(ws, 300);

    ws.send(JSON.stringify({ type: 'join', playerId: 'player-abc', wager: 100, name: 'Alice' }));

    const msgs = await pending;
    const parsed = msgs.map((m) => JSON.parse(m) as Record<string, unknown>);
    const joined = parsed.find((m) => m.type === 'playerJoined');

    expect(joined).toBeDefined();
    expect(joined!.playerId).toBe('player-abc');
    expect(joined!.name).toBe('Alice');
    expect(joined!.wager).toBe(100);

    ws.close();
  });

  // ── 6. Joining twice with the same playerId only joins once ───────────────
  it('join twice with same playerId is handled gracefully', async () => {
    const ws = await connectWS('ws-double-join-test-1');

    await waitForMessage(ws);

    ws.send(JSON.stringify({ type: 'join', playerId: 'player-dup', wager: 50, name: 'Bob' }));
    await new Promise<void>((resolve) => setTimeout(resolve, 150));

    // Collect messages after first join
    const pending = collectMessages(ws, 300);
    ws.send(JSON.stringify({ type: 'join', playerId: 'player-dup', wager: 50, name: 'Bob' }));
    const msgs = await pending;
    const parsed = msgs.map((m) => JSON.parse(m) as Record<string, unknown>);

    // The second join attempt should not result in a second playerJoined broadcast;
    // it may return an error message instead.
    const joinedMsgs = parsed.filter((m) => m.type === 'playerJoined');
    const errorMsgs = parsed.filter((m) => m.type === 'error');
    // Either: no extra join, or an error — both are acceptable server behaviours.
    expect(joinedMsgs.length + errorMsgs.length).toBeGreaterThanOrEqual(0); // always passes; real check below
    // The server must not broadcast a second playerJoined for the same playerId+round
    expect(joinedMsgs.length).toBe(0);

    ws.close();
  });

  // ── 7. Invalid JSON returns error message ─────────────────────────────────
  it('invalid JSON message returns error', async () => {
    const ws = await connectWS('ws-bad-json-test-1');

    await waitForMessage(ws);

    const pending = collectMessages(ws, 300);
    ws.send('not valid json at all');
    const msgs = await pending;

    const parsed = msgs.map((m) => JSON.parse(m) as { type: string });
    const error = parsed.find((m) => m.type === 'error');
    expect(error).toBeDefined();

    ws.close();
  });

  // ── 8. Cashout without an active bet returns error ─────────────────────────
  it('cashout without active bet returns error', async () => {
    const ws = await connectWS('ws-cashout-nobet-test-1');

    await waitForMessage(ws);

    const pending = collectMessages(ws, 300);
    ws.send(JSON.stringify({ type: 'cashout' }));
    const msgs = await pending;

    const parsed = msgs.map((m) => JSON.parse(m) as { type: string });
    const error = parsed.find((m) => m.type === 'error');
    expect(error).toBeDefined();

    ws.close();
  });

  // ── 9. Unknown HTTP route returns 404 ─────────────────────────────────────
  it('returns 404 for unknown routes', async () => {
    const resp = await SELF.fetch('http://localhost/this-route-does-not-exist');
    expect(resp.status).toBe(404);
  });

  // ── 10. Debug endpoint without ASSETS falls through to Not found ──────────
  it('non-debug DO request returns 404 from onRequest', async () => {
    // A non-debug request to the DO's onRequest handler returns 404
    const resp = await SELF.fetch('http://localhost/parties/crash-game/http-404-test-1');
    expect(resp.status).toBe(404);
  });

  // ── 11. Multiple clients connect to the same room ─────────────────────────
  it('two clients can connect to the same room', async () => {
    const room = 'ws-multi-client-test-1';
    const ws1 = await connectWS(room);
    const ws2 = await connectWS(room);

    const [raw1, raw2] = await Promise.all([waitForMessage(ws1), waitForMessage(ws2)]);
    const p1 = JSON.parse(raw1) as { type: string; phase: string };
    const p2 = JSON.parse(raw2) as { type: string; phase: string };

    // Both clients should receive the state message on connect
    expect(p1.type).toBe('state');
    expect(p2.type).toBe('state');
    expect(p1.phase).toBe('WAITING');
    expect(p2.phase).toBe('WAITING');

    ws1.close();
    ws2.close();
  });

  // ── 12. playerJoined is broadcast to all connected clients ────────────────
  it('playerJoined is broadcast to all clients in the room', async () => {
    const room = 'ws-broadcast-test-1';
    const ws1 = await connectWS(room);
    const ws2 = await connectWS(room);

    // Drain the initial state messages for both sockets
    await Promise.all([waitForMessage(ws1), waitForMessage(ws2)]);

    // ws2 may also need to drain a state message if ws1 connected before it
    // Start collecting on both sockets before the join
    const p1 = collectMessages(ws1, 400);
    const p2 = collectMessages(ws2, 400);

    ws1.send(
      JSON.stringify({ type: 'join', playerId: 'player-broadcast', wager: 200, name: 'Carol' }),
    );

    const [msgs1, msgs2] = await Promise.all([p1, p2]);
    const parsed1 = msgs1.map((m) => JSON.parse(m) as Record<string, unknown>);
    const parsed2 = msgs2.map((m) => JSON.parse(m) as Record<string, unknown>);

    const joined1 = parsed1.find((m) => m.type === 'playerJoined');
    const joined2 = parsed2.find((m) => m.type === 'playerJoined');

    expect(joined1).toBeDefined();
    expect(joined2).toBeDefined();
    expect(joined1!.playerId).toBe('player-broadcast');
    expect(joined2!.playerId).toBe('player-broadcast');

    ws1.close();
    ws2.close();
  });

  // ── 13. State message drandRound is null initially ────────────────────────
  it('initial state has drandRound as null', async () => {
    const ws = await connectWS('ws-drand-null-test-1');

    const raw = await waitForMessage(ws);
    const parsed = JSON.parse(raw) as { drandRound: unknown };

    // drandRound is only set after a round starts (fetched from drand.lol)
    expect(parsed.drandRound).toBeNull();

    ws.close();
  });

  // ── 14. State message players array is empty initially ────────────────────
  it('initial state has empty players array', async () => {
    const ws = await connectWS('ws-empty-players-test-1');

    const raw = await waitForMessage(ws);
    const parsed = JSON.parse(raw) as { players: unknown[] };

    expect(parsed.players).toEqual([]);

    ws.close();
  });
});
