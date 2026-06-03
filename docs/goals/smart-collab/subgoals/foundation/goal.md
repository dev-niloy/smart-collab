# Goal: foundation (subgoal of smart-collab)

First subgoal. Stands up the monorepo, both apps, the database, raw auth, RBAC, and the demo seed. Nothing product-specific (projects/tasks/dashboard) ships here — those come in later subgoals.

Parent: `docs/goals/smart-collab/goal.md` (read first for stack + constraints).

---

## What
Working monorepo with:
- `/backend` Express+TS+Prisma server that boots, connects to Postgres, exposes `/healthz`, and serves a fully working raw-auth stack (signup / login / logout / refresh / me) with RBAC middleware
- `/frontend` Next.js+TS+Tailwind+shadcn app that boots, talks to the backend, and renders functional Login / Signup / Dashboard-shell pages with a working **Demo Login** button for all 3 roles
- Prisma schema + first migration + seed script producing the 3 demo accounts (admin, project_manager, team_member)
- CI (lint+typecheck+test) green on both apps
- Deploy plumbing wired (Vercel config for frontend, Dockerfile + Railway/Render config for backend) — actual public URLs come later in `deploy-and-readme` subgoal, but the pipes are ready

## Why
Every later subgoal (projects, tasks, dashboard…) depends on auth, RBAC, the module pattern, the validation/error infra, and the Prisma client. Build it once, build it right, never revisit. Also where the user proves the "raw auth, no library" backend story for the assessment.

## Done looks like
1. `npm --prefix backend run dev` → server boots, `GET /healthz` returns `{ ok: true }`, Postgres connection logged
2. `npm --prefix frontend run dev` → `localhost:3000` renders Login page (shadcn-styled), Demo Login button works
3. From the frontend: signup → login → land on `/dashboard` (placeholder shell) → logout flow round-trips cleanly
4. Demo Login (any of 3 buttons) logs in as that role; `/me` returns correct role; route guards block disallowed pages
5. Hitting a protected backend route without a valid token → 401 with the project's `ApiError` shape
6. Hitting an RBAC-protected route with wrong role → 403 with the project's `ApiError` shape
7. `npm --prefix backend test` and `npm --prefix frontend test` both pass; coverage report runs (target >= 80% on auth + middleware files)
8. CI workflow passes on a PR from `feature/foundation` to `develop`

## Mode
- project_type: greenfield
- scope: feature
- session: new
- inherits everything else from parent (stack, constraints, file org)

## Scope of this subgoal

### Backend
- TS project init (`tsconfig`, eslint, prettier, jest)
- Express app boot (`app.ts` / `server.ts`) with Helmet, CORS (allowlist via env), morgan/pino logging, `express.json` limits
- Global error handler + `ApiError` / `AppError` classes mirroring `solvemeet_backend_api/src/app/errors/`
- Validation middleware (Zod-based) — generic `validate(schema)` wrapper
- Prisma init: schema with `User` + `Role` enum + `Session` (or refresh-token table) + `ActivityLog` placeholder (so later subgoals don't re-migrate the User table)
- First migration applied; client generated
- `auth` module (mirroring solvemeet pattern):
  - `auth.constant.ts` — JWT TTLs, cookie names, role list
  - `auth.validation.ts` — signup/login/refresh Zod schemas
  - `auth.service.ts` — register/login/logout/refresh/me; bcrypt hashing; JWT sign+verify; refresh-token rotation
  - `auth.controller.ts` — request -> service -> response, no business logic
  - `auth.routes.ts` — POST `/auth/signup`, POST `/auth/login`, POST `/auth/logout`, POST `/auth/refresh`, GET `/auth/me`, POST `/auth/demo-login` (body: `{ role }`)
- `middlewares/auth.ts` — verify access token, hydrate `req.user`
- `middlewares/rbac.ts` — `requireRole(...roles)` guard
- `config/env.ts` — typed env loader (Zod), fails fast
- `prisma/seed.ts` — creates 3 demo users with known passwords (env-driven, README documents them)
- Tests: unit on service (hashing, token rotation, role guard); integration on `/auth/*` routes
- `Dockerfile` for backend (matches deploy target)

### Frontend
- Next.js App Router init (TS, ESLint, Tailwind preset)
- shadcn init + base components (`button`, `input`, `form`, `card`, `dropdown-menu`, `toast`)
- `next-themes` wired (dark/light toggle in shell — even though §10 polishes it later, the provider lands here)
- `lib/api.ts` — fetch wrapper that attaches access token (httpOnly cookie OR header — locked in Phase 2 task), handles 401 refresh-once, exposes `apiGet/apiPost/...`
- `lib/auth.ts` — client-side auth helpers (login, logout, me)
- TanStack Query provider in root layout
- Routes:
  - `/` -> redirect to `/dashboard` if authed, else `/login`
  - `/login` — form (RHF + Zod), Demo Login section with 3 buttons
  - `/signup` — form
  - `/dashboard` — placeholder shell with header (user email + role + logout)
  - `/forbidden` — generic 403 page
- Middleware (`middleware.ts`) — gate protected routes; redirect unauthed users
- Vitest setup + one smoke test per page (renders)
- `vercel.ts` config stub

### Infra / repo
- Root `package.json` (workspaces) OR root scripts forwarding to `--prefix`
- Root `README.md` skeleton
- Root `.env.example` (frontend + backend keys)
- GitHub Actions: `ci.yml` running lint + typecheck + test for both apps on PR
- Branches: `main` (protected), `develop` (default), this subgoal lives on `feature/foundation`

## Existing Tests (subgoal baseline)
- Backend: Jest — set up in this subgoal. Baseline = 0% before, target >= 80% on auth+middleware by end.
- Frontend: Vitest + RTL — set up in this subgoal. Baseline = 0% before, target >= 70% on auth pages + api lib by end.
- Coverage commands as per parent goal.md.

## Constraints (inherited + subgoal-specific)
- Everything in parent `Constraints` section applies.
- **No auth library.** Bcrypt + jsonwebtoken + Prisma only.
- **Refresh tokens stored hashed** in DB (`Session` table). Never plaintext.
- **Demo passwords from env** — not hardcoded in seed.ts. README explains how to set them.
- **`User` model fields are locked here** — later subgoals must NOT alter existing columns; only add new tables / columns. Lock list:
  - `id` (uuid), `email` (unique), `name`, `passwordHash`, `role` (enum: admin / project_manager / team_member), `createdAt`, `updatedAt`
- **CORS allowlist** — backend reads `CORS_ORIGINS` env, no wildcard in non-dev envs.
- **Validation server-side first.** Any client-side schema must mirror server Zod schema.

## Out of scope (handled by later subgoals)
- Projects, tasks, members, dashboards, charts, search/filter, activity log content, file uploads, comments, notifications
- Email verification + password reset flows (note: stub fields if needed, no flow)
- Actual public deploy URLs (pipes only, push happens in `deploy-and-readme`)
- Production Postgres provisioning (dev = Docker / Neon free tier is fine for now)
