# Goal — profile-settings (subgoal)

Parent: `smart-collab`
Branch: `feature/profile-settings` off `develop@7505845`
Mode: brownfield · feature · new session

---

## What
Add a `/profile` page where a signed-in user can update their **display name**, **email**, **password**, and **profile picture (avatar)**. New backend endpoints under `/users/me`, schema field `User.avatarPath`, file upload via the existing attachment-style multer pattern (memory storage → disk write under a new `avatars/` upload sub-directory), and a `Profile` link in the sidebar account dropdown.

## Why
No way today for a user to change their own name, email, password, or avatar from the app. RailBottom dropdown surfaces email + role + Log out but no profile management. Admin would have to touch a row in Postgres directly. Closes a real gap.

## Done looks like
1. `backend/prisma/schema.prisma` adds `avatarPath String?` to `User`. Migration `<ts>_add_user_avatar/migration.sql` adds the column; idempotent.
2. New endpoints, all behind `requireAuth`, mounted at `/api/v1/users/me`:
   - `GET /users/me` — `{ id, email, name, role, avatarUrl, createdAt, updatedAt }`. `avatarUrl` is `/api/v1/users/me/avatar` when `avatarPath` set, else `null`.
   - `PATCH /users/me` — body `{ name?: string, email?: string }`. Email uniqueness → 422 `EMAIL_TAKEN` on P2002. Name min 1 / max 200 trimmed. At least one field required.
   - `PATCH /users/me/password` — body `{ currentPassword, newPassword }`. `bcrypt.compare` must pass → 422 `INVALID_CURRENT_PASSWORD` otherwise. `newPassword` follows signup rule (≥8 chars). On success: hash + persist + delete every Session except the caller's current one. Returns `{ ok: true }`.
   - `POST /users/me/avatar` — multipart `file`, single image only, max 2 MB. Writes to `<UPLOAD_DIR>/avatars/<userId>-<random>.<ext>` via new `avatarUploader` multer config. Deletes prior avatar file best-effort. Updates `User.avatarPath`. Returns PublicUser DTO.
   - `DELETE /users/me/avatar` — clears `User.avatarPath`, best-effort unlinks file.
   - `GET /users/me/avatar` — streams stored file with the correct mime header. 404 when none.
3. Module gains `user.service.ts`, `user.validation.ts`, `user.constant.ts`, `user.multer.ts`. `user.routes.ts` extended. `user.controller.ts` rewritten to a CRUD-style controller.
4. Cookie-auth pattern: password change reads current session id from the cookie (whatever `auth` middleware sets), spares THAT one Session row, deletes the rest for that user. Documented in code.
5. Frontend new route `/profile/page.tsx`:
   - Three sections (single page, no tabs): **Identity** (name + email + Save), **Password** (current + new + Save), **Avatar** (preview + Upload + Remove).
   - react-hook-form + zod (existing patterns), shadcn `Card` / `Input` / `Label` / `Button`.
   - Toast on success + `ApiError` on failure.
   - Avatar `<img>` uses `/api/v1/users/me/avatar?t=<bust>` with cache-busting on update.
6. New hooks in `frontend/src/hooks/useProfile.ts`: `useUpdateProfile`, `useChangePassword`, `useUploadAvatar`, `useDeleteAvatar`. All call `qc.invalidateQueries({ queryKey: ['auth', 'me'] })` on success so RailBottom + cross-tab via BroadcastChannel (#B4) refresh identity / avatar without reload.
7. `RailBottom.tsx`: avatar circle becomes an `<img>` of the avatar when present (falls back to initial). Dropdown gains a `Profile` item linking to `/profile`, above Log out.
8. Tests: per-endpoint BE integration + per-section FE vitest covering form validation, success path, FE invalidation key fires, oversized avatar 422, unsupported mime 422, bad current password 422, session-invalidation on password change keeps caller's session.
9. Manual smoke: change name → topbar reflects, change email → reload re-auth still works, change password → other tab gets logged out, upload avatar → RailBottom shows pic.
10. BE 598 → ~615. FE 465 → ~480.

## Mode
- project_type: brownfield
- scope: feature
- session: new

## Locked decisions
- **Avatar storage**: reuse existing attachment-style multer + local disk. New sub-dir `avatars/` under `UPLOAD_DIR`. Distinct `avatarUploader` instance with tighter mime allowlist (`image/png`, `image/jpeg`, `image/webp`, `image/gif`) and 2 MB cap. No DB Attachment row — single `User.avatarPath` field.
- **Email change**: trust + update. No verification token, no email transport. Same posture as signup today.
- **Password change**: requires current password (bcrypt compare). On success deletes ALL of that user's sessions EXCEPT the caller's current one — user stays logged in here, every other tab / device forced back to /login.
- **No re-auth on email change**: session cookie holds userId; email is non-authoritative for auth. New email visible after `auth.me` cache invalidates.
- **Avatar URL contract**: stable path `/api/v1/users/me/avatar`. Cache-bust via `?t=<updatedAt timestamp>` on FE.
- **One profile page**: single route `/profile`, no admin editing of other users (future RBAC sub-scope).

## Constraints (brownfield)
- MUST NOT break the 598 / 465 baseline. Net count rises.
- MUST NOT change existing signup / login schemas or hashing rounds.
- MUST NOT introduce a new file-storage dependency.
- MUST keep `GET /users` admin-only listing intact (DTO gains `avatarUrl`, otherwise unchanged).
- MUST NOT touch `comment` / `notification` modules — avoids conflict with the open `comment-mentions` PR #41.
- MUST keep BroadcastChannel + auth-me invalidation behavior so multi-tab session-end after password change works.

## Scope
- IN: schema migration, five `/users/me` endpoints, one new FE page, four new hooks, RailBottom avatar wiring, tests.
- OUT: admin user edit, email verification round-trip, server-side avatar cropping / resizing, multi-avatar history, 2FA / passkey / OAuth, display-name uniqueness.
- DEFERRED: optimistic UI for password change ("logged out elsewhere" toast), server-side avatar compression (Sharp / ImageMagick).

## Existing Tests
- Backend Jest 598 baseline.
- Frontend Vitest 465 baseline.
- Baseline passing: verified 2026-06-06 at branch off.

## Acceptance Criteria
Items 1–10 above. Verified by Jest + Vitest + manual seed-based smoke per section.
