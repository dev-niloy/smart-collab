# Goal — extras-polish (subgoal)

Parent: `smart-collab` (assessment app)
Branch: `feature/extras-polish` off `develop`
Mode: brownfield · feature · new session

---

## What
Cover §10 Extras: comments on tasks, file attachments on tasks, in-app notifications, dark-mode polish.

### Comments
- New `comment` Prisma model: `id`, `taskId`, `authorId`, `body`, `createdAt`, `updatedAt`
- Module: constant/validation/service/controller/routes
- Endpoints under `/api/v1/tasks/:taskId/comments`:
  - `POST /` (create — caller must be project member or admin; body 1..2000 chars)
  - `GET /?limit=50&cursor=…` (list, newest first, cursor pagination)
  - `PATCH /:id` (edit own only; admin can edit any)
  - `DELETE /:id` (delete own; PM + admin can delete any)
- Emits `comment.created` activity into existing activity log
- Frontend: `<TaskCommentsPanel>` on `/projects/[id]/tasks/[taskId]` detail — list + create form + edit/delete inline

### Attachments
- New `attachment` Prisma model: `id`, `taskId`, `uploaderId`, `filename`, `mimeType`, `sizeBytes`, `storagePath`, `createdAt`
- Local-disk storage at `backend/uploads/` (gitignored), UUID-prefixed filename to avoid collisions
- Express static mount at `/api/v1/attachments/file/:id/:filename` (auth-gated)
- Endpoints under `/api/v1/tasks/:taskId/attachments`:
  - `POST /` (multipart upload via multer; max 10MB; whitelist common mime types — images, pdf, docs, txt, zip)
  - `GET /` (list metadata only)
  - `DELETE /:id` (delete by uploader / PM / admin; also unlink file)
- Static download: `GET /api/v1/attachments/file/:id` (auth required; returns the file)
- Emits `attachment.added` and `attachment.removed` activity
- Frontend: drag-drop area + list in task detail with download links + delete button

### Notifications
- New `notification` Prisma model: `id`, `recipientId`, `actorId?`, `type`, `entityType`, `entityId`, `projectId?`, `payload (Json)`, `readAt? DateTime`, `createdAt`
- Generated server-side via `recordActivity` hook side-effects, on these triggers:
  - `task.assigned` → notify the new assignee (unless assignee == actor)
  - `comment.created` → notify task assignee + task creator (deduped, exclude actor)
- Module + endpoints `/api/v1/notifications`:
  - `GET /` (list mine, newest first, cursor pagination, optional `unread=true`)
  - `GET /unread-count`
  - `POST /:id/read` (mark single read)
  - `POST /read-all` (mark all read for me)
- Frontend: `<NotificationBell>` in `<Header>` w/ unread count badge + dropdown list + mark-all-read + click navigates to entity

### Dark mode polish
- Audit existing `next-themes` toggle on all primary pages (login, signup, projects list, project detail, tasks list, task detail, dashboard, activity, members)
- Fix any hardcoded `bg-white`/`text-black` etc that breaks in dark mode
- Verify chip components from search-filter-sort subgoal contrast in dark mode
- Verify recharts colors in dark mode

## Why
Assessment §10 calls these out as bonus. Comments + attachments + notifications are the collaboration cherry-on-top that turns the app from CRUD-with-RBAC into a real team tool. Dark-mode polish is portfolio polish.

## Done looks like
1. `POST /api/v1/tasks/:taskId/comments` creates a comment (member/admin), 1..2000 chars, returns DTO `{id,taskId,author:{id,name},body,createdAt,updatedAt}`; emits activity
2. `GET /api/v1/tasks/:taskId/comments?limit=50&cursor=…` returns cursor-paginated list newest first
3. `PATCH /api/v1/tasks/:taskId/comments/:id` lets author + admin edit body; 403 otherwise
4. `DELETE /api/v1/tasks/:taskId/comments/:id` lets author + PM + admin delete; 403 otherwise; emits activity
5. `POST /api/v1/tasks/:taskId/attachments` multipart upload: 422 over 10MB or unsupported mime; returns DTO; writes file under `backend/uploads/<uuid>-<safeName>`; emits activity
6. `GET /api/v1/tasks/:taskId/attachments` returns metadata list (no file streams)
7. `GET /api/v1/attachments/file/:id` streams the file w/ original filename + correct content-type; 404 missing; 401 unauth
8. `DELETE /api/v1/tasks/:taskId/attachments/:id` deletes row + unlinks file; uploader/PM/admin allowed; emits activity
9. Notifications generated automatically: assignment → new assignee; comment → assignee + task creator; never to actor
10. `GET /api/v1/notifications?unread=true` returns mine, scoped, cursor-paginated, DTO `{id,type,actorName,entityType,entityId,projectId,payload,readAt,createdAt}`
11. `GET /api/v1/notifications/unread-count` returns `{count: number}`
12. `POST /api/v1/notifications/:id/read` flips `readAt`; 404 if not mine
13. `POST /api/v1/notifications/read-all` marks all my unread as read; returns `{updated: number}`
14. Frontend: task detail page renders `<TaskCommentsPanel>` w/ list + create + edit/delete; create form disabled when over limit
15. Frontend: task detail page renders attachments drag-drop area + list w/ download + delete (RBAC-aware)
16. Frontend: header shows `<NotificationBell>` w/ unread badge; dropdown lists latest 10; mark-all-read clears badge; click navigates
17. Dark mode: no contrast regressions across all primary pages
18. Backend coverage on new files ≥80%; frontend coverage on new components/hooks ≥70%
19. Existing test counts preserved (backend 459, frontend 319) + new tests on top
20. CI green on PR `feature/extras-polish` → `develop`

## Mode
- project_type: brownfield
- scope: feature
- session: new

## Scope of this subgoal
- IN: comments CRUD, attachments upload/list/delete (local disk), in-app notifications w/ bell, dark-mode audit + fixes
- OUT: S3/Cloudinary storage, image preview/thumbnails, comment threading/replies, comment mentions/@-parsing, push notifications, email notifications, notification preferences UI, web-push, real-time websockets, file virus scanning

## Constraints (brownfield)
- MUST NOT change existing API response shapes for tasks/projects/members/activity/search
- MUST run notification + activity emission inside originating Prisma `$transaction` so a failed mutation never leaves orphan notifications
- MUST preserve baseline test counts (backend 459, frontend 319)
- MUST sanitise filenames (strip path traversal, limit length, whitelist mime types)
- MUST gate file downloads behind auth (no public bucket leak)
- MUST not log file contents or filenames containing user data in plaintext logs

## Existing Tests
- Backend jest: baseline 459/459
- Frontend vitest: baseline 319/319
- Coverage: `--coverage` flag both apps

## Acceptance Criteria
Items 1–20 above. Verified by running test commands.
