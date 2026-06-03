# Smart Project & Task Collaboration System

Full-stack team collaboration app for projects, tasks, members, and progress tracking.
Built for the EAP 4.0 Assessment.

> Status: foundation in progress. Public live URLs land in a later subgoal.

---

## Stack

- **Backend** — Node.js + TypeScript, Express, Prisma, PostgreSQL. Raw JWT + bcrypt auth (no auth library). Modular per-feature layout (`constant`/`controller`/`routes`/`service`/`validation`).
- **Frontend** — Next.js (App Router) + TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form + Zod.
- **Infra** — Docker Compose (dev Postgres), GitHub Actions CI. Vercel (frontend) + Railway/Render (backend) for deploy.

---

## Repo layout

```
/
├── backend/        Express + Prisma server
├── frontend/       Next.js app
├── docs/           Planning (workflow + per-feature goal boards)
└── README.md
```

---

## Setup

> Prereqs: Node 20+, npm 10+, Docker (for Postgres).

```bash
# 1. Clone and install
git clone <repo-url> smart-collab
cd smart-collab

# 2. Copy env template
cp .env.example .env
# edit .env — REQUIRED before step 5:
#   - JWT_ACCESS_SECRET, JWT_REFRESH_SECRET (>=32 chars; openssl rand -base64 48)
#   - DEMO_ADMIN_PW, DEMO_PM_PW, DEMO_MEMBER_PW (seed throws if missing)

# 3. Start dev Postgres
npm run db:up

# 4. Install app deps (each app owns its own deps)
npm --prefix backend install
npm --prefix frontend install

# 5. Migrate + seed (env from step 2 must be set)
#    backend/.env is read by both prisma and the seed script
cp .env backend/.env
npm run db:migrate
npm run db:seed

# 6a. Run everything in one terminal (recommended)
npm run dev              # postgres + backend + frontend; Ctrl+C tears it all down

# 6b. Or split across two terminals
npm run dev:backend      # -> http://localhost:4000
npm run dev:frontend     # -> http://localhost:3000
```

---

## Features

Tracking the assessment scope. Each section ships as its own subgoal (`docs/goals/smart-collab/subgoals/<name>/`).

- **Auth** — email + password, RBAC (admin / project_manager / team_member), Demo Login for each role
- **Projects** — CRUD, status (Active / Completed / On Hold), filters, search
- **Tasks** — CRUD under projects, priority (H/M/L), status (Todo / In Progress / Completed), validation (no dup titles per project, no reassigning completed, no past deadlines)
- **Team** — add members to projects, assign tasks, per-member workload
- **Dashboard** — KPI cards, charts (priority / progress trend / productivity / status), upcoming deadlines, high-priority tasks
- **Activity log** — latest 5-10 actions with actor + timestamp
- **Search / filter / sort / pagination** — across projects, tasks, members
- **Extras** — dark/light mode, file attachments, comments, in-app notifications

---

## API routes (live)

### Auth — `/api/v1/auth`
| Method | Path           | Auth | Description                                  |
|--------|----------------|------|----------------------------------------------|
| POST   | `/signup`      | —    | Email + password signup (defaults to team_member) |
| POST   | `/login`       | —    | Email + password login                       |
| POST   | `/demo-login`  | —    | One-click demo login by role                 |
| POST   | `/refresh`     | —    | Rotate access + refresh cookies              |
| POST   | `/logout`      | —    | Clear cookies + revoke refresh session       |
| GET    | `/me`          | ✓    | Current user                                 |

### Projects — `/api/v1/projects`
| Method | Path     | Roles            | Description                                                                   |
|--------|----------|------------------|-------------------------------------------------------------------------------|
| GET    | `/`      | all authed       | List with `q`, `status`, `sort` (`created`/`deadline`/`updated`), `page`, `limit` (max 50) |
| GET    | `/:id`   | all authed       | Single project (includes creator)                                             |
| POST   | `/`      | admin, project_manager | Create (rejects past deadlines with 422 PAST_DEADLINE)                  |
| PATCH  | `/:id`   | admin, project_manager | Partial update (same past-deadline guard)                               |
| DELETE | `/:id`   | admin, project_manager | Hard delete                                                             |

### Frontend pages
- `/login`, `/signup` — auth
- `/dashboard` — landing
- `/projects` — list (URL-state filters, debounced search, pagination)
- `/projects/new` — create form (admin / PM)
- `/projects/[id]` — detail with creator, RBAC edit + delete
- `/projects/[id]/edit` — update form (admin / PM)
- `/forbidden` — 403 fallback

---

## Environment variables

See `.env.example` for the full list. Required keys:

### Backend
- `DATABASE_URL` — Postgres connection string
- `JWT_ACCESS_SECRET` — sign access tokens
- `JWT_REFRESH_SECRET` — sign refresh tokens
- `ACCESS_TOKEN_TTL` — e.g. `15m`
- `REFRESH_TOKEN_TTL` — e.g. `7d`
- `CORS_ORIGINS` — comma-separated allowlist (e.g. `http://localhost:3000`)
- `COOKIE_DOMAIN` — `localhost` for dev
- `NODE_ENV` — `development` | `production`
- `PORT` — backend port (default 4000)
- `DEMO_ADMIN_PW` — password seeded into the admin demo account
- `DEMO_PM_PW` — password seeded into the project manager demo account
- `DEMO_MEMBER_PW` — password seeded into the team member demo account

### Frontend
- `NEXT_PUBLIC_API_URL` — backend origin (e.g. `http://localhost:4000`)

---

## Demo credentials

Seeded by `npm run db:seed`. Passwords come from the env vars above — set them before seeding. Documented in the README so the assessment reviewer can sign in:

| Role            | Email                  | Password env var   |
|-----------------|------------------------|--------------------|
| Admin           | admin@demo.local       | `DEMO_ADMIN_PW`    |
| Project Manager | pm@demo.local          | `DEMO_PM_PW`       |
| Team Member    | member@demo.local      | `DEMO_MEMBER_PW`   |

Frontend exposes a **Demo Login** button per role on the `/login` page — one click signs you in.

---

## Deployment

> Filled in by the `deploy-and-readme` subgoal. Live URLs added here once the backend (Railway/Render) and frontend (Vercel) are live.

- **Frontend (Vercel)** — configured via `frontend/vercel.ts`
- **Backend (Railway/Render)** — Dockerfile-based deploy

---

## Development workflow

Project follows the 4-phase loop in `docs/WORKFLOW.md`. Per-feature boards live under `docs/goals/<feature>/`. Each task in a board carries a real `receipt` (proof) before being marked `done`.

Branches:
- `main` — protected, production
- `develop` — staging, all features merge here first
- `feature/*` — branched off `develop`

---

## Scripts (root)

| Script                 | What it does                                      |
|------------------------|---------------------------------------------------|
| `npm run dev`          | Start full stack (postgres + backend + frontend); Ctrl+C stops all. Heap-capped (backend 768MB, frontend 1.5GB). Override with `SC_BACKEND_HEAP_MB` / `SC_FRONTEND_HEAP_MB`. Uses webpack (lower RAM than Turbopack). |
| `npm run dev:backend`  | Start backend in watch mode                       |
| `npm run dev:frontend` | Start Next.js dev server (webpack)                |
| `npm test`             | Run backend + frontend test suites                |
| `npm run lint`         | Lint both apps                                    |
| `npm run typecheck`    | Type-check both apps                              |
| `npm run db:up`        | Start dev Postgres (Docker Compose)               |
| `npm run db:migrate`   | Apply Prisma migrations                           |
| `npm run db:seed`      | Seed demo users                                   |
