# Goal — comment-mentions (subgoal)

Parent: `smart-collab`
Branch: `feature/comment-mentions` off `develop@8b501f4`
Mode: brownfield · feature · new session

---

## What
Close backlog #B8. Build the writer side of @-mentions in task comments. Add an `@` picker inside `TaskCommentsPanel` that lists project-assignable members, lets the user select one, and inserts a deterministic token `@[Name](userId)` into the textarea. Backend `comment.service.create` parses the token from the persisted body, validates each referenced userId against `prisma.projectMember.findFirst({ projectId, userId })` (silently drops non-members), then enqueues a NEW notification type `comment.mention` for each mentioned user — suppressing `comment.created` for the same recipient so they land in the Inbox Mentions tab (which already exists). Body renderer turns the token into an inline chip.

## Why
Consumer side is already wired and currently lies dormant:
- `frontend/src/app/(authed)/inbox/page.tsx:24` formats `comment.mention` / `mention.created` notifications.
- `frontend/src/components/shell/InboxPanel.tsx:5` ships a `mentions` Inbox tab.
- But `backend/src/app/modules/notification/notification.constant.ts` does NOT include `comment.mention` in `NOTIFICATION_TYPES`. `validateInput` would throw `UNKNOWN_NOTIFICATION_TYPE` if anything tried to enqueue one today. No code does. Net result: the Mentions tab is structurally guaranteed to stay empty forever.
- The composer is a plain `<Textarea>` (`frontend/src/components/tasks/TaskCommentsPanel.tsx`). There is no `@` keystroke handler, no popover, no mention chip rendering.

Closing #B8 means the existing FE plumbing finally fires, and team members can be tagged into a discussion without DM-pinging them out of band.

## Done looks like
1. `backend/src/app/modules/notification/notification.constant.ts` adds `'comment.mention'` to `NOTIFICATION_TYPES`. `isKnownNotificationType('comment.mention') === true`.
2. New module file `backend/src/app/modules/comment/comment.mentions.ts` (or inline helper in `comment.service.ts` — Architect's call) exporting `parseMentions(body: string): string[]` that:
   - Returns deduplicated user IDs (preserves first-occurrence order).
   - Matches the regex `/@\[([^\]]+)\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi` (strict v4-style UUID — partial matches and case-malformed UUIDs do NOT count as mentions).
   - Caps at 20 mentions per comment — over-cap raises `ApiError.unprocessable('Too many mentions (max 20).', 'TOO_MANY_MENTIONS')` in `comment.service.create` BEFORE the transaction opens.
3. `comment.service.create` now:
   - Parses mentions from `body` after the existing project access check.
   - Validates each parsed userId against `prisma.projectMember.findFirst({ projectId: task.projectId, userId })` (admin role bypass — matches `ensureAssigneeIsProjectMember`'s pattern). Non-members are SILENTLY dropped (no error — a malicious sender must not be able to mention arbitrary users and enumerate their existence; reuses the silent-drop pattern from `csvOfEnum` in `task.validation.ts`).
   - Builds the final recipient set as: (assignees ∪ task.createdBy) for `comment.created` MINUS the mention set; mentioned valid members get only `comment.mention`. Actor still filtered by the existing `enqueue` self-skip — no double notification.
   - Persists the comment body verbatim (token format stored as-is, frontend renders).
   - Activity log unchanged — still emits `comment.created` (mentions are a notification fan-out detail, not a separate activity).
4. `backend/src/app/modules/notification/__tests__/notification.triggers.test.ts` gets new cases (in addition to keeping existing ones green):
   - Single mention on a task where the mentioned user is a project member → 1 `comment.mention` row for that user; NO `comment.created` row for the same user; other assignees + creator still receive `comment.created`.
   - Mention of a non-project-member userId → silently dropped, no `comment.mention` row, no error.
   - Self-mention (actor mentions themselves) → no notification at all (the existing `enqueue` actor-skip handles this).
   - Body with 21 mentions → 422 `TOO_MANY_MENTIONS`, no DB writes.
   - Body with malformed token (truncated UUID, wrong-case `@[name](nope)`) → no mentions parsed, comment posts normally.
5. New unit-test file `backend/src/app/modules/comment/__tests__/comment.mentions.test.ts` covering `parseMentions` in isolation: empty body, single mention, multiple distinct mentions, duplicate mentions (deduped), mention inside backtick code-fence (still counts — keep parser dumb; renderer handles fence escaping), mention immediately followed by punctuation.
6. Frontend composer `frontend/src/components/tasks/TaskCommentsPanel.tsx` integrates a mention picker:
   - On `@` keystroke (where the prior char is whitespace, start-of-input, or newline), open a popover anchored at the caret listing `useAssignableMembers(projectId)`.
   - Typing after `@` filters the list against name + email substrings (case-insensitive).
   - Arrow Up / Down navigates the list; Enter selects the highlighted entry; Esc dismisses without inserting; Backspace at the `@` position closes the popover.
   - Selecting inserts `@[Name](userId) ` (with trailing space) at the caret and advances it past the token. The visible textarea content is the literal token — no contentEditable, no rich-text editor; the renderer chips it on display.
7. New component `frontend/src/components/tasks/CommentBody.tsx` renders a comment body string by splitting on the mention-token regex and rendering chips:
   - Chips use the existing `TaskAssigneesAvatars` styling for visual consistency (small avatar circle or initial + name) and link to a hover-card with the email. Reuse `Tooltip` from `components/ui/tooltip` for the email-on-hover behavior.
   - Replaces direct `{comment.body}` renders in `TaskCommentsPanel.tsx` (both the active comment list and the edit-mode preview).
8. Frontend tests in `frontend/src/components/tasks/__tests__/`:
   - `TaskCommentsPanel.mentions.test.tsx` — `userEvent.keyboard('{@}')` opens popover; typing filters; Enter inserts the token; `useCreateComment` payload `body` ends with `@[Name](userId)`.
   - `CommentBody.test.tsx` — body with a single token renders as plain text + chip; body with no token renders as plain text; chip has the email in its accessible name.
9. Backend tests stay ≥ 598 (likely 598 + 5 ≈ 603); frontend tests stay ≥ 462 (likely 462 + 6 ≈ 468). Net both should rise; any drop is a blocker.
10. Manual smoke: PM seeds two members, PM comments `@[Demo Member](member-uuid) please confirm` → Demo Member's Inbox shows the new mention in the Mentions tab; comment renders with a member chip; assignee who is NOT the mentioned user gets only `comment.created`, not `comment.mention`.

## Mode
- project_type: brownfield
- scope: feature
- session: new

## Locked decisions
- **Token format**: `@[Name](<uuid>)` — square-bracket label, parenthesized UUID. Matches the existing inbox-side regex pattern. No alternative shorthand (no `@username`, no `@email`).
- **Strict v4 UUID match**: parser regex rejects partial / malformed UUIDs so a body like `[email](abc)` never accidentally counts as a mention.
- **Silent drop for non-member mentions**: stops information disclosure (cannot enumerate existence by mention spam).
- **Suppress `comment.created` for mentioned recipients**: avoids double-notify; mentions land in the Mentions tab, which is the more specific signal.
- **Cap at 20 mentions per comment**: matches `assigneeIds: z.array(uuidField).max(50)` precedent on the lower end; mentions are noisier so a tighter cap is sensible.
- **Body stored verbatim**: the token is the persistence format; render-time replacement keeps the comment editable as plain text without contentEditable churn.
- **No rich-text editor**: no Lexical / Tiptap / Slate. Plain `<Textarea>` plus an absolutely-positioned popover.
- **No retroactive mention notifications on edit**: `comment.update` does not exist as an API today; if it lands later, edits do NOT replay mention notifications (scope creep).
- **Activity log unchanged**: still `comment.created` only — mentions are a notification fan-out detail, not a separate activity.

## Constraints (brownfield)
- MUST keep all #B1 RBAC, #B5/#B6/#B7 task semantics, and #B4 cache-sync behavior intact.
- MUST NOT break the 598 / 462 baseline. Net count may rise only.
- MUST NOT introduce a rich-text dependency. No `lexical`, `tiptap-*`, `slate`, `prosemirror-*`, `draft-js`.
- MUST NOT change the existing `comment.created` notification format or activity action — mentions are additive only.
- MUST NOT bypass project-member validation. A mentioned userId that is not a project member is silently dropped, not 422'd (information-disclosure guard).
- MUST keep `NOTIFICATION_TYPES` as an `as const` tuple (downstream `isKnownNotificationType` narrows on it).
- MUST keep the composer textarea accessible (label, focus management, popover gets `role="listbox"` + `aria-activedescendant`).
- MUST NOT change inbox-side rendering — the existing format strings in `inbox/page.tsx` already handle `comment.mention`.

## Scope
- IN:
  - Backend: `NOTIFICATION_TYPES` enum addition, mention parser, `comment.service.create` recipient-set logic, validation + tests.
  - Frontend: composer popover + token insertion, `CommentBody` chip renderer, tests.
- OUT:
  - Rich-text editor.
  - `@here` / `@all` channel-style mentions.
  - Cross-project / cross-task mentions.
  - Retroactive mention notifications on a (non-existent) comment edit endpoint.
  - Mention notifications via email / webhook (out-of-band delivery).
- DEFERRED:
  - Mention search across global users (e.g. admin role): future subgoal.
  - Optimistic-update of the comment list after submit (currently invalidate-only; could mask render-time chip latency).

## Existing Tests
- Backend: Jest — 598 baseline (preserved + new mention cases).
- Frontend: Vitest — 462 baseline (preserved + new composer + renderer cases).
- E2E: out of scope for this subgoal (Playwright suite from #B4 stays focused on cache-sync).
- Coverage commands:
  - backend: `cd backend && npm test --silent`
  - frontend: `cd frontend && npm test -- --run`
- Baseline passing: verified 2026-06-06 at branch off (BE 598, FE 462).

## Acceptance Criteria
Items 1–10 above. Verified by full Jest + Vitest suites, manual seed-based smoke, and visual confirmation that the Inbox Mentions tab finally contains rows.
