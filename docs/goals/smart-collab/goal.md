# Goal: smart-collab (parent — whole assessment)

Charter for **Smart Project & Task Collaboration System** (EAP 4.0 Assessment).
This parent goal owns the assessment-level SPEC. Each section ships as a subgoal under `subgoals/`.

Source brief: `EAP 4.0 Assessment Task .md` (local-only, gitignored).

---

## What
Full-stack team collaboration app: projects → tasks → members, with RBAC, validation, dashboard analytics, activity log, search/filter. Deployed publicly.

## Why
Assessment deliverable. Also a portfolio piece showing raw backend craft (auth from scratch, modular Express+Prisma, validation, RBAC) paired with modern Next.js frontend.

## Done looks like
- Live URL (Vercel frontend + Railway/Render backend) reachable from clean browser
- GitHub repo (monorepo) with README covering setup, env vars, demo creds, deploy steps
- Demo Login button works for all 3 roles (admin / project manager / team member)
- All 10 assessment sections covered with observable behavior
- All subgoals reach `[DONE]` in their own state.yaml

---

## Mode (project-level — inherited by subgoals)
- **project_type:** greenfield
- **scope:** full-project (composed of feature-scoped subgoals)
- **session:** new

---

## Tech Stack

### Backend (`/backend`)
- Node.js + TypeScript (strict)
- Express
- Prisma ORM + PostgreSQL
- **Raw auth from scratch** — bcrypt + JWT (access + refresh), session/token middleware, RBAC middleware. NO better-auth. NO Clerk. Hand-rolled to showcase backend depth.
- Zod (or joi) for validation
- Pino/winston for logging
- Jest for tests
- Module pattern mirrors `solvemeet_backend_api/src/app/modules/<feature>/`:
  - `<feature>.constant.ts`
  - `<feature>.controller.ts`
  - `<feature>.routes.ts`
  - `<feature>.service.ts`
  - `<feature>.validation.ts`

### Frontend (`/frontend`)
- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- TanStack Query (server state) + Zustand or React Context (UI state)
- React Hook Form + Zod (client validation, mirror server schemas)
- Recharts (analytics)
- next-themes (dark/light)

### Infra
- Monorepo: `/backend`, `/frontend` at root (single GitHub repo)
- PostgreSQL: Neon / Supabase / Railway-managed
- Deploy: Vercel (frontend) + Railway or Render (backend + Postgres)
- CI: GitHub Actions — lint + typecheck + test on PR

---

## Architecture (high-level)

```
[Next.js client] --HTTPS--> [Express API] --Prisma--> [PostgreSQL]
       |                          |
   shadcn UI                  raw JWT auth
   TanStack Query             RBAC middleware
                              activity log writer
```

- Frontend never touches DB directly. All data via backend REST.
- Auth: access token in httpOnly cookie OR Authorization header (decide in foundation subgoal). Refresh token rotation.
- RBAC enforced in backend middleware per route; frontend hides UI but never trusts client.

---

## File Organization

```
/
├── backend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── modules/<feature>/   # constant, controller, routes, service, validation
│   │   │   ├── middlewares/         # auth, rbac, error, validation
│   │   │   ├── errors/              # AppError, ApiError
│   │   │   └── routes/              # root router composing modules
│   │   ├── config/                  # env, db, jwt
│   │   ├── helpers/
│   │   ├── shared/
│   │   ├── utils/
│   │   ├── app.ts
│   │   └── server.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── tests/
├── frontend/
│   ├── src/app/                     # Next.js App Router
│   ├── src/components/ui/           # shadcn
│   ├── src/components/<feature>/
│   ├── src/lib/                     # api client, auth helpers
│   ├── src/hooks/
│   └── src/stores/
├── docs/                            # this folder
└── README.md
```

---

## Existing Tests (greenfield baseline)
- Backend test framework: **Jest**
- Backend coverage command: `npm --prefix backend run test:coverage`
- Frontend test framework: **Vitest + React Testing Library** (Playwright for E2E later)
- Frontend coverage command: `npm --prefix frontend run test:coverage`
- Existing coverage: 0% (greenfield)
- Baseline passing: yes (no tests yet → vacuously true; first task per subgoal sets up suite)

---

## Constraints
- **No better-auth, Clerk, NextAuth, etc.** Auth is hand-rolled. Non-negotiable.
- **No AI-attributed commits / branches / comments.** Per global rules.
- **`main` protected.** Work on `feature/*` off `develop`. PR + explicit user OK before merge.
- **Demo credentials** must be seeded and documented in README (3 roles).
- **Validation server-side first.** Client validation is UX sugar, never the gate.
- **Past deadlines, duplicate task titles per project, reassigning completed tasks → rejected at API boundary.** Mirror messages from assessment §4.
- **Activity log** writes happen inside the same transaction as the mutation that caused them where possible.

---

## Acceptance Criteria (assessment §1–§10 mapped)

Every item below must be observable on the deployed app.

### Auth (§1)
- Signup, login (email + password) work
- Logout invalidates session
- Demo Login button (one per role) — pre-filled, one-click in
- Role-based route + UI gating: admin / project_manager / team_member

### Projects (§2)
- CRUD projects: name, description, deadline, status (Active / Completed / On Hold)
- List view with filters + search

### Tasks (§3)
- CRUD tasks under a project: title, description, assignee, due date, priority (H/M/L), status (Todo / In Progress / Completed)
- Status change inline
- View tasks by project or by status

### Validation (§4)
- Duplicate task title in same project → 409 with exact message
- Reassigning completed task → 409 with exact message
- Past deadline → 422 with exact message

### Team (§5)
- Add members to projects
- Assign tasks to members
- Per-member task list view
- Workload summary: total / completed / pending per member

### Progress tracking (§6)
- Dashboard shows: total projects, total tasks, completed, pending, overdue
- Per-project summary card

### Activity log (§7)
- Latest 5–10 activities with timestamp + actor + action

### Dashboard analytics (§8)
- KPI cards (5 counts)
- Charts: tasks by priority, project progress trend, team productivity, status distribution
- Recent activities, upcoming deadlines, high-priority tasks, member workload

### Search/filter/sort (§9)
- Search projects, tasks, members
- Filter by status, priority, assignee, deadline status
- Sort: latest / nearest deadline / highest priority / recently updated
- Pagination on large lists

### Extras (§10)
- Dark/light mode
- File attachment on tasks
- Comments on tasks
- Notification system (basic)
- Analytics chart (covered by §8)

### Deployment (§12)
- Live URL works
- README has: setup, features, env vars, demo creds, deploy instructions

---

## Subgoals (planned — Phase 2 will lock the order)

1. `foundation` ← starting here. Monorepo + backend skeleton + Prisma + raw auth + RBAC + demo seed + frontend skeleton + deploy plumbing
2. `projects-crud` — §2
3. `tasks-crud` — §3 + §4 validation rules
4. `team-collab` — §5 (members, assignment, workload)
5. `dashboard-analytics` — §6 + §8
6. `activity-log` — §7
7. `search-filter-sort` — §9
8. `extras-polish` — §10 (dark mode, attachments, comments, notifications)
9. `deploy-and-readme` — §12

Each lives in `subgoals/<name>/` with its own `goal.md` + `state.yaml` + `progress.md`. Parent task is `[done]` only when child board reaches `phase: DONE`.

---

## Out of scope
- Real-time presence / live cursors
- Mobile native app
- Multi-tenant org switching (one workspace per user — RBAC handles access)
- Calendar integrations, Slack/email push beyond basic in-app notification
- Advanced reporting exports (CSV/PDF) unless explicitly asked
- Payment / billing
