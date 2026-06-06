# Backlog — captured during progress-system smoke (2026-06-05)

## #B6 — Multi-assignee on tasks — **RESOLVED 2026-06-06 (subgoal `task-multi-assignee` complete, PR pending)**

**Shipped:**
- New `TaskAssignee(taskId, userId, addedById, addedAt)` join table + backfill migration.
- `canWriteTask` predicate over `assignees[]`.
- `task.create` accepts `assigneeIds: string[]`; legacy `assignedTo` still accepted (back-compat).
- New endpoints: `POST/PUT/DELETE /tasks/:id/assignees` (PM/admin only).
- Notifications: status-change fan-out to all assignees (except actor); `task.assigned`/`task.unassigned` on add/remove.
- Dashboard + projectMember workload: dual-read TaskAssignee + legacy.
- Frontend: stacked avatars + `+N` overflow on cards + detail; new-task multi-select picker; detail-page `TaskAssigneesPanel` (PM-only PUT).
- 580 → 601 backend tests, 442 → 447 frontend tests.

**NOT shipped (deferred — see #B7):**
- Drop legacy `Task.assignedTo` column — ~20 test files reference it directly; cleanup is its own subgoal.

---

## #B7 — Drop legacy `Task.assignedTo` column — **RESOLVED 2026-06-06 (subgoal `task-drop-legacy-assignedto` complete, PR pending)**

**Why:** finish the t21 cleanup deferred from `task-multi-assignee`. The column is dual-written but functionally inert; tests still seed via `assignedTo` directly. Until it's dropped + tests migrated, schema carries dead weight.

**Scope:**
- Migrate ~20 backend test files from `prisma.task.create({ assignedTo: x })` → `prisma.task.create({ assignees: { create: { userId: x, addedById: y } } })`.
- Service layer: remove dual-write paths (`task.create` legacy branch, `task.update` legacy `assignedTo` branch, `syncLegacyAssignedTo`, dashboard/workload `OR` clauses, comment service legacy merge).
- Frontend: `Task.assignedTo` + `Task.assignee` removed from schema; bump `assignees` from optional → required. Drop legacy fallback in `canWriteFor` / `assigneeMap` / detail page.
- Migration: `ALTER TABLE tasks DROP COLUMN "assignedTo"; DROP INDEX tasks_assignedTo_idx;`.
- Hard-reject PATCH `assignedTo` / `assigneeIds` (t11 promise) — error code `USE_ASSIGNEE_ENDPOINTS`.
- API response shape (goal #11): remove `assignedTo` + `assignee` from Task DTO.
- Edit page: re-add assignee picker if multi-assignee Combobox lands (goal #15 originally placed it there).

**Estimate:** 5-8 tasks; mostly mechanical churn + the column drop migration at the end.

---

## #B6 — Multi-assignee — ORIGINAL DECISIONS (for reference)

**User-locked decisions (2026-06-05):**
- Task can have **N assignees**, not just one. Industry standard (Linear/Jira/Asana).
- Any assignee can update status + edit fields (today: only the single assignee). `canWriteTask` becomes `actor.id IN task.assigneeIds`.
- Still PM-only for reassign + delete (no change).

**Schema:**
- New `TaskAssignee(taskId, userId, addedById, addedAt)` join table w/ unique `(taskId, userId)` + cascade on Task delete.
- Drop `Task.assignedTo` column (single FK) — migration backfills each existing non-null `assignedTo` into a single `TaskAssignee` row.
- Index `(taskId)` + `(userId)` for filter queries.

**Backend:**
- All assignee filters: `actor.id IN taskAssignees` (EXISTS subquery).
- `canWriteTask`: assignee match via join, not direct FK.
- `ensureAssigneeIsProjectMember`: validate every member of the new list.
- `task.create` / `task.update` accept `assigneeIds: string[]` (replaces single `assignedTo`).
- "assignedTo=me" filter becomes "any assignee = me".
- Notifications: fan-out to every assignee on status changes.

**Frontend:**
- Replace single Select with multi-select chip picker (shadcn `combobox` or stacked checkbox dropdown).
- Card UI: show stacked avatars + "+N" when >3 assignees.
- New task page + edit page: multi-pick.
- `useAssignableMembers` unchanged; consumer change.

**Estimate:** 12–15 tasks across A schema migration / B service multi-assignee / C controllers + validation / D frontend picker + display / E close.

**Branch when started:** `feature/task-multi-assignee` off whichever develop SHA task-assignee-write merges to.

---

## #B1 — Member visibility scoping (RBAC) — **RESOLVED 2026-06-05 (PR #29 merged)**

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

## #B5 — Task assignee-write + soft-delete — **NEXT SUBGOAL after member-visibility merges**

**User-locked decisions (2026-06-05):**
- Only the **assignee** can update task status + edit fields (title/desc/priority/due).
- Only **PM/admin** can reassign.
- Delete: **PM/admin** can delete any; **creator** can delete their own task regardless of role.
- Soft-delete: deleted tasks remain in DB; only **PM/admin** can view a "Deleted" tab and **restore**.
- Unassigned tasks: only **PM/admin** can update status until someone claims (assignee gets set).
- **Comments + attachments** stay open to every project member (including non-assignees).

**Subgoal candidate:** `task-assignee-write`. Estimate ~14-18 tasks across:
- Phase A — field-write enforcement (status/title/desc/priority/due gated on assignee || PM/admin).
- Phase B — reassign gated on PM/admin only.
- Phase C — soft-delete (`deletedAt: DateTime?` + index; service queries filter `deletedAt: null` for non-PM views; creator-own-delete bypass).
- Phase D — Deleted tab on tasks page + Restore action (PM/admin only).
- Phase E — FE buttons + UI gates per the table in goal.md.

**Branch when started:** `feature/task-assignee-write` off whichever develop SHA member-visibility merges to.

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

## #B8 — @-mentions in comment composer — **MEDIUM / FEATURE**

**Captured 2026-06-06 during sidebar dogfooding.**

**Why now:** Consumer side already plumbed — `InboxPanel` has a Mentions tab, notification type `comment.mention` is wired through inbox rendering, and `comment.service.create` already fans out to assignees + creator. Writer side is missing entirely: `TaskCommentsPanel.tsx` is a plain `<Textarea>` with no `@` picker, and `comment.service.create` does not parse mention tokens or enqueue a `comment.mention` notification. Result: nobody can actually be mentioned, so the Mentions tab will stay empty forever.

**Scope:**
- **Frontend composer:** `@` keystroke opens a popover anchored at the caret; popover lists assignable project members (reuse `useAssignableMembers(projectId)`), filters as the user types after `@`, arrow keys + Enter select, Esc dismisses; selection inserts a token `@[Name](userId)` into the textarea and advances the caret past it.
- **Backend `comment.service.create`:** parse mention tokens from the persisted body with a deterministic regex (`/@\[([^\]]+)\]\(([0-9a-f-]{36})\)/g`), dedupe by userId, validate each userId against `prisma.projectMember.findFirst({ projectId, userId })` (silently drop non-members so a malicious sender cannot mention arbitrary users), then enqueue notification type `comment.mention` for each one. Skip self-mention via the existing `enqueue` self-filter.
- **Notification overlap policy:** when a user is BOTH a task assignee AND mentioned, send only `comment.mention` (more specific, lands in the Mentions tab). Plain `comment.created` is suppressed for that recipient. Other assignees + creator still get `comment.created` as today.
- **Body renderer:** when displaying a comment, replace `@[Name](userId)` tokens with a styled inline chip (link to `/users/:id` or hover-card showing email/role). Reuse the existing `TaskAssigneesAvatars` styling for consistency.
- **Tests:** unit tests for the regex parser (token, multiple tokens, malformed, embedded code-fence, no-mentions), integration test for `comment.service.create` confirming `comment.mention` rows land for valid members only, frontend composer test using `userEvent.keyboard('@')` asserting popover opens, selection inserts the token, and the `useCreateComment` payload contains it.
- **Out of scope:** mention notifications for edits (`comment.update` does not exist), @-channels (`@here`, `@all`), cross-project mentions, rich-text editor (Lexical / TipTap). Keep markdown-style token + plain textarea.

**Risks:**
- Token format is rendered to the user verbatim if the body renderer ships before the composer or vice-versa → ship both behind a single PR.
- Members removed from the project after a comment is sent should not get an orphaned mention notification; the project-member validation at send-time handles it for new comments; existing comments are not retro-corrected.
- Mention spam: cap at 20 mentions per comment, 422 over that.

**Pre-requisites:** none — can land before or after #B4 cache-sync.

---

## Notes
- #B1 + #B2 surfaced 2026-06-05 during manual smoke of `progress-system` subgoal.
- #B3 (org/team) captured 2026-06-05 in member-visibility Phase 1 brainstorm — deferred by user.
- #B1 is the next subgoal (in progress). #B2 can be a `chore/*` branch any time. #B3 is a milestone-level conversation, not a subgoal.
- #B4 (in progress as `feature/member-cache-sync`). #B8 captured 2026-06-06 during sidebar dogfooding; user noticed there was no way to @-mention a teammate from the comment box.
