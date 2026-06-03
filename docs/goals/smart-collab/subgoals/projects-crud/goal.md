# Goal: projects-crud (subgoal of smart-collab)

Second subgoal. Builds Project model + CRUD endpoints + frontend list/detail/edit flow with basic search/filter/sort/pagination. RBAC-gated per assessment role example.

Parent: `docs/goals/smart-collab/goal.md` (stack + constraints).
Predecessor: `subgoals/foundation/` (DONE — provides User, auth, RBAC, modular backend pattern, shadcn UI, api wrapper, useUser hook).

---

## What
- Backend `project` module mirroring solvemeet pattern: `project.constant.ts`, `project.validation.ts`, `project.service.ts`, `project.controller.ts`, `project.routes.ts`
- REST: `POST/GET/PATCH/DELETE /api/v1/projects` + `GET /api/v1/projects/:id`
- Prisma `Project` model + `ProjectStatus` enum + migration
- RBAC: Admin + PM can create/edit/delete; Team Member read-only
- Frontend routes: `/projects` (list), `/projects/new` (create), `/projects/[id]` (detail), `/projects/[id]/edit` (edit)
- Basic search/filter/sort/pagination on list: name search (`?q=`), status filter (`?status=`), sort (`?sort=created|deadline|updated`), pagination (`?page=&limit=`)
- Confirm-delete UX
- Tests: backend integration on routes + RBAC matrix; frontend page + form tests

## Why
First product-domain feature on top of foundation. Validates the modular backend pattern in real use (not just auth) and proves the frontend stack (TanStack Query mutations + shadcn forms + RHF+Zod) for CRUD work. Every later subgoal (tasks, members, dashboard) reads from Projects, so this MUST be solid.

## Done looks like
1. `POST /api/v1/projects` with valid body as Admin/PM -> 201 + project row created, `createdBy` = caller's id
2. `POST /api/v1/projects` as Member -> 403 FORBIDDEN_ROLE
3. `GET /api/v1/projects` returns paginated list (`{ data, total, page, limit }`) for all 3 roles
4. `GET /api/v1/projects?q=foo&status=active&sort=deadline&page=2&limit=10` filters/sorts/paginates correctly
5. `PATCH /api/v1/projects/:id` as Admin/PM updates fields, 404 on missing id, 422 on invalid body
6. `DELETE /api/v1/projects/:id` as Admin/PM cascades (placeholder — no tasks yet); 403 as Member
7. Past-deadline rejection: `deadline < now` on create/update -> 422 with message "Please select a valid deadline." (matches assessment §4 verbiage even though §4 lives in tasks-crud)
8. Frontend `/projects` lists projects in shadcn Cards with name, status badge, deadline, search input, status filter dropdown, sort dropdown, pagination controls
9. `/projects/new` (Admin/PM only — Member sees /forbidden) form with name/description/deadline/status, RHF+Zod, error toasts
10. `/projects/[id]` detail page; Admin/PM see Edit + Delete buttons, Member sees view-only
11. `/projects/[id]/edit` updates and routes back to detail
12. Delete shows confirm dialog (shadcn alert-dialog) before firing DELETE
13. Backend coverage on `project.*` files >=80%; frontend coverage on project pages + hooks >=70%
14. CI green on PR `feature/projects-crud` -> `develop`

## Mode
- project_type: greenfield
- scope: feature
- session: new
- inherits parent stack + constraints

## Scope of this subgoal

### Backend (`backend/src/app/modules/project/`)
- `project.constant.ts` — STATUS values, sort keys, pagination defaults/limits
- `project.validation.ts` — Zod schemas: `createProjectSchema`, `updateProjectSchema`, `listProjectsQuerySchema`, `projectIdParamSchema`
- `project.service.ts` — `create`, `update`, `remove`, `findById`, `list({q, status, sort, page, limit})`. Past-deadline guard. Writes `createdBy` from `req.user.id`.
- `project.controller.ts` — thin handlers
- `project.routes.ts` — wires routes under `/api/v1/projects`, applies `requireAuth` globally + `requireRole('admin','project_manager')` on mutating routes
- Prisma: add `Project` model + `ProjectStatus` enum + migration `add_project`
- Tests: integration on each endpoint with role matrix + validation edge cases

### Frontend (`frontend/src/app/projects/`)
- `lib/schemas/project.ts` — mirror backend Zod schemas
- `lib/projects.ts` — API client (createProject, listProjects, getProject, updateProject, deleteProject)
- `hooks/useProjects.ts` — TanStack `useProjects(filters)`, `useProject(id)`, `useCreateProject`, `useUpdateProject`, `useDeleteProject` mutations with cache invalidation
- `/projects/page.tsx` — list with search box, status filter, sort dropdown, pagination, status badge, "New Project" button (RBAC-gated via `useRole`)
- `/projects/new/page.tsx` — create form (Admin/PM only — redirect Member to `/forbidden`)
- `/projects/[id]/page.tsx` — detail view + Edit/Delete buttons (RBAC-gated)
- `/projects/[id]/edit/page.tsx` — update form
- shadcn add: `select`, `alert-dialog`, `badge`, `textarea` (run `shadcn add` if not present)
- Header: add "Projects" nav link
- Tests: vitest on list page (filter/sort/pagination interactions), create/edit form submission, delete confirm flow

### Infra
- No new infra. Reuse postgres container, CI, deploy plumbing from foundation.
- `proxy.ts` already includes `/projects` in PROTECTED_PREFIXES — no change needed.

## Existing Tests (subgoal baseline)
- Backend: 80/80 jest passing on develop (foundation baseline)
- Frontend: 21/21 vitest passing on develop
- Coverage commands unchanged from parent
- New code targets: backend project module >=80% lines, frontend project pages+hooks >=70%

## Constraints (inherited + subgoal-specific)
- Inherited from parent + foundation goal.md
- **`User` schema must not be altered** (foundation lock). Reference via `createdBy String @db.Uuid` FK.
- **RBAC enforced server-side first.** Frontend RBAC (hiding buttons) is UX sugar.
- **Past-deadline rejection in service layer**, not just validation, so direct DB calls / future bulk-import paths share the rule.
- **Pagination cap**: limit default 10, max 50. Prevents accidental full-table reads.
- **Search uses Prisma `contains` mode insensitive** (Postgres ILIKE). No raw SQL.
- **Activity log writes deferred** to `activity-log` subgoal (§7). DO NOT add ad-hoc writes here.
- **No member assignment yet** — `team-collab` subgoal owns that. This subgoal only writes `createdBy`.

## Out of scope (handled later)
- Project members / team assignment (-> team-collab subgoal §5)
- Tasks under projects (-> tasks-crud subgoal §3)
- Cross-feature search/filter/sort polish (-> search-filter-sort subgoal §9)
- Dashboard KPIs about projects (-> dashboard-analytics subgoal §6+§8)
- Activity log entries for project mutations (-> activity-log subgoal §7)
- File attachments / comments on projects (-> extras-polish subgoal §10)
- Bulk actions, CSV export
