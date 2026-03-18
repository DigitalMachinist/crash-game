import type { TerminalLine } from '../../types';

export type LineTemplate = Omit<TerminalLine, 'id' | 'timestamp'>;

export const POOLS = {
  user: ['admin', 'deploy', 'root', 'svc-account', 'jenkins'],
  os: ['Linux 5.15', 'Linux 6.1 (Ubuntu 24.04)', 'FreeBSD 14.0', 'CentOS 9'],
  sensitiveFile: ['api_keys.json', 'credentials.kdbx', '.env.production', 'master.key'],
  filename: ['credentials.kdbx', 'model_weights.bin', 'OMEGA_PROTOCOL.enc', 'customer_db.sql'],
  nextHost: ['db-primary-01', 'backup-nas-02', 'core-router-01', 'cache-redis-04'],
  agency: ['FBI CYBER DIVISION', 'NSA TAO', 'INTERPOL', 'FIVE EYES COALITION'],
  ticket: ['INC-0847', 'INC-1293', 'SEC-0441', 'INC-2091', 'SEC-0778'],
  iface: ['tun0', 'eth0', 'wg0'],
  port: ['22', '443', '5432', '3306', '8080'],
  uptime: ['847 days', '23 days', '412 days', '134 days', '5 days'],
};

/** Tier 1 — Initial Access (1.0x–1.5x) */
export const TIER1: LineTemplate[] = [
  { text: '$ ssh -i exploit.key {user}@{ip}', color: '#805800', type: 'command' },
  { text: 'Connecting to {hostname}:{port}...', color: '#805800', type: 'normal' },
  { text: '[+] Authentication successful', color: '#00cc66', type: 'success' },
  { text: '{hostname} — {os} — uptime {uptime}', color: '#805800', type: 'normal' },
  { text: '$ nmap -sS {ip} -p 1-1024', color: '#805800', type: 'command' },
  { text: 'PORT    STATE    SERVICE', color: '#805800', type: 'normal' },
  { text: '22/tcp  open     ssh', color: '#805800', type: 'normal' },
  { text: '443/tcp open     https', color: '#805800', type: 'normal' },
  { text: '3306/tcp open    mysql', color: '#805800', type: 'normal' },
  { text: '[*] Enumerating shares...', color: '#cc8800', type: 'warning' },
  { text: '[+] Session opened.', color: '#00cc66', type: 'success' },
];

/** Tier 2 — Reconnaissance (1.5x–3.0x) */
export const TIER2: LineTemplate[] = [
  { text: '$ find / -perm -u=s -type f 2>/dev/null', color: '#805800', type: 'command' },
  { text: '$ cat /etc/passwd | grep -v nologin', color: '#805800', type: 'command' },
  { text: '[*] Scanning internal network...', color: '#cc8800', type: 'warning' },
  { text: '10.0.0.1 - gateway - open 22,80,443', color: '#805800', type: 'normal' },
  { text: '10.0.0.12 - {hostname} - open 3306', color: '#805800', type: 'normal' },
  { text: '[+] SMB shares discovered: 3', color: '#00cc66', type: 'success' },
  { text: 'Mounting remote filesystem...', color: '#805800', type: 'normal' },
  { text: '[+] Access: /var/backups — read/write', color: '#00cc66', type: 'success' },
  { text: '$ ls -la /home/{user}/', color: '#805800', type: 'command' },
  { text: '.bash_history  .ssh  .env', color: '#805800', type: 'normal' },
  { text: '[*] Credential file detected.', color: '#cc8800', type: 'warning' },
];

/** Tier 3 — Privilege Escalation (3.0x–6.0x) */
export const TIER3: LineTemplate[] = [
  { text: '[+] ROOT ACCESS GRANTED', color: '#00cc66', type: 'success' },
  { text: 'root@{hostname}:~# ls /opt/.secrets/', color: '#805800', type: 'command' },
  { text: 'master.key  vpn-gateway.ovpn  credentials.kdbx', color: '#cc8800', type: 'warning' },
  { text: 'root@{hostname}:~# cat {sensitive_file}', color: '#805800', type: 'command' },
  { text: '[*] Pivoting to {next_host}...', color: '#cc8800', type: 'warning' },
  { text: '[+] SSH key accepted', color: '#00cc66', type: 'success' },
  { text: 'Injecting payload into kernel module...', color: '#cc8800', type: 'warning' },
  { text: '[+] Persistence established.', color: '#00cc66', type: 'success' },
  { text: '$ sudo -l', color: '#805800', type: 'command' },
  { text: '(ALL : ALL) NOPASSWD: ALL', color: '#ff8c00', type: 'warning' },
];

/** Tier 4 — Exfiltration (6.0x–15.0x) */
export const TIER4: LineTemplate[] = [
  { text: '[*] Beginning data extraction...', color: '#ff8c00', type: 'warning' },
  { text: '[EXFIL] {filename} — transferring...', color: '#ff8c00', type: 'progress' },
  { text: '[*] Lateral movement: jumping to {next_host}', color: '#ff8c00', type: 'warning' },
  { text: '[+] {filename} — 100% complete', color: '#00cc66', type: 'success' },
  { text: 'Bypassing DLP controls...', color: '#ff8c00', type: 'warning' },
  { text: '[+] DLP bypass successful.', color: '#00cc66', type: 'success' },
  { text: '[!] IDS signature match — suppressing alert', color: '#ff6600', type: 'danger' },
  { text: 'root@{hostname}:~# tar -czf /tmp/loot.tar.gz /', color: '#805800', type: 'command' },
  { text: '$ scp /tmp/loot.tar.gz {user}@10.0.0.99:/', color: '#805800', type: 'command' },
  { text: '[*] Covering tracks... clearing logs', color: '#ff8c00', type: 'warning' },
];

/** Tier 5 — Deep Access (15.0x–30.0x) */
export const TIER5: LineTemplate[] = [
  { text: '[!] SOC ALERT: Ticket #{ticket} — Priority CRITICAL', color: '#ff4400', type: 'danger' },
  { text: '[*] Counter-intrusion payload detected on {iface}', color: '#ff6600', type: 'warning' },
  { text: '[!] Proxy node compromised — rerouting', color: '#ff4400', type: 'danger' },
  { text: '[!] IDS: ACTIVE SCAN DETECTED', color: '#ff4400', type: 'danger' },
  { text: '[*] Honeypot triggered — re-routing traffic', color: '#ff6600', type: 'warning' },
  { text: '[!] Certificate mismatch on {iface}', color: '#ff4400', type: 'danger' },
  { text: '[DEEP] Accessing crown jewel partition...', color: '#ff6600', type: 'warning' },
  { text: '[!] Anomaly detected — traffic spike 847%', color: '#ff4400', type: 'danger' },
  { text: '[*] Firewall rules modifying in real-time', color: '#ff6600', type: 'warning' },
  { text: '[!] link integrity fa??ure on {iface}', color: '#ff4400', type: 'danger' },
];

/** Tier 6 — Danger Zone (30.0x+) */
export const TIER6: LineTemplate[] = [
  { text: '[!] ██ {agency} — TRACKING ██', color: '#ff0040', type: 'danger' },
  { text: '[!] ██ DIRECT EXPOSURE IMMINENT ██', color: '#ff0040', type: 'danger' },
  { text: '[!] P4CKET L0SS: {pct1}%... {pct2}%...', color: '#ff0040', type: 'danger' },
  { text: '[ERR] {iface}: link is not re??dy', color: '#ff0040', type: 'danger' },
  { text: '[!] ██ DISCONNECT NOW ██', color: '#ff0040', type: 'danger' },
  { text: '[!] TRACE VECTOR LOCKED', color: '#ff0040', type: 'danger' },
  { text: '[!] OPERATOR EXPOSED — ABORT MISSION', color: '#ff0040', type: 'danger' },
  { text: '[CRIT] ██ AGENCY FEED ACTIVE ██', color: '#ff0040', type: 'danger' },
  { text: '[!] Physical location triangulated', color: '#ff0040', type: 'danger' },
  { text: '> ██████████████████████████████████████████', color: '#ff0040', type: 'danger' },
];

export const TIERS: Record<number, LineTemplate[]> = {
  1: TIER1,
  2: TIER2,
  3: TIER3,
  4: TIER4,
  5: TIER5,
  6: TIER6,
};
