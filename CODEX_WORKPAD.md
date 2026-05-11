# MAX-40 Workpad

Issue: https://linear.app/symphony-test-jwalin/issue/MAX-40/openhuman-repair-today-feed-keyboard-focus-regression-on-pr-4

Repo: `/Users/jwalinshah/projects/openhuman`
Worktree: `/Users/jwalinshah/projects/openhuman-MAX-40-today-focus-regression`
Branch: `codex/MAX-40-today-focus-regression`
Base ref: `origin/pr/4` (`41e881520fc02162c4747afd3e842b28e871e6ba`)
Target PR branch: `claude/integrate-messaging-calendar-demo-CyH4G`

## Plan

- Keep scope to the Today keyboard focus regression surfaced by PR #4 CI.
- Avoid Today data model, provider, RPC/schema, ranking, privacy, and merge-conflict changes.
- Validate the targeted Today suite first, then the full frontend coverage command if practical.

## Evidence

- CI failure was in `src/pages/__tests__/Today.test.tsx`: the Escape-clears-focus test asserted the focused row class immediately after a native `document` keydown.
- Local pre-change targeted validation passed: `yarn workspace openhuman-app test src/pages/__tests__/Today.test.tsx`.
- Local pre-change full frontend validation passed: `yarn workspace openhuman-app test:coverage`.

## Change

- Made the failing test wait for the focus ring to appear after `j` and disappear after `Escape`, matching the component's state transition instead of asserting synchronously.

## Validation

- Passed: `yarn workspace openhuman-app test src/pages/__tests__/Today.test.tsx`
  - 1 file passed, 28 tests passed.
- Passed: `yarn workspace openhuman-app test:coverage`
  - 91 files passed, 2 skipped; 738 tests passed, 2 skipped.
