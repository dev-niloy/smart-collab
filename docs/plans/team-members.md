# Plan — team-members (Phase 2 GSD)

Parent SPEC: `docs/goals/smart-collab/subgoals/team-members/goal.md`
Branch: `feature/team-members` (off develop@d29f04d)
Mode: brownfield · feature · new session

Every task ends with a commit. Steps: 1. RED 2. GREEN 3. REFACTOR 4. Commit.
Update Status `[ ] -> [x]` after commit. Update progress.md after each task.

---

## Phase A — Prisma + migration

### Task 1: ProjectMember model + ProjectRole enum + relations + indexes
Files: `backend/prisma/schema.prisma`
Steps:
- Add `enum ProjectRole { pm member }` mapping `project_role`
- Add `model ProjectMember { id String @id @default(uuid()) @db.Uuid; projectId String @db.Uuid; userId String @db.Uuid; role ProjectRole @default(member); addedAt DateTime @default(now()); addedById String? @db.Uuid; project Project @relation(fields:[projectId], references:[id], onDelete: Cascade); user User @relation("ProjectMemberUser", fields:[userId], references:[id], onDelete: Cascade); addedBy User? @relation("ProjectMemberAddedBy", fields:[addedById], references:[id], onDelete: SetNull); @@unique([projectId, userId]); @@index([userId]); @@index([projectId]); @@map("project_members") }`
- Add back-relations on `User` (projectMemberships, projectMembershipsAdded) and `Project` (members)
- 1. RED: extend prisma smoke test asserting `prisma.projectMember.count()` resolves to number — fails (relation missing)
- 2. GREEN: schema change above; `prisma generate`
- 3. REFACTOR: nothing
- 4. Commit `[A1] prisma: add ProjectMember + ProjectRole enum w/ relations and indexes`
Status: [x] — schema + migration `20260604051802_add_project_member` applied. Removed unrelated rename-index drift from generated SQL. prisma smoke test extended: 5/5 pass. Full backend 220/220.

### Task 2: migration add_project_member + backfill creators as PM
Files: `backend/prisma/migrations/<ts>_add_project_member/migration.sql`
Steps:
- `prisma migrate dev --name add_project_member` to generate base migration
- Edit generated SQL to append backfill: `INSERT INTO "project_members" (id, "projectId", "userId", role, "addedAt", "addedById") SELECT gen_random_uuid(), p.id, p."createdBy", 'pm', p."createdAt", p."createdBy" FROM "projects" p WHERE NOT EXISTS (SELECT 1 FROM "project_members" pm WHERE pm."projectId" = p.id AND pm."userId" = p."createdBy") ON CONFLICT DO NOTHING;`
- 1. RED: write seed test that creates Project via `prisma.project.create` raw (not service) then asserts at least one row exists with role=pm matching createdBy after migration — fails before migration
- 2. GREEN: migration applies cleanly to docker postgres
- 3. REFACTOR: trim extra whitespace in migration
- 4. Commit `[A2] migration: add_project_member + backfill creators as pm`
Status: [x] — separate migration `20260604052411_backfill_project_member_pm` w/ idempotent INSERT…SELECT…WHERE NOT EXISTS. 2 verification tests cover (a) backfill inserts pm row matching createdBy, (b) idempotent re-run produces no duplicates. Backend 222/222.

### Task 3: prisma smoke + backfill verification test
Files: `backend/src/config/__tests__/prisma.test.ts`
Steps:
- 1. RED: assert ProjectMember row exists for every project (`projectMember.count() >= project.count()` w/ role=pm filter) after creating a fresh project via raw prisma — fails if backfill skipped existing rows
- 2. GREEN: passing already from t2; lock with explicit assertion
- 3. REFACTOR: extract test helper if duplicated
- 4. Commit `[A3] test: prisma backfill verified — every project has pm member row`
Status: [x] — covered by A2 verification suite (2 tests in projectMember.backfill.test.ts). Plan slice merged into A2 commit since migration + verification are inseparable in a single GREEN cycle.

---

## Phase B — Backend module

### Task 4: projectMember.constant.ts
Files: `backend/src/app/modules/projectMember/projectMember.constant.ts`
Steps:
- 1. RED: import constants in `__tests__/projectMember.constant.test.ts` — fails (no file)
- 2. GREEN: export `PROJECT_ROLES=['pm','member']` literal tuple, error codes `USER_NOT_FOUND`, `ALREADY_MEMBER`, `MEMBER_NOT_FOUND`, `CANNOT_REMOVE_LAST_PM`, `ASSIGNEE_NOT_PROJECT_MEMBER`, `FORBIDDEN_PROJECT_ROLE`; verbatim messages
- 3. REFACTOR: alphabetize
- 4. Commit `[B4] projectMember: constants + verbatim error messages`
Status: [ ]

### Task 5: projectMember.validation.ts + unit tests
Files:
  - `backend/src/app/modules/projectMember/projectMember.validation.ts`
  - `backend/src/app/modules/projectMember/__tests__/projectMember.validation.test.ts`
Steps:
- 1. RED: 8 cases — addMemberSchema requires email + valid role; updateMemberRoleSchema requires role; memberIdParamSchema enforces uuid; rejects unknown roles; trims email; lowercases email
- 2. GREEN: Zod schemas matching backend conventions
- 3. REFACTOR: dedupe role enum literal from constants
- 4. Commit `[B5] projectMember: zod validation + 8/8 unit tests`
Status: [ ]

### Task 6: projectMember.service core — add, isMember, getProjectRole, listAssignable
Files:
  - `backend/src/app/modules/projectMember/projectMember.service.ts`
  - `backend/src/app/modules/projectMember/__tests__/projectMember.service.crud.test.ts`
Steps:
- 1. RED: 10 cases — addMember(projectId, email, role, actorId) returns row + user echo; addMember unknown email -> ApiError 404 USER_NOT_FOUND; addMember duplicate -> 422 ALREADY_MEMBER (catch p2002); isMember true/false; getProjectRole returns 'pm'|'member'|null; listAssignable returns [{id,email,name,role}] including system admins not in ProjectMember; listAssignable excludes duplicates
- 2. GREEN: service exports; userSelect minimal shape
- 3. REFACTOR: extract `findUserByEmail` helper
- 4. Commit `[B6] projectMember.service: add/isMember/getProjectRole/listAssignable + 10/10`
Status: [ ]

### Task 7: projectMember.service workload + listMembers + updateRole
Files:
  - `backend/src/app/modules/projectMember/projectMember.service.ts`
  - `backend/src/app/modules/projectMember/__tests__/projectMember.service.list.test.ts`
Steps:
- 1. RED: 7 cases — listMembers returns each member w/ `workload.{todo,in_progress,completed,due_soon}`; due_soon counts tasks with dueDate within 7 days AND not completed; updateRole flips pm <-> member; updateRole 404 on missing memberId; workload counts only tasks in same project
- 2. GREEN: `groupBy` on task.status + raw count for due_soon via single `$queryRaw` OR multiple `count` calls in `Promise.all`; chosen impl = `Promise.all(statuses.map(s => count(...)))` for portability + due_soon as 5th count
- 3. REFACTOR: extract `loadWorkload(projectId, userId)`
- 4. Commit `[B7] projectMember.service: listMembers w/ workload + updateRole + 7/7`
Status: [ ]

### Task 8: projectMember.service removeMember (tx + auto-unassign + last-PM guard)
Files:
  - `backend/src/app/modules/projectMember/projectMember.service.ts`
  - `backend/src/app/modules/projectMember/__tests__/projectMember.service.remove.test.ts`
Steps:
- 1. RED: 6 cases — removeMember inside `$transaction` sets `task.assignedTo = null` for that user in that project AND deletes ProjectMember row; tasks in OTHER projects assigned to same user untouched; removing last pm when project has any tasks -> 422 CANNOT_REMOVE_LAST_PM; removing pm when other pm exists is allowed; removeMember 404 on missing
- 2. GREEN: tx body: count pms; if role=='pm' && pmCount==1 && projectTaskCount>0 -> throw; updateMany tasks where assignedTo=userId AND projectId=projectId set null; delete ProjectMember
- 3. REFACTOR: extract `assertNotLastPm` guard
- 4. Commit `[B8] projectMember.service: removeMember tx w/ auto-unassign + last-pm guard + 6/6`
Status: [ ]

---

## Phase C — Routes + integrations

### Task 9: requireProjectRole middleware
Files:
  - `backend/src/app/middleware/requireProjectRole.ts`
  - `backend/src/app/middleware/__tests__/requireProjectRole.test.ts`
Steps:
- 1. RED: 6 cases — admin bypass (any project); project-pm passes when checking 'pm'; project-member fails when 'pm' required; non-member fails 403 FORBIDDEN_PROJECT_ROLE; missing project param 422; missing token 401
- 2. GREEN: middleware reads `req.params.id`, calls `projectMemberService.getProjectRole(projectId, actorId)`, checks against required role (or admin bypass)
- 3. REFACTOR: cache lookup on req object to avoid double-fetch in same request
- 4. Commit `[C9] middleware: requireProjectRole w/ admin bypass + 6/6`
Status: [ ]

### Task 10: projectMember.controller + routes mounted + happy-path tests
Files:
  - `backend/src/app/modules/projectMember/projectMember.controller.ts`
  - `backend/src/app/modules/projectMember/projectMember.routes.ts`
  - `backend/src/app/modules/project/project.routes.ts` (mount child router)
  - `backend/src/app/modules/projectMember/__tests__/projectMember.routes.test.ts`
Steps:
- 1. RED: 8 happy-path tests — POST/GET/PATCH/DELETE wired; admin can do all 4; project-pm can do all 4; GET /:id/members/assignable returns list; member can GET but not mutate
- 2. GREEN: controller thin; routes use `requireAuth` global + `requireProjectRole('pm')` on POST/PATCH/DELETE; mount under existing project router as child via `mergeParams`
- 3. REFACTOR: extract common ProjectId param validation
- 4. Commit `[C10] projectMember: controller + routes + 8 happy-path tests`
Status: [ ]

### Task 11: integration negative paths
Files: `backend/src/app/modules/projectMember/__tests__/projectMember.routes.test.ts`
Steps:
- 1. RED: 10 negative tests — 401 unauth on each verb; 403 FORBIDDEN_PROJECT_ROLE for non-pm trying POST/PATCH/DELETE; 404 USER_NOT_FOUND on add unknown email; 422 ALREADY_MEMBER on duplicate add; 404 MEMBER_NOT_FOUND on PATCH/DELETE unknown id; 422 CANNOT_REMOVE_LAST_PM on lone-pm removal w/ tasks present
- 2. GREEN: ensure controller maps each error class to right status
- 3. REFACTOR: factor seed helpers (createProjectWithMembers)
- 4. Commit `[C11] projectMember: integration negatives + 10/10`
Status: [ ]

### Task 12: project.service.create — auto-insert creator as pm in same tx
Files:
  - `backend/src/app/modules/project/project.service.ts`
  - `backend/src/app/modules/project/__tests__/project.service.test.ts`
Steps:
- 1. RED: 2 tests — creating a project via service inserts ProjectMember row {role:'pm', userId: createdBy} in same tx; failure to insert ProjectMember rolls back the project (simulate via prisma mock that throws)
- 2. GREEN: wrap existing create in `$transaction([projectCreate, projectMemberCreate])` OR convert to `prisma.$transaction(async (tx) => { ... })`
- 3. REFACTOR: keep public API unchanged
- 4. Commit `[C12] project.service: auto-insert creator as pm member in same tx`
Status: [ ]

### Task 13: task.service — ASSIGNEE_NOT_PROJECT_MEMBER validation
Files:
  - `backend/src/app/modules/task/task.service.ts`
  - `backend/src/app/modules/task/__tests__/task.service.crud.test.ts`
  - `backend/src/app/modules/task/task.constant.ts`
Steps:
- 1. RED: 4 tests — POST task w/ assignedTo not member of project -> 422 ASSIGNEE_NOT_PROJECT_MEMBER; PATCH same; admin assignee bypass (admin can be assigned even if not ProjectMember); null assignedTo always allowed
- 2. GREEN: add `ensureAssigneeIsProjectMember(projectId, assignedTo)` guard; admin bypass via system role check on candidate user (system_role==='admin')
- 3. REFACTOR: hoist guard alongside existing PAST_DEADLINE / REASSIGN_COMPLETED
- 4. Commit `[C13] task.service: ASSIGNEE_NOT_PROJECT_MEMBER guard + 4/4 (admin bypass preserved)`
Status: [ ]

---

## Phase D — Frontend lib + hooks

### Task 14: lib/schemas + lib/project-members API client
Files:
  - `frontend/src/lib/schemas/project-member.ts`
  - `frontend/src/lib/project-members.ts`
  - `frontend/src/lib/__tests__/project-members.test.ts`
  - `frontend/src/lib/schemas/__tests__/project-member.test.ts`
Steps:
- 1. RED: 12 cases — schema: addMemberSchema rejects invalid email, trims+lowercases, role enum strict; client: listMembers, listAssignable, addMember, updateRole, removeMember; URL paths correct; ApiError thrown on non-2xx; ALREADY_MEMBER surfaces via ApiError.code
- 2. GREEN: Zod v4 mirror; fetch wrappers like `lib/tasks.ts`
- 3. REFACTOR: dedupe role tuple
- 4. Commit `[D14] frontend lib: project-member schemas + api client + 12/12`
Status: [ ]

### Task 15: lib/project-member-format
Files:
  - `frontend/src/lib/project-member-format.ts`
  - `frontend/src/lib/__tests__/project-member-format.test.ts`
Steps:
- 1. RED: 4 cases — ROLE_LABEL (pm->'Project Manager', member->'Member'), ROLE_VARIANT (pm->default, member->outline), WORKLOAD_TONE (>=10 -> destructive, >=5 -> secondary, else outline)
- 2. GREEN: helpers mirror lib/task-format pattern
- 3. REFACTOR: nothing
- 4. Commit `[D15] frontend lib: project-member-format helpers + 4/4`
Status: [ ]

### Task 16: hooks/useProjectMembers + mutations
Files:
  - `frontend/src/hooks/useProjectMembers.ts`
  - `frontend/src/hooks/__tests__/useProjectMembers.test.tsx`
Steps:
- 1. RED: 9 cases — useProjectMembers(projectId) gated on projectId; useAssignableMembers(projectId) gated; useAddMember invalidates ['project-members', projectId]; useUpdateMemberRole same; useRemoveMember invalidates members AND ['tasks'] (because assignees may have changed); 401 surfaces; ApiError on 422 ALREADY_MEMBER
- 2. GREEN: TanStack hooks, queryKey pattern `['project-members', projectId]`
- 3. REFACTOR: extract `queryKeys` constant
- 4. Commit `[D16] frontend hooks: useProjectMembers + mutations + 9/9`
Status: [ ]

---

## Phase E — Frontend pages + refactor

### Task 17: /projects/[id]/members/page.tsx list w/ MemberCard
Files:
  - `frontend/src/app/projects/[id]/members/page.tsx`
  - `frontend/src/components/members/MemberCard.tsx`
  - `frontend/src/app/projects/[id]/members/__tests__/page.test.tsx`
Steps:
- 1. RED: 6 cases — renders member cards (name, email, system-role badge, project-role badge, workload counts); admin sees Add+Remove+RoleEdit; project-pm sees same; project-member sees read-only; non-member redirected/error; loading skeleton; error retry
- 2. GREEN: page calls `useProjectMembers(projectId)` + `useUser()`; computes `isPrivileged = user.role==='admin' || currentMember?.role==='pm'`
- 3. REFACTOR: extract MemberCard
- 4. Commit `[E17] frontend: members list page + MemberCard + RBAC + 6/6`
Status: [ ]

### Task 18: AddMemberForm component + wired on members page
Files:
  - `frontend/src/components/members/AddMemberForm.tsx`
  - `frontend/src/app/projects/[id]/members/page.tsx`
  - `frontend/src/components/members/__tests__/AddMemberForm.test.tsx`
Steps:
- 1. RED: 5 cases — submit calls addMember; email required; role select required; ALREADY_MEMBER -> toast.error; USER_NOT_FOUND -> toast.error; success -> reset form + toast.success
- 2. GREEN: RHF + zodResolver mirroring task new form; Select for role (pm/member)
- 3. REFACTOR: nothing
- 4. Commit `[E18] frontend: AddMemberForm w/ rbac visibility + 5/5`
Status: [ ]

### Task 19: RemoveMemberButton + role select dropdown wired
Files:
  - `frontend/src/components/members/RemoveMemberButton.tsx`
  - `frontend/src/components/members/RoleSelect.tsx`
  - `frontend/src/components/members/__tests__/RemoveMemberButton.test.tsx`
  - `frontend/src/components/members/__tests__/RoleSelect.test.tsx`
Steps:
- 1. RED: 6 cases — RemoveMember opens AlertDialog w/ copy 'Remove member? Their assigned tasks will be unassigned.', confirm fires mutation + toast.success, CANNOT_REMOVE_LAST_PM -> toast.error w/ specific message, cancel closes w/o call; RoleSelect changes fire PATCH; loading disables select; ApiError surfaces toast
- 2. GREEN: components + integration on MemberCard
- 3. REFACTOR: share toast error helper
- 4. Commit `[E19] frontend: RemoveMemberButton + RoleSelect + 6/6`
Status: [ ]

### Task 20: refactor task assignee picker -> useAssignableMembers (3 spots)
Files:
  - `frontend/src/app/projects/[id]/tasks/page.tsx` (inline assignee filter)
  - `frontend/src/app/projects/[id]/tasks/new/page.tsx` (assignee Select)
  - `frontend/src/app/projects/[id]/tasks/[taskId]/edit/page.tsx` (assignee Select)
  - tests for each
Steps:
- 1. RED: 4 cases — tasks list filter Select options come from useAssignableMembers (not useUsers); new task form assignee options scoped; edit form same; useUsers no longer called from task pages (verify mock spy)
- 2. GREEN: swap import + hook call; preserve UNASSIGNED + 'Any' options
- 3. REFACTOR: extract `AssigneeSelect` shared component to dedupe
- 4. Commit `[E20] frontend: scope task assignee picker to project members (3 spots) + AssigneeSelect`
Status: [ ]

### Task 21: project detail Members section + link
Files:
  - `frontend/src/app/projects/[id]/page.tsx`
  - `frontend/src/app/projects/[id]/__tests__/page.test.tsx`
Steps:
- 1. RED: 2 cases — detail page renders 'Members' link to `/projects/{id}/members`, visible to all authed; member count shown if loaded
- 2. GREEN: add Members button alongside View tasks button; optional `useProjectMembers(projectId)` for count
- 3. REFACTOR: nothing
- 4. Commit `[E21] frontend: project detail Members link w/ count + 2/2`
Status: [ ]

---

## Phase F — Wrap

### Task 22: coverage check + README updates
Files: `README.md`, no code changes (verification + docs)
Steps:
- Run `npm --prefix backend run test:coverage` — assert `projectMember.*` >=80% lines; assert global jest count >= 219 + ~55 new = ~274
- Run `npm --prefix frontend run test:coverage` — assert members files + AssigneeSelect >=70% lines; assert vitest count >= 143 + ~44 new = ~187
- Update README API table: `/api/v1/projects/:id/members` (4 verbs), `/api/v1/projects/:id/members/assignable`, plus RBAC matrix per route
- Update frontend pages list w/ `/projects/[id]/members`
- Note assignee scoping change in README "Recent changes"
- Commit `[F22] coverage + README updates — subgoal team-members complete`
- Mark subgoal state.yaml phase_completion.superpowers = true
Status: [ ]

---

## Plan totals
- 22 tasks across 6 phases (A prisma/migration, B service, C routes+integrations, D frontend lib/hooks, E pages+refactor, F wrap)
- Estimated new tests: backend ~55, frontend ~44
- Backend target: ≥274 jest passing, ≥80% lines on projectMember module
- Frontend target: ≥187 vitest passing, ≥70% lines on member pages/hooks
- All pre-existing tests (219 backend / 143 frontend) must continue passing throughout — verify suite after every GREEN
