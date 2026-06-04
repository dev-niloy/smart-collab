# Progress — tasks-crud (human narrative)

Thin log. Board (`state.yaml`) holds task status + receipts.

## Session log
- 2026-06-04: Phase 3 — t17 done. /projects/[id]/tasks/[taskId] detail page: fields + creator + assignee, RBAC Edit gated to admin|PM|owner (createdBy or assignedTo), Delete admin|PM only (stub for t19). 7 page tests covering 3 roles × own/other ownership cases. Frontend 133/133. Next: t18 edit form.
- 2026-06-04: Phase 3 — t16 done. /projects/[id]/tasks/new create form: RHF+Zod, useUsers assignee dropdown (UNASSIGNED sentinel), all authed can create (members included), push to detail on submit. 3 page tests; frontend 126/126. Next: t17 task detail page.
- 2026-06-04: Phase 3 — t15 done (Phase D start). /projects/[id]/tasks list page: URL-state filters (q + status + priority + assignee + sort), debounced search, inline status Select per card (PATCH via useUpdateTask), assignee filter populated from useUsers, RBAC-open New Task button. 8 page tests; frontend 123/123. PR #9 (Phases A-C) merged to develop. Next: t16 /projects/[id]/tasks/new create form.
- 2026-06-04: Phase 3 — t14 done. Phase C complete. hooks/useTasks (+ useProjectTasks nested), hooks/useUsers; cache invalidation on parent ['tasks'] key invalidates all derived lists. 11 hook tests; frontend 115/115. Next: Phase D — t15 /projects/[id]/tasks list page.
- 2026-06-04: Phase 3 — t13 done. lib/task-format.ts (status + priority label/variant maps, fmtDate + fmtDateTime). 8 tests. Extracted from start (Ralph lesson). Next: t14 TanStack hooks useTasks + useUsers.
- 2026-06-04: Phase 3 — t12 done. Frontend lib: schemas/task.ts (Zod v4 mirror), tasks.ts (CRUD + nested listTasksForProject, URLSearchParams query, Date->ISO), users.ts (listUsers minimal). 22 tests added; frontend 96/96 vitest. Zod v4 UUID strict — test fixtures use real v4 uuid. Next: t13 lib/task-format.ts (status + priority label/variant maps + tests).
- 2026-06-04: Phase 3 — t11 done. Phase B complete. Nested GET /api/v1/projects/:id/tasks delegates to taskService.list, validates project existence first (404 PROJECT_NOT_FOUND), honors task query filters. 4 tests added. Backend 218/218. Next: Phase C frontend — t12 lib/schemas/task + lib/tasks + lib/users.
- 2026-06-04: Phase 3 — t10 done. GET /api/v1/users minimal shape (id, email, name, role) ordered by name. requireAuth global. 5/5 tests verify 401 unauth + shape + RBAC (all 3 roles can list). Backend 214/214. Next: t11 nested GET /api/v1/projects/:id/tasks convenience route.
- 2026-06-04: Phase 3 — t9 done. All 3 assessment §4 verbatim messages verified e2e: PAST_DEADLINE (POST+PATCH), DUPLICATE_TASK_TITLE (POST+PATCH, same-project case-insensitive; different project allowed), REASSIGN_COMPLETED (PATCH assignedTo while completed; also same-call status->completed+reassign blocked; status->completed alone allowed). +8 tests; backend 209/209. Next: t10 GET /api/v1/users endpoint.
- 2026-06-04: Phase 3 — t8 done. +12 negative integration tests on task.routes (401/403/404/422 + pagination cap). Member PATCH on unknown id surfaces 404 (ownership middleware checks existence first — desired). Backend 201/201. Next: t9 e2e validation rules (past-deadline, dup title per project, reassign-completed).
- 2026-06-04: Phase 3 — t7 done (Phase B start). task.controller (5 thin handlers) + task.ownership middleware (admin/PM bypass; member must be createdBy OR assignedTo) + task.routes mounted at /api/v1/tasks. PATCH chain: validate(params) -> ownership -> validate(body) -> handler. 8/8 routes integration tests. Backend 189/189. Next: t8 negative paths (401/403/404/422 + pagination cap).
- 2026-06-03: Phase 3 — Phase A complete (t1-t6: prisma schema + add_task migration + constants + validation + service CRUD + service list). All 3 assessment §4 verbatim guards in service (past-deadline, dup-title per project, no reassign of completed). Backend 181/181 jest (+46 for tasks: 15 validation, 19 crud, 11 list, +1 prisma smoke). Next: Phase B controller + routes + users endpoint + nested project tasks route.
- 2026-06-03: Phase 1 locked + Phase 2 GSD sliced — board has 21 tasks across 5 phases (A backend prisma+module t1-t6, B controller+routes+users+nested route t7-t11, C frontend lib+hooks+format helpers t12-t14, D pages+delete component t15-t19, E project-detail wire-up+coverage+readme t20-t21). Awaiting Phase 3 TDD execution starting at t1.
- 2026-06-03: Phase 1 GStack — branched feature/tasks-crud off develop. Drafted goal.md covering task module + Task model + 3 verbatim assessment validation rules (past deadline, dup title per project, no reassign of completed) + RBAC matrix (Admin+PM full CRUD; Member create + edit own + status change own, no delete) + frontend nested pages under /projects/[id]/tasks. Awaiting user lock before Phase 2 slicing.

## Decisions
- 2026-06-03: **Single `assignedTo` FK on Task, nullable.** Linear/Jira default. Multi-assignee deferred. Nullable so tasks can be unassigned at creation.
- 2026-06-03: **Hard delete with cascade from Project.** Mirrors projects-crud. Deleting a project removes its tasks; deleting a task is irreversible.
- 2026-06-03: **Reassign-while-completed blocked at service layer.** Not just UI. Assessment §4 verbatim message: "Cannot reassign a completed task."
- 2026-06-03: **Assignee picker reads all users via new `GET /api/v1/users`.** Team-membership scoping deferred to team-members subgoal. Minimal user shape returned (id, email, name, role) — no passwordHash, no timestamps.
- 2026-06-03: **Mirror lib/project-format extraction from the start.** Create lib/task-format.ts in t-equivalent slot to avoid Ralph having to refactor it later (lesson from projects-crud iter 1 Architect finding).
- 2026-06-03: **Assessment §4 verbatim messages live in task.constant.ts.** Three constants: PAST_DEADLINE_MESSAGE (reuse text from project.constant.ts), DUPLICATE_TASK_TITLE_MESSAGE, REASSIGN_COMPLETED_MESSAGE.

## Blockers (human notes)
None.
