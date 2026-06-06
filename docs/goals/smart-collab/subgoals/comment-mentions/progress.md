# Progress — comment-mentions

Branch: `feature/comment-mentions` off `develop@8b501f4`
Started: 2026-06-06

## Baseline (recorded 2026-06-06)
- Backend Jest: 598 / 598 passed
- Frontend Vitest: 462 / 462 passed
- E2E (Playwright): out of scope this subgoal

## Locked intake (from goal.md)
- Token format: `@[Name](<uuid-v4>)`
- Strict v4-UUID regex
- Silent-drop non-member mentions (information-disclosure guard)
- Suppress `comment.created` for any recipient that also gets `comment.mention`
- Max 20 mentions per comment (422 `TOO_MANY_MENTIONS` over cap)
- No rich-text editor dep (plain `<Textarea>` + popover)
- No retro mention-replay on edit (no `comment.update` endpoint exists)
- Activity log unchanged — mentions are a notification fan-out detail only

## Phase 1 Scout findings (read-only code map)

### Consumer side (already exists, dormant)
| Where | What |
|---|---|
| `frontend/src/components/shell/InboxPanel.tsx:5` | `InboxTab = 'unread' \| 'mentions' \| 'assigned'` |
| `frontend/src/app/(authed)/inbox/page.tsx:24` | Formats `comment.mention` / `mention.created` notif rows |
| `frontend/src/app/(authed)/inbox/page.tsx:105` | `mentions` filter scoped to `comment.mention` / `mention.created` / `type.includes('mention')` |

### Writer side gap (must be filled)
| Where | Gap |
|---|---|
| `backend/src/app/modules/notification/notification.constant.ts:1-7` | `NOTIFICATION_TYPES` does NOT include `'comment.mention'`. Any `enqueue({ type: 'comment.mention' })` would currently throw `UNKNOWN_NOTIFICATION_TYPE`. |
| `backend/src/app/modules/comment/comment.service.ts` (~line 117) | No mention parsing. Recipient set is only assignees ∪ creator with all of them getting `comment.created`. |
| `frontend/src/components/tasks/TaskCommentsPanel.tsx` (~line 180) | Plain `<Textarea>`, no `@` handler, no popover. |
| (new) `frontend/src/components/tasks/CommentBody.tsx` | Does not exist; the token would render verbatim today. |

### Existing patterns to reuse
- `useAssignableMembers(projectId)` for the popover list — already cache-broadcast-synced (#B4 PR #37) so cross-tab freshness is free.
- `Tooltip` from `components/ui/tooltip` for chip-on-hover email.
- `enqueue` actor-self-skip in `notification.service.ts:32-35` for free actor-suppression.
- `ensureAssigneeIsProjectMember` pattern in `task.service.ts:131` for the membership probe (admin role bypass + `projectMember.findFirst`).

## Phase 3 Superpowers — shipped (2026-06-06)

| Slice | Commit | Surface |
|---|---|---|
| t1 BE enum + parser | `feat(comment-mentions): NOTIFICATION_TYPES enum + parseMentions util (slice 1)` | `notification.constant.ts` adds `'comment.mention'`; new `comment.mentions.ts` exports `parseMentions` + `MAX_MENTIONS_PER_COMMENT = 20`; 14 unit tests cover dedupe, malformed-UUID drop, cap-not-enforced-in-parser |
| t2 BE recipient logic | `feat(comment-mentions): comment.service.create resolves mentions + suppresses comment.created (slice 2)` | `comment.service.create` parses, cap-checks (422 `TOO_MANY_MENTIONS` BEFORE tx), `resolveValidMentionMembers` admin-bypass + projectMember probe (silent drop non-members), comment.created fan-out subtracts the mention set, comment.mention fan-out only for valid members; 4 integration tests in `notification.triggers.test.ts` |
| t3 FE renderer | `feat(comment-mentions): CommentBody chip renderer (slice 3)` | `lib/mentions.ts` (regex + `splitMentionSegments` + `formatMentionToken`); `CommentBody` chips tokens with `data-user-id` attr; `TaskCommentsPanel` swaps plain `<p>` for `<CommentBody>`; 6 unit tests |
| t4 FE composer | `feat(comment-mentions): MentionTextarea composer with @ picker (slice 4)` | `MentionTextarea` detects `@` at start/after-whitespace, opens listbox popover anchored below textarea, lists `useAssignableMembers`, ArrowUp/Down/Enter/Esc + mouse click, inserts `@[Name](userId) ` at caret; clamps highlighted index at render to dodge cascading-setState lint; `role=combobox` + `aria-autocomplete` for SR support; `TaskCommentsPanel` props gain `projectId`, parent threads `task.projectId`; 6 unit tests |

## Verification (Phase 3)
- `cd backend && npm test --silent` → 616 / 616 on clean run (baseline 598; +18 = 14 parser unit + 4 integration). Pre-existing `activityLog.service.list` flake still surfaces occasionally, unchanged + out of scope.
- `cd frontend && npm test -- --run` → 477 / 477 (baseline 462; +15 net).
- `cd backend && npx tsc --noEmit` clean. `cd frontend && npx tsc --noEmit` clean.
- `cd frontend && npm run lint` exit 0 (5 pre-existing react-hook-form / React Compiler warnings on unrelated files; no new errors).
- Smoke pending — see "Manual smoke" section below.

## Manual smoke (PM-led, dev stack required)
1. Sign in as `pm@demo.local`, open a Demo Web task with at least one other assignee.
2. In the comment composer, type `Heads up @` — popover appears listing project members.
3. Type `de` — list filters to `Demo Member`. Press Enter — body becomes `Heads up @[Demo Member](<uuid>) `.
4. Submit. The Inbox **Mentions** tab on `member@demo.local` finally surfaces a row (was structurally empty before this subgoal).
5. Another assignee (NOT mentioned) gets only `comment.created`, not `comment.mention`.
6. `@xyz` where `xyz` matches nobody → popover empty; comment still posts.
7. 21 valid mention tokens in one body → 422 `TOO_MANY_MENTIONS`, no comment row.

## Phase Completion
- [x] Phase 1 GStack — goal.md + state.yaml + progress.md written; baseline
      (BE 598, FE 462); intake locked; Scout map of dormant inbox plumbing +
      writer-side gap captured
- [x] Phase 2 GSD — Judge picked BE-first slice plan (t1 enum + parser,
      t2 recipient logic, t3 FE renderer, t4 FE composer); ordering
      threaded into the Phase 3 commits
- [x] Phase 3 Superpowers — 4 slices shipped, BE 598 → 616, FE 462 → 477
- [ ] Phase 4 Ralph Wiggum — multi-persona review

## Blockers
none
