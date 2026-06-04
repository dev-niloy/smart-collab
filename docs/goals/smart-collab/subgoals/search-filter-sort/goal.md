# Goal — search-filter-sort (subgoal)

Parent: `smart-collab` (assessment app)
Branch: `feature/search-filter-sort` off `develop`
Mode: brownfield · feature · new session

---

## What
Broaden existing list-endpoint filters + add a global search bar covering assessment §8.

Backend:
- `task.validation.listTasksQuerySchema`: accept comma-separated multi-select on `status` and `priority`; add `dueFrom`/`dueTo` ISO date range; accept `assignedTo=me` and `createdBy=me` shorthands that resolve to the authed actor; reject invalid combinations
- `task.service.list`: filter by `dueDate` range + multi-status/priority `in:[…]` clauses + me-shorthand
- `project.validation.listProjectsQuerySchema`: multi-select on `status`; add `deadlineFrom`/`deadlineTo`; accept `createdBy=me`
- `project.service.list`: same shape on projects (status in[…], deadline range, createdBy resolution)
- New `search` module under `/api/v1/search?q=…&limit=N`:
  - Query string required (`q.length ≥ 2`, `≤ 200`); `limit` default 5 per kind, max 20
  - Returns `{ projects: ProjectHit[], tasks: TaskHit[] }`; case-insensitive substring on `name`/`title`, also matches on `description`
  - Visibility: same as existing list endpoints — caller sees only what they could see by listing each kind
  - Hits include the minimum needed to link: `{ id, label, projectId?, projectName?, status, dueDate?, priority? }`

Frontend:
- `lib/schemas/search`, `lib/search` client (`searchAll({ q, limit })`)
- `hooks/useGlobalSearch` (TanStack Query, `enabled: q.length >= 2`, debounced by caller)
- `components/search/GlobalSearchBar` mounted in `<Header>` — keyboard-accessible combobox, focuses on `/` shortcut, results dropdown grouped by Projects + Tasks, opens link on click, Esc closes
- `/projects` list page: multi-select chips for status + deadline range + "Created by me" toggle, all URL-state synced (back-compat with single-value URLs)
- `/projects/[id]/tasks` page: same — multi-select status + multi-select priority + due-date range + "Assigned to me" / "Created by me" toggles, URL-state synced

## Why
Assessment §8: cross-cutting search/filter/sort. Today task + project list endpoints support single-value filters only; missing global search, date ranges, multi-select, and "me" shorthands that any real PM/board UI needs.

## Done looks like
1. `GET /api/v1/tasks?status=todo,in_progress&priority=high,medium&dueFrom=2026-06-04&dueTo=2026-06-30&assignedTo=me&createdBy=me` returns only matching rows for the authed actor; rejects bad date / unknown enum value w/ 422 VALIDATION_ERROR
2. `GET /api/v1/projects?status=active,on_hold&deadlineFrom=2026-06-04&deadlineTo=2026-12-31&createdBy=me` same — 422 on garbage
3. Single-value usage of existing query params still works (`status=todo` and `status=todo,in_progress` both valid; latter wins when both supplied? — spec: comma split first, treat any single token same way)
4. `GET /api/v1/search?q=foo&limit=5` returns `{projects: [{id,name,description?,status,deadline}], tasks: [{id,title,description?,projectId,projectName,status,priority,dueDate}]}` ordered by best substring match (prefix > contains)
5. `GET /api/v1/search?q=a` → 422 (under min length 2)
6. `GET /api/v1/search?q=…&limit=21` → 422 (above max 20)
7. Auth required on `/api/v1/search` (401 when unauthenticated)
8. Visibility: search results are filtered exactly like list endpoints — non-admin users only see what they could see via `/projects` or `/tasks` (admin/PM see everything currently; member behavior matches existing list semantics)
9. Backend coverage on the new + extended files ≥80%
10. Frontend `<GlobalSearchBar>` opens on `/`, closes on Esc, renders grouped Projects + Tasks, navigates on click; empty state when no hits; loading spinner during fetch
11. `/projects` page URL-state supports `status=active,on_hold&deadlineFrom=…&deadlineTo=…&createdBy=me`; clicking chips updates URL; reloading restores filters
12. `/projects/[id]/tasks` page URL-state supports `status=todo,in_progress&priority=high&dueFrom=…&dueTo=…&assignedTo=me&createdBy=me`
13. Existing test counts preserved (backend 403, frontend 284) + new tests on top
14. CI green on PR `feature/search-filter-sort` → `develop`

## Mode
- project_type: brownfield
- scope: feature
- session: new

## Scope of this subgoal
- IN: backend filter/sort extensions on tasks + projects, new search module, frontend global search bar in Header, multi-select + date range UI on /projects + /projects/[id]/tasks, URL-state sync
- OUT: full-text search ranking (use simple ILIKE), saved searches/views, search across activity log + members, search history, fuzzy matching, search suggestions/autocomplete from history

## Constraints (brownfield)
- MUST NOT change response shapes of existing endpoints — only widen accepted query inputs
- MUST keep single-value query forms working (back-compat for any external consumer)
- MUST preserve baseline test counts (backend 403, frontend 284)
- MUST NOT regress dashboard / activity log / project-member features
- Search visibility MUST match list-endpoint visibility (no leaking otherwise-hidden rows)

## Existing Tests
- Backend: jest (`npm --prefix backend test`), baseline 403/403
- Frontend: vitest (`npm --prefix frontend test -- --run`), baseline 284/284

## Acceptance Criteria
Items 1–14 above. Verified by running test commands.
