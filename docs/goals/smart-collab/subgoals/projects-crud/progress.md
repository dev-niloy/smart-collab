# Progress — projects-crud (human narrative)

Thin log. Board (`state.yaml`) holds task status + receipts.

## Session log
- 2026-06-03: Phase 3 COMPLETE. Phase E shipped: t17 header Projects nav link + dashboard KPI as clickable Card, header tests 2/2. t18 coverage check (backend project 95.19% lines, frontend project files all >=83%, no TODOs) + README API routes table + frontend pages. Final: backend 135/135, frontend 68/68. Ready for Phase 4 Ralph Wiggum review on PR #7.
- 2026-06-03: Phase 3 — t16 done. Phase D complete. DeleteProjectButton w/ AlertDialog (controlled open, base-ui), confirm copy verbatim, wired into detail page replacing stub. 3 tests; frontend 66/66. Pushed feature/projects-crud to origin; PR #7 open vs develop. Next: Phase E — t17 (router gating / app navigation) + t18 (coverage check, README, cleanup).
- 2026-06-03: Phase 3 — t15 done. /projects/[id]/edit form: prefilled from useProject via reset(), toDateInput formats ISO -> YYYY-MM-DD for native date input, member redirect, push detail on save. 2 page tests; frontend 63/63. Next: t16 DeleteProjectButton w/ AlertDialog.
- 2026-06-03: Phase 3 — t14 done. Embedded creator{id,email,name} in API (industry standard, single round-trip). /projects/[id] detail page: name, description, status Badge, deadline, "Created by Alice (alice@x.y)", timestamps, RBAC-gated Edit link + Delete button stub. useParams (not Promise params) for testability. Backend 135/135 (+1 creator assertion); frontend 61/61. Next: t15 /projects/[id]/edit form.
- 2026-06-03: Phase 3 — t13 done. /projects/new create form: RHF+Zod (form schema split from backend coerce-date for type sanity), Textarea + date Input + Select, member redirected to /forbidden via useRole, toast on success/error, push to detail on create. 3 page tests; frontend 57/57. Next: t14 /projects/[id] detail page.
- 2026-06-03: Phase 3 — t12 done. /projects list page: URL-state filters, debounced search (300ms), card grid, RBAC-gated CTA, two empty states, error retry, paginated. 8 page tests; frontend 54/54 vitest. Locked layout decisions: URL params (shareable + back-button), 300ms debounce, card grid, two empty states. Next: t13 /projects/new create form.
- 2026-06-03: Phase 3 — t11 done. Phase C complete. shadcn primitives added (select, alert-dialog, badge, textarea); no package.json bump. 5/5 ui smoke. Frontend total now 49 tests across 11 files. Next: Phase D — t12 /projects list page.
- 2026-06-03: Phase 3 — t10 done. hooks/useProjects.ts: useProjects/useProject + useCreate/Update/DeleteProject. Cache invalidation: detail cache primed on mutation success + list cache invalidated. 7 hook tests via renderHook + QueryClientProvider. Frontend 44/44 vitest. Next: t11 shadcn primitives (select, alert-dialog, badge, textarea).
- 2026-06-03: Phase 3 — t9 done. Frontend lib: schemas/project.ts (Zod v4 mirror of backend contract) + projects.ts (API client w/ apiGet/Post/Patch/Delete, URLSearchParams query, Date->ISO serialization). 16/16 tests added; frontend 37/37 vitest, typecheck + lint clean. Next: t10 TanStack hooks (useProjects, useProject, useCreate/Update/DeleteProject with invalidation).
- 2026-06-03: Phase 3 — t7 + t8 done. Phase B complete. Added pagination-cap test (limit=999 -> 50), combined q+status+sort=deadline filter test, PATCH past-deadline 422 with assessment-verbatim message, GET/DELETE unknown id 404. project.routes.test.ts 18/18; backend 135/135 jest. Next: Phase C frontend — t9 lib/schemas + lib/projects API client.
- 2026-06-03: Phase 3 — t6 done (Phase B start). project.controller.ts + project.routes.ts + mounted at /api/v1/projects. Integration tests 13/13 cover happy + RBAC + 401/403/404/422. Service P2025 mapping switched to duck-typed `err.code` for resetModules safety. Backend 130/130 jest (was 117, +13). Next: t7 remaining negatives (pagination cap) + t8 PATCH past-deadline.
- 2026-06-03: Phase 3 — Phase A complete (t1-t5: prisma schema + add_project migration + constants/validation + service CRUD + service list). Backend 117/117 jest (was 80, +37 new for project module). Coverage on project.* approaching target. Next: Phase B controller + routes.
- 2026-06-03: Phase 1 locked by user. Phase 2 GSD — board sliced into 18 tasks across 5 phases (A: prisma+module skeleton t1-t5, B: controller+routes t6-t8, C: frontend lib+hooks+shadcn t9-t11, D: pages t12-t16, E: wrap t17-t18). Awaiting user OK before Phase 3.
- 2026-06-03: Phase 1 GStack — branched feature/projects-crud off develop. Drafted goal.md covering backend project module + Prisma Project model + frontend list/detail/create/edit pages + basic search/filter/sort/pagination + RBAC matrix. Awaiting user lock before Phase 2 slicing.

## Decisions
- 2026-06-03: **Embed `creator` relation in Project API responses.** Linear/GitHub/Jira pattern. Single round-trip for "Created by Alice" UI. Applied to create/findById/update/list. Frontend Project type extended with ProjectCreator{id,email,name}.
- 2026-06-03: **RBAC: Admin + PM mutate; Member read-only.** Matches assessment §1 example. Server enforces; frontend hides buttons (UX only).
- 2026-06-03: **Single `createdBy` FK on Project, not multi-owner join table.** Industry standard (Linear/Jira/Asana). Lowest schema churn. Multi-membership belongs to `team-collab` subgoal via a separate `ProjectMember` join table — added later without altering Project columns.
- 2026-06-03: **Hard delete with cascade**, no soft delete. Assessment scope. `Task` (added in tasks-crud) will FK with `onDelete: Cascade`. Soft delete adds query complexity not worth here.
- 2026-06-03: **Past-deadline guard at service layer**, not just Zod. Future bulk-import / migration paths inherit the rule. Message text matches assessment §4: "Please select a valid deadline."
- 2026-06-03: **Pagination capped at limit 50** (default 10). Prevents accidental full-table reads as data grows.
- 2026-06-03: **Basic search/filter/sort lands here, advanced cross-cutting deferred to t7 search-filter-sort.** Ship a usable list now; harmonize patterns across projects/tasks/members later.

## Blockers (human notes)
None.
