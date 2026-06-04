# Session Handoff — extras-polish (Phase 3 resume)

Written: 2026-06-04 (~15:30Z)
Resumes at: **Phase 3 Superpowers t1**

---

## TL;DR for the next session

Branch `feature/extras-polish` exists off `develop@7218dc2`. Phases 1+2 done and committed (`92c3fb0`). 19 tasks sliced. Phase 3 has NOT started yet (no code commits, only docs). Read `goal.md` + `state.yaml` + `docs/plans/extras-polish.md` then execute t1..t19 RED→GREEN→REFACTOR→commit per task. Big subgoal — ~90 new tests across backend + frontend.

---

## What this subgoal builds

§10 of the assessment — 4 features bundled:
1. **Comments on tasks** — CRUD + activity emit
2. **File attachments on tasks** — local-disk multer upload + auth-gated download
3. **In-app notifications** — auto-generated bell w/ unread badge
4. **Dark mode polish** — audit + fix hardcoded colors

---

## State on disk

| File | Status |
|------|--------|
| `docs/goals/smart-collab/subgoals/extras-polish/goal.md` | SPEC done (20 acceptance criteria) |
| `docs/goals/smart-collab/subgoals/extras-polish/state.yaml` | `phase: 2`, 19 tasks all `pending`, `next_task: t1` |
| `docs/goals/smart-collab/subgoals/extras-polish/progress.md` | Phase 1+2 logged |
| `docs/plans/extras-polish.md` | 19 tasks with RED→GREEN→REFACTOR→commit per task, all `Status: [ ]` |

---

## Locked clarifications (do NOT re-ask)

- Scope: **all 4 extras** (comments + attachments + notifications + dark-mode polish)
- Comments: `body` 1..2000 chars; edit own + admin; delete by author + PM + admin; cursor pagination newest first
- Attachments: **local disk** at `backend/uploads/` (gitignored); UUID-prefix filenames; multer; 10MB max; whitelist mime (pdf, png/jpg/gif/webp, txt, csv, zip, doc/x, xls/x); auth-gated download
- Notifications: **in-app only** (no email, no push, no websocket); triggers = `task.assigned` (new assignee), `comment.created` (assignee + creator, deduped, exclude actor)
- Dark mode: **audit only** — fix hardcoded `bg-white`/`text-black`, no redesign

OUT of scope: S3/Cloudinary, thumbnails, comment threading/replies, @mentions, virus scanning, notification preferences UI, real-time websockets, email.

---

## Verification — start here on resume

```bash
cd "/home/niloy-roy/Desktop/P/Smart Project & Task Collaboration System"

# Confirm branch + state
git status                       # expect: clean, on feature/extras-polish
git log --oneline develop..HEAD  # expect: single docs commit 92c3fb0
git log -1 --oneline develop     # expect: 7218dc2 Merge PR #15 search-filter-sort

# Confirm baselines still green
npm --prefix backend test        # expect 459 passing (1 flake possible on activityLog.service.list — retry once)
npm --prefix frontend test -- --run  # expect 319 passing

# Confirm prisma in sync
cd backend && npx prisma migrate status  # expect "Database schema is up to date"
```

If any of the above fail w/ a real (non-flake) regression: stop, fix, commit, then start t1.

---

## Phase 3 task plan recap (read `docs/plans/extras-polish.md` for full RED→GREEN steps)

```
Phase A — Schema           t1 baseline · t2 schema+migration (Comment + Attachment + Notification)
Phase B — Comments backend t3 validation · t4 service+activity · t5 controller+routes
Phase C — Attachments      t6 deps+sanitiser · t7 service · t8 controller+download
Phase D — Notifications    t9 enqueue · t10 triggers wired · t11 list/read/count routes
Phase E — Frontend         t12 schemas+clients · t13 hooks · t14 CommentsPanel
                           t15 AttachmentsPanel · t16 NotificationBell · t17 task detail wiring
Phase F — Wrap             t18 dark mode audit · t19 README+coverage
```

Commit format: `[A2] schema: Comment + Attachment + Notification models + migration + 4/4`. Mark plan `Status: [x]` after each commit.

---

## Known gotchas (from prior subgoals this session)

1. **Prisma migrate advisory lock** — if `prisma migrate dev` hangs, stale lock from killed prior process. Fix:
   ```sql
   PGPASSWORD=smartcollab psql -h localhost -p 5433 -U smartcollab -d smartcollab \
     -c "SELECT pg_terminate_backend(pid) FROM pg_locks WHERE locktype='advisory';"
   ```
2. **`activityLog.service.list` test flakes during full backend run** — cross-test contamination on shared activity rows. Standalone always passes. Don't chase it, retry the full suite.
3. **Frontend test ambiguity** — adding new aria-labels may collide w/ existing `getByLabelText(/foo/i)` regexes. Use exact strings on new labels (eg `Search projects and tasks`, not `/search projects/i`).
4. **Service signature widening** — when adding `actorId` or new optional fields to a service `ListArgs`, downstream controllers fail TypeScript until the controller also passes the new field through. Type-check after each new shape.

---

## Git conventions (CLAUDE.md global rules — strictly followed)

- Branch off `develop`. Never commit directly to `develop`/`main`.
- Commit format `<type>: <short desc>` lowercase, no trailing period, terse. Atomic per task.
- **Never push or open a PR without explicit user permission each time.** Wait for "yes / push it / open the pr".
- No AI attribution anywhere — no `Co-authored-by: Claude`, no `🤖`, no AI mentions in commits / PR body / code comments / file names.
- `.gitignore` already covers `node_modules/`, `.env`. Add `backend/uploads/` in t6.

---

## Useful pointers — existing code to mirror

| New module | Mirror this existing module |
|------------|----------------------------|
| `comment` | `activityLog` (cursor pagination, list+create+delete, transaction emit) |
| `attachment` | `activityLog` skeleton; multer is new — search npm `multer` v1.x typed via `@types/multer` |
| `notification` | `activityLog` for list+cursor; new write-only path piggybacks on existing `$transaction` in task/comment services |

Activity emit helper is `recordActivity(tx, {...})` in `backend/src/app/modules/activityLog/activityLog.service.ts`. Action enum needs extending for: `comment.created`, `comment.deleted`, `attachment.added`, `attachment.removed`. Add these to `activityLog.constant.ts ACTIONS` array in t2 (schema task) or t3 (comment.constant). State.yaml task t2 currently only mentions models — add ACTIONS extension to that commit.

Cursor codec already exists at `activityLog.validation.ts` (`encodeCursor`/`decodeCursor`). Reuse it for comments + notifications cursor pagination.

`requireProjectRole('member')` middleware at `backend/src/app/middlewares/requireProjectRole.ts` — reuse for comment + attachment routes scoped under a task. Caller must be admin OR project member.

Existing `task.service.update` wraps in `prisma.$transaction` and calls `recordActivity` — copy this pattern for `notification.enqueue` (also tx-scoped).

---

## Open questions for next session (none currently blocking)

- **Notification deduping logic** — `comment.created` notifies (assignee, creator). What if assignee == creator? Dedupe expected (no double notif). Test it explicitly.
- **Attachment delete** — delete row first or unlink file first? Plan says: row + activity inside tx, then `fs.unlink` after commit. If unlink fails post-commit, log the orphan file path; don't 500 the response. Document this in t7 REFACTOR comment.
- **Comment edit emits activity?** Currently plan emits on create + delete only, not on edit. Confirm with user if missing — otherwise it's intentional (edits are quiet to avoid noise).

---

## Recovery if things go sideways

- Need to undo a commit: `git reset HEAD~1` (soft); `git reset --hard` only with explicit user permission.
- Need to drop the migration: `npx prisma migrate reset` blasts data. Don't use without asking — there's seed data PMs use for the demo login.
- Stuck on a failing test for >5 min: pause, ask the user instead of grinding.

---

## When Phase 3 completes

1. Run final regressions: backend ≥459 + ~50 new, frontend ≥319 + ~40 new.
2. Coverage check: `--coverage` flag, target ≥80% backend on new files, ≥70% frontend.
3. Append `## Extras` README section per t19.
4. Update state.yaml `phase: 3`, mark `superpowers: true` in `phase_completion`.
5. Update progress.md Phase Completion checkbox.
6. Commit `[F19] extras-polish: coverage + README — subgoal complete`.
7. Proceed to Phase 4 Ralph Wiggum (rotate 6 personas, single iteration, fix one finding each).

After Ralph `[DONE]`: ask the user before pushing + opening PR.
