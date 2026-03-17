import type { RoundTarget } from '../../types';

/** Mulberry32 — fast seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a random element from an array using the provided RNG. */
export function seededPick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

const ORGS = [
  'ELLINGSON MINERAL',
  'CYBERDYNE SYSTEMS',
  'OMNI CONSUMER PRODUCTS',
  'SOYLENT CORP',
  'WEYLAND-YUTANI',
  'TYRELL CORPORATION',
  'INITECH SYSTEMS',
  'MASSIVE DYNAMIC',
  'VERIDIAN DYNAMICS',
  'NORTHSIDE DIGITAL',
  'AXIOM FINANCIAL',
  'NEXUS BIOTECH',
  'ORCA CAPITAL GROUP',
  'MERIDIAN LABS',
  'ATLAS DEFENSE SYSTEMS',
];

const HOSTNAMES = [
  'srv-prod-web-03',
  'db-primary-01',
  'mail-gw-02',
  'api-node-07',
  'core-auth-01',
  'backup-nas-02',
  'core-router-01',
  'cache-redis-04',
  'svc-gateway-02',
  'log-aggregator-01',
];

const IP_PREFIXES = ['198.51.100', '203.0.113', '192.0.2', '198.18.0', '198.19.255'];

/** Generate a deterministic RoundTarget from a round ID seeded RNG. */
export function generateRoundTarget(roundId: number, rng: () => number): RoundTarget {
  const org = seededPick(ORGS, rng);
  const hostname = seededPick(HOSTNAMES, rng);
  const prefix = seededPick(IP_PREFIXES, rng);
  const ip = `${prefix}.██`;
  return { org, hostname, ip, roundId };
}
