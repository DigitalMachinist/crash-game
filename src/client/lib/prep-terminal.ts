import type { RoundTarget, TerminalLine } from '../../types';
import { nextLineId } from './line-id';

/** Returns countdown-synced prep lines for the WAITING phase terminal. */
export function getPrepLines(secondsRemaining: number, target: RoundTarget | null): TerminalLine[] {
  const ip = target?.ip ?? '198.51.100.██';
  const ts = Date.now();

  // Lines indexed by which second they appear (countdown from 10 to 0)
  const lineMap: Record<number, TerminalLine> = {
    10: {
      id: nextLineId(),
      text: `[${fmt(10)}] Initializing proxy chain...`,
      color: '#c08400',
      type: 'normal',
      timestamp: ts,
    },
    9: {
      id: nextLineId(),
      text: `[${fmt(9)}]  > route add via tor-exit-DE`,
      color: '#00cc66',
      type: 'success',
      timestamp: ts,
    },
    8: {
      id: nextLineId(),
      text: `[${fmt(8)}]  > route add via tor-exit-BR`,
      color: '#00cc66',
      type: 'success',
      timestamp: ts,
    },
    7: {
      id: nextLineId(),
      text: `[${fmt(7)}]  > route add via tor-exit-JP`,
      color: '#00cc66',
      type: 'success',
      timestamp: ts,
    },
    6: {
      id: nextLineId(),
      text: `[${fmt(6)}]  Proxy chain: 6 bounces active.`,
      color: '#c08400',
      type: 'normal',
      timestamp: ts,
    },
    5: {
      id: nextLineId(),
      text: `[${fmt(5)}]  Loading exploit kit... [████████████████████] 100%`,
      color: '#c08400',
      type: 'progress',
      timestamp: ts,
    },
    4: {
      id: nextLineId(),
      text: `[${fmt(4)}]  $ nmap -sS ${ip}`,
      color: '#c08400',
      type: 'command',
      timestamp: ts,
    },
    3: {
      id: nextLineId(),
      text: `[${fmt(3)}]  Payload staged. Awaiting operator.`,
      color: '#c08400',
      type: 'normal',
      timestamp: ts,
    },
    2: {
      id: nextLineId(),
      text: `[${fmt(2)}]  Standing by...`,
      color: '#c08400',
      type: 'normal',
      timestamp: ts,
    },
    1: {
      id: nextLineId(),
      text: `[${fmt(1)}]  LAUNCH IMMINENT`,
      color: '#cc8800',
      type: 'warning',
      timestamp: ts,
    },
  };

  // Emit lines for all seconds from countdown down to secondsRemaining
  const lines: TerminalLine[] = [];
  for (let s = 10; s >= secondsRemaining; s--) {
    const line = lineMap[s];
    if (line) lines.push(line);
  }
  return lines;
}

function fmt(s: number): string {
  return `00:${String(s).padStart(2, '0')}`;
}
