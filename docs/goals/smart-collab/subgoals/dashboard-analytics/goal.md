# Goal — dashboard-analytics (subgoal)

Parent: `smart-collab` (assessment app)
Branch: `feature/dashboard-analytics` off `develop`
Mode: brownfield · feature · new session

---

## What
- Backend `dashboard` module mirroring existing module pattern (constant/validation/service/controller/routes)
- Split endpoints under `/api/v1/dashboard` and `/api/v1/projects/:id/dashboard/*`:
  - `GET /api/v1/dashboard/kpis` (or `/projects/:id/dashboard/kpis`) → counts: total projects (global), total tasks, completed tasks, completion %, my open tasks (assigned to caller)
  - `GET .../dashboard/status` → tasks grouped by status `{todo, in_progress, completed}` (donut data)
  - `GET .../dashboard/priority` → tasks grouped by priority `{low, medium, high}` (bar data)
  - `GET .../dashboard/productivity?days=30` → daily completed-tasks series for last N days (line data)
  - `GET .../dashboard/upcoming?days=7` → tasks (and projects) w/ dueDate/deadline in next N days, ordered ascending
  - `GET .../dashboard/high-priority` → tasks where priority=high AND status!=completed
- Visibility / RBAC:
  - Global endpoints: any authed user. Numbers reflect ALL projects/tasks visible to the caller (assessment app is single-tenant; admin and PM see everything, members see everything they have a row in OR all if assessment expects open visibility — default OPEN visibility same as existing list endpoints)
  - Per-project endpoints: caller must be project member OR system admin (reuse `requireProjectRole('member')`)
- Frontend `recharts` dep + components:
  - `KpiCard` — title + big number + optional sub-label
  - `StatusDonut` — recharts PieChart
  - `PriorityBar` — recharts BarChart
  - `ProductivityLine` — recharts LineChart (X axis: date label, Y: completed count)
  - `UpcomingList` — card listing next 7 days items (tasks first, then project deadlines)
  - `HighPriorityList` — card listing open high-priority tasks
- Pages:
  - `/dashboard` — global page replacing current placeholder shell. 4 KPI cards top row; status donut + priority bar middle row; productivity line full-width; upcoming + high-priority side-by-side bottom
  - `/projects/[id]/dashboard` — same component grid scoped to one project; reachable from project detail page
- Tests: backend integration per endpoint + RBAC matrix on project-scoped variants; frontend page + each chart component + hooks

## Why
§6 of assessment: dashboard with task summary (counts), upcoming deadlines, high-priority highlights, charts (priority + progress + productivity + status). §8 reinforces upcoming + high-priority. Tasks + projects + members all exist; this is the read-side aggregation layer that lets the user finally see signal across them. Per-project variant lets a PM/member focus on a single project.

## Done looks like
1. `GET /api/v1/dashboard/kpis` returns `{ totalProjects, totalTasks, completedTasks, completionPct, myOpenTasks }` for any authed user
2. `GET /api/v1/projects/:id/dashboard/kpis` returns the same shape (totalProjects always 1) scoped to one project; 403 FORBIDDEN_PROJECT_ROLE if caller not a project member or admin
3. `GET /api/v1/dashboard/status` returns `{ todo, in_progress, completed }` count map; same for per-project variant
4. `GET /api/v1/dashboard/priority` returns `{ low, medium, high }` count map; same for per-project variant
5. `GET /api/v1/dashboard/productivity?days=30` returns `[{ date: 'YYYY-MM-DD', completed: number }]` of length 30 (zero-fill missing days); per-project variant scopes
6. `GET /api/v1/dashboard/upcoming?days=7` returns `{ tasks: [{id,title,dueDate,projectId,priority,status}], projects: [{id,name,deadline}] }` ordered ascending by date
7. `GET /api/v1/dashboard/high-priority` returns `[{id,title,projectId,dueDate,status,assignee:{name,email}|null}]`
8. All endpoints reject `days` < 1 or > 365 with 422 VALIDATION_ERROR; default values when omitted
9. Per-project endpoints all enforce `requireProjectRole('member')` (admin bypasses)
10. `/dashboard` page renders all 6 widgets (4 KPI + status donut + priority bar + productivity line + upcoming + high-priority) using TanStack Query hooks; loading skeletons + error retry per widget
11. `/projects/[id]/dashboard` renders same components scoped to projectId via different hook
12. Project detail page: add `Dashboard →` button next to `View tasks` and `Members`
13. recharts container is responsive (uses `ResponsiveContainer`)
14. Empty-data branches render gracefully (`No data yet` placeholders for charts; empty list cards for lists)
15. Backend coverage on `dashboard.*` files ≥80%; frontend coverage on dashboard pages + components + hooks ≥70%
16. CI green on PR `feature/dashboard-analytics` → `develop`

## Mode
- project_type: brownfield (extends foundation + projects-crud + tasks-crud + team-members)
- scope: feature
- session: new
- inherits parent stack + constraints

## Scope of this subgoal

### Backend (`backend/src/app/modules/dashboard/`)
- `dashboard.constant.ts` — `DEFAULT_PRODUCTIVITY_DAYS=30`, `MAX_DAYS=365`, `DEFAULT_UPCOMING_DAYS=7`, status/priority enums re-exported for convenience
- `dashboard.validation.ts` — Zod query schemas: `daysQuerySchema`, `projectIdParamSchema`
- `dashboard.service.ts` — pure aggregation functions: `getKpis(scope)`, `getStatusCounts(scope)`, `getPriorityCounts(scope)`, `getProductivity(scope, days)`, `getUpcoming(scope, days)`, `getHighPriority(scope)`. `scope = { projectId?: string, actorId: string }`. All use `prisma.task.groupBy` + `prisma.task.count` + `prisma.project.findMany` — batched via `Promise.all`
- `dashboard.controller.ts` — thin handlers; supplies `actorId` from `req.user`; routes determine `projectId` from params if nested
- `dashboard.routes.ts` — global router mounted at `/api/v1/dashboard`; nested router as project child at `/:id/dashboard` w/ `requireProjectRole('member')`
- Tests: integration per endpoint (global + per-project), RBAC on project-scoped variants, productivity zero-fill, days clamp, empty-data shapes

### Frontend
- `frontend/src/lib/schemas/dashboard.ts` — types: `Kpis`, `StatusCounts`, `PriorityCounts`, `ProductivityPoint`, `UpcomingPayload`, `HighPriorityTask`
- `frontend/src/lib/dashboard.ts` — API client (one fn per endpoint, global + per-project variants)
- `frontend/src/hooks/useDashboard.ts` — TanStack hooks: `useKpis(projectId?)`, `useStatusCounts(projectId?)`, `usePriorityCounts(projectId?)`, `useProductivity(projectId?, days)`, `useUpcoming(projectId?, days)`, `useHighPriority(projectId?)`
- `frontend/src/components/dashboard/` — `KpiCard.tsx`, `StatusDonut.tsx`, `PriorityBar.tsx`, `ProductivityLine.tsx`, `UpcomingList.tsx`, `HighPriorityList.tsx`. Each handles loading / empty / error states locally
- `frontend/src/app/dashboard/page.tsx` — global page replacing current shell
- `frontend/src/app/projects/[id]/dashboard/page.tsx` — per-project page
- Project detail page: add `Dashboard →` button
- recharts dep added to `frontend/package.json`
- Tests: vitest on each component (loading/empty/error/data), hooks (fetch + invalidate), pages (smoke: renders widget cards)

### Infra
- No new infra
- Existing Next 16 proxy.ts covers `/api/v1/dashboard` (catch-all)
- Postgres container unchanged

## Existing Tests (subgoal baseline)
- Backend test framework: Jest. Coverage cmd: `npm --prefix backend run test:coverage`
- Backend baseline: 287/287 passing (verified 2026-06-04 12:44)
- Frontend test framework: Vitest. Coverage cmd: `npm --prefix frontend run test:coverage`
- Frontend baseline: 198/198 passing (verified 2026-06-04 12:44)
- Baseline passing: yes

## Constraints (brownfield, must respect)
- Mirror existing module pattern exactly (constant/validation/service/controller/routes)
- Per-project endpoints reuse `requireProjectRole` middleware from team-members subgoal — do not duplicate
- No new mutations — dashboard is READ-ONLY
- No new prisma model (consumes existing Task/Project/ProjectMember)
- Task status / priority enums untouched
- `recharts` only new dep; pinned to a known stable major
- Productivity series MUST zero-fill missing days so frontend chart has continuous X-axis
- Upcoming "next N days" includes today (inclusive) and N-1 days forward
- High-priority list excludes completed tasks
- KPI `myOpenTasks` counts tasks where `assignedTo === actorId` AND `status !== 'completed'`
- All endpoints respect existing auth middleware (`requireAuth` globally)
- No activity log writes (→ t6)
- No notifications (→ t8)
- No client-side aggregation of raw task lists — server does the math; frontend renders

## Out of scope (handled later)
- Activity feed widget (→ t6 activity-log)
- Notifications panel (→ t8)
- Search across dashboard items (→ t7 search-filter-sort)
- Drilldown links from chart segments (defer to extras)
- Multi-project comparison view
- Date-range picker / custom productivity window UI controls beyond fixed default
- CSV/PDF export of dashboard
- Dark-mode chart palette tuning beyond default theme inheritance
