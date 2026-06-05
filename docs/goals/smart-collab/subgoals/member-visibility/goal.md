# Goal — member-visibility (subgoal)

Parent: `smart-collab`
Branch: `feature/member-visibility` off `develop@243b1d7`
Mode: brownfield · feature · new session

---

## What
Scope project + task visibility by `ProjectMember` membership. Backend list/detail queries filter to "projects the actor is a member of" for non-admin roles. Frontend already has a Members tab on project detail (`/projects/[id]/members`) — surface it from the project detail header for project_managers + ensure team_members are read-only on it. Task assignee dropdowns continue to source from project members only.

## Why
Smoke of `progress-system` exposed a real security gap (backlog #B1): logging in as `member@demo.local` (team_member) showed every project + task in the org, including ones the user was not a member of. This is a multi-tenant trust violation. PMs also currently see all projects, which leaks cross-team context. RBAC needs to be enforced at the data layer, not just at UI.

## Done looks like
1. `GET /api/v1/projects` filters to projects where `actor.role == 'admin'` OR `actor.id ∈ ProjectMember.userId` for the project.
2. `GET /api/v1/projects/:id` returns 403 with `{ code: 'FORBIDDEN' }` when the actor is non-admin and not a member.
3. `GET /api/v1/projects/:id/tasks` returns 403 when actor is non-admin and not a member.
4. `GET /api/v1/tasks?...` (cross-project) filters to tasks of projects the actor is a member of (admins see all).
5. Task `findById` returns 403 if actor not a member of the task's project (admins exempt).
6. Project `create` continues to auto-add creator as `pm` (no change). Project_manager sees the project they just created.
7. Existing project_manager + team_member fixtures used in tests cover the new scope filter — no test regression on admin-flow tests.
8. Frontend: no visible UI change other than fewer rows (filtered server-side). The Members tab link on project detail header surfaces for project_manager + admin (already wired for admin per `useRole`); team_member sees the link as read-only (no add/remove buttons).
9. Smoke: log in as `member@demo.local` → only sees projects they're explicitly added to; trying to access a non-member project by direct URL returns the existing 403 / not-found page.

## Mode
- project_type: brownfield
- scope: feature
- session: new

## Locked decisions
- **Roles:** `admin` = unrestricted. `project_manager` and `team_member` = scoped to ProjectMember membership (identical filter, different UI capabilities).
- **Within a project (member):** team_member sees ALL tasks in the project, not just their assignments. Standard PM tool behavior. Filter by "Mine" chip stays available.
- **Where to add members:** existing Members tab on project detail (`/projects/[id]/members`) — no change to project create form. Creator auto-add as `pm` stays.
- **Enforcement layer:** backend service layer (`project.service.ts`, `task.service.ts`) — NOT route middleware. Service receives `actor: { id, role }` and applies the where-clause. Middleware only authenticates; authorization is per query.
- **403 vs 404:** when actor is authenticated but not a member, return 403 `FORBIDDEN`. (Not 404 — leaking project existence is fine within a single tenant; the bigger value is a clear error for legitimate-but-unscoped users.)
- **Performance:** existing `members` relation on `Project` w/ `userId` foreign key already indexed. Add `where: { members: { some: { userId: actorId } } }` to list query — Prisma compiles to an `EXISTS` subquery; no N+1.
- **Caching invalidation:** when a member is added/removed via `projectMember` endpoints, invalidate `['projects']` + `['project', id]` on the FE so newly-granted members see the project appear (already partially handled — verify in `useProjectMembers`).

## Constraints (brownfield)
- MUST NOT change DB schema (`ProjectMember` already exists).
- MUST NOT change request/response shape of `/api/v1/projects` or `/api/v1/projects/:id` — only the filter applied.
- MUST preserve admin-flow tests (admins still see all).
- MUST NOT break the `creator-auto-added-as-pm` invariant — creators must still see their own project immediately after `POST /projects`.
- MUST NOT regress the existing 441 frontend tests or 528 backend tests.
- MUST NOT introduce N+1 on list endpoints — use a single relational filter, not a join-then-filter loop.
- MUST keep the same controller / route signatures — no breaking API rename.

## Scope
- IN:
  - Backend service: actor-aware filter in `projectService.list`, `projectService.findById`, `taskService.list`, `taskService.findById`, project-scoped tasks list.
  - Service signature: extend `Scope` / `ListArgs` types to carry `actor: { id, role }`. Controllers thread this from `req.user`.
  - 403 error path for non-member access via direct URL.
  - Service-layer tests for each affected method: admin sees all, member sees their projects, non-member gets 403.
  - Frontend: Members link surfaced on project detail header for project_manager too (currently admin-only per `useRole`). team_member sees read-only Members tab.
- OUT:
  - Multi-select members on project create form (decided OUT — separate tab).
  - Custom per-project role tiers beyond `pm` / `member`.
  - Audit log for who viewed what.
  - Public/private project flag.
  - Activity log scoping (already scoped via projectId).
  - Dashboard KPI scoping by membership — existing `Scope` already accepts `projectId`; global dashboards intentionally show org-wide counts (admin context). Verify + document; do not change.
- DEFERRED:
  - Project create form members multi-select (option C from brainstorm) — defer to a future polish subgoal if user pushback.
  - Granular permissions (e.g. "view only", "comment only").

## Existing Tests
- Backend: Jest — 528 baseline (must remain green; new auth tests add to count)
- Frontend: Vitest — 441 baseline (must remain green; new RBAC tests add to count)
- Coverage command (backend): `cd backend && npm test --silent`
- Coverage command (frontend): `cd frontend && npm test -- --run`

## Acceptance Criteria
Items 1–9 above. Verified by:
- Backend Jest assertions: 3 users (admin / pm / member) × 2 projects (one each is a member of) → assert list shapes; assert 403 on cross-access for pm + member; assert 200 for admin everywhere.
- Frontend Vitest: API client `403 → throws ApiError(403, 'FORBIDDEN')`. Project detail page handles 403 gracefully (existing `forbidden` route?).
- Manual smoke: `admin@demo.local` sees all projects; `pm@demo.local` sees their projects; `member@demo.local` sees only projects they've been added to. Visit non-member project URL → 403 page.

## Open follow-ups (out of scope)
- After merge, set up a seed script that adds member@demo.local to one demo project explicitly so the demo cohort can see scoped behavior end-to-end without manual data prep.
