# Deployment Plan: crash-override.digitalmachinist.ca

## Overview

Deploy the crash game (Cloudflare Worker + Durable Objects + static assets) to production at `crash-override.digitalmachinist.ca`, with automatic deploys on push to `main`.

---

## Architecture

```
GitHub push to main
  → GitHub Actions workflow
    → npm run build:client   (Vite → public/)
    → npx wrangler deploy    (Worker + DO + assets)
      → crash-override.digitalmachinist.ca
```

The Worker serves both the WebSocket Durable Object (partyserver) and static assets from the same domain — no separate CDN or hosting needed.

---

## Step 1: Cloudflare Dashboard — DNS

1. Go to **Cloudflare Dashboard → digitalmachinist.ca → DNS → Records**
2. You do NOT need to manually add a DNS record. When you configure a Custom Domain on the Worker (Step 3), Cloudflare automatically creates the required DNS record. Just verify it appears after setup.

---

## Step 2: Cloudflare Dashboard — Create the Worker (first deploy)

For the very first deploy, run manually from your local machine:

```bash
nvm use v20.20.1
npm run build:client
npx wrangler deploy
```

This creates the Worker named `crash-game` in your Cloudflare account. You'll need to authenticate with `npx wrangler login` first if you haven't already.

---

## Step 3: Cloudflare Dashboard — Custom Domain

1. Go to **Cloudflare Dashboard → Workers & Pages → crash-game → Settings → Domains & Routes**
2. Click **Add → Custom Domain**
3. Enter: `crash-override.digitalmachinist.ca`
4. Cloudflare will automatically:
   - Create a CNAME DNS record pointing to the Worker
   - Provision an SSL certificate
   - Route all traffic for that subdomain to your Worker

**Why Custom Domains over Routes:** Custom Domains handle DNS + SSL automatically. Routes require you to manually create DNS records and can have edge-case issues with Durable Objects.

---

## Step 4: Update `wrangler.toml` for production

Add production environment config and disable debug in production:

```toml
name = "crash-game"
main = "src/server/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "./public"

[vars]
CRASH_DEBUG = "false"

[[durable_objects.bindings]]
name = "CrashGame"
class_name = "CrashGame"

[[migrations]]
tag = "v1"
new_classes = ["CrashGame"]
```

Changes:
- Set `CRASH_DEBUG = "false"` for production (override locally with `wrangler dev --var CRASH_DEBUG:true`)

---

## Step 5: GitHub Actions — Automatic Deploy

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci --legacy-peer-deps

      - run: npm run build:client

      - run: npm run typecheck
      - run: npm run typecheck:server
      - run: npm run test
      - run: npm run lint

      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### GitHub Secret Setup

1. Go to **Cloudflare Dashboard → My Profile → API Tokens → Create Token**
2. Use the **"Edit Cloudflare Workers"** template
3. Permissions needed:
   - **Account / Workers Scripts / Edit**
   - **Account / Workers KV Storage / Edit** (needed for Durable Objects migrations)
   - **Zone / Workers Routes / Edit**
   - **Zone / DNS / Edit** (for Custom Domain management)
4. Zone Resources: **Include → digitalmachinist.ca**
5. Account Resources: **Include → your account**
6. Copy the token
7. Go to **GitHub → crash-game repo → Settings → Secrets and variables → Actions**
8. Click **New repository secret**
9. Name: `CLOUDFLARE_API_TOKEN`, Value: paste the token

---

## Step 6: Verify

After the first deploy (manual or via CI):

1. Visit `https://crash-override.digitalmachinist.ca` — should load the Svelte app
2. Open browser DevTools → Network → verify WebSocket connection upgrades successfully
3. Check **Cloudflare Dashboard → Workers & Pages → crash-game → Logs** for any errors

---

## Optional: Preview Deploys for PRs

Add a second workflow for PR preview environments if desired later:

```yaml
# .github/workflows/preview.yml — deploy to crash-game-preview on PRs
```

This is not required for the initial setup.

---

## Checklist

- [ ] `npx wrangler login` (one-time local auth)
- [ ] First deploy: `npm run build:client && npx wrangler deploy`
- [ ] Add Custom Domain in Cloudflare dashboard
- [ ] Create Cloudflare API token
- [ ] Add `CLOUDFLARE_API_TOKEN` secret to GitHub
- [ ] Create `.github/workflows/deploy.yml`
- [ ] Push to `main` and verify automatic deploy
- [ ] Visit `https://crash-override.digitalmachinist.ca` and test
