# Plan — dashboard-analytics (Phase 2 GSD)

Parent SPEC: `docs/goals/smart-collab/subgoals/dashboard-analytics/goal.md`
Branch: `feature/dashboard-analytics` (off develop@620790f)
Mode: brownfield · feature · new session

Every task ends with a commit. Steps: 1. RED 2. GREEN 3. REFACTOR 4. Commit.
Update Status `[ ] -> [x]` after commit. Update progress.md after each.

---

## Phase A — Backend service core

### Task 1: dashboard.constant.ts + dashboard.validation.ts + zod tests
Files:
  - `backend/src/app/modules/dashboard/dashboard.constant.ts`
  - `backend/src/app/modules/dashboard/dashboard.validation.ts`
  - `backend/src/app/modules/dashboard/__tests__/dashboard.validation.test.ts`
Steps:
- 1. RED: 6 zod tests — daysQuerySchema: default 30 / clamps via z.number().int().min(1).max(365); rejects -1, 0, 366, NaN; coerces "10" → 10
- 2. GREEN: constants `DEFAULT_PRODUCTIVITY_DAYS=30`, `DEFAULT_UPCOMING_DAYS=7`, `MAX_DAYS=365`; validation schemas
- 3. REFACTOR: factor `daysField` helper
- 4. Commit `[A1] dashboard: constants + zod validation + 6/6`
Status: [ ]

### Task 2: dashboard.service — getKpis (global + scoped)
Files:
  - `backend/src/app/modules/dashboard/dashboard.service.ts`
  - `backend/src/app/modules/dashboard/__tests__/dashboard.service.kpis.test.ts`
Steps:
- 1. RED: 5 tests — getKpis({actorId}) returns `{totalProjects, totalTasks, completedTasks, completionPct, myOpenTasks}`; getKpis({projectId, actorId}) scopes; completionPct rounds to int; division by zero → 0; myOpenTasks excludes completed
- 2. GREEN: `Promise.all` of `project.count` + 4 `task.count` w/ where filters
- 3. REFACTOR: extract `taskScope(where, projectId)` helper
- 4. Commit `[A2] dashboard.service: getKpis global+scoped + 5/5`
Status: [ ]

### Task 3: dashboard.service — getStatusCounts + getPriorityCounts
Files:
  - `backend/src/app/modules/dashboard/dashboard.service.ts`
  - `backend/src/app/modules/dashboard/__tests__/dashboard.service.groupings.test.ts`
Steps:
- 1. RED: 6 tests — status returns `{todo, in_progress, completed}` zeros included when no tasks; priority returns `{low, medium, high}` same; scoped variants; uses single groupBy each
- 2. GREEN: `prisma.task.groupBy({by:['status'], _count:{_all:true}})` then zero-fill missing keys; same for priority
- 3. REFACTOR: extract `zeroFillBy<K>(rows, keys)`
- 4. Commit `[A3] dashboard.service: status + priority counts + 6/6`
Status: [ ]

### Task 4: dashboard.service — getProductivity (zero-filled date series)
Files:
  - `backend/src/app/modules/dashboard/dashboard.service.ts`
  - `backend/src/app/modules/dashboard/__tests__/dashboard.service.productivity.test.ts`
Steps:
- 1. RED: 5 tests — returns array length=days; ascending dates ending today; zero-fill days w/ no completed tasks; groups by `DATE(updatedAt)` for tasks where `status=completed`; scoped variant
- 2. GREEN: `prisma.$queryRaw` w/ `DATE_TRUNC('day', "updatedAt")` for portability; then zero-fill loop in JS
- 3. REFACTOR: extract `dateKey(d) -> YYYY-MM-DD`
- 4. Commit `[A4] dashboard.service: productivity + 5/5 (zero-fill)`
Status: [ ]

### Task 5: dashboard.service — getUpcoming + getHighPriority
Files:
  - `backend/src/app/modules/dashboard/dashboard.service.ts`
  - `backend/src/app/modules/dashboard/__tests__/dashboard.service.lists.test.ts`
Steps:
- 1. RED: 6 tests — upcoming returns `{tasks:[],projects:[]}` ordered ascending by date; only items w/ dueDate in [now, now+days]; excludes completed tasks; scoped variant; highPriority filters priority=high AND status!=completed; returns assignee w/ minimal user shape; scoped variant
- 2. GREEN: 2 prisma queries (task.findMany + project.findMany) for upcoming; 1 task.findMany w/ priority=high for highPriority
- 3. REFACTOR: shared `userMiniSelect`
- 4. Commit `[A5] dashboard.service: upcoming + high-priority + 6/6`
Status: [ ]

---

## Phase B — Backend routes + controllers

### Task 6: dashboard.controller + routes (global + nested) + happy-path
Files:
  - `backend/src/app/modules/dashboard/dashboard.controller.ts`
  - `backend/src/app/modules/dashboard/dashboard.routes.ts`
  - `backend/src/app/modules/project/project.routes.ts` (mount nested)
  - `backend/src/app/routes/index.ts` (mount global)
  - `backend/src/app/modules/dashboard/__tests__/dashboard.routes.test.ts`
Steps:
- 1. RED: 12 happy tests — each of 6 endpoints (kpis, status, priority, productivity, upcoming, high-priority) responds 200 w/ correct shape for global AND per-project variant; admin can hit any project variant; project member can hit own project
- 2. GREEN: thin handlers; routes mounted at `/api/v1/dashboard` (global) and `/projects/:id/dashboard` (nested w/ mergeParams + requireProjectRole('member'))
- 3. REFACTOR: dedupe controller bodies via factory
- 4. Commit `[B6] dashboard: controller + routes (global + nested) + 12 happy`
Status: [ ]

### Task 7: dashboard routes negatives (RBAC + validation)
Files: `backend/src/app/modules/dashboard/__tests__/dashboard.routes.test.ts`
Steps:
- 1. RED: 8 negative tests — 401 unauth on /kpis; 403 FORBIDDEN_PROJECT_ROLE on /projects/:id/dashboard/kpis from non-member; 422 days=0/days=999 on productivity + upcoming; 404 PROJECT_NOT_FOUND on /projects/<unknown>/dashboard/*
- 2. GREEN: ensure error mapping
- 3. REFACTOR: factor seed helpers
- 4. Commit `[B7] dashboard: route negatives + 8/8`
Status: [ ]

---

## Phase C — Frontend lib + hooks + dep

### Task 8: install recharts + lib/schemas/dashboard + lib/dashboard client
Files:
  - `frontend/package.json` (+ recharts dep)
  - `frontend/src/lib/schemas/dashboard.ts`
  - `frontend/src/lib/dashboard.ts`
  - `frontend/src/lib/__tests__/dashboard.test.ts`
Steps:
- 1. RED: 8 tests — fetch wrappers hit correct paths (global + per-project), unwrap data, ApiError surfaces on non-2xx; client respects `days` query param
- 2. GREEN: install recharts (pinned), write types + fetch wrappers
- 3. REFACTOR: shared `buildScope(projectId)` URL prefix
- 4. Commit `[C8] frontend: recharts dep + dashboard schemas + api client + 8/8`
Status: [ ]

### Task 9: hooks/useDashboard
Files:
  - `frontend/src/hooks/useDashboard.ts`
  - `frontend/src/hooks/__tests__/useDashboard.test.tsx`
Steps:
- 1. RED: 9 tests — useKpis/useStatusCounts/usePriorityCounts/useProductivity/useUpcoming/useHighPriority all gate on projectId when nested; query keys include scope; 401 surfaces; default staleTime
- 2. GREEN: TanStack hooks one per endpoint; `dashboardKey(scope, widget)` shared
- 3. REFACTOR: extract `useDashboardQuery` helper
- 4. Commit `[C9] frontend: useDashboard hooks + 9/9`
Status: [ ]

---

## Phase D — Frontend components

### Task 10: KpiCard + tests
Files:
  - `frontend/src/components/dashboard/KpiCard.tsx`
  - `frontend/src/components/dashboard/__tests__/KpiCard.test.tsx`
Steps:
- 1. RED: 4 tests — renders title + value + optional sub-label; loading skeleton; isError variant; large numbers formatted w/ thousands separator
- 2. GREEN: presentational only
- 3. REFACTOR: nothing
- 4. Commit `[D10] frontend: KpiCard + 4/4`
Status: [ ]

### Task 11: StatusDonut + PriorityBar (recharts)
Files:
  - `frontend/src/components/dashboard/StatusDonut.tsx`
  - `frontend/src/components/dashboard/PriorityBar.tsx`
  - `frontend/src/components/dashboard/__tests__/StatusDonut.test.tsx`
  - `frontend/src/components/dashboard/__tests__/PriorityBar.test.tsx`
Steps:
- 1. RED: 6 tests — each renders ResponsiveContainer w/ data series; loading state; empty-data placeholder; reads colors from theme tokens
- 2. GREEN: recharts PieChart + BarChart wrapped in ResponsiveContainer; mock ResponsiveContainer dims in test
- 3. REFACTOR: shared `chartTheme` helper for colors
- 4. Commit `[D11] frontend: StatusDonut + PriorityBar + 6/6`
Status: [ ]

### Task 12: ProductivityLine (recharts LineChart)
Files:
  - `frontend/src/components/dashboard/ProductivityLine.tsx`
  - `frontend/src/components/dashboard/__tests__/ProductivityLine.test.tsx`
Steps:
- 1. RED: 4 tests — renders LineChart w/ N points; X-axis label format M/D; loading state; empty-data placeholder
- 2. GREEN: LineChart + dot:false stroke from theme tokens
- 3. REFACTOR: nothing
- 4. Commit `[D12] frontend: ProductivityLine + 4/4`
Status: [ ]

### Task 13: UpcomingList + HighPriorityList
Files:
  - `frontend/src/components/dashboard/UpcomingList.tsx`
  - `frontend/src/components/dashboard/HighPriorityList.tsx`
  - `frontend/src/components/dashboard/__tests__/UpcomingList.test.tsx`
  - `frontend/src/components/dashboard/__tests__/HighPriorityList.test.tsx`
Steps:
- 1. RED: 6 tests — upcoming groups tasks + project deadlines, shows date + title, links to task/project detail; empty list copy 'Nothing in the next N days'; high-priority shows priority badge + assignee chip; click row → push detail; loading skeleton
- 2. GREEN: Card-based lists
- 3. REFACTOR: shared row component
- 4. Commit `[D13] frontend: UpcomingList + HighPriorityList + 6/6`
Status: [ ]

---

## Phase E — Pages + nav

### Task 14: /dashboard global page (replace current shell)
Files:
  - `frontend/src/app/dashboard/page.tsx`
  - `frontend/src/app/dashboard/__tests__/page.test.tsx`
Steps:
- 1. RED: 4 tests — renders all 6 widgets (kpi row + 2-chart row + line + lists row); fetches global hooks (no projectId); loading state per widget; smoke: title 'Dashboard'
- 2. GREEN: grid layout w/ Card containers
- 3. REFACTOR: nothing
- 4. Commit `[E14] frontend: /dashboard global page + 4/4`
Status: [ ]

### Task 15: /projects/[id]/dashboard scoped page + detail link
Files:
  - `frontend/src/app/projects/[id]/dashboard/page.tsx`
  - `frontend/src/app/projects/[id]/dashboard/__tests__/page.test.tsx`
  - `frontend/src/app/projects/[id]/page.tsx` (add Dashboard button)
Steps:
- 1. RED: 3 tests — page passes projectId into all hooks; admin & member can view; project detail page renders Dashboard link
- 2. GREEN: same grid w/ projectId prop wired
- 3. REFACTOR: shared `<DashboardGrid projectId?>` component
- 4. Commit `[E15] frontend: scoped dashboard + project detail link + 3/3`
Status: [ ]

---

## Phase F — Wrap

### Task 16: coverage check + README updates
Files: `README.md`
Steps:
- Backend coverage: `dashboard.*` files ≥80% lines
- Frontend coverage: `dashboard` files ≥70% lines
- README API table: new section `/api/v1/dashboard` + per-project variants
- README frontend pages: add `/dashboard` and `/projects/[id]/dashboard`
- Commit `[F16] coverage + README — subgoal dashboard-analytics complete`
Status: [ ]

---

## Plan totals
- 16 tasks across 6 phases (A service x5, B routes x2, C lib+hooks x2, D components x4, E pages x2, F wrap x1)
- Est new tests: backend ~50, frontend ~50
- Backend target: ≥337 jest passing, ≥80% lines on dashboard module
- Frontend target: ≥248 vitest passing, ≥70% lines on dashboard files
- All pre-existing (287 + 198) must continue passing
