# Whole-Portfolio Implementation-Readiness Review: openhuman-sym206-recovery

Date: 2026-05-07
Queue item: `openhuman-sym206-recovery-implementation-readiness`
Branch: `codex/goal-openhuman-sym206-recovery-implementation-readiness`
Reviewed HEAD: `f11f2178`

## Scope

Read-only implementation-readiness pass for the OpenHuman repo. This report uses repo-local evidence only: docs, scripts, test layout, CI workflow files, package metadata, current source/test files, and current git state. No product code was edited. No external services, pushes, PRs, or tracker updates were performed.

Repo-local prior overnight outputs were not present. `fd -H -t f 'overnight|handoff|result\.json|CODEX_WORKPAD|ISSUE\.md' .` only found `src/openhuman/agent/harness/subagent_runner/handoff.rs`, which is source code, not a previous overnight run artifact.

## Concrete Observations

1. Root `package.json:8-32` provides the main command surface and delegates build/typecheck/lint/test tasks to `openhuman-app`; root validation can use `pnpm typecheck`, `pnpm lint`, `pnpm test:coverage`, `pnpm test:rust`, and `pnpm debug`.
2. `app/package.json:5-6` requires Node `>=24.0.0`, so implementation agents need a Node 24 environment before running app tests.
3. `app/package.json:14` says `core:stage` is now a no-op because the core is linked in-process after PR #1061, while `app/src-tauri/Cargo.toml:109-115` confirms the Tauri shell links `openhuman_core` by path.
4. `Cargo.toml:8-10` defines the root binary as `openhuman-core`, not `openhuman`; however `docs/ARCHITECTURE.md:14-19` still describes an `openhuman` sidecar process and `docs/ARCHITECTURE.md:15` still says `cargo build --bin openhuman`.
5. `app/src-tauri/Cargo.toml:30-35` and `app/src-tauri/Cargo.toml:100-107` make CEF the default runtime and reference vendored CEF crates by path. This means Tauri shell checks/builds require initialized submodules.
6. `.gitmodules:1-7` declares `app/src-tauri/vendor/tauri-cef` and `app/src-tauri/vendor/tauri-plugin-notification`, but `git submodule status` currently shows both with a leading `-`, and both vendor directories are empty in this worktree. Any Tauri shell validation is blocked until submodules are initialized.
7. `.github/workflows/test.yml:23-131` runs frontend coverage, Rust core tests, and Rust Tauri shell tests on PRs; `.github/workflows/test.yml:133-190` shows the Linux E2E job exists only as commented-out YAML, so PR CI does not currently exercise WDIO flows automatically.
8. `.github/workflows/coverage.yml:21-138` runs separate frontend, Rust core, and Rust Tauri coverage jobs, and `.github/workflows/coverage.yml:136-175` enforces diff-cover on changed lines for PRs.
9. `.github/workflows/pr-quality.yml:13-21`, `.github/workflows/pr-quality.yml:32-49` mark checklist, coverage-matrix, and markdown-link checks as `continue-on-error: true`, so these are useful advisory checks but not hard implementation gates.
10. `docs/TESTING-STRATEGY.md:39-56` requires at least one failure/edge assertion and no real network in unit/integration/E2E; follow-up work should use the shared mock backend and focused test layers.
11. `docs/TESTING-STRATEGY.md:91-117` lists local pre-merge commands, including Rust fmt/check/clippy/test, Tauri check, app typecheck/lint/format/unit tests, mock-backed Rust integration, and focused E2E when behavior is user-visible.
12. The repo has substantial existing coverage surface: 358 test/spec files found by local file scan, including 162 app unit tests, 148 Rust test files, and 41 WDIO specs under `app/test/e2e/specs`.
13. `docs/TEST-COVERAGE-MATRIX.md:24` says the coverage matrix must be updated with feature changes, but `.github/workflows/pr-quality.yml:32-45` currently enforces that only as a soft check.
14. `docs/TEST-COVERAGE-MATRIX.md:427-451` still lists multiple Settings and Developer Options WDIO gaps, and `docs/TEST-COVERAGE-MATRIX.md:459-466` summarizes 27 missing and 27 partial leaves.
15. `src/openhuman/tools/impl/agent/spawn_subagent.rs:140-142` advertises `dedicated_thread`; `src/openhuman/tools/impl/agent/spawn_subagent.rs:434-468` persists a worker thread and returns a `[worker_thread_ref]` envelope when enabled.
16. `src/openhuman/agent/harness/session/tests.rs:380-420` has the high-level `Agent::turn -> spawn_subagent -> run_subagent -> parent history` test, but the tool-call arguments in `src/openhuman/agent/harness/session/tests.rs:413-416` do not cover `dedicated_thread: true`.
17. `app/src/pages/conversations/components/ToolTimelineBlock.tsx:100-149` parses a worker-thread envelope and renders `WorkerThreadRefCard`.
18. `app/src/pages/conversations/components/WorkerThreadRefCard.tsx:1-3` imports `setActiveThread`, and `app/src/pages/conversations/components/WorkerThreadRefCard.tsx:23-27` dispatches it on click. But `app/src/store/threadSlice.ts:261-272` shows `setSelectedThread` changes visible messages, while `setActiveThread` only tracks an in-flight send target.
19. `app/src/pages/Conversations.tsx:818-837` renders timeline, inference status, and streaming assistant state from `selectedThreadId`, not `activeThreadId`; this makes the worker-thread card click path a likely implementation bug.
20. `app/src/pages/conversations/components/__tests__/ToolTimelineBlock.test.tsx:17-115` verifies subagent activity rendering, but it does not assert worker-thread envelope rendering or card click navigation.
21. `scripts/debug/README.md:1-7` documents bounded-output debug wrappers, and `scripts/debug/README.md:11-30` gives focused `pnpm debug unit`, `pnpm debug rust`, and single-spec WDIO commands suitable for implementation agents.

## Risks And Blockers

- Tauri shell validation is currently blocked locally because required vendored submodules are not initialized. This affects `cargo check --manifest-path app/src-tauri/Cargo.toml`, Tauri coverage, and E2E builds.
- The architecture docs contain sidecar-era claims that conflict with current metadata and Tauri manifest behavior. This can mislead implementation agents into using obsolete `core:stage` or `cargo build --bin openhuman` paths.
- PR CI has no active WDIO job despite many user-visible flows relying on WDIO coverage. User-visible changes need focused local E2E or an explicit blocker note.
- PR quality checks for checklist/matrix/markdown links are soft. Implementation agents must treat the matrix update and checklist as required even when CI would not block.
- The worker-thread UI card likely dispatches the wrong Redux action. This is narrow and implementation-ready because `selectedThreadId` is the render source and `activeThreadId` is the in-flight guard.

## Implementation-Ready Follow-Up Tasks

### 1. Fix worker-thread card navigation

Owned files:
- `app/src/pages/conversations/components/WorkerThreadRefCard.tsx`
- `app/src/pages/conversations/components/__tests__/ToolTimelineBlock.test.tsx` or a new adjacent `WorkerThreadRefCard.test.tsx`

Acceptance criteria:
- Clicking "Open worker thread" updates `thread.selectedThreadId` to the worker thread id.
- The click path no longer mutates `activeThreadId` as a navigation mechanism.
- A Vitest assertion proves the card rendered from a `[worker_thread_ref]` envelope opens the worker thread.

Smallest useful validation:
```bash
pnpm debug unit src/pages/conversations/components -t "worker thread"
```

### 2. Add Rust full-path coverage for `dedicated_thread: true`

Owned files:
- `src/openhuman/agent/harness/session/tests.rs`
- `src/openhuman/tools/impl/agent/spawn_subagent.rs` only if behavior needs adjustment

Acceptance criteria:
- A high-level `Agent::turn` test emits `spawn_subagent` with `"dedicated_thread": true`.
- The parent history receives a `[worker_thread_ref]` envelope instead of the raw child output.
- The workspace conversation store contains a `worker-*` thread labeled `worker` with the delegated prompt and child answer messages.

Smallest useful validation:
```bash
pnpm debug rust turn_dispatches_spawn_subagent_to_dedicated_worker_thread
```

### 3. Lock worker-thread envelope rendering and click behavior in the app

Owned files:
- `app/src/pages/conversations/components/ToolTimelineBlock.tsx`
- `app/src/pages/conversations/components/__tests__/ToolTimelineBlock.test.tsx`
- `app/src/pages/conversations/utils/workerThreadRef.test.ts`

Acceptance criteria:
- `ToolTimelineBlock` renders `workerRef.before`, `WorkerThreadRefCard`, and optional `workerRef.after` for a successful envelope.
- The test fixture includes the JSON shape emitted by `spawn_subagent.rs`.
- Invalid or malformed envelopes remain ignored without crashing.

Smallest useful validation:
```bash
pnpm debug unit src/pages/conversations/components/__tests__/ToolTimelineBlock.test.tsx
```

### 4. Reconcile sidecar-era docs with current in-process core behavior

Owned files:
- `docs/ARCHITECTURE.md`
- `docs/src-tauri/README.md`
- `docs/src/README.md`
- `docs/agent-workflows/codex-pr-checklist.md`
- `AGENTS.md` if repository-level agent commands still mention sidecar staging

Acceptance criteria:
- Docs use `openhuman-core` where the root binary is meant.
- Docs state that Tauri links `openhuman_core` in-process and that `app/package.json` `core:stage` is a no-op.
- Any remaining sidecar references are explicitly scoped to the `openhuman-core run` harness or compatibility probe.
- No docs instruct agents to stage a removed sidecar before normal app validation.

Smallest useful validation:
```bash
pnpm --filter openhuman-app format:check
```

### 5. Add a local validation preflight for vendored Tauri submodules

Owned files:
- `scripts/debug/README.md`
- `scripts/debug/cli.sh` or a new `scripts/debug/preflight.sh`
- `docs/agent-workflows/codex-pr-checklist.md`

Acceptance criteria:
- A focused preflight command reports whether `app/src-tauri/vendor/tauri-cef/crates/tauri-runtime-cef` and `app/src-tauri/vendor/tauri-plugin-notification/Cargo.toml` exist.
- The preflight tells agents exactly when to run `git submodule update --init --recursive`.
- Tauri shell validation blockers are captured before an agent spends time on failing `cargo check` output.

Smallest useful validation:
```bash
pnpm debug preflight
```

## Recommended Validation Matrix For Future Implementation PRs

Use the smallest command that proves the slice, then add broader gates based on touched files:

```bash
# App-only worker-thread UI
pnpm debug unit src/pages/conversations/components -t "worker thread"
pnpm typecheck

# Rust worker-thread behavior
pnpm debug rust turn_dispatches_spawn_subagent_to_dedicated_worker_thread
cargo fmt --manifest-path Cargo.toml --all --check

# Docs-only sidecar cleanup
pnpm --filter openhuman-app format:check

# Tauri shell or E2E work, only after submodules are initialized
git submodule status
cargo check --manifest-path app/src-tauri/Cargo.toml
pnpm test:e2e:build
bash app/scripts/e2e-run-spec.sh test/e2e/specs/agent-review.spec.ts agent-review
```

## Handoff

- Changed files: `docs/overnight/2026-05-07-whole-portfolio-review/openhuman-sym206-recovery-implementation-readiness.md`
- Product code changed: none
- Commit SHA: not created locally; `git add`/`git commit` is blocked in this sandbox because the worktree Git metadata lives outside the writable roots (`.git/worktrees/.../index.lock`: `Operation not permitted`)
- PR URL: none; external pushes/PR creation were out of scope
- Local blocker: Tauri vendor submodules are uninitialized in this worktree, so Tauri shell/E2E validation should start with `git submodule update --init --recursive`
- Required queue validation to run after writing: `git status --short`
