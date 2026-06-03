# Progress — projects-crud (human narrative)

Thin log. Board (`state.yaml`) holds task status + receipts.

## Session log
- 2026-06-03: Phase 3 — t9 done. Frontend lib: schemas/project.ts (Zod v4 mirror of backend contract) + projects.ts (API client w/ apiGet/Post/Patch/Delete, URLSearchParams query, Date->ISO serialization). 16/16 tests added; frontend 37/37 vitest, typecheck + lint clean. Next: t10 TanStack hooks (useProjects, useProject, useCreate/Update/DeleteProject with invalidation).
- 2026-06-03: Phase 3 — t7 + t8 done. Phase B complete. Added pagination-cap test (limit=999 -> 50), combined q+status+sort=deadline filter test, PATCH past-deadline 422 with assessment-verbatim message, GET/DELETE unknown id 404. project.routes.test.ts 18/18; backend 135/135 jest. Next: Phase C frontend — t9 lib/schemas + lib/projects API client.
- 2026-06-03: Phase 3 — t6 done (Phase B start). project.controller.ts + project.routes.ts + mounted at /api/v1/projects. Integration tests 13/13 cover happy + RBAC + 401/403/404/422. Service P2025 mapping switched to duck-typed `err.code` for resetModules safety. Backend 130/130 jest (was 117, +13). Next: t7 remaining negatives (pagination cap) + t8 PATCH past-deadline.
- 2026-06-03: Phase 3 — Phase A complete (t1-t5: prisma schema + add_project migration + constants/validation + service CRUD + service list). Backend 117/117 jest (was 80, +37 new for project module). Coverage on project.* approaching target. Next: Phase B controller + routes.
- 2026-06-03: Phase 1 locked by user. Phase 2 GSD — board sliced into 18 tasks across 5 phases (A: prisma+module skeleton t1-t5, B: controller+routes t6-t8, C: frontend lib+hooks+shadcn t9-t11, D: pages t12-t16, E: wrap t17-t18). Awaiting user OK before Phase 3.
- 2026-06-03: Phase 1 GStack — branched feature/projects-crud off develop. Drafted goal.md covering backend project module + Prisma Project model + frontend list/detail/create/edit pages + basic search/filter/sort/pagination + RBAC matrix. Awaiting user lock before Phase 2 slicing.

## Decisions
- 2026-06-03: **RBAC: Admin + PM mutate; Member read-only.** Matches assessment §1 example. Server enforces; frontend hides buttons (UX only).
- 2026-06-03: **Single `createdBy` FK on Project, not multi-owner join table.** Industry standard (Linear/Jira/Asana). Lowest schema churn. Multi-membership belongs to `team-collab` subgoal via a separate `ProjectMember` join table — added later without altering Project columns.
- 2026-06-03: **Hard delete with cascade**, no soft delete. Assessment scope. `Task` (added in tasks-crud) will FK with `onDelete: Cascade`. Soft delete adds query complexity not worth here.
- 2026-06-03: **Past-deadline guard at service layer**, not just Zod. Future bulk-import / migration paths inherit the rule. Message text matches assessment §4: "Please select a valid deadline."
- 2026-06-03: **Pagination capped at limit 50** (default 10). Prevents accidental full-table reads as data grows.
- 2026-06-03: **Basic search/filter/sort lands here, advanced cross-cutting deferred to t7 search-filter-sort.** Ship a usable list now; harmonize patterns across projects/tasks/members later.

## Blockers (human notes)
None.
