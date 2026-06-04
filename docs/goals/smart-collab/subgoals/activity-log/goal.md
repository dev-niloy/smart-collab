# Goal — activity-log (subgoal)

Parent: `smart-collab` (assessment app)
Branch: `feature/activity-log` off `develop`
Mode: brownfield · feature · new session

---

## What
- Extend existing `ActivityLog` Prisma model with `projectId`, `entityType`, `entityId` columns + indexes
- Backend `activityLog` module mirroring existing module pattern (constant/validation/service/controller/routes)
- Emitter service `recordActivity({ actorId, action, entityType, entityId, projectId?, meta? })` reusable from any module
- Hook emitter into existing service mutations (no controller changes):
  - task.service: create / update / delete / status change / assignment change
  - project.service: create / update / delete
  - projectMember.service: add / remove
- Endpoints under `/api/v1/activity`:
  - `GET /api/v1/activity?cursor=&limit=10` → global feed (auth required, latest first)
  - `GET /api/v1/projects/:id/activity?cursor=&limit=10` → per-project feed (requireProjectRole('member'))
- Response shape: `{ items: ActivityDTO[], nextCursor: string|null }` — cursor is base64(createdAt|id) tiebreaker
- Frontend:
  - `lib/schemas/activity.ts` (zod DTO)
  - `lib/activity.ts` (api client: `listActivity`, `listProjectActivity`)
  - `hooks/useActivity.ts` (`useActivity`, `useProjectActivity` — TanStack Query useInfiniteQuery)
  - `components/activity/ActivityItem.tsx` (one row: actor name, action verb, target link, relative time)
  - `components/activity/ActivityFeed.tsx` (list + "Load more" button + empty/loading/error)
  - Dashboard widget: latest 10 in a card on `/dashboard` (uses ActivityFeed limit=10, no load more)
  - Project tab: `projects/[id]/activity/page.tsx` (full ActivityFeed with cursor pagination)
- Action verb registry (constant): map `action` string → human verb + target template, e.g.
  `task.created` → `"created task"`, `task.status_changed` → `"moved task to {status}"`,
  `member.added` → `"added {name} to project"`

## Why
§7 of assessment: activity log on dashboard with actor, timestamp, action. Cross-cutting audit trail across tasks/projects/members. Industry standard (GitHub/Linear/Jira): per-entity feeds + global feed + cursor pagination. Schema already stubbed in foundation — this lights it up.

## Done looks like
1. Migration adds `projectId UUID NULL`, `entityType TEXT NOT NULL`, `entityId UUID NOT NULL` to `activity_logs` + composite indexes `(projectId, createdAt DESC)` and `(entityType, entityId, createdAt DESC)`
2. `recordActivity()` helper writes a row inside the same Prisma transaction as the originating mutation (so failures roll back together)
3. Task service emits on create / update / delete / explicit status transitions / assignee changes — verified by integration tests
4. Project service emits on create / update / delete
5. ProjectMember service emits on add / remove (already-transactional add path piggybacks)
6. `GET /api/v1/activity` returns latest 10 globally; `nextCursor` paginates older
7. `GET /api/v1/projects/:id/activity` returns latest 10 for that project; 403 FORBIDDEN_PROJECT_ROLE if not member/admin; 404 PROJECT_NOT_FOUND if id missing
8. Invalid `limit` (<1 or >50) → 422 VALIDATION_ERROR; default 10
9. Bad `cursor` (un-decodable) → 422 VALIDATION_ERROR
10. DTO includes `{ id, action, actorName, actorId, entityType, entityId, projectId, meta, createdAt }`; actor name null when actor deleted
11. Dashboard page renders ActivityFeed widget (latest 10, no load-more)
12. `/projects/[id]/activity` renders full feed with working "Load more"
13. Project detail page links to `Activity →`
14. Verb registry covers every emitted action — unknown action falls back to raw string
15. Backend coverage on `activityLog.*` files ≥80%; frontend coverage on activity components + hooks ≥70%
16. Backend baseline 343 + new tests still pass; frontend baseline 243 + new tests still pass
17. CI green on PR `feature/activity-log` → `develop`

## Mode
- project_type: brownfield (extends foundation + tasks-crud + projects-crud + team-members + dashboard-analytics)
- scope: feature
- session: new
- inherits parent stack + constraints

## Scope of this subgoal
- IN: ActivityLog schema extension, emitter helper, service-layer hooks in task/project/projectMember, 2 endpoints (global + per-project), frontend feed widget + page, dashboard widget, project detail link
- OUT: filtering by action type, search, real-time push (SSE/WebSocket), email/notification digest, retention/archival policy, admin-only views

## Constraints (brownfield)
- MUST NOT alter existing `ActivityLog.id|actorId|action|meta|createdAt` columns or `users.activities` relation
- MUST NOT change existing task/project/projectMember API response shapes — emit is side-effect only
- MUST run emitter inside the originating Prisma `$transaction` so a failed mutation does not leave an orphan log
- MUST preserve baseline test counts (backend 343, frontend 243) — new tests on top
- MUST NOT log sensitive fields in `meta` (passwordHash, tokens) — whitelist what gets stored

## Existing Tests
- Backend framework: jest (`npm --prefix backend test`), baseline 343/343
- Frontend framework: vitest (`npm --prefix frontend test -- --run`), baseline 243/243
- Coverage commands: `npm --prefix backend test -- --coverage` / `npm --prefix frontend test -- --coverage --run`

## Acceptance Criteria
Items 1–17 above. All must be verified by running the test commands, not assumed.
