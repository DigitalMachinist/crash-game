# Lighthouse Audit Fixes Specification

**Date:** 2026-03-19
**Status:** Approved
**Motivation:** Address all actionable findings from Lighthouse audit (Performance 100, Accessibility 94, Best Practices 96, SEO 91) to improve accessibility, eliminate console errors, harden security, and optimize font loading.

**Lighthouse report:** `docs/notes/lighthouse-report-crash-override.digitalmachinist.ca-20260319T011712.json`

## Scope

7 items covering all actionable Lighthouse findings:

| # | Finding | Category | Current Score Impact |
|---|---------|----------|---------------------|
| 1 | Forced reflow in TerminalDisplay.svelte | Performance | Not flagged in this run (score 1), but identified by code inspection as layout thrashing during RUNNING phase |
| 2 | Color contrast failures (58 elements) | Accessibility | Contributes to score of 94 (target 100) |
| 3 | `each_key_duplicate` console error | Best Practices | Contributes to score of 96 (target 100) |
| 4 | Missing `<meta name="description">` | SEO | Contributes to score of 91 (target 100) |
| 5 | Render-blocking Google Fonts + critical chain | Performance | Diagnostic (-140ms FCP/LCP estimated) |
| 6 | Security headers missing | Best Practices | Informational (score 1, but flagged high severity) |
| 7 | bfcache blocked by WebSocket | Performance | Score 0, but inherent to WebSocket architecture — no fix possible until browser support lands |

### Out of Scope

- Unminified/unused JavaScript findings (browser extension artifacts, not app code)
- Cloudflare beacon blocked by ad-blockers (not actionable)
- Manual accessibility audits (keyboard focus, ARIA roles — separate effort)

## Item 1: Forced Reflow Fix

**File:** `src/client/components/TerminalDisplay.svelte:19-25`

**Problem:** The `$effect` reads `container.scrollHeight` (forces synchronous layout) and writes `container.scrollTop` on every `lines` change. During RUNNING phase, terminal lines update every 150-1750ms, causing repeated forced reflows. Note: Lighthouse did not flag this in the audit run (score 1, empty items), but code inspection confirms the layout thrashing pattern.

**Fix:** Wrap in `requestAnimationFrame` to defer the read/write to the next frame boundary. Capture the element reference to prevent stale access if the component unmounts before the callback fires.

## Item 2: Color Contrast (Split Text vs Decorative)

**Problem:** `--color-primary-dim: #805800` (3.16:1) and `--color-success-dim: #006633` (2.81:1) on `--color-bg: #0a0800` fail WCAG AA 4.5:1 for normal text. 58 elements flagged in the Lighthouse report across the entire UI.

**Approach:** Add two new CSS custom properties for text-specific use while preserving the original dim values for borders and decorative elements:

- `--color-primary-dim-text: #c08400` (5.1:1 ratio — passes AA)
- `--color-success-dim-text: #1a9956` (4.7:1 ratio — passes AA)

**Scope of changes:**

- **Root variables** in `App.svelte` `:root` block: Add the 2 new variables
- **Dynamic threat variables** in `App.svelte`: Add `--threat-dim-text: var(--color-primary-dim-text)` to `:root` (line 381). In the `$dangerColors` effect (`App.svelte:146-159`), add `root.style.setProperty('--threat-dim-text', colors.dimText)` alongside the existing `--threat-dim` setter. The `DangerColors` type (`src/types.ts`) and `getDangerColors()` (`src/client/lib/threat.ts`) must be extended with a `dimText` field containing the AA-compliant text variant for each threat level.
- **14 Svelte component files** with 59 total usages: Change `color:` properties referencing `--color-primary-dim` or `--color-success-dim` to use the new `-text` variants. Leave `border-color:` and `border:` usages unchanged.
- **Fallback hex values** in modals (`var(--color-primary-dim, #805800)`) update to `var(--color-primary-dim-text, #c08400)` for text-bearing properties only.
- **Hardcoded hex in `src/client/lib/prep-terminal.ts`:** 6 occurrences of `#805800` (lines 19, 47, 54, 61, 68, 75) used as text `color` — change to `#c08400`.

**Files affected:** `App.svelte`, `TerminalDisplay.svelte`, `BetForm.svelte`, `PlayerList.svelte`, `History.svelte`, `VerifyModal.svelte`, `FairnessModal.svelte`, `NameModal.svelte`, `ThreatPanel.svelte`, `ThreatMeter.svelte`, `ConnectionStatus.svelte`, `ObserverBanner.svelte`, `Multiplier.svelte`, `TargetInfo.svelte`, `CashoutButton.svelte`, `prep-terminal.ts`.

**Design reference:** `docs/notes/contrast-mockups.html` (Option C approved).

## Item 3: `each_key_duplicate` Console Error

**Problem:** Lighthouse logged `svelte.dev/e/each_key_duplicate` errors twice during page load. Static analysis found no duplicate keys in any `{#each}` block — all 3 keyed iterations use unique values (`line.id` monotonic counter, `player.playerId` UUID, `entry.roundId` integer).

**Diagnosis approach:** This is a runtime issue. Likely causes:
- Server sends duplicate entries in the `history` array (same `roundId` appearing twice)
- Server sends duplicate entries in `players` array (same `playerId`)
- Race condition where a store update fires before the previous render completes

**Fix:** Add defensive deduplication at the store level, filtering to unique keys before the data reaches `{#each}` blocks. This makes the client resilient regardless of server behavior.

**Investigation required at implementation time:** Reproduce the error by connecting to the live site and monitoring the browser console to identify which specific `{#each}` block triggers the duplicate key warning.

## Item 4: Meta Description

**File:** `src/client/index.html`

**Problem:** No `<meta name="description">` tag exists.

**Fix:** Add:
```html
<meta name="description" content="Crash Override — a provably fair multiplier crash game. Place your bet, watch the multiplier climb, and cash out before it crashes.">
```

## Item 5: Self-Host Google Fonts

**Files:**
- Remove: 3 lines from `src/client/index.html` (2 preconnect links + 1 stylesheet link)
- Create: `public/fonts/` directory with 4 woff2 files
- Add: `@font-face` declarations in `App.svelte` global styles

**Problem:** Google Fonts creates a 3-hop critical request chain (HTML → Google Fonts CSS → woff2 file) and a render-blocking CSS request. Also, the `fonts.googleapis.com` preconnect is missing the `crossorigin` attribute, making it a wasted connection.

**Fix:** Download and self-host the 4 font files:
- Fira Code Regular (400) woff2
- Fira Code Bold (700) woff2
- Space Mono Regular (400) woff2
- Space Mono Bold (700) woff2

Add `@font-face` declarations with `font-display: swap` in `App.svelte`'s `:global` styles. Remove all Google Fonts references from `index.html`.

**Benefits:** Eliminates the critical chain, the render-blocking CSS, and the preconnect issue all at once. Fonts are served from the same origin with no third-party dependency.

## Item 6: Security Headers

**File:** Create `public/_headers`

**Problem:** No security headers are set. Lighthouse flagged missing CSP, HSTS, COOP, and frame control as high severity (informational).

**Fix:** Add a `public/_headers` file. Cloudflare Workers with `[assets]` configuration supports `_headers` files (documented at developers.cloudflare.com/workers/static-assets/headers/). Since `wrangler.toml` does not set `run_worker_first`, Cloudflare's runtime serves matching static assets directly before invoking the Worker, so `_headers` rules apply to static asset responses. The `_headers` file itself is not served as a static asset — it is parsed by the runtime and applied as rules.

```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Cross-Origin-Opener-Policy: same-origin
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' wss://*.digitalmachinist.ca wss://crash-override.digitalmachinist.ca; img-src 'self' data:; frame-ancestors 'none'
```

CSP rationale:
- `style-src 'unsafe-inline'` — required for Svelte's scoped styles
- `font-src 'self'` — fonts are self-hosted after item 5
- `connect-src` — allows WebSocket connections to the game server
- `frame-ancestors 'none'` — equivalent to X-Frame-Options: DENY (CSP3)

## Item 7: bfcache (WebSocket Limitation)

**Problem:** Lighthouse reports score 0 for bfcache because pages with active WebSocket connections cannot enter the back/forward cache. This is a browser limitation, not an app bug.

**Fix:** No code change possible. Document as a known limitation. This will resolve automatically when browsers add bfcache support for WebSocket pages.

## Verification

After implementation, run a fresh Lighthouse audit against the deployed site to confirm:
- Accessibility score improves (target: 100)
- Best Practices score improves (target: 100)
- SEO score improves (target: 100)
- Performance diagnostics improve (shorter critical chain, no forced reflow)
- Console errors eliminated
- Security headers present in response
