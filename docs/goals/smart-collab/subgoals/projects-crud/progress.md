# Progress — projects-crud (human narrative)

Thin log. Board (`state.yaml`) holds task status + receipts.

## Session log
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
