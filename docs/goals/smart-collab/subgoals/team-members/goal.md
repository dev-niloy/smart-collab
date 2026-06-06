# Goal — team-members (subgoal)

Parent: `smart-collab` (assessment app)
Branch: `feature/team-members` off `develop`
Mode: brownfield · feature · new session

---

## What
- New `ProjectMember` join table with per-project role (`pm` | `member`)
- Backend `projectMember` module mirroring `project`/`task` pattern: constant / validation / service / controller / routes
- REST under `/api/v1/projects/:id/members` (list, add, update role, remove)
- Add member flow: PM/Admin enters email → backend looks up user → creates `ProjectMember` row (404 if email unknown, 422 if already member)
- Workload aggregate: `GET /api/v1/projects/:id/members` returns each member + open task counts (`todo`, `in_progress`, `completed`, `due_soon` within 7 days)
- Refactor task assignee picker: scoped to project members only (`GET /api/v1/projects/:id/members/assignable`) instead of global `/api/v1/users`
- Auto-unassign on member removal: when `ProjectMember` deleted, all tasks where `assignedTo === userId` and `projectId === projectId` get `assignedTo = null`
- Project creator auto-added as `pm` member at project create time (backfill migration for existing rows)
- RBAC:
  - System `admin` → full access everywhere (implicit; no ProjectMember row needed)
  - Project-role `pm` → manage members, assign tasks, edit project, edit any task in project
  - Project-role `member` → view project, edit own tasks, status change on own
- Frontend:
  - `/projects/[id]/members` — member list w/ workload card per member, add-member form, role select, remove button (PM/Admin only)
  - Task assignee dropdown sources from project members (refactor existing forms)
  - Project detail page: add Members section / link
- Tests: backend integration on routes + RBAC matrix + auto-unassign + scoped assignee; frontend page + form + RBAC tests

## Why
§5 of assessment: "PM/Admin can add team members to a project and assign tasks to them; team members can view their assigned tasks and update status; PM/Admin can view per-member workload." Tasks-crud currently treats every authed user as assignable to any project, which breaks the team-bounded model the assessment describes. This subgoal makes membership explicit and scopes assignment correctly. Workload counts here feed t5 dashboard.

## Done looks like
1. Prisma `ProjectMember(id, projectId, userId, role, addedAt, addedBy)` model + `ProjectRole` enum (`pm`, `member`) + migration `add_project_member` + backfill making each project's `createdBy` user a `pm` row
2. Unique constraint `(projectId, userId)` enforced at DB level
3. `POST /api/v1/projects/:id/members` body `{ email, role }` → Admin or project-role PM only → 201 with member + user echo; 404 USER_NOT_FOUND if email unknown; 422 ALREADY_MEMBER if duplicate; 403 if caller lacks perms
4. `GET /api/v1/projects/:id/members` returns `[{ id, role, addedAt, user: {id,email,name,role}, workload: { todo, in_progress, completed, due_soon } }]` for any project member or Admin
5. `GET /api/v1/projects/:id/members/assignable` returns `[{ id, email, name, role: projectRole }]` for assignee dropdown (Admin always included even without ProjectMember row)
6. `PATCH /api/v1/projects/:id/members/:memberId` updates `role` only → Admin or project-role PM; 403 otherwise; 404 if member row missing
7. `DELETE /api/v1/projects/:id/members/:memberId` → Admin or project-role PM → 204; **side effect: all tasks in this project assigned to that userId get `assignedTo = null` in same transaction**; 422 CANNOT_REMOVE_LAST_PM if removing last `pm` row from a project that has tasks
8. Project creation auto-inserts creator as `pm` ProjectMember in same transaction
9. Task assignee Zod validation rejects `assignedTo` userId that is not a member of the task's project (422 ASSIGNEE_NOT_PROJECT_MEMBER) — applies on task create + task update
10. Existing task assignee picker on frontend swapped to `useProjectMembers(projectId)` hook (no global `/users` call from task forms)
11. Member edits own task — still allowed; member edits other member's task — 403 (existing rule preserved)
12. `/projects/[id]/members` page: member list w/ name+email+system-role+project-role+workload counts; add-member form (RHF + Zod) w/ email + role select; remove confirm dialog (shadcn AlertDialog); role select dropdown updates via PATCH
13. RBAC button gating on members page: add/remove/role-edit visible only to Admin or project-role PM; everyone else sees read-only list
14. Project detail page: Members card or section linking to `/projects/[id]/members`
15. Backend coverage on `projectMember.*` files ≥80%; frontend coverage on members pages + hooks ≥70%
16. All 3 validation rules from tasks-crud still pass; all 219 backend + 143 frontend tests still pass after refactor
17. CI green on PR `feature/team-members` → `develop`

## Mode
- project_type: brownfield (extends foundation + projects-crud + tasks-crud)
- scope: feature
- session: new
- inherits parent stack + constraints

## Scope of this subgoal

### Backend (`backend/src/app/modules/projectMember/`)
- `projectMember.constant.ts` — `PROJECT_ROLES`, error message constants
- `projectMember.validation.ts` — Zod: `addMemberSchema`, `updateMemberRoleSchema`, `memberIdParamSchema`
- `projectMember.service.ts` — `addMember`, `listMembers` (w/ workload aggregation), `listAssignable`, `updateRole`, `removeMember` (w/ task auto-unassign in tx), `isMember`, `getProjectRole`
- `projectMember.controller.ts` — thin handlers; supplies `actorId` + `actorRole` from `req.user`
- `projectMember.routes.ts` — mounted under `/projects/:id/members`; `requireAuth` global; per-route guard middleware for project-role PM check
- Project service: extend `create` to insert creator as PM member in same tx
- Project routes: add `GET /:id/members`, `POST /:id/members`, `GET /:id/members/assignable`, `PATCH /:id/members/:memberId`, `DELETE /:id/members/:memberId`
- Task service: extend `create` + `update` to validate `assignedTo` is project member (or null)
- Auth/RBAC middleware: add `requireProjectRole('pm')` middleware that reads `projectId` from `req.params.id` and checks ProjectMember OR system admin
- Prisma: add `ProjectMember` model + `ProjectRole` enum + migration `add_project_member` w/ backfill SQL
- Tests: integration on each endpoint, role matrix, auto-unassign side effect, ASSIGNEE_NOT_PROJECT_MEMBER on task routes, last-PM removal block

### Frontend (`frontend/src/app/projects/[id]/members/`)
- `lib/schemas/project-member.ts` — mirror backend Zod
- `lib/project-members.ts` — API client (listMembers, addMember, updateRole, removeMember, listAssignable)
- `hooks/useProjectMembers.ts` — TanStack hooks: `useProjectMembers(projectId)`, `useAssignableMembers(projectId)`, `useAddMember`, `useUpdateMemberRole`, `useRemoveMember`
- `lib/project-member-format.ts` — ROLE_LABEL, ROLE_VARIANT, workload color tokens
- `/projects/[id]/members/page.tsx` — list page w/ member cards, add form, role selects, remove dialog
- `components/members/MemberCard.tsx` — name/email/system-role/project-role badge + workload counts
- `components/members/AddMemberForm.tsx` — email + role select
- `components/members/RemoveMemberButton.tsx` — confirm dialog
- Refactor: `frontend/src/app/projects/[id]/tasks/new/page.tsx`, `.../[taskId]/edit/page.tsx`, inline assignee select on list page — all now consume `useAssignableMembers(projectId)` instead of `useUsers()`
- Project detail page: add Members section linking to `/projects/[id]/members` w/ member count
- Tests: vitest on members page (list/add/remove/role-change), AddMemberForm validation, RBAC button visibility, refactored task assignee dropdowns scoped to project

### Infra
- No new infra
- Existing Next 16 proxy.ts already covers `/projects` and child routes
- Postgres container unchanged

## Existing Tests (subgoal baseline)
- Backend test framework: Jest. Coverage cmd: `npm --prefix backend run test:coverage`
- Backend baseline: 219/219 passing (verified 2026-06-04 11:06)
- Frontend test framework: Vitest. Coverage cmd: `npm --prefix frontend run test:coverage`
- Frontend baseline: 143/143 passing (verified 2026-06-04 11:06)
- Baseline passing: yes

## Constraints (brownfield, must respect)
- Mirror existing module pattern exactly (constant/validation/service/controller/routes)
- All 3 task validation rules (PAST_DEADLINE, DUPLICATE_TASK_TITLE, REASSIGN_COMPLETED) must continue to pass verbatim
- System role enum (`admin`, `project_manager`, `team_member`) is untouched; project-role is a separate `ProjectRole` enum
- System `admin` bypasses all project-role checks (acts as super-user)
- `(projectId, userId)` unique on ProjectMember enforced at DB level
- Task auto-unassign on member removal happens in same transaction as the DELETE (no orphan window)
- Project creator auto-PM-membership happens in same transaction as project create (no orphan window)
- Existing task assignee picker that called `/api/v1/users` is replaced — `/api/v1/users` endpoint remains for admin tooling but is no longer consumed by task forms
- No activity log writes here (→ t6)
- No notifications here (→ t8)
- No charts here (→ t5)
- No new top-level deps beyond what's already pinned

## Out of scope (handled later)
- Email invitations to non-existing users (deferred)
- Bulk member add via CSV
- Member-level permissions beyond pm/member (no custom roles)
- Activity log entries for member mutations (→ t6)
- Notifications on add/remove (→ t8)
- Workload visualisations / charts (→ t5)
- Cross-project search of members (→ t7)
- Multi-org / multi-workspace tenancy
