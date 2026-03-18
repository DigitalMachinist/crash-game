export type AgencyEntry = {
  name: string;
  subtitle: string;
  caseRef: string;
};

function randomDigits(n: number): string {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
}

function randomAlpha(n: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const RIVAL_HANDLES = ['gr00t', 'xX_ph4ntom_Xx', 'null_ptr', 'SYSTEM', 'l33tH4x0r'];

export function pickAgency(): AgencyEntry {
  const agencies: AgencyEntry[] = [
    {
      name: 'FBI CYBER DIVISION',
      subtitle: 'OPERATOR COMPROMISED — ALL SESSIONS TERMINATED',
      caseRef: `CASE #2026-CF-${randomDigits(5)}`,
    },
    {
      name: 'NSA TAILORED ACCESS OPS',
      subtitle: 'SIGNAL INTERCEPTED — OPERATOR LOCATED',
      caseRef: `SIGINT REF: SIGMA-${randomAlpha(4)}`,
    },
    {
      name: 'INTERPOL CYBER CRIME',
      subtitle: 'OPERATOR COMPROMISED — ALL SESSIONS TERMINATED',
      caseRef: `WARRANT: IC-2026-EU-${randomDigits(4)}`,
    },
    {
      name: 'CORPORATE SECURITY',
      subtitle: 'UNAUTHORIZED ACCESS DETECTED — SOURCE IDENTIFIED',
      caseRef: `INCIDENT: CS-${randomDigits(6)}`,
    },
    {
      name: `PWNED BY: ${RIVAL_HANDLES[Math.floor(Math.random() * RIVAL_HANDLES.length)]}`,
      subtitle: 'YOUR BACKDOOR HAD A BACKDOOR',
      caseRef: '',
    },
  ];
  return agencies[Math.floor(Math.random() * agencies.length)]!;
}

const LOCKOUT_SUBTITLES = [
  'INTRUSION COUNTERMEASURES DEPLOYED — CONNECTION SEVERED',
  'TARGET HOST INITIATED EMERGENCY ISOLATION PROTOCOL',
  'REMOTE FAILSAFE ACTIVATED — UNABLE TO RECONNECT',
  'SECURITY PERIMETER RESTORED — FURTHER ACCESS BLOCKED',
  'NETWORK LOCKDOWN IN PROGRESS — ALL SESSIONS TERMINATED',
];

export function pickLockoutSubtitle(): string {
  return LOCKOUT_SUBTITLES[Math.floor(Math.random() * LOCKOUT_SUBTITLES.length)]!;
}
