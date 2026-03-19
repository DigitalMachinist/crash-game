import type { TerminalLine } from '../../types';
import { nextLineId } from './line-id';
import { mulberry32, seededPick } from './prng';
import { POOLS, TIERS } from './terminal-content-pools';

export interface TerminalSession {
  stop(): void;
}

/** Determine content tier from multiplier. */
export function getTierForMultiplier(multiplier: number): number {
  if (multiplier >= 30) return 6;
  if (multiplier >= 15) return 5;
  if (multiplier >= 6) return 4;
  if (multiplier >= 3) return 3;
  if (multiplier >= 1.5) return 2;
  return 1;
}

/** Base emission interval (ms) for a given multiplier. */
export function getBaseInterval(multiplier: number): number {
  if (multiplier >= 30) return 150;
  if (multiplier >= 15) return 250;
  if (multiplier >= 6) return 400;
  if (multiplier >= 3) return 750;
  if (multiplier >= 1.5) return 1250;
  return 1750;
}

/**
 * Fill template variables: replaces {hostname}, {ip}, {user}, etc. with pool values.
 * stable: hostname and ip are stable per round. others are drawn fresh each call.
 */
function fillVars(
  text: string,
  stable: { hostname: string; ip: string },
  rng: () => number,
): string {
  return text
    .replace(/{hostname}/g, stable.hostname)
    .replace(/{ip}/g, stable.ip)
    .replace(/{user}/g, seededPick(POOLS.user, rng))
    .replace(/{os}/g, seededPick(POOLS.os, rng))
    .replace(/{sensitive_file}/g, seededPick(POOLS.sensitiveFile, rng))
    .replace(/{filename}/g, seededPick(POOLS.filename, rng))
    .replace(/{next_host}/g, seededPick(POOLS.nextHost, rng))
    .replace(/{agency}/g, seededPick(POOLS.agency, rng))
    .replace(/{ticket}/g, seededPick(POOLS.ticket, rng))
    .replace(/{iface}/g, seededPick(POOLS.iface, rng))
    .replace(/{port}/g, seededPick(POOLS.port, rng))
    .replace(/{uptime}/g, seededPick(POOLS.uptime, rng))
    .replace(/{pct1}/g, String(Math.floor(rng() * 30) + 20))
    .replace(/{pct2}/g, String(Math.floor(rng() * 50) + 40))
    .replace(/{n}/g, String(Math.floor(rng() * 6) + 1));
}

/**
 * Start a terminal session for the RUNNING phase.
 * Returns a TerminalSession with a stop() method to clean up timers.
 */
export function startTerminalSession(
  roundId: number,
  getMultiplier: () => number,
  onLine: (line: TerminalLine) => void,
  onProgressUpdate: (id: number, newText: string) => void,
): TerminalSession {
  // Stable per-round variables
  const stableRng = mulberry32(roundId);
  const stable = {
    hostname: seededPick(
      [
        'api.nexus-biotech.net',
        'db-primary.ellingson.corp',
        'mail.orca-capital.io',
        'cdn-prod.axiom-financial.net',
        'auth.meridian-labs.corp',
      ],
      stableRng,
    ),
    ip: seededPick(['198.51.100.██', '203.0.113.██', '10.0.14.██'], stableRng),
  };

  // Session-local RNG (random seed for per-session variety)
  const sessionSeed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  const rng = mulberry32(sessionSeed);

  let stopped = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  function schedule(fn: () => void, delay: number): void {
    if (stopped) return;
    timers.push(setTimeout(fn, delay));
  }

  function emitNext(): void {
    if (stopped) return;

    const mult = getMultiplier();
    const tier = getTierForMultiplier(mult);
    const templates = TIERS[tier] ?? TIERS[1]!;
    const template = seededPick(templates, rng);

    const text = fillVars(template.text, stable, rng);
    const line: TerminalLine = {
      id: nextLineId(),
      text,
      color: template.color,
      type: template.type,
      timestamp: Date.now(),
    };
    onLine(line);

    // Tier 4+: occasionally emit a progress bar that updates in-place
    if (tier >= 4 && template.type === 'progress') {
      startProgressBar(line.id, stable, rng);
    }

    // Schedule next emission with ±20% jitter
    const base = getBaseInterval(getMultiplier());
    const jitter = base * 0.2;
    const delay = base - jitter + rng() * jitter * 2;
    schedule(emitNext, delay);
  }

  function startProgressBar(lineId: number, s: typeof stable, r: () => number): void {
    const filename = seededPick(POOLS.filename, r);
    const totalSteps = 8;
    let step = 0;

    function tick(): void {
      if (stopped) return;
      step++;
      const pct = Math.round((step / totalSteps) * 100);
      const filled = Math.round((step / totalSteps) * 16);
      const empty = 16 - filled;
      const bar = '█'.repeat(filled) + '░'.repeat(empty);
      const speed = (rng() * 80 + 20).toFixed(1);
      if (pct < 100) {
        onProgressUpdate(lineId, `[EXFIL] ${filename} [${bar}] ${pct}% ${speed}MB/s`);
        schedule(tick, 400 + rng() * 400);
      } else {
        onProgressUpdate(lineId, `[EXFIL] ${filename} [████████████████] 100% — complete`);
      }
    }
    schedule(tick, 500);
  }

  // Start the emission loop with a short initial delay
  schedule(emitNext, 200 + rng() * 300);

  return {
    stop() {
      stopped = true;
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
    },
  };
}
