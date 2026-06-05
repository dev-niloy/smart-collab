# Backlog — captured during progress-system smoke (2026-06-05)

## #B1 — Member visibility scoping (RBAC) — **HIGH PRIORITY / SECURITY**

**Observed:** logged in as `member@demo.local` (role: team_member), all projects + tasks were visible — including projects the user is NOT a member of.

**Expected:**
- **Projects list:** team_member should only see projects where they are in `ProjectMember`. admin/pm see all.
- **Project detail:** 403 if non-admin/non-pm and not a member.
- **Tasks list (project-scoped):** team_member only sees tasks of projects they belong to; within those, optionally only their assigned tasks (decision needed).
- **Create project flow:** during create, allow PM/admin to pick initial members. Currently creator auto-added as `pm` only.
- **Create task flow:** assignee dropdown should only list project members, not all users. (Check if `useAssignableMembers` already does this — backend may already filter; frontend may not.)
- **Cross-project task lookup (`useTasks`):** also scope by membership.

**Affected modules:**
- `backend/src/app/modules/project/project.service.ts` → `list` + `findById` need `where: { members: { some: { userId: actorId } } }` for non-admin/non-pm actors.
- `backend/src/app/modules/task/task.service.ts` → similar membership filter on list/findById.
- `backend/src/app/modules/projectMember/` → already exists; ensure CRUD UI surfaces in project detail "Members" tab.
- `frontend/src/app/(authed)/projects/page.tsx` → no FE change if backend filters list correctly.
- `frontend/src/app/(authed)/projects/new/page.tsx` → add multi-select "Add members" step.
- `frontend/src/app/(authed)/projects/[id]/tasks/new/page.tsx` → confirm assignee dropdown scoped to members.

**Open decisions:**
- Should team_member see ALL tasks in projects they belong to, or only their own assignments? (Industry norm: see all tasks in their projects, can filter by "Mine".)
- Should "Mine" sidebar chip on Projects panel become the default view for team_members?

**Subgoal candidate:** `member-visibility` (off develop, after progress-system merges).

---

## #B2 — DashboardPanel sidebar shortcuts look identical — **LOW PRIORITY / COSMETIC**

**Observed:** left sidebar DashboardPanel shows `My Open Tasks` + `Today's Deadlines` as two identical-looking list items. No data preview.

**Expected:** at minimum, a count badge per item (e.g. `My Open Tasks (3)`, `Today's Deadlines (1)`); ideally a thin inline progress bar under "My Open Tasks" mirroring the Dashboard KPI's bar.

**Affected:** `frontend/src/components/shell/DashboardPanel.tsx`.

**Effort:** ~1h. Reuse `useKpis()` + count via existing dashboard hooks. Could ship as a small `chore/dashboard-panel-counts` branch.

---

## #B4 — Members count + assignable list mismatch — **MEDIUM / DATA CONSISTENCY**

**Observed during member-visibility smoke (2026-06-05):**
- (a) PM views project detail header showing `Members (2)` but the linked members page renders only 1 row (PM themselves). User added a member via the form but list does not reflect it consistently across views.
- (b) Task-create page assignee dropdown on Daralmehrab shows only PM + Admin, missing Demo Member who was reportedly added to the project. Same project members page in another browser session shows Demo Member present.

**Likely root cause (untriaged):**
- React-query cache staleness across browser tabs (PM had stale entry from before t8 controller redeploy).
- OR add-member mutation returning non-2xx so `onSuccess` never fires → no invalidation → display shows pre-add state.
- OR the user mentally conflated projects (member added to Solvemeet but expected to appear in Daralmehrab task assignee dropdown).

**To investigate:**
- Hard-refresh PM session after t12 deploy and re-attempt smoke step #4 / #5.
- Inspect Network tab on add-member POST → confirm 201 + payload.
- Verify backend integration: `POST /projects/:id/members` then `GET /projects/:id/members/assignable` returns the new row.
- If reproducible after refresh: add e2e test covering add-then-assignable refresh flow.

**Status:** captured during member-visibility smoke but **not blocking** that subgoal — RBAC code is correct in isolation (verified by 23 unit + integration tests). Fix in a follow-up `fix/member-list-staleness` once reproduced cleanly.

---

## #B3 — Organization + Team model (MILESTONE-LEVEL / DEFERRED)

**Idea (user, 2026-06-05):** introduce an `Organization` top-level entity with `Team`s under it, and assign PMs / team_members at the org or team level rather than project-by-project. Multi-tenant org switcher in the topbar.

**Status:** captured but explicitly deferred — user chose to ship narrow `member-visibility` first (closes #B1 today using existing `ProjectMember`). Org/team is a separate milestone, NOT a follow-up subgoal.

**Why deferred:**
- Real schema migration: new `Organization`, `Team`, `OrgMember`, `TeamMember` tables.
- Every read endpoint rescopes by `orgId`. 528 backend + 441 frontend tests need fixture updates.
- Auth context expands: `req.user.orgId` + `req.user.teams[]`.
- FE: org switcher, team CRUD UI, invite flow, demo reseed.
- Estimate: 5-10× current `member-visibility`; ~30+ tasks.

**Notes:**
- The narrow `member-visibility` fix uses the existing `ProjectMember` table; nothing in it is wasted work — an `Organization` model can sit cleanly on top later.
- Open design questions for the milestone: workspace switcher placement (topbar vs rail), cross-org users (one user / many orgs), billing scope, invite-by-email flow, team-vs-project-role precedence.
- Recommended sequence post-merge: profile-settings → sidebar-v2 → org-teams milestone (own roadmap, not a subgoal).

---

## Notes
- #B1 + #B2 surfaced 2026-06-05 during manual smoke of `progress-system` subgoal.
- #B3 (org/team) captured 2026-06-05 in member-visibility Phase 1 brainstorm — deferred by user.
- #B1 is the next subgoal (in progress). #B2 can be a `chore/*` branch any time. #B3 is a milestone-level conversation, not a subgoal.
