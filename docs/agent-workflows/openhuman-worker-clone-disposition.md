# OpenHuman Worker Clone Disposition

Generated for `SYM-266` on 2026-05-09.

This is a read-only inventory. No worktrees were deleted, no branches were reset,
and no PRs were closed.

## Validation Commands

```bash
git worktree list
gh -R tinyhumansai/openhuman pr list --state open --limit 50
gh -R tinyhumansai/openhuman pr list --state all --author jwalin-shah --limit 100
```

GitHub lookup succeeded for `tinyhumansai/openhuman`. Local clone evidence came
from `/Users/jwalinshah/projects/openhuman-sym*` paths.

## Launch Gate

Do not launch more OpenHuman implementation workers until the active review queue
is below the repo cap and the open `SYM-209` PR has an explicit disposition.

Current upstream open queue at review time:

- `#1375` draft, `feat/mascot-emotional-reactions`, external owner.
- `#1333` draft, `feat/interactive-tour-gates`, external owner.
- `#1321` open, `codex/SYM-209-core-state-rewards-timeout`, changes requested.

The queue is at the cap of three open upstream PRs, and the only active Jwalin
worker PR has requested changes.

## Clone Disposition Table

| Path | Issue | Branch | Upstream state | PR status | Evidence files | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| `/Users/jwalinshah/projects/openhuman-sym206-recovery` | `SYM-206` | `codex/SYM-206-vitest-mock-port-collision` | tracks `origin/codex/SYM-206-vitest-mock-port-collision`, clean | upstream `#1271` merged | `ISSUE.md` missing; `CODEX_WORKPAD.md` missing | Archive candidate after human confirms no local-only handoff is needed. |
| `/Users/jwalinshah/projects/openhuman-sym208-recovery` | `SYM-208` | `codex/SYM-208-pr-checklist-preflight` | tracks `origin/codex/SYM-208-pr-checklist-preflight`, clean | upstream `#1270` merged | `ISSUE.md` missing; `CODEX_WORKPAD.md` missing | Archive candidate after human confirms no local-only handoff is needed. |
| `/Users/jwalinshah/projects/openhuman-sym209-worker` | `SYM-209` | `codex/SYM-209-core-state-rewards-timeout` | tracks `origin/codex/SYM-209-core-state-rewards-timeout`, clean | upstream `#1321` open, mergeable, changes requested | `ISSUE.md` missing; `CODEX_WORKPAD.md` missing | Keep for review follow-up. Do not launch another worker on this area until requested changes are reconciled. |
| `/Users/jwalinshah/projects/openhuman-sym210-worker` | `SYM-210` | `codex/SYM-210-context-ready-nonblocking` | tracks `origin/codex/SYM-210-context-ready-nonblocking`, clean | upstream `#1322` merged | `ISSUE.md` missing; `CODEX_WORKPAD.md` missing | Archive candidate after human confirms no local-only handoff is needed. |
| `/Users/jwalinshah/projects/openhuman-sym211-worker` | `SYM-211` | `codex/SYM-211-twitter-oauth-actionable-errors` | tracks `upstream/main`, clean, ahead 1 and behind 52 | upstream `#1318` merged and approved | `ISSUE.md` missing; `CODEX_WORKPAD.md` missing | Human review before archive because the local branch tracks `upstream/main` instead of its origin branch and is heavily behind current upstream. |
| `/Users/jwalinshah/projects/openhuman-sym212-recovery` | `SYM-212` | `codex/SYM-212-thread-rpc-query-hooks` | tracks `origin/codex/SYM-212-thread-rpc-query-hooks`, clean | upstream `#1272` merged and approved | `ISSUE.md` missing; `CODEX_WORKPAD.md` missing | Archive candidate after human confirms no local-only handoff is needed. |
| `/Users/jwalinshah/projects/openhuman-sym231` | `SYM-231` | `codex/SYM-231-security-policy-registry` | tracks `origin/codex/SYM-231-security-policy-registry`, clean | upstream `#1311` merged | `ISSUE.md` missing; `CODEX_WORKPAD.md` missing | Archive candidate after human confirms no local-only handoff is needed. |
| `/Users/jwalinshah/projects/openhuman-sym85` | `SYM-85` | `codex/linear-mention-sym-85-extract-chat-composer-behavior-from` | tracks `origin/codex/linear-mention-sym-85-extract-chat-composer-behavior-from`, clean | upstream `#1239` merged with changes requested recorded; fork `#24` closed and conflicting | `ISSUE.md` missing; `CODEX_WORKPAD.md` missing | Human review before archive because duplicate fork PR history is closed/conflicting even though upstream merged. |
| `/Users/jwalinshah/projects/openhuman-sym95-worker` | `SYM-95` | `codex/SYM-95-duplicate-pr-cleanup-guidance` | tracks `origin/codex/SYM-95-duplicate-pr-cleanup-guidance`, clean | upstream `#1323` merged | `ISSUE.md` missing; `CODEX_WORKPAD.md` missing | Archive candidate after human confirms no local-only handoff is needed. |
| `/Users/jwalinshah/projects/openhuman-sym-266-disposition` | `SYM-266` | `codex/SYM-266-worker-clone-disposition` | tracks `upstream/main`, clean at creation | no PR at inventory time | local issue/workpad only | Keep until this disposition PR is merged or explicitly accepted. |

## Follow-Up Work

- Resolve upstream PR `#1321` for `SYM-209` before new implementation workers
  touch core-state rewards timeout behavior.
- Create one cleanup-only issue for the merged clean clones once a human approves
  archive/removal candidates.
- Add `ISSUE.md` or `CODEX_WORKPAD.md` handoff files to future worker clones at
  launch time, or record equivalent Linear evidence before the worker starts.
- Do not delete any `openhuman-sym*` clone from this document alone. Treat this
  as inventory, not cleanup authorization.
