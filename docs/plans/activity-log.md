# Plan — activity-log (Phase 2 GSD)

Parent SPEC: `docs/goals/smart-collab/subgoals/activity-log/goal.md`
Branch: `feature/activity-log` (off develop@b7b9008)
Mode: brownfield · feature · new session

Every task ends with a commit. Steps: 1. RED 2. GREEN 3. REFACTOR 4. Commit.
Update Status `[ ] -> [x]` after commit. Update progress.md after each.

---

## Phase A — Schema + emitter foundation

### Task 1: baseline verification commit
Files: none (verification only)
Steps:
- 1. Run `npm --prefix backend test` — confirm 343/343 green
- 2. Run `npm --prefix frontend test -- --run` — confirm 243/243 green
- 3. Run `cd backend && npx prisma migrate status` — confirm "Database schema is up to date"
- 4. Commit `[Baseline] existing tests passing before activity-log work begins` (empty commit ok)
Status: [ ]

### Task 2: prisma schema — extend ActivityLog + migration
Files:
  - `backend/prisma/schema.prisma`
  - `backend/prisma/migrations/<timestamp>_extend_activity_log/migration.sql`
Steps:
- 1. RED: write `backend/src/app/modules/activityLog/__tests__/activityLog.schema.test.ts` — 3 tests: insert row with projectId+entityType+entityId returns those fields; entityType required; composite index on (projectId, createdAt desc) queryable
- 2. GREEN: add columns `projectId Uuid?`, `entityType String`, `entityId Uuid` + indexes `@@index([projectId, createdAt])`, `@@index([entityType, entityId, createdAt])` to ActivityLog model; `npx prisma migrate dev --name extend_activity_log`
- 3. REFACTOR: confirm @relation to Project added (`project Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)`) + reverse on Project model
- 4. Commit `[A2] activityLog: extend schema with projectId/entityType/entityId + migration + 3/3`
Status: [ ]

### Task 3: activityLog.constant.ts — action verb registry
Files:
  - `backend/src/app/modules/activityLog/activityLog.constant.ts`
  - `backend/src/app/modules/activityLog/__tests__/activityLog.constant.test.ts`
Steps:
- 1. RED: 4 tests — ACTIONS enum has task.created/task.updated/task.deleted/task.status_changed/task.assigned/project.created/project.updated/project.deleted/member.added/member.removed; ENTITY_TYPES has task/project/member; META_WHITELIST excludes passwordHash; sanitizeMeta strips disallowed keys
- 2. GREEN: export string-literal union ACTIONS + ENTITY_TYPES + `sanitizeMeta(meta)` filter
- 3. REFACTOR: factor whitelist into const array
- 4. Commit `[A3] activityLog: action constants + meta sanitizer + 4/4`
Status: [ ]

### Task 4: activityLog.service — recordActivity helper
Files:
  - `backend/src/app/modules/activityLog/activityLog.service.ts`
  - `backend/src/app/modules/activityLog/__tests__/activityLog.service.record.test.ts`
Steps:
- 1. RED: 5 tests — recordActivity(tx, {actorId, action, entityType, entityId}) writes row; projectId optional null; meta sanitized; throws on unknown action; runs inside provided Prisma tx client (rolls back with outer tx)
- 2. GREEN: `recordActivity(tx: Prisma.TransactionClient, input)` → `tx.activityLog.create({ data: { ...sanitized } })`
- 3. REFACTOR: type input via `RecordActivityInput`
- 4. Commit `[A4] activityLog.service: recordActivity helper + 5/5`
Status: [ ]

## Phase B — Wire emitter into existing services

### Task 5: task.service — emit on create / update / delete
Files:
  - `backend/src/app/modules/task/task.service.ts` (EXISTING — must not break shape)
  - `backend/src/app/modules/task/__tests__/task.service.activity.test.ts`
Steps:
- 1. RED: 6 tests — createTask emits task.created with entityId=task.id + projectId; updateTask emits task.updated when fields change (skip if no-op); deleteTask emits task.deleted; existing task tests still pass
- 2. GREEN: wrap each in $transaction, call recordActivity(tx, ...)
- 3. REFACTOR: factor `withActivity(tx, action, ...)` helper if cleaner
- 4. Commit `[B5] task.service: emit activity on CRUD + 6/6 (existing tests preserved)`
Status: [ ]

### Task 6: task.service — emit on status + assignee changes
Files:
  - `backend/src/app/modules/task/task.service.ts`
  - `backend/src/app/modules/task/__tests__/task.service.activity.test.ts`
Steps:
- 1. RED: 5 tests — updateTask with new status emits task.status_changed (meta: from/to); updateTask with new assigneeId emits task.assigned (meta: from/to); no emit when status/assignee unchanged; both changes in one call emit both events
- 2. GREEN: diff prevState vs nextState inside tx, emit conditional events
- 3. REFACTOR: extract `diffTaskFields(prev, next)` returning array of activity payloads
- 4. Commit `[B6] task.service: emit on status/assignment change + 5/5`
Status: [ ]

### Task 7: project.service — emit on CRUD
Files:
  - `backend/src/app/modules/project/project.service.ts` (EXISTING)
  - `backend/src/app/modules/project/__tests__/project.service.activity.test.ts`
Steps:
- 1. RED: 4 tests — createProject emits project.created (entityId=project.id, projectId=project.id); updateProject emits project.updated; deleteProject emits project.deleted; existing project tests still pass
- 2. GREEN: wrap mutations in tx + recordActivity
- 3. REFACTOR: none
- 4. Commit `[B7] project.service: emit activity on CRUD + 4/4`
Status: [ ]

### Task 8: projectMember.service — emit on add / remove
Files:
  - `backend/src/app/modules/projectMember/projectMember.service.ts` (EXISTING)
  - `backend/src/app/modules/projectMember/__tests__/projectMember.service.activity.test.ts`
Steps:
- 1. RED: 4 tests — addMember emits member.added (meta: userId, role); removeMember emits member.removed; existing add/remove tests still pass; activity row links projectId
- 2. GREEN: extend existing tx with recordActivity
- 3. REFACTOR: none
- 4. Commit `[B8] projectMember.service: emit on add/remove + 4/4`
Status: [ ]

## Phase C — Endpoints + RBAC

### Task 9: activityLog.validation.ts — list query schema (limit + cursor)
Files:
  - `backend/src/app/modules/activityLog/activityLog.validation.ts`
  - `backend/src/app/modules/activityLog/__tests__/activityLog.validation.test.ts`
Steps:
- 1. RED: 6 tests — limit default 10 / int / 1..50; rejects 0 / 51 / NaN; cursor optional string; cursor base64-decodes to `{createdAt, id}` or 422
- 2. GREEN: `listQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10), cursor: z.string().optional() })` + decode helper
- 3. REFACTOR: extract `encodeCursor` / `decodeCursor` pure fns
- 4. Commit `[C9] activityLog: list query validation + cursor codec + 6/6`
Status: [ ]

### Task 10: activityLog.service — listGlobal + listByProject
Files:
  - `backend/src/app/modules/activityLog/activityLog.service.ts`
  - `backend/src/app/modules/activityLog/__tests__/activityLog.service.list.test.ts`
Steps:
- 1. RED: 8 tests — listGlobal returns latest N ordered desc; nextCursor when more rows; null when end; listByProject filters by projectId; decoded cursor seeds where clause `(createdAt,id) < cursor`; deleted actor returns actorName null; DTO shape matches schema; limit honored
- 2. GREEN: prisma.activityLog.findMany with `take: limit + 1`, order by `createdAt desc, id desc`; build nextCursor from last row
- 3. REFACTOR: extract `toDTO(row)` + shared `buildWhere(cursor, projectId?)`
- 4. Commit `[C10] activityLog.service: list global + by project w/ cursor + 8/8`
Status: [ ]

### Task 11: activityLog.controller + global routes
Files:
  - `backend/src/app/modules/activityLog/activityLog.controller.ts`
  - `backend/src/app/modules/activityLog/activityLog.routes.ts`
  - `backend/src/app/routes/index.ts` (EXISTING — add registration)
  - `backend/src/app/modules/activityLog/__tests__/activityLog.routes.test.ts`
Steps:
- 1. RED: 6 happy-path supertest cases — GET /api/v1/activity 200 + items array + nextCursor; auth required (401); limit=5 honored; cursor pagination second page; validation 422 on limit=0; default limit=10
- 2. GREEN: controller `listGlobal(req,res)` + route w/ auth middleware
- 3. REFACTOR: pattern-match dashboard controller
- 4. Commit `[C11] activityLog: controller + global route + 6/6`
Status: [ ]

### Task 12: project-nested route + RBAC
Files:
  - `backend/src/app/modules/project/project.routes.ts` (EXISTING)
  - `backend/src/app/modules/activityLog/__tests__/activityLog.routes.project.test.ts`
Steps:
- 1. RED: 6 tests — GET /api/v1/projects/:id/activity 200 for project member; 200 for admin; 403 FORBIDDEN_PROJECT_ROLE for non-member; 404 PROJECT_NOT_FOUND for missing id; events filtered to that project only; pagination works
- 2. GREEN: mount sub-route under projects w/ `requireProjectRole('member')`
- 3. REFACTOR: extract `listByProject` controller fn
- 4. Commit `[C12] activityLog: per-project route + RBAC + 6/6`
Status: [ ]

## Phase D — Frontend

### Task 13: lib/schemas/activity + lib/activity api client
Files:
  - `frontend/src/lib/schemas/activity.ts`
  - `frontend/src/lib/activity.ts`
  - `frontend/src/lib/__tests__/activity.test.ts`
Steps:
- 1. RED: 6 tests — ActivityDTO schema validates required fields; listActivity({limit,cursor}) hits /api/v1/activity; listProjectActivity(projectId, ...) hits /api/v1/projects/:id/activity; passes query params; returns parsed page; 422 throws
- 2. GREEN: zod schema + axios calls returning `{items, nextCursor}`
- 3. REFACTOR: factor base url constant
- 4. Commit `[D13] activity: schemas + api client + 6/6`
Status: [ ]

### Task 14: hooks/useActivity (useInfiniteQuery x2)
Files:
  - `frontend/src/hooks/useActivity.ts`
  - `frontend/src/hooks/__tests__/useActivity.test.tsx`
Steps:
- 1. RED: 6 tests — useActivity returns pages w/ items; fetchNextPage advances cursor; hasNextPage false when nextCursor null; useProjectActivity scopes to projectId; query keys distinct; respects limit override
- 2. GREEN: useInfiniteQuery wrappers w/ getNextPageParam = last.nextCursor
- 3. REFACTOR: shared queryKey factory
- 4. Commit `[D14] activity: useActivity + useProjectActivity hooks + 6/6`
Status: [ ]

### Task 15: ActivityItem component + verb registry
Files:
  - `frontend/src/components/activity/ActivityItem.tsx`
  - `frontend/src/components/activity/verbRegistry.ts`
  - `frontend/src/components/activity/__tests__/ActivityItem.test.tsx`
Steps:
- 1. RED: 5 tests — renders actor name (or "Unknown" when null); renders verb from registry for task.created; falls back to raw action string when unknown; renders relative time (e.g. "2m ago"); links to entity when task/project
- 2. GREEN: pure component takes ActivityDTO, uses date-fns formatDistanceToNow
- 3. REFACTOR: extract `renderVerb(action, meta)` from registry
- 4. Commit `[D15] activity: ActivityItem + verb registry + 5/5`
Status: [ ]

### Task 16: ActivityFeed component (list + load more + empty/loading/error)
Files:
  - `frontend/src/components/activity/ActivityFeed.tsx`
  - `frontend/src/components/activity/__tests__/ActivityFeed.test.tsx`
Steps:
- 1. RED: 6 tests — renders ActivityItem per row; "Load more" button when hasNextPage; hides when no more; loading skeleton on first fetch; "No activity yet" empty state; error retry button
- 2. GREEN: consumes hook result via props (variants global vs project decided by parent passing hook fn)
- 3. REFACTOR: split skeleton component
- 4. Commit `[D16] activity: ActivityFeed component + 6/6`
Status: [ ]

### Task 17: dashboard widget integration
Files:
  - `frontend/src/components/dashboard/DashboardGrid.tsx` (EXISTING)
  - `frontend/src/app/dashboard/page.tsx` (EXISTING)
  - `frontend/src/app/dashboard/__tests__/page.test.tsx` (EXISTING — extend)
Steps:
- 1. RED: 3 tests — dashboard renders ActivityFeed widget; uses useActivity with limit=10; no "Load more" on dashboard variant
- 2. GREEN: add `<ActivityFeed hook={useActivity} limit={10} hideLoadMore />` to grid
- 3. REFACTOR: ensure responsive grid placement
- 4. Commit `[D17] dashboard: integrate activity widget + 3/3`
Status: [ ]

### Task 18: project activity page + project detail link
Files:
  - `frontend/src/app/projects/[id]/activity/page.tsx`
  - `frontend/src/app/projects/[id]/page.tsx` (EXISTING — add link)
  - `frontend/src/app/projects/[id]/activity/__tests__/page.test.tsx`
  - `frontend/src/app/projects/[id]/__tests__/page.test.tsx` (EXISTING — extend)
Steps:
- 1. RED: 5 tests — page renders ActivityFeed scoped to id; load more works; project detail page shows "Activity →" link to /projects/[id]/activity; uses useProjectActivity
- 2. GREEN: page component + Link in project detail
- 3. REFACTOR: shared page chrome
- 4. Commit `[D18] activity: per-project page + project detail link + 5/5`
Status: [ ]

## Phase E — Wrap

### Task 19: coverage + README + final regressions
Files:
  - `README.md` (EXISTING — append section)
  - none else
Steps:
- 1. Run `npm --prefix backend test -- --coverage` — confirm activityLog files ≥80%
- 2. Run `npm --prefix frontend test -- --coverage --run` — confirm activity components/hooks ≥70%
- 3. Run full suites — backend 343 baseline + new tests pass; frontend 243 baseline + new tests pass
- 4. Append `## Activity Log` section to README documenting endpoints + UI surfaces
- 5. Commit `[E19] activity-log: coverage check + README updates — subgoal complete`
Status: [ ]
