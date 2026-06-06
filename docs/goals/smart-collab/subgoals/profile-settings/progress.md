# Progress — profile-settings

Branch: `feature/profile-settings` off `develop@7505845`
Started: 2026-06-06

## Baseline (recorded 2026-06-06)
- Backend Jest: 598 / 598 passed
- Frontend Vitest: 465 / 465 passed

## Locked intake (from goal.md)
- Avatar storage: existing attachment-style multer + local disk (`<UPLOAD_DIR>/avatars/`); 2 MB cap; mime allowlist `image/{png,jpeg,webp,gif}`
- Email change: trust + update (no verification token)
- Password change: requires current; success deletes ALL other sessions for that user, keeps caller's session

## Phase 1 Scout findings (read-only code map)

### Existing patterns to reuse
- `backend/src/app/modules/attachment/multer.ts` — `memoryStorage` + size cap + mime filter + `handleMulterError`.
- `backend/src/app/modules/attachment/attachment.service.ts` — `resolveStoragePath` anchors to `UPLOAD_DIR` and refuses path escape.
- `backend/src/app/modules/auth/auth.routes.ts:27` — `GET /me` already returns the public user shape; we add a parallel under `/users/me`.
- Session model + cookie-auth middleware — read session id from cookie, spare it on password change.
- `frontend/src/hooks/useUser.ts` `USER_KEY = ['auth', 'me']` — new mutations invalidate this so RailBottom + cross-tab via BroadcastChannel (#B4) update without reload.
- `frontend/src/components/shell/RailBottom.tsx` — already renders an avatar circle with the initial letter; gets an `<img>` fallback when `avatarUrl` is set.

### Writer-side gap
- `User` model has no `avatarPath` column → migration required.
- `user.service.ts` does not exist (only `user.controller.ts` with a one-line `list`).
- No multer config for the `user` module yet.
- No PATCH / POST / DELETE endpoints under `/users/me`.
- No `/profile` route on the frontend.

## Phase 2 GSD — proposed task slices (draft)
- **s1 schema + migration**: add `User.avatarPath`, generate + apply migration, verify Prisma client picks it up.
- **s2 BE module skeleton**: extract `user.service.ts` + `user.validation.ts` + `user.constant.ts`, port the existing `list` into the service.
- **s3 GET / PATCH /users/me + tests**: identity + email update + collision handling.
- **s4 PATCH /users/me/password + tests**: bcrypt-compare current, hash new, spare caller's Session.
- **s5 POST + DELETE + GET /users/me/avatar + tests**: multer config, disk write under `avatars/`, stream on GET, best-effort cleanup on DELETE.
- **s6 FE hooks**: `useUpdateProfile`, `useChangePassword`, `useUploadAvatar`, `useDeleteAvatar` + USER_KEY invalidation.
- **s7 FE `/profile` page**: identity / password / avatar sections, react-hook-form + zod, toast on success/error, cache-busting `<img>`.
- **s8 RailBottom hook-up**: avatar fallback + Profile menu item.
- **s9 close**: smoke + progress.md + state.yaml flip + open PR.

## Phase Completion
- [x] Phase 1 GStack — goal.md + state.yaml + progress.md written; baseline (BE 598, FE 465); intake locked; Scout map captured
- [ ] Phase 2 GSD — Judge picks first Worker slice (s1 schema-first)
- [ ] Phase 3 Superpowers — execute slices TDD
- [ ] Phase 4 Ralph Wiggum — multi-persona review

## Blockers
none
