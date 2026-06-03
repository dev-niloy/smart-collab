# Goal — tasks-crud (subgoal)

Parent: `smart-collab` (assessment app)
Branch: `feature/tasks-crud` off `develop`
Mode: brownfield · feature · new session

---

## What
- Backend `task` module mirroring `project` pattern: `task.constant.ts`, `task.validation.ts`, `task.service.ts`, `task.controller.ts`, `task.routes.ts`
- REST under `/api/v1/tasks` (flat, with `?projectId=` filter) + `GET /api/v1/projects/:id/tasks` convenience nested list
- Prisma `Task` model + `TaskStatus` + `TaskPriority` enums + migration `add_task`
- Validation rules (assessment §4 verbatim messages):
  - Past deadline -> "Please select a valid deadline."
  - Duplicate title within same project -> "Task title already exists in this project."
  - Reassigning a completed task -> "Cannot reassign a completed task."
- RBAC matrix:
  - Admin + PM: full CRUD on any task
  - Team Member: create task, edit own assigned tasks, status change on own tasks, cannot delete
- Single `assignedTo` FK -> User (nullable; tasks can be unassigned)
- `GET /api/v1/users` thin endpoint (id, email, name, role) so assignee dropdown has options. All authed roles can read; no mutation.
- Frontend:
  - `/projects/[id]/tasks` — task list within a project (filter by status + priority + assignee, sort, pagination)
  - `/projects/[id]/tasks/new` — create form
  - `/projects/[id]/tasks/[taskId]` — detail
  - `/projects/[id]/tasks/[taskId]/edit` — edit form
  - Inline status change on list rows
  - Delete confirm dialog (admin/PM only)
- Tests: backend integration on routes + RBAC matrix + 3 validation rules; frontend page + form + RBAC tests

## Why
Tasks are the spine of the assessment app. Projects, team members, dashboard analytics, and activity log all read or aggregate task state. Shipping this unblocks every downstream subgoal.

## Done looks like
1. `POST /api/v1/tasks` with valid body as Admin/PM/Member -> 201 + task row created; `createdBy` = caller; `projectId` from body
2. Member creates task -> 201 (members can create); Member tries to PATCH a task they don't own -> 403
3. `GET /api/v1/tasks?projectId=...` returns paginated `{ data, total, page, limit }` with filters: `q` (title contains), `status`, `priority`, `assignedTo` (uuid or 'unassigned'); sort: `created` | `dueDate` | `priority` | `updated`
4. `GET /api/v1/projects/:id/tasks` mirrors the list (server-side equivalent of `?projectId=`)
5. `GET /api/v1/tasks/:id` includes `creator` + `assignee` (id, email, name, role)
6. `PATCH /api/v1/tasks/:id` updates allowed fields; 404 on missing; 422 on validation; 403 on member editing someone else's
7. `DELETE /api/v1/tasks/:id` only Admin/PM -> 204; member -> 403
8. Past-deadline on create/update -> 422 PAST_DEADLINE message "Please select a valid deadline."
9. Duplicate title within same project (case-insensitive) -> 422 DUPLICATE_TASK_TITLE message "Task title already exists in this project."
10. Reassign attempt on completed task (i.e. PATCH `assignedTo` when current `status === 'completed'`) -> 422 REASSIGN_COMPLETED message "Cannot reassign a completed task."
11. `GET /api/v1/users` returns [{id, email, name, role}] for all authed users; no creator/sensitive fields
12. Frontend `/projects/[id]/tasks` lists tasks in cards/rows with title, status, priority, assignee chip, due date, inline status select; toolbar with filters/search/sort/pagination
13. `/projects/[id]/tasks/new` form (RHF + Zod): title, description, priority Select, status Select (defaults Todo), assignedTo Select (loaded from /users), dueDate
14. `/projects/[id]/tasks/[taskId]` detail page with creator, assignee, all fields, RBAC-gated Edit + Delete
15. `/projects/[id]/tasks/[taskId]/edit` update form
16. RBAC button gating: Member sees Edit only on tasks they own (assignedTo === self OR createdBy === self); never sees Delete
17. Delete shows confirm dialog (shadcn AlertDialog) before firing DELETE
18. Backend coverage on `task.*` files >=80%; frontend coverage on task pages + hooks >=70%
19. CI green on PR `feature/tasks-crud` -> `develop`

## Mode
- project_type: brownfield (extends solid foundation + projects-crud)
- scope: feature
- session: new
- inherits parent stack + constraints

## Scope of this subgoal

### Backend (`backend/src/app/modules/task/`)
- `task.constant.ts` — `STATUSES`, `PRIORITIES`, sort keys, defaults, MAX_LIMIT=50, all three assessment-verbatim message constants
- `task.validation.ts` — Zod: `createTaskSchema`, `updateTaskSchema`, `listTasksQuerySchema`, `taskIdParamSchema`
- `task.service.ts` — `create`, `findById` (with creator + assignee embed), `update`, `remove`, `list({projectId, q, status, priority, assignedTo, sort, page, limit})`. Guards: future deadline, no dup title per project, no reassign-while-completed
- `task.controller.ts` — thin handlers; supplies `actorId` from `req.user`; on update/delete enforces ownership for members (admin/PM bypass)
- `task.routes.ts` — `requireAuth` global; per-route ownership middleware for member edits; `requireRole('admin','project_manager')` on DELETE
- Backend `user` module light: `user.controller.list` + `user.routes` -> `GET /api/v1/users` returning `[{id, email, name, role}]`
- Project routes addition: `GET /api/v1/projects/:id/tasks` (delegates to taskService.list)
- Prisma: add `Task` model + `TaskStatus` + `TaskPriority` enums + migration `add_task`
- Tests: integration on each endpoint, role matrix, all 3 validation rules verbatim

### Frontend (`frontend/src/app/projects/[id]/tasks/`)
- `lib/schemas/task.ts` — mirror backend Zod
- `lib/tasks.ts` — API client (createTask, listTasks, getTask, updateTask, deleteTask)
- `lib/users.ts` — `listUsers()` for assignee dropdown
- `hooks/useTasks.ts` — TanStack hooks: `useTasks({projectId, filters})`, `useTask(id)`, `useCreateTask`, `useUpdateTask`, `useDeleteTask` with cache invalidation
- `hooks/useUsers.ts` — `useUsers()` for assignee picker
- `lib/task-format.ts` — STATUS_LABEL, STATUS_VARIANT, PRIORITY_LABEL, PRIORITY_VARIANT, mirrors `lib/project-format.ts` shape
- Pages under `/projects/[id]/tasks/...` (list, new, detail, edit)
- shadcn: ensure `select`, `alert-dialog`, `badge`, `textarea` available (already added in projects-crud)
- Project detail page: add a Tasks card or section linking to `/projects/[id]/tasks`
- Tests: vitest on list page (filter/sort/paginate/inline status change), forms, RBAC button visibility, delete confirm flow, user dropdown

### Infra
- No new infra. Reuse Postgres container, CI.
- `proxy.ts` should already cover `/projects` and child routes (confirm; tasks live under `/projects/[id]/tasks`).

## Existing Tests (subgoal baseline)
- Backend test framework: Jest. Coverage cmd: `npm --prefix backend run test:coverage`
- Backend current coverage (post projects-crud + Ralph): 135/135 tests passing; project module ~95% lines
- Frontend test framework: Vitest. Coverage cmd: `npm --prefix frontend run test:coverage`
- Frontend current: 74/74; project files ~83-100%
- Baseline passing: yes (verified end of projects-crud)

## Constraints (brownfield, must respect)
- Mirror existing module pattern exactly (constant/validation/service/controller/routes)
- Mirror `lib/project-format.ts` extraction pattern for status/priority helpers (no duplication in pages — extract from the start)
- Past-deadline message MUST match `PAST_DEADLINE_MESSAGE` from `project.constant.ts` style (text verbatim from assessment)
- Duplicate-title check is case-insensitive; only within the same `projectId`
- Reassign-while-completed: blocked at service layer, not just UI
- Single assignedTo FK (multi-assignee deferred to later subgoal if ever)
- Hard delete with cascade from Project (so deleting a project removes its tasks); Task delete is hard delete
- All RBAC enforced server-side; frontend gating is UX only
- `GET /api/v1/users` returns minimal shape (id, email, name, role). NO passwordHash, createdAt, updatedAt. Authed users only.
- No activity-log writes (-> activity-log subgoal)
- No external deps beyond what's already pinned

## Out of scope (handled later)
- ProjectMember join table / scoped assignee picker (-> team-members subgoal)
- Task comments, attachments, mentions (-> extras subgoal)
- Cross-cutting unified search across tasks + projects + members (-> search-filter-sort subgoal)
- Activity log entries for task mutations (-> activity-log subgoal)
- Notifications on task assignment / status change (-> notifications subgoal)
- Dashboard charts that aggregate task data (-> dashboard-analytics subgoal — consumes this module's GET endpoints)
- Kanban / drag-drop board view (extras)
- Bulk operations
