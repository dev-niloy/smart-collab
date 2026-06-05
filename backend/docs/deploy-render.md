# Deploy backend to Render

Target: `https://<service>.onrender.com` — Free Web Service, auto-deploy on push.

## Service config (Render dashboard)

| Field | Value |
|---|---|
| Type | Web Service |
| Environment | Node |
| Region | (closest free region) |
| Branch | `main` (or `develop` while staging) |
| Root Directory | `backend` |
| Build Command | `npm ci --include=dev && npm run build:prod` |
| Start Command | `npm run start:prod` |
| Health Check Path | `/healthz` |
| Instance Type | Free |
| Auto-Deploy | Yes |

Notes
- `--include=dev` keeps `typescript`, `prisma`, `tsx` available for build + seed. Render reuses the same image at start, so devDeps persist into runtime — `tsx prisma/seed.ts` works without moving tsx to `dependencies`.
- `build:prod` = `prisma generate && tsc --project tsconfig.build.json` → emits `dist/`.
- `start:prod` = `npm run db:migrate:deploy && npm run db:seed && node dist/server.js` → migrates, idempotently seeds the 3 demo accounts, then boots.
- `/healthz` is the Render-pinged liveness endpoint — already implemented.

## Environment variables

Set every value in the Render dashboard. Never commit any of these.

| Key | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | flips cookies to `samesite=none; secure` and enables CORS `*` stripping |
| `PORT` | (leave unset; Render injects) | Render passes its assigned port via `$PORT` |
| `DATABASE_URL` | `postgresql://...neon.tech/...?sslmode=require&pgbouncer=true` | use the **pooled** Neon connection string |
| `JWT_ACCESS_SECRET` | 40+ random chars | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | 40+ random chars, **different from access** | `openssl rand -hex 32` |
| `ACCESS_TOKEN_TTL` | `15m` | |
| `REFRESH_TOKEN_TTL` | `7d` | |
| `CORS_ORIGINS` | `https://<your-app>.vercel.app` | exact origin; comma-list allowed; wildcard `*` is stripped in prod |
| `COOKIE_DOMAIN` | leave empty / single space | cross-site cookie scoped to Render host; do not pin to a domain unless using a custom one |
| `DEMO_ADMIN_PW` | random ≥12 chars | seeded as demo admin password |
| `DEMO_PM_PW` | random ≥12 chars | seeded as demo PM password |
| `DEMO_MEMBER_PW` | random ≥12 chars | seeded as demo member password |
| `ENABLE_DEMO_LOGIN` | `true` | required for assessment Demo Login button |
| `UPLOAD_DIR` | `/tmp/uploads` | Render free disk is ephemeral; uploads only survive until restart |

## First deploy

1. Create Render service with the config above.
2. Paste all env vars (use the Neon pooled string for `DATABASE_URL`).
3. Trigger first deploy.
4. Watch build logs: should see `prisma generate` → `tsc` → no errors.
5. Watch start logs: `prisma migrate deploy` applies all migrations to Neon → seed upserts 3 users → server listens on `$PORT`.
6. Smoke: `curl -i https://<service>.onrender.com/healthz` → expect `200 {"status":"ok"}`.

## Post-deploy

- Free tier sleeps after ~15 min idle → first request after sleep ≈ 30 s cold start. Acceptable for the assessment review.
- Logs: Render dashboard → service → Logs tab.
- Rollback: Render dashboard → Deploys tab → Redeploy any previous green build.
