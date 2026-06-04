# Plan — search-filter-sort (Phase 2 GSD)

Parent SPEC: `docs/goals/smart-collab/subgoals/search-filter-sort/goal.md`
Branch: `feature/search-filter-sort` (off develop@9ebf81e)
Mode: brownfield · feature · new session

Every task ends with a commit. Steps: 1. RED 2. GREEN 3. REFACTOR 4. Commit.

---

## Phase A — Backend: extend task list filters

### Task 1: baseline verification commit
Files: none
Steps:
- 1. Run backend + frontend suites + prisma migrate status, confirm 403/284 green
- 2. Commit `[Baseline] existing tests passing before search-filter-sort work begins` (empty commit)
Status: [ ]

### Task 2: task.validation — multi-select status/priority + dueFrom/dueTo + me shorthands
Files:
  - `backend/src/app/modules/task/task.validation.ts` (EXISTING)
  - `backend/src/app/modules/task/__tests__/task.validation.test.ts` (EXISTING — extend)
Steps:
- 1. RED: 10 tests — `status=todo,in_progress` → array; single value still works; rejects unknown enum; `priority=high,medium` same; `dueFrom=2026-06-04` parses; `dueTo` parses; rejects garbage date; rejects `dueFrom > dueTo`; `assignedTo=me` → literal `'me'` marker preserved; `createdBy=me` same
- 2. GREEN: add `multiEnum` helper splitting on `,` then z.array(enum); add `dateField`; add `assignedTo: z.union([uuid, 'me', UNASSIGNED]).optional()`; add `createdBy: z.union([uuid, 'me']).optional()`
- 3. REFACTOR: factor `csvOf(z.nativeEnum(X))` helper
- 4. Commit `[A2] task.validation: multi-select + date range + me shorthands + 10/10`
Status: [ ]

### Task 3: task.service.list — wire new filters
Files:
  - `backend/src/app/modules/task/task.service.ts` (EXISTING)
  - `backend/src/app/modules/task/__tests__/task.service.list.test.ts` (EXISTING — extend)
Steps:
- 1. RED: 8 tests — status array → `where.status: { in }`; priority array → `where.priority: { in }`; dueFrom→`where.dueDate: { gte }`; dueTo→`{ lte }`; both combine; assignedTo='me' resolves to caller; createdBy='me' resolves to caller; combining all narrows correctly
- 2. GREEN: extend ListArgs + buildWhere — `status?: TaskStatus | TaskStatus[]`; `priority?: TaskPriority | TaskPriority[]`; `dueFrom?: Date`; `dueTo?: Date`; `actorId?: string` (used to resolve `me`)
- 3. REFACTOR: helper `arrayOrEq(field, v)`
- 4. Commit `[A3] task.service.list: multi-select + date range + me + 8/8`
Status: [ ]

### Task 4: task.controller — pass actorId for me resolution
Files:
  - `backend/src/app/modules/task/task.controller.ts` (EXISTING)
  - `backend/src/app/modules/task/__tests__/task.routes.test.ts` (EXISTING — extend)
Steps:
- 1. RED: 4 supertest cases — `?assignedTo=me` returns only caller's tasks; `?createdBy=me` returns only caller's; `?status=todo,in_progress` 200 with mixed; `?dueFrom=…&dueTo=…` returns range
- 2. GREEN: controller passes `actorId: req.user.id` into service when query has `'me'`
- 3. REFACTOR: none
- 4. Commit `[A4] task.controller + routes: me resolution + 4/4`
Status: [ ]

## Phase B — Backend: extend project list filters

### Task 5: project.validation — multi-select status + deadlineFrom/To + createdBy=me
Files:
  - `backend/src/app/modules/project/project.validation.ts` (EXISTING)
  - `backend/src/app/modules/project/__tests__/project.validation.test.ts` (EXISTING)
Steps:
- 1. RED: 6 tests — `status=active,on_hold`; single value still works; rejects unknown; `deadlineFrom/To` parses; rejects bad date; `createdBy=me`
- 2. GREEN: reuse `csvOf` helper from task module (move to shared lib first if needed)
- 3. REFACTOR: extract `backend/src/app/lib/queryFields.ts` for csvOf + dateField + meOrUuid
- 4. Commit `[B5] project.validation: multi-select + range + me + shared helpers + 6/6`
Status: [ ]

### Task 6: project.service.list + controller — wire filters
Files:
  - `backend/src/app/modules/project/project.service.ts` (EXISTING)
  - `backend/src/app/modules/project/project.controller.ts` (EXISTING)
  - `backend/src/app/modules/project/__tests__/project.service.list.test.ts` (EXISTING)
  - `backend/src/app/modules/project/__tests__/project.routes.test.ts` (EXISTING)
Steps:
- 1. RED: 6 tests across service+routes — status array filter; deadlineFrom/To; combined; createdBy=me resolution; existing single-value still works; admin still sees all
- 2. GREEN: extend ListArgs + buildWhere; controller passes actorId
- 3. REFACTOR: none
- 4. Commit `[B6] project.service+controller: multi-select + range + me + 6/6`
Status: [ ]

## Phase C — Backend: global search module

### Task 7: search.validation + search.constant
Files:
  - `backend/src/app/modules/search/search.constant.ts`
  - `backend/src/app/modules/search/search.validation.ts`
  - `backend/src/app/modules/search/__tests__/search.validation.test.ts`
Steps:
- 1. RED: 5 tests — `q` required min 2 max 200; rejects 1-char; rejects 201-char; `limit` default 5 / int / 1..20; rejects 21
- 2. GREEN: zod schema + constants (`MIN_Q`, `MAX_Q`, `DEFAULT_HIT_LIMIT`, `MAX_HIT_LIMIT`)
- 3. REFACTOR: none
- 4. Commit `[C7] search: validation + constants + 5/5`
Status: [ ]

### Task 8: search.service — findProjects + findTasks
Files:
  - `backend/src/app/modules/search/search.service.ts`
  - `backend/src/app/modules/search/__tests__/search.service.test.ts`
Steps:
- 1. RED: 8 tests — finds project by name substring (ILIKE); finds by description; finds task by title; respects limit (5 default); orders prefix-match before contains; returns DTO shape `{ projects:[{id,name,description,status,deadline}], tasks:[{id,title,description,projectId,projectName,status,priority,dueDate}] }`; case-insensitive; empty when no matches
- 2. GREEN: 2 parallel prisma queries w/ `mode: 'insensitive' contains`; assemble DTOs; sort by `startsWith` before `contains`
- 3. REFACTOR: extract `prefixThenContainsScore` comparator
- 4. Commit `[C8] search.service: project + task hits w/ ranking + 8/8`
Status: [ ]

### Task 9: search.controller + route mount
Files:
  - `backend/src/app/modules/search/search.controller.ts`
  - `backend/src/app/modules/search/search.routes.ts`
  - `backend/src/app/routes/index.ts` (EXISTING — add registration)
  - `backend/src/app/modules/search/__tests__/search.routes.test.ts`
Steps:
- 1. RED: 6 supertest cases — `GET /api/v1/search?q=foo` 200 + shape; 401 unauthenticated; 422 when q omitted; 422 when q.length<2; 422 when limit=21; returns combined hits
- 2. GREEN: standard controller + Router + mount `/api/v1/search`
- 3. REFACTOR: none
- 4. Commit `[C9] search: controller + routes + 6/6`
Status: [ ]

## Phase D — Frontend: schemas + client + hook

### Task 10: lib/schemas/search + lib/search api client
Files:
  - `frontend/src/lib/schemas/search.ts`
  - `frontend/src/lib/search.ts`
  - `frontend/src/lib/__tests__/search.test.ts`
Steps:
- 1. RED: 5 tests — schema validates; `searchAll({q})` hits `/api/v1/search?q=…`; passes limit param; returns parsed page; throws on invalid response
- 2. GREEN: zod + apiGet wrapper
- 3. REFACTOR: none
- 4. Commit `[D10] search: schemas + api client + 5/5`
Status: [ ]

### Task 11: lib/queryString — multi-value helpers
Files:
  - `frontend/src/lib/queryString.ts`
  - `frontend/src/lib/__tests__/queryString.test.ts`
Steps:
- 1. RED: 6 tests — `parseCsv('a,b')` → `['a','b']`; trims; dedupes; `toCsv(['a','b'])` → `'a,b'`; `parseCsv('')` → `[]`; `parseDateParam` ISO date passes / invalid → undefined
- 2. GREEN: pure functions
- 3. REFACTOR: none
- 4. Commit `[D11] lib: queryString multi-value helpers + 6/6`
Status: [ ]

### Task 12: hooks/useGlobalSearch
Files:
  - `frontend/src/hooks/useGlobalSearch.ts`
  - `frontend/src/hooks/__tests__/useGlobalSearch.test.tsx`
Steps:
- 1. RED: 4 tests — enabled false when q.length<2; fetches when q.length≥2; uses TanStack staleTime; query key includes q + limit
- 2. GREEN: useQuery wrapper
- 3. REFACTOR: none
- 4. Commit `[D12] hooks: useGlobalSearch + 4/4`
Status: [ ]

## Phase E — Frontend: GlobalSearchBar + URL-state on list pages

### Task 13: GlobalSearchBar component in Header
Files:
  - `frontend/src/components/search/GlobalSearchBar.tsx`
  - `frontend/src/components/header.tsx` (EXISTING — mount)
  - `frontend/src/components/search/__tests__/GlobalSearchBar.test.tsx`
Steps:
- 1. RED: 7 tests — renders input; `/` keyboard shortcut focuses input; typing 2 chars triggers fetch; Esc closes results; grouped Projects + Tasks render; clicking a hit navigates; empty state when 0 hits
- 2. GREEN: input + dropdown + keyboard handlers; uses useGlobalSearch w/ debounce 200ms
- 3. REFACTOR: extract HitGroup subcomponent
- 4. Commit `[E13] search: GlobalSearchBar + Header mount + 7/7`
Status: [ ]

### Task 14: /projects page multi-select + range URL-state
Files:
  - `frontend/src/app/projects/page.tsx` (EXISTING)
  - `frontend/src/hooks/useProjects.ts` (EXISTING — extend if needed)
  - `frontend/src/app/projects/__tests__/page.test.tsx` (EXISTING — extend)
Steps:
- 1. RED: 5 tests — initial render reads `status=active,on_hold` URL → multi-chip active; clicking chip toggles + updates URL via csv; deadlineFrom input updates URL; createdBy=me toggle updates URL; reloading restores all
- 2. GREEN: replace single-select status w/ multi-select chips; add date range inputs; add "Created by me" toggle; serialize via toCsv
- 3. REFACTOR: factor MultiSelectChip component
- 4. Commit `[E14] projects page: multi-select + date range + me toggle + 5/5`
Status: [ ]

### Task 15: /projects/[id]/tasks page multi-select + range URL-state
Files:
  - `frontend/src/app/projects/[id]/tasks/page.tsx` (EXISTING)
  - `frontend/src/hooks/useTasks.ts` (EXISTING — extend if needed)
  - `frontend/src/app/projects/[id]/tasks/__tests__/page.test.tsx` (EXISTING — extend)
Steps:
- 1. RED: 6 tests — multi-status chips render+toggle+URL; multi-priority same; dueFrom/dueTo inputs; assignedTo=me toggle; createdBy=me toggle; reloading restores all
- 2. GREEN: same pattern as projects page
- 3. REFACTOR: reuse MultiSelectChip
- 4. Commit `[E15] tasks page: multi-select + date range + me toggles + 6/6`
Status: [ ]

## Phase F — Wrap

### Task 16: coverage + README + final regressions
Files:
  - `README.md` (EXISTING)
Steps:
- 1. Run backend + frontend coverage — confirm new files ≥80% backend, ≥70% frontend
- 2. Run full suites — backend 403 baseline + new pass; frontend 284 baseline + new pass
- 3. Append `## Search & advanced filters` section to README documenting endpoints + UI
- 4. Commit `[F16] search-filter-sort: coverage + README — subgoal complete`
Status: [ ]
