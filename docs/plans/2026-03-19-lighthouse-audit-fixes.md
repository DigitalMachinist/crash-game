# Lighthouse Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address all 7 actionable Lighthouse audit findings to improve accessibility, eliminate console errors, harden security, and optimize font loading.

**Architecture:** Seven independent fixes applied in sequence. Each fix is self-contained and can be committed independently. The color contrast fix (Item 2) is the largest, touching 16 files. Font self-hosting (Item 5) must complete before security headers (Item 6) since the CSP assumes `font-src 'self'`.

**Tech Stack:** Svelte 5, CSS custom properties, Cloudflare Workers `_headers`, woff2 self-hosted fonts

**Spec:** `docs/specs/2026-03-19-lighthouse-audit-fixes.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/client/components/TerminalDisplay.svelte` | Fix forced reflow (Item 1) |
| Modify | `src/types.ts` | Add `dimText` to `DangerColors` interface (Item 2) |
| Modify | `src/client/lib/threat.ts` | Add `dimText` values to `getDangerColors()` (Item 2) |
| Modify | `src/client/lib/__tests__/threat.test.ts` | Test `dimText` field in `getDangerColors()` (Item 2) |
| Modify | `src/client/App.svelte` | Add CSS variables, update `$dangerColors` effect (Item 2) |
| Modify | `src/client/lib/prep-terminal.ts` | Replace hardcoded `#805800` with `#c08400` (Item 2) |
| Modify | `src/client/components/BetForm.svelte` | Update text color references (Item 2) |
| Modify | `src/client/components/PlayerList.svelte` | Update text color references (Item 2) |
| Modify | `src/client/components/History.svelte` | Update text color references (Item 2) |
| Modify | `src/client/components/VerifyModal.svelte` | Update text color references (Item 2) |
| Modify | `src/client/components/FairnessModal.svelte` | Update text color references (Item 2) |
| Modify | `src/client/components/NameModal.svelte` | Update text color references (Item 2) |
| Modify | `src/client/components/ThreatPanel.svelte` | Update text color references (Item 2) |
| Modify | `src/client/components/ThreatMeter.svelte` | Update text color references (Item 2) |
| Modify | `src/client/components/ConnectionStatus.svelte` | Update text color references (Item 2) |
| Modify | `src/client/components/ObserverBanner.svelte` | Update text color references (Item 2) |
| Modify | `src/client/components/Multiplier.svelte` | Update text color references (Item 2) |
| Modify | `src/client/components/TargetInfo.svelte` | Update text color references (Item 2) |
| Modify | `src/client/components/CashoutButton.svelte` | Update text color references (Item 2) |
| Modify | `src/client/lib/message-handler.ts` | Add deduplication for history (Item 3) |
| Modify | `src/client/index.html` | Add meta description (Item 4), remove Google Fonts (Item 5) |
| Create | `src/client/public/fonts/fira-code-latin-400-normal.woff2` | Self-hosted font (Item 5) |
| Create | `src/client/public/fonts/fira-code-latin-700-normal.woff2` | Self-hosted font (Item 5) |
| Create | `src/client/public/fonts/space-mono-latin-400-normal.woff2` | Self-hosted font (Item 5) |
| Create | `src/client/public/fonts/space-mono-latin-700-normal.woff2` | Self-hosted font (Item 5) |
| Create | `src/client/public/_headers` | Security headers (Item 6) |

---

## Chunk 1: Performance and Contrast Fixes (Items 1-2)

### Task 1: Fix forced reflow in TerminalDisplay

**Files:**
- Modify: `src/client/components/TerminalDisplay.svelte:19-25`

- [ ] **Step 1: Fix the forced reflow**

In `src/client/components/TerminalDisplay.svelte`, replace lines 19-25:

Old:
```typescript
$effect(() => {
  // Scroll to bottom whenever lines change
  lines;
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
});
```

New:
```typescript
$effect(() => {
  // Scroll to bottom whenever lines change — deferred to avoid forced reflow
  lines;
  if (container) {
    const el = container;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }
});
```

The `el` capture prevents a stale `container` reference if the component unmounts before the rAF fires.

- [ ] **Step 2: Run tests to verify no regressions**

```bash
npm run test:svelte
```

Expected: All Svelte component tests pass. TerminalDisplay has no direct test, but the test suite confirms no breakage.

- [ ] **Step 3: Commit**

```bash
git add src/client/components/TerminalDisplay.svelte
git commit -m "fix: defer TerminalDisplay scroll to rAF to avoid forced reflow"
```

---

### Task 2: Extend DangerColors type with dimText field

**Files:**
- Modify: `src/types.ts:145-151`
- Modify: `src/client/lib/threat.ts:12-44`
- Modify: `src/client/lib/__tests__/threat.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/client/lib/__tests__/threat.test.ts`, inside the existing `getDangerColors` describe block (or create one if it doesn't exist):

```typescript
describe('getDangerColors dimText', () => {
  it('GHOST dimText is brighter than dim', () => {
    const colors = getDangerColors('GHOST');
    expect(colors.dimText).toBe('#c08400');
    expect(colors.dim).toBe('#805800');
  });

  it('every threat level has a dimText field', () => {
    const levels: ThreatLevel[] = ['GHOST', 'LOW', 'ELEVATED', 'HIGH', 'SEVERE', 'CRITICAL'];
    for (const level of levels) {
      const colors = getDangerColors(level);
      expect(typeof colors.dimText).toBe('string');
      expect(colors.dimText).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
```

Add the `ThreatLevel` import if not already present:
```typescript
import type { ThreatLevel } from '../../../types';
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- threat.test
```

Expected: FAIL — `dimText` property does not exist on `DangerColors`.

- [ ] **Step 3: Add dimText to DangerColors interface**

In `src/types.ts`, replace lines 145-151:

Old:
```typescript
export interface DangerColors {
  color: string;
  dim: string;
  bg: string;
  border: string;
  glowAlpha: number;
}
```

New:
```typescript
export interface DangerColors {
  color: string;
  dim: string;
  dimText: string;
  bg: string;
  border: string;
  glowAlpha: number;
}
```

- [ ] **Step 4: Add dimText values to getDangerColors()**

In `src/client/lib/threat.ts`, update each case in `getDangerColors()`. The `dimText` values are AA-compliant brightened variants of `dim`:

```typescript
export function getDangerColors(level: ThreatLevel): DangerColors {
  switch (level) {
    case 'GHOST':
      return {
        color: '#ffb000',
        dim: '#805800',
        dimText: '#c08400',
        bg: '#0a0800',
        border: '#332800',
        glowAlpha: 0.15,
      };
    case 'LOW':
      return { color: '#ffb000', dim: '#805800', dimText: '#c08400', bg: '#0a0800', border: '#332800', glowAlpha: 0.2 };
    case 'ELEVATED':
      return { color: '#ff8c00', dim: '#803000', dimText: '#c04800', bg: '#0f0800', border: '#332800', glowAlpha: 0.3 };
    case 'HIGH':
      return {
        color: '#ff6600',
        dim: '#803000',
        dimText: '#c04800',
        bg: '#100700',
        border: '#331800',
        glowAlpha: 0.35,
      };
    case 'SEVERE':
      return {
        color: '#ff4400',
        dim: '#800020',
        dimText: '#c00030',
        bg: '#120600',
        border: '#331800',
        glowAlpha: 0.45,
      };
    case 'CRITICAL':
      return { color: '#ff0040', dim: '#400000', dimText: '#800020', bg: '#1a0000', border: '#400000', glowAlpha: 0.6 };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test -- threat.test
```

Expected: All tests pass including the new `dimText` tests.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/client/lib/threat.ts src/client/lib/__tests__/threat.test.ts
git commit -m "feat: add dimText field to DangerColors for AA-compliant text contrast"
```

---

### Task 3: Add CSS variables and update App.svelte

**Files:**
- Modify: `src/client/App.svelte:146-159` (JS effect)
- Modify: `src/client/App.svelte:355-385` (CSS `:root`)
- Modify: `src/client/App.svelte:544-591` (CSS text color usages)

- [ ] **Step 1: Add new CSS custom properties to :root**

In `src/client/App.svelte`, in the `:global(:root)` block (after line 358), add the new text variables:

After `--color-primary-dim: #805800;` add:
```css
--color-primary-dim-text: #c08400;
```

After `--color-success-dim: #006633;` add:
```css
--color-success-dim-text: #1a9956;
```

After `--threat-dim: var(--color-primary-dim);` add:
```css
--threat-dim-text: var(--color-primary-dim-text);
```

- [ ] **Step 2: Update the $dangerColors effect to set --threat-dim-text**

In `src/client/App.svelte`, in the `$effect` at line 146-159, after line 150 (`root.style.setProperty('--threat-dim', colors.dim);`), add:

```typescript
root.style.setProperty('--threat-dim-text', colors.dimText);
```

- [ ] **Step 3: Update text color usages in App.svelte CSS**

In `src/client/App.svelte` CSS, update these `color:` properties (NOT `border-color:`):

Line 544: `color: var(--threat-dim, var(--color-primary-dim));` → `color: var(--threat-dim-text, var(--color-primary-dim-text));`
Line 548: `color: var(--threat-dim, var(--color-primary-dim));` → `color: var(--threat-dim-text, var(--color-primary-dim-text));`
Line 552: `color: var(--threat-dim, var(--color-primary-dim));` → `color: var(--threat-dim-text, var(--color-primary-dim-text));`
Line 566: `color: var(--color-success-dim);` → `color: var(--color-success-dim-text);`
Line 577: `color: var(--threat-dim, var(--color-primary-dim));` → `color: var(--threat-dim-text, var(--color-primary-dim-text));`
Line 591: `color: var(--color-primary-dim);` → `color: var(--color-primary-dim-text);`

Leave line 609 (`border: 1px solid var(--color-success-dim);`) unchanged — it's decorative.

- [ ] **Step 4: Run tests**

```bash
npm run test:svelte && npm run test
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/client/App.svelte
git commit -m "feat: add dim-text CSS variables and update App.svelte text colors for AA contrast"
```

---

### Task 4: Update hardcoded hex in prep-terminal.ts

**Files:**
- Modify: `src/client/lib/prep-terminal.ts:19,47,54,61,68,75`

- [ ] **Step 1: Replace all 6 occurrences of #805800**

In `src/client/lib/prep-terminal.ts`, replace all 6 occurrences of `#805800` with `#c08400`:

Lines 19, 47, 54, 61, 68, 75 — each has `color: '#805800'` → `color: '#c08400'`

- [ ] **Step 2: Run tests**

```bash
npm run test
```

Expected: All tests pass. prep-terminal.ts is a pure function with no direct tests, but the main suite confirms no breakage.

- [ ] **Step 3: Commit**

```bash
git add src/client/lib/prep-terminal.ts
git commit -m "fix: brighten hardcoded prep-terminal text colors for AA contrast"
```

---

### Task 5: Update component text color references

**Files:**
- Modify: 14 Svelte component files (see list below)

For each file, change `color:` properties that reference `--color-primary-dim` or `--color-success-dim` to use the `-text` variant. Leave `border-color:` and `border:` properties unchanged.

- [ ] **Step 1: Update BetForm.svelte**

In `src/client/components/BetForm.svelte`, replace all `color: var(--color-primary-dim)` with `color: var(--color-primary-dim-text)` on lines 152, 180, 195, 210, 244, 251, 259, 266.

- [ ] **Step 2: Update PlayerList.svelte**

In `src/client/components/PlayerList.svelte`, replace `color: var(--color-primary-dim)` with `color: var(--color-primary-dim-text)` on lines 48, 56, 83, 95, 114.

- [ ] **Step 3: Update History.svelte**

In `src/client/components/History.svelte`, replace `color: var(--color-primary-dim)` with `color: var(--color-primary-dim-text)` on lines 53, 61, 83, 98. Leave line 97 (`border: 1px solid var(--color-primary-dim)`) unchanged.

- [ ] **Step 4: Update VerifyModal.svelte**

In `src/client/components/VerifyModal.svelte`:
- Lines 113, 127, 153, 172, 180: `color: var(--color-primary-dim, #805800)` → `color: var(--color-primary-dim-text, #c08400)`
- Line 190: `border-color: var(--color-primary-dim, #805800)` — **leave unchanged** (decorative)

- [ ] **Step 5: Update FairnessModal.svelte**

In `src/client/components/FairnessModal.svelte`:
- Lines 150, 178, 204: `color: var(--color-primary-dim, #805800)` → `color: var(--color-primary-dim-text, #c08400)`
- Line 214: `border-color: var(--color-primary-dim, #805800)` — **leave unchanged** (decorative)

- [ ] **Step 6: Update NameModal.svelte**

In `src/client/components/NameModal.svelte`:
- Lines 98, 112, 130, 170: `color: var(--color-primary-dim, #805800)` → `color: var(--color-primary-dim-text, #c08400)`
- Line 178: `border-color: var(--color-primary-dim, #805800)` — **leave unchanged** (decorative)

- [ ] **Step 7: Update ThreatPanel.svelte**

In `src/client/components/ThreatPanel.svelte`:
- Lines 71, 77, 91: `color: var(--threat-dim, var(--color-primary-dim))` → `color: var(--threat-dim-text, var(--color-primary-dim-text))`
- Line 105: `border-color: var(--color-success-dim)` — **leave unchanged** (decorative)

- [ ] **Step 8: Update remaining components**

In `src/client/components/ThreatMeter.svelte`:
- Lines 47, 79: `color: var(--threat-dim, var(--color-primary-dim))` → `color: var(--threat-dim-text, var(--color-primary-dim-text))`

In `src/client/components/ConnectionStatus.svelte`:
- Lines 42, 56: `color: var(--color-primary-dim)` → `color: var(--color-primary-dim-text)`

In `src/client/components/ObserverBanner.svelte`:
- Line 24: `color: var(--threat-dim, var(--color-primary-dim))` → `color: var(--threat-dim-text, var(--color-primary-dim-text))`

In `src/client/components/Multiplier.svelte`:
- Lines 92, 120: `color: var(--color-primary-dim)` → `color: var(--color-primary-dim-text)`

In `src/client/components/TargetInfo.svelte`:
- Lines 42, 50, 61, 82: `color: var(--color-primary-dim)` → `color: var(--color-primary-dim-text)`

In `src/client/components/CashoutButton.svelte`:
- Line 38: `'var(--color-success-dim)'` → `'var(--color-success-dim-text)'`

- [ ] **Step 9: Run full test suite**

```bash
npm run test && npm run test:svelte
```

Expected: All tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/client/components/
git commit -m "fix: update 14 components to use AA-compliant dim-text color variables"
```

---

## Chunk 2: Console Error, Meta, Fonts, Security Headers (Items 3-7)

### Task 6: Fix each_key_duplicate console error

**Files:**
- Modify: `src/client/lib/message-handler.ts:48`

- [ ] **Step 1: Investigate which {#each} block triggers the error**

The error fires at runtime. The most likely source is `history.set(snapshot.history)` in `message-handler.ts:48`, where the server may send duplicate `roundId` entries. Add defensive deduplication before setting the store.

- [ ] **Step 2: Add deduplication for history**

In `src/client/lib/message-handler.ts`, replace line 48:

Old:
```typescript
history.set(snapshot.history);
```

New:
```typescript
// Deduplicate by roundId to prevent Svelte each_key_duplicate errors
const seen = new Set<number>();
const uniqueHistory = snapshot.history.filter((entry) => {
  if (seen.has(entry.roundId)) return false;
  seen.add(entry.roundId);
  return true;
});
history.set(uniqueHistory);
```

Note: The `players` store uses a `Record<string, PlayerSnapshot>` keyed by `playerId`, so duplicates are naturally deduplicated by the record key. No change needed there.

- [ ] **Step 3: Run tests**

```bash
npm run test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/client/lib/message-handler.ts
git commit -m "fix: deduplicate history entries to prevent each_key_duplicate console error"
```

---

### Task 7: Add meta description

**Files:**
- Modify: `src/client/index.html:5`

- [ ] **Step 1: Add meta description tag**

In `src/client/index.html`, after line 5 (`<title>Crash</title>`) but before the closing of other `<head>` content, add:

```html
<meta name="description" content="Crash Override — a provably fair multiplier crash game. Place your bet, watch the multiplier climb, and cash out before it crashes.">
```

- [ ] **Step 2: Commit**

```bash
git add src/client/index.html
git commit -m "feat: add meta description for SEO"
```

---

### Task 8: Self-host Google Fonts

**Files:**
- Modify: `src/client/index.html:7-9` (remove Google Fonts links)
- Create: `src/client/public/fonts/` (4 woff2 files)
- Modify: `src/client/App.svelte` (add @font-face declarations)

**Important:** Font files must go in `src/client/public/fonts/`, NOT `public/fonts/`. The `public/` directory is Vite's build output (`outDir: '../../public'` with `emptyOutDir: true` in `vite.config.ts`), which gets wiped on every `npm run build:client`. Vite's `publicDir` (default: `public` relative to `root: 'src/client'`) is `src/client/public/` — files here are copied as-is to the build output during build.

- [ ] **Step 1: Download the 4 woff2 font files**

Download from google-webfonts-helper (https://gwfh.mranftl.com/fonts) or fontsource. Select Fira Code (400, 700) and Space Mono (400, 700), latin subset, woff2 format.

Alternatively, extract URLs from the Google Fonts CSS:

```bash
mkdir -p src/client/public/fonts
curl -s 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&family=Space+Mono:wght@400;700&display=swap' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120' \
  | grep -Eo "url\([^)]*\.woff2" | sed 's/url(//' | while read url; do
    filename=$(echo "$url" | sed 's/.*\///')
    curl -s -o "src/client/public/fonts/$filename" "$url"
  done
```

The expected files (names may vary based on source):

- `src/client/public/fonts/fira-code-latin-400-normal.woff2`
- `src/client/public/fonts/fira-code-latin-700-normal.woff2`
- `src/client/public/fonts/space-mono-latin-400-normal.woff2`
- `src/client/public/fonts/space-mono-latin-700-normal.woff2`

Verify the files exist and have reasonable sizes (typically 20-50 KB each):

```bash
ls -la src/client/public/fonts/
```

- [ ] **Step 2: Add @font-face declarations to App.svelte**

In `src/client/App.svelte`, in the `<style>` section, add before the `:global(*, *::before, *::after)` rule (around line 349):

```css
@font-face {
  font-family: 'Fira Code';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/fira-code-latin-400-normal.woff2') format('woff2');
}
@font-face {
  font-family: 'Fira Code';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/fira-code-latin-700-normal.woff2') format('woff2');
}
@font-face {
  font-family: 'Space Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/space-mono-latin-400-normal.woff2') format('woff2');
}
@font-face {
  font-family: 'Space Mono';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/space-mono-latin-700-normal.woff2') format('woff2');
}
```

Note: Adjust filenames to match whatever was actually downloaded in Step 1.

- [ ] **Step 3: Remove Google Fonts references from index.html**

In `src/client/index.html`, remove lines 7-9:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
```

- [ ] **Step 4: Build and verify fonts load**

```bash
npm run build:client
```

Expected: Build succeeds. Verify the fonts directory is included in the build output.

- [ ] **Step 5: Run tests**

```bash
npm run test && npm run test:svelte
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/client/public/fonts/ src/client/App.svelte src/client/index.html
git commit -m "perf: self-host Google Fonts to eliminate critical request chain

Replaces Google Fonts CDN with self-hosted woff2 files.
Eliminates 3-hop critical chain, render-blocking CSS, and
fixes unused preconnect crossorigin attribute."
```

---

### Task 9: Add security headers

**Files:**
- Create: `src/client/public/_headers`

**Important:** Like fonts, the `_headers` file must go in `src/client/public/` (Vite's `publicDir`), not `public/` (build output). Vite copies it as-is to the build output during build.

- [ ] **Step 1: Create the _headers file**

Create `src/client/public/_headers` with the following content:

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
- `style-src 'unsafe-inline'` — Svelte injects scoped styles
- `font-src 'self'` — fonts are self-hosted (Task 8)
- `connect-src` includes WebSocket origins for PartyKit
- No external font CDN needed

- [ ] **Step 2: Commit**

```bash
git add src/client/public/_headers
git commit -m "sec: add security headers via Cloudflare Workers _headers file

Adds CSP, HSTS, COOP, X-Frame-Options, X-Content-Type-Options,
Referrer-Policy, and Permissions-Policy."
```

---

### Task 10: Item 7 — bfcache (no code change)

The Lighthouse audit reports score 0 for bfcache because pages with active WebSocket connections cannot enter the back/forward cache. This is a browser limitation (`failureType: "Pending browser support"`), not an application bug. No code change is possible — this will resolve automatically when browsers add bfcache support for WebSocket pages.

---

### Task 11: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npm run test:all
```

Expected: All tests across all 3 configs pass.

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: No type errors (especially after adding `dimText` to `DangerColors`).

- [ ] **Step 3: Run lint and format**

```bash
npm run check
```

Expected: Clean. If format issues exist, run `npm run format` and commit.

- [ ] **Step 4: Build client**

```bash
npm run build:client
```

Expected: Build succeeds with self-hosted fonts bundled.

- [ ] **Step 5: Commit any remaining adjustments**

If any fixes were needed during verification:

```bash
git add <specific files>
git commit -m "fix: address verification issues for Lighthouse audit fixes"
```
