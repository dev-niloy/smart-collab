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

## Phase Completion
- [x] Phase 1 GStack — goal.md + state.yaml + progress.md written; baseline
      recorded (BE 598, FE 462); intake locked; Scout map of consumer-side
      plumbing + writer-side gap captured above
- [ ] Phase 2 GSD — Judge picks first Worker slice (likely BE-first: enum
      + parser + recipient logic + tests), then FE composer + renderer
- [ ] Phase 3 Superpowers — execute slices TDD
- [ ] Phase 4 Ralph Wiggum — multi-persona review

## Blockers
none
