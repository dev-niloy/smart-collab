# Progress — tasks-crud (human narrative)

Thin log. Board (`state.yaml`) holds task status + receipts.

## Session log
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
