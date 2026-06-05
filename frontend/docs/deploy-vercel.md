# Deploy frontend to Vercel

Target: `https://<project>.vercel.app` — auto-deploy on push.

## Project import (Vercel dashboard)

| Field | Value |
|---|---|
| Framework Preset | Next.js (auto-detected) |
| Root Directory | `frontend` |
| Build Command | (default — `next build`) |
| Output Directory | (default — `.next`) |
| Install Command | (default — `npm install`) |
| Node Version | 20.x |
| Production Branch | `main` (or `develop` while staging) |

No overrides needed — Vercel detects Next.js from `frontend/package.json` and `next.config.ts`.

## Environment variables

Set under Vercel project → Settings → Environment Variables. Apply to **Production**, **Preview**, **Development**.

| Key | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<render-service>.onrender.com` | exact Render URL from the backend deploy, no trailing slash. Browser-exposed (NEXT_PUBLIC_*) by design — it is just the public API host. |

## First deploy

1. Import repo → pick Root Directory `frontend`.
2. Add `NEXT_PUBLIC_API_URL` env var pointing at the Render backend URL.
3. Deploy. Wait for green build.
4. Capture the Vercel URL — paste into the Render backend's `CORS_ORIGINS` env var (Phase C / task 8), then redeploy Render so CORS lets the Vercel origin through.

## Smoke

1. Open the Vercel URL in incognito.
2. Demo Login → each of 3 roles → dashboard loads.
3. DevTools → Application → Cookies: refresh-token cookie present with `Secure`, `HttpOnly`, `SameSite=None`.
4. DevTools → Network: API requests hit the Render URL; `Access-Control-Allow-Origin` echoes the Vercel origin exactly (no `*`).

## Rollback

Vercel dashboard → Deployments → ⋯ → Promote any previous deployment to Production.
