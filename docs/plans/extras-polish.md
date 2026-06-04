# Plan — extras-polish (Phase 2 GSD)

Parent SPEC: `docs/goals/smart-collab/subgoals/extras-polish/goal.md`
Branch: `feature/extras-polish` (off develop@7218dc2)
Mode: brownfield · feature · new session

Every task ends with a commit. Steps: 1. RED 2. GREEN 3. REFACTOR 4. Commit.

---

## Phase A — Schema migration

### Task 1: baseline verification commit
Files: none
Steps:
- 1. Run backend + frontend suites + prisma migrate status, confirm 459/319 green
- 2. Commit `[Baseline] existing tests passing before extras-polish work begins`
Status: [x]

### Task 2: prisma schema — add Comment, Attachment, Notification + migration
Files:
  - `backend/prisma/schema.prisma`
  - `backend/prisma/migrations/<ts>_extras_schema/migration.sql`
  - `backend/src/app/modules/comment/__tests__/comment.schema.test.ts`
Steps:
- 1. RED: 4 tests — insert comment FK to task + author; insert attachment w/ storagePath; insert notification w/ readAt null default; indexes queryable
- 2. GREEN: 3 models + relations on Task/User; `npx prisma migrate dev --name extras_schema`
- 3. REFACTOR: ensure `onDelete: Cascade` on attachments/comments via task; `Restrict` on author/uploader
- 4. Commit `[A2] schema: Comment + Attachment + Notification models + migration + 4/4`
Status: [x]

## Phase B — Comments backend

### Task 3: comment.constant + comment.validation
Files:
  - `backend/src/app/modules/comment/comment.constant.ts`
  - `backend/src/app/modules/comment/comment.validation.ts`
  - `backend/src/app/modules/comment/__tests__/comment.validation.test.ts`
Steps:
- 1. RED: 5 tests — body required 1..2000; trims whitespace; rejects empty; rejects 2001; listQuery has limit 1..50 default 50 + cursor optional
- 2. GREEN: zod schemas + constants (`MAX_BODY=2000`, `DEFAULT_LIST_LIMIT=50`, `MAX_LIST_LIMIT=50`)
- 3. REFACTOR: reuse cursor codec from activityLog.validation if useful
- 4. Commit `[B3] comment: constants + validation + 6/6`
Status: [x]

### Task 4: comment.service — create/list/update/delete + activity emit
Files:
  - `backend/src/app/modules/comment/comment.service.ts`
  - `backend/src/app/modules/comment/__tests__/comment.service.test.ts`
Steps:
- 1. RED: 8 tests — create returns DTO + emits `comment.created` activity; list newest first + cursor pagination; update body by author/admin; 403 not author and not admin; delete by author/PM/admin; emits `comment.deleted` activity; 404 when not found
- 2. GREEN: prisma + recordActivity wrappers; permission helper `canMutateComment(actor, comment, projectRole)`
- 3. REFACTOR: extract `toDTO` + cursor encode/decode helper
- 4. Commit `[B4] comment.service: CRUD + activity emit + 8/8`
Status: [x]

### Task 5: comment.controller + routes mounted under task
Files:
  - `backend/src/app/modules/comment/comment.controller.ts`
  - `backend/src/app/modules/comment/comment.routes.ts`
  - `backend/src/app/modules/task/task.routes.ts` (EXISTING — mount sub-router)
  - `backend/src/app/modules/comment/__tests__/comment.routes.test.ts`
Steps:
- 1. RED: 8 supertest cases — POST 201 + DTO; GET 200 list + nextCursor; PATCH 200 author; PATCH 403 stranger; DELETE 204 author; DELETE 204 PM (non-author); DELETE 403 stranger member; 422 on body too long
- 2. GREEN: standard controller pattern + mount `/api/v1/tasks/:taskId/comments`
- 3. REFACTOR: extract `loadCommentOr404` middleware
- 4. Commit `[B5] comment: controller + routes mounted under task + 8/8`
Status: [x]

## Phase C — Attachments backend

### Task 6: install multer + uploads dir + constant + validation
Files:
  - `backend/package.json`
  - `backend/src/app/modules/attachment/attachment.constant.ts`
  - `backend/src/app/modules/attachment/attachment.validation.ts`
  - `backend/.gitignore` or `.gitignore` (add `uploads/`)
  - `backend/src/app/modules/attachment/__tests__/attachment.validation.test.ts`
Steps:
- 1. RED: 4 tests — accepts allowed mime; rejects unknown mime; rejects > MAX_SIZE; safeFilename strips path traversal + caps length
- 2. GREEN: `npm i multer @types/multer`; constants `MAX_SIZE=10MB`, `ALLOWED_MIME = [pdf, png, jpg, gif, webp, txt, csv, zip, doc/x, xls/x]`; `safeFilename(name)`; uploads dir bootstrap
- 3. REFACTOR: none
- 4. Commit `[C6] attachment: deps + constants + filename sanitiser + 4/4`
Status: [x]

### Task 7: attachment.service — upload/list/delete + activity emit
Files:
  - `backend/src/app/modules/attachment/attachment.service.ts`
  - `backend/src/app/modules/attachment/__tests__/attachment.service.test.ts`
Steps:
- 1. RED: 6 tests — upload writes row + emits `attachment.added`; list returns metadata only; delete by uploader/PM/admin removes row + unlinks file + emits `attachment.removed`; 403 stranger; 404 missing; transaction rolls back orphan row when file write fails
- 2. GREEN: fs + prisma + recordActivity inside `$transaction`; permission helper
- 3. REFACTOR: extract `toDTO` + `resolveStoragePath(id)` helper
- 4. Commit `[C7] attachment.service: upload/list/delete + activity + 6/6`
Status: [x]

### Task 8: attachment.controller + routes + static download endpoint
Files:
  - `backend/src/app/modules/attachment/attachment.controller.ts`
  - `backend/src/app/modules/attachment/attachment.routes.ts`
  - `backend/src/app/routes/index.ts` (EXISTING — mount /api/v1/attachments)
  - `backend/src/app/modules/task/task.routes.ts` (EXISTING — mount sub-router)
  - `backend/src/app/modules/attachment/__tests__/attachment.routes.test.ts`
Steps:
- 1. RED: 6 supertest — POST 201 multipart returns DTO; GET 200 list; GET /api/v1/attachments/file/:id streams correct content-type + filename; 401 unauth on download; DELETE 204 author; DELETE 403 stranger
- 2. GREEN: multer single('file') middleware; controllers; `res.download` for static stream
- 3. REFACTOR: handle multer error -> 422 with consistent envelope
- 4. Commit `[C8] attachment: controller + routes + download + 6/6`
Status: [x]

## Phase D — Notifications backend

### Task 9: notification.constant + validation + service create
Files:
  - `backend/src/app/modules/notification/notification.constant.ts`
  - `backend/src/app/modules/notification/notification.validation.ts`
  - `backend/src/app/modules/notification/notification.service.ts`
  - `backend/src/app/modules/notification/__tests__/notification.service.create.test.ts`
Steps:
- 1. RED: 5 tests — `enqueue(tx, {recipientId, type, ...})` writes row; never enqueues for actor==recipient; type enum validated; payload sanitised; bulk insert for assignment + comment triggers
- 2. GREEN: pure DB helper; `NOTIFICATION_TYPES = ['task.assigned','comment.created']`
- 3. REFACTOR: none
- 4. Commit `[D9] notification: enqueue helper + 5/5`
Status: [x]

### Task 10: wire notifications into task.assigned + comment.created
Files:
  - `backend/src/app/modules/task/task.service.ts` (EXISTING — extend tx)
  - `backend/src/app/modules/comment/comment.service.ts` (EXISTING — extend tx)
  - `backend/src/app/modules/notification/__tests__/notification.triggers.test.ts`
Steps:
- 1. RED: 6 tests — assignment to new user enqueues `task.assigned` for assignee; no notif when assignee==actor; reassign from A to B enqueues for B only; new comment notifies task assignee + creator (deduped, exclude actor); existing task + comment tests still pass
- 2. GREEN: extend existing `$transaction` blocks
- 3. REFACTOR: factor `notifyAssignment(tx, ...)` helper
- 4. Commit `[D10] notification triggers: assignment + comment + 6/6`
Status: [x]

### Task 11: notification.service list + read + unread-count + controller + routes
Files:
  - `backend/src/app/modules/notification/notification.service.ts` (extend)
  - `backend/src/app/modules/notification/notification.controller.ts`
  - `backend/src/app/modules/notification/notification.routes.ts`
  - `backend/src/app/routes/index.ts` (mount /api/v1/notifications)
  - `backend/src/app/modules/notification/__tests__/notification.routes.test.ts`
Steps:
- 1. RED: 8 supertest — GET / 200 mine; GET /?unread=true filters; GET /unread-count returns {count}; POST /:id/read flips readAt; POST /read-all bulk; 401 unauth; 404 not mine; cursor pagination
- 2. GREEN: standard controller + auth + cursor codec
- 3. REFACTOR: shared toDTO
- 4. Commit `[D11] notification: list/read/count + controller + routes + 8/8`
Status: [x]

## Phase E — Frontend

### Task 12: lib/schemas + lib clients (comment + attachment + notification)
Files:
  - `frontend/src/lib/schemas/comment.ts`
  - `frontend/src/lib/schemas/attachment.ts`
  - `frontend/src/lib/schemas/notification.ts`
  - `frontend/src/lib/comments.ts`
  - `frontend/src/lib/attachments.ts`
  - `frontend/src/lib/notifications.ts`
  - `frontend/src/lib/__tests__/comments.test.ts`
  - `frontend/src/lib/__tests__/attachments.test.ts`
  - `frontend/src/lib/__tests__/notifications.test.ts`
Steps:
- 1. RED: 12 tests — 4 per module: schema validates DTO; list passes query params; create POSTs body; delete fires DELETE
- 2. GREEN: zod schemas + apiGet/apiPost/apiDelete wrappers; multipart upload via fetch FormData for attachments
- 3. REFACTOR: shared cursor-page schema
- 4. Commit `[E12] frontend: extras schemas + clients + 12/12`
Status: [ ]

### Task 13: hooks (useComments + useAttachments + useNotifications + useUnreadCount)
Files:
  - `frontend/src/hooks/useComments.ts`
  - `frontend/src/hooks/useAttachments.ts`
  - `frontend/src/hooks/useNotifications.ts`
  - `frontend/src/hooks/__tests__/useComments.test.tsx`
  - `frontend/src/hooks/__tests__/useAttachments.test.tsx`
  - `frontend/src/hooks/__tests__/useNotifications.test.tsx`
Steps:
- 1. RED: 10 tests — useComments infinite query + add/update/delete mutations invalidate; useAttachments list + upload + delete; useNotifications infinite query + useUnreadCount + markRead mutation refetches count
- 2. GREEN: TanStack Query wrappers
- 3. REFACTOR: shared query key factory
- 4. Commit `[E13] frontend: extras hooks + 10/10`
Status: [ ]

### Task 14: TaskCommentsPanel component
Files:
  - `frontend/src/components/tasks/TaskCommentsPanel.tsx`
  - `frontend/src/components/tasks/__tests__/TaskCommentsPanel.test.tsx`
Steps:
- 1. RED: 6 tests — renders list; create form posts; over-limit button disabled; edit toggles textarea (author only); delete button (author + PM); load more
- 2. GREEN: composable panel using useComments
- 3. REFACTOR: extract CommentRow subcomponent
- 4. Commit `[E14] frontend: TaskCommentsPanel + 6/6`
Status: [ ]

### Task 15: TaskAttachmentsPanel component
Files:
  - `frontend/src/components/tasks/TaskAttachmentsPanel.tsx`
  - `frontend/src/components/tasks/__tests__/TaskAttachmentsPanel.test.tsx`
Steps:
- 1. RED: 5 tests — renders existing files; file input triggers upload; over-size disabled; download link href correct; delete button (uploader)
- 2. GREEN: panel using useAttachments; multipart FormData upload via hook
- 3. REFACTOR: extract AttachmentRow subcomponent
- 4. Commit `[E15] frontend: TaskAttachmentsPanel + 5/5`
Status: [ ]

### Task 16: NotificationBell in Header
Files:
  - `frontend/src/components/notifications/NotificationBell.tsx`
  - `frontend/src/components/header.tsx` (EXISTING — mount)
  - `frontend/src/components/notifications/__tests__/NotificationBell.test.tsx`
Steps:
- 1. RED: 6 tests — renders bell; unread count badge; dropdown opens on click; list of latest 10; mark-all-read clears badge; clicking item navigates + marks read
- 2. GREEN: bell + dropdown using useNotifications + useUnreadCount
- 3. REFACTOR: extract NotificationRow subcomponent
- 4. Commit `[E16] frontend: NotificationBell + Header mount + 6/6`
Status: [ ]

### Task 17: task detail page integrates Comments + Attachments panels
Files:
  - `frontend/src/app/projects/[id]/tasks/[taskId]/page.tsx` (EXISTING)
  - `frontend/src/app/projects/[id]/tasks/[taskId]/__tests__/page.test.tsx` (EXISTING — extend)
Steps:
- 1. RED: 3 tests — task detail renders TaskCommentsPanel; task detail renders TaskAttachmentsPanel; existing details still rendered
- 2. GREEN: add panels below existing detail body
- 3. REFACTOR: none
- 4. Commit `[E17] task detail: integrate comments + attachments panels + 3/3`
Status: [ ]

## Phase F — Dark mode + wrap

### Task 18: dark-mode audit + fixes
Files:
  - any frontend file with hardcoded light-only colors (audit will identify)
  - `frontend/src/components/theme-toggle.tsx` (verify)
  - `frontend/src/app/dashboard/__tests__/page.test.tsx` (extend)
Steps:
- 1. RED: 2 tests — `<html>` carries `dark` class when theme=dark; key Card components do not have hardcoded `bg-white`
- 2. GREEN: grep + fix hardcoded colors; ensure Tailwind tokens used (`bg-background`, `text-foreground`)
- 3. REFACTOR: none
- 4. Commit `[F18] dark mode: audit + fix hardcoded colors + 2/2`
Status: [ ]

### Task 19: README + coverage + final regression
Files:
  - `README.md`
Steps:
- 1. Run backend + frontend coverage; confirm targets
- 2. Run full suites
- 3. Append `## Extras: comments + attachments + notifications` section documenting endpoints + UI
- 4. Commit `[F19] extras-polish: coverage + README — subgoal complete`
Status: [ ]
