# OpenHuman workflow-handoff audit

Queue item: `openhuman-workflow-handoff`
Date: 2026-05-07
Repo path: `/Users/jwalinshah/projects/agent-stack/.agent-stack-worktrees/2026-05-07-overnight-marathon/openhuman-workflow-handoff`
Branch: `codex/goal-openhuman-workflow-handoff`
HEAD: `f11f217809841cf8e3a7f694d8e80967d8e188b8`

## Scope and non-goals

This is a read-only workflow handoff audit. The only intended write is this report at `docs/overnight/openhuman-workflow-handoff.md`.

Non-goals:

- No product code changes.
- No dependency installation, submodule initialization, generated artifacts, external service calls, deploys, pushes, or PR creation.
- No attempt to mark Linear, GitHub, or any external tracker as done.
- No attempt to run heavyweight app, Rust, Tauri, or E2E validation beyond the queue validation command.

## Repo purpose

OpenHuman is a desktop-first React plus Tauri v2 application with a Rust core. The README positions it as an open-source personal AI assistant with local knowledge, skills, messaging channels, screen intelligence, autocomplete, voice, and desktop integrations (`README.md`). The contributor docs define the repo as a monorepo with app UI in `app/`, Rust domain logic and JSON-RPC in root `src/`, Tauri host code in `app/src-tauri/`, test harnesses under `app/test/` and `tests/`, and operational docs under `docs/` (`AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/src/README.md`, `docs/src-tauri/README.md`).

## Current local state

- `git status --short --branch` reported only `## codex/goal-openhuman-workflow-handoff` before this report was created.
- `git status --short --ignored=matching` printed no tracked, untracked, or ignored entries before this report was created.
- `git rev-parse HEAD` returned `f11f217809841cf8e3a7f694d8e80967d8e188b8`.
- `git log --oneline -5` shows the current tip as `f11f2178` with subject `Sentinel: [CRITICAL] Fix shell injection vulnerability in browser screenshot tool (#20)`.
- Remotes are fork-oriented locally: `origin` and `jwalin-ssh` point at `jwalin-shah/openhuman`; `upstream` points at `tinyhumansai/openhuman`.
- `rg --files | wc -l` counted 2154 tracked paths.
- `rg --files app/test/e2e/specs | wc -l` counted 41 WDIO spec files.
- `rg --files app/src -g '*.test.ts' -g '*.test.tsx' | wc -l` counted 162 frontend test files.
- `rg --files src tests -g '*test*.rs' -g '*tests.rs' | wc -l` counted 151 Rust test files.
- `pnpm --version` is `10.10.0`; `node --version` is `v25.9.0`; `cargo --version` is `cargo 1.93.0`; `rustc --version` is `rustc 1.93.0`.
- `git submodule status --recursive` shows both Tauri vendor submodules uninitialized with leading `-`: `app/src-tauri/vendor/tauri-cef` and `app/src-tauri/vendor/tauri-plugin-notification`.
- `du -sh app/src-tauri/vendor app/node_modules node_modules target app/src-tauri/target` showed `app/src-tauri/vendor` is `0B`; `node_modules`, `app/node_modules`, `target`, and `app/src-tauri/target` are absent in this worktree.

## Command observations

Commands run for audit evidence:

- `llm-tldr tree .` was attempted first per repo instructions, but it produced no usable output during the initial exploration window and eventually returned a very large JSON tree after the report was drafted; the audit fell back to `rg --files` and targeted reads.
- `rg --files` listed the repo inventory and confirmed the large Rust, React, Tauri, docs, package, workflow, and test surface.
- `git status --short --branch`, `git status --short --ignored=matching`, `git rev-parse HEAD`, `git branch --show-current`, `git remote -v`, and `git log --oneline -5` established the local handoff state.
- `git submodule status --recursive` showed vendored Tauri submodules are not initialized in this isolated worktree.
- `test -f scripts/stage-core-sidecar.mjs` exited non-zero; the script referenced by several docs and `app/scripts/e2e-build.sh` is absent.
- `test -f .github/workflows/package-and-publish.yml` exited non-zero; `scripts/test-ci-local.sh` points at a workflow that is no longer present.
- `test -d skills` exited non-zero; the historical in-repo `skills/` directory is absent.
- `bash -n app/scripts/e2e-build.sh`, `bash -n app/scripts/e2e-run-spec.sh`, `bash -n scripts/worktree-bootstrap.sh`, `bash -n scripts/test-rust-with-mock.sh`, and `bash -n scripts/test-ci-local.sh` all passed syntax checks.

## Handoff map

### Source of truth and issue flow

- `docs/agent-workflows/codex-pr-checklist.md` is the strongest current remote-agent checklist. It requires preflight commands, one branch and one PR per issue, PR body evidence, validation commands, duplicate PR handling, and explicit blocked-command reporting.
- `.github/PULL_REQUEST_TEMPLATE.md` requires a summary, problem, solution, diff coverage, matrix updates, manual smoke updates where needed, and a closing issue reference.
- `.github/ISSUE_TEMPLATE/feature.md`, `.github/ISSUE_TEMPLATE/bug.md`, and `.github/ISSUE_TEMPLATE/task.md` all require acceptance criteria and the diff coverage gate for code changes.
- `scripts/work/README.md` and `scripts/work/start.sh` automate GitHub issue pickup, branch creation, and handoff to an agent CLI. They do not model the Linear-first workflow from global instructions and still create `issue/<num>-<slug>` branches by default unless `WORK_BRANCH_PREFIX` is set.
- `scripts/review/README.md` and sibling review scripts provide PR sync/review/merge helpers, but merge helpers are out of scope for overnight workers and should not be used by implementation agents without explicit human control.

### Validation and CI surfaces

- `package.json` delegates root app commands to `openhuman-app`: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test:coverage`, `pnpm test:rust`, and `pnpm debug`.
- `app/package.json` defines the concrete app scripts. Important commands are `compile`, `format:check`, `lint`, `test:coverage`, `test:rust`, `test:e2e:build`, `test:e2e:*`, `rust:check`, `rust:format:check`, and `rust:clippy`.
- `docs/TESTING-STRATEGY.md` defines the test layering: Rust unit, Rust integration, Vitest, WDIO E2E, and release manual smoke. It also requires at least one failure or edge assertion per feature leaf.
- `.github/workflows/typecheck.yml` runs TypeScript compile, Prettier, ESLint, Rust fmt, and core clippy in the `ghcr.io/tinyhumansai/openhuman_ci:rust-1.93.0` container.
- `.github/workflows/test.yml` runs frontend coverage, `cargo test -p openhuman`, and `cargo test --manifest-path app/src-tauri/Cargo.toml`; the Linux and macOS E2E jobs are currently commented out.
- `.github/workflows/coverage.yml` runs Vitest coverage, core `cargo llvm-cov`, Tauri `cargo llvm-cov`, then `diff-cover --fail-under=80` on merged lcov artifacts.
- `scripts/debug/README.md` documents agent-friendly wrappers that tee full logs to `target/debug-logs/` while keeping stdout compact.
- `scripts/test-rust-with-mock.sh` starts `scripts/mock-api-server.mjs`, exports `BACKEND_URL` and `VITE_BACKEND_URL`, then runs `cargo test --manifest-path Cargo.toml --workspace`.

### Core architecture and current drift

- `Cargo.toml` defines the root package `openhuman` and the primary binary as `openhuman-core` at `src/main.rs`. Several docs still say `cargo build --bin openhuman`.
- `app/package.json` says `core:stage` is now a no-op: `core is linked in-process; sidecar removed (PR #1061)`.
- `app/src-tauri/Cargo.toml` depends on `openhuman_core = { path = "../..", package = "openhuman", default-features = false }` and documents the in-process core design in comments.
- `app/src-tauri/src/core_process.rs` is the live lifecycle source: it starts the core HTTP/JSON-RPC server as a Tokio task inside the Tauri process, generates an RPC bearer token, rejects unknown listeners on the RPC port, and can terminate stale OpenHuman listeners.
- `app/src-tauri/src/core_rpc.rs` applies `Authorization: Bearer <token>` using the current in-memory token from `core_process`.
- `app/src-tauri/src/lib.rs` registers `core_rpc_url` and `core_rpc_token` Tauri commands directly in `generate_handler!`.
- `src/core/auth.rs` requires `Authorization: Bearer <token>` for `POST /rpc`; only read-only routes such as `/`, `/health`, `/schema`, `/events`, and auth callback routes are public.
- `app/src/services/coreRpcClient.ts` fetches both `core_rpc_url` and `core_rpc_token` in Tauri before direct HTTP JSON-RPC calls, so the frontend path is aligned with the auth middleware.
- `src/core/jsonrpc.rs` invokes registered controller handlers first, then falls back to legacy dynamic dispatch.
- `src/core/all.rs` is the central controller registry and documents that new domains must add both registered controllers and declared schemas.
- `src/rpc/dispatch.rs` now contains only the legacy `openhuman.security_policy_info` fallback, making it a small but still important parity check for controller migration work.

### Stale documentation and script references

- `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/src-tauri/README.md`, `docs/src-tauri/01-architecture.md`, `docs/src-tauri/03-services.md`, and `docs/BUILDING.md` still describe an `openhuman` sidecar or staged sidecar flow in places that conflict with `app/package.json`, `app/src-tauri/Cargo.toml`, and `app/src-tauri/src/core_process.rs`.
- `docs/src-tauri/01-architecture.md` references an `app/src-tauri/src/commands/` directory and `commands/core_relay.rs`, but `rg --files app/src-tauri/src` shows no `commands/` directory in the current tree.
- `app/scripts/e2e-build.sh` still runs `node "$REPO_ROOT/scripts/stage-core-sidecar.mjs"`, but that file is absent.
- `scripts/worktree-bootstrap.sh` still stages `app/src-tauri/binaries/openhuman-core-aarch64-apple-darwin`, runs `cargo build --bin openhuman-core`, and then runs `yarn core:stage`, even though package metadata uses pnpm and `core:stage` no longer stages a sidecar.
- `scripts/setup-dev-codesign.sh` still frames dev TCC stability around repeated `yarn core:stage` sidecar signing.
- `scripts/run-dev-win.sh` still calls `pnpm core:stage`; this is harmless if the no-op is intended, but the script comments should say so.
- `scripts/test-ci-local.sh` points at `.github/workflows/package-and-publish.yml`, uses a stale `vezuresdotxyz/openhuman-frontend-runner` event payload, runs `yarn`, and tries `(cd skills && yarn install && yarn build)` even though `skills/` is absent.
- `.github/workflows/build-windows.yml` is active on `workflow_dispatch` and `push` to `fix/windows`, but still configures `actions/setup-node` with `cache: yarn` and runs `yarn install --frozen-lockfile`; this repo only has `pnpm-lock.yaml`, `app/pnpm-lock.yaml`, and `remotion/pnpm-lock.yaml`.

## Risks and stale assumptions

1. Core lifecycle handoff is split between live in-process code and stale sidecar docs. An implementation agent following `docs/BUILDING.md`, `docs/src-tauri/README.md`, or old parts of `AGENTS.md` can waste time looking for a removed staging script, building the wrong binary name, or diagnosing nonexistent child-process behavior.

2. `app/scripts/e2e-build.sh` appears broken in the current tree because it calls missing `scripts/stage-core-sidecar.mjs`. Any next worker asked to run `pnpm test:e2e:build` should expect an early Node file-not-found failure before reaching Tauri unless this script is updated.

3. E2E JSON-RPC helper auth looks stale after the RPC bearer-token change. `src/core/auth.rs` protects `POST /rpc`, but `app/test/e2e/helpers/core-rpc-webview.ts` and `app/test/e2e/helpers/core-rpc-node.ts` send only `Content-Type` and never include `Authorization`. The production frontend path in `app/src/services/coreRpcClient.ts` does include the token, so E2E helpers may now be testing a transport that cannot authenticate.

4. Isolated worktrees do not have initialized Tauri vendor submodules. `git submodule status --recursive` showed leading `-` for `app/src-tauri/vendor/tauri-cef` and `app/src-tauri/vendor/tauri-plugin-notification`, and `app/src-tauri/vendor` is `0B`. Tauri compile/test/build commands should be reported as blocked until submodules are initialized.

5. JavaScript dependencies are absent locally. `node_modules` and `app/node_modules` do not exist, so TypeScript, Vitest, ESLint, Prettier, WDIO, and Tauri CLI commands should be expected to fail before `pnpm install`.

6. Package manager assumptions are inconsistent. The repo declares `pnpm@10.10.0` in `package.json`, but multiple active or semi-active workflow scripts still use `yarn`. This is a handoff hazard for Windows builds, local CI reproduction, and worktree bootstrap.

7. PR target guidance is ambiguous. `AGENTS.md` says open PRs against `tinyhumansai/openhuman` unless told otherwise; `docs/agent-workflows/codex-pr-checklist.md` says PRs should target `jwalin-shah/openhuman:main` unless upstream permissions allow `tinyhumansai/openhuman:main`. A worker can follow either in good faith and create a surprise handoff target.

8. The current CI test map is strong but expensive. The required gates include Prettier, ESLint, TypeScript, Rust fmt, core clippy, frontend coverage, core coverage, Tauri coverage, and diff-cover. A Linear or Work Pack issue that lacks a focused validation command is likely to stall on environment setup or over-run agent budgets.

9. Several release and local debug scripts rely on secrets or live credentials (`scripts/ci-secrets.example.json`, `scripts/debug-notion-live.sh`, release workflows, signing scripts). Overnight workers should keep those out of scope unless the issue explicitly authorizes external services and credentials.

## Next safe Work Pack candidates

### 1. Reconcile the post-PR #1061 core lifecycle handoff

Problem:

Docs and scripts still describe a staged child sidecar, while current code links the core into the Tauri host and runs it in-process.

Suggested ownership:

- Docs: `AGENTS.md`, `docs/BUILDING.md`, `docs/ARCHITECTURE.md`, `docs/src-tauri/README.md`, `docs/src-tauri/01-architecture.md`, `docs/src-tauri/03-services.md`, `docs/src/01-architecture.md`.
- Scripts: `app/scripts/e2e-build.sh`, `scripts/worktree-bootstrap.sh`, `scripts/setup-dev-codesign.sh`, `scripts/run-dev-win.sh`.

Acceptance criteria:

- Current docs consistently name the root binary as `openhuman-core` where the standalone core binary matters.
- Current docs explain that the desktop app embeds `openhuman_core` in-process and exposes local JSON-RPC over the same localhost route.
- Historical sidecar references are either removed, marked historical, or scoped only to standalone/manual harnesses.
- `app/scripts/e2e-build.sh` no longer calls absent `scripts/stage-core-sidecar.mjs`.
- `rg -n "stage-core-sidecar|cargo build --bin openhuman|core sidecar|openhuman sidecar" AGENTS.md docs app/scripts scripts` has only intentional historical or fallback references.

Validation candidates:

- `bash -n app/scripts/e2e-build.sh scripts/worktree-bootstrap.sh scripts/setup-dev-codesign.sh scripts/run-dev-win.sh` - expected pass after script edits.
- `pnpm --filter openhuman-app core:stage` - expected pass as a documented no-op.
- `test ! -f scripts/stage-core-sidecar.mjs` plus `! rg -n "scripts/stage-core-sidecar.mjs" AGENTS.md docs app scripts` - expected pass if the removed script is no longer referenced.
- `pnpm --filter openhuman-app format:check` - expected blocked until dependencies and submodules are installed in this worktree.

### 2. Repair authenticated E2E core RPC helpers

Problem:

The core now requires an RPC bearer token on `POST /rpc`, but E2E helper calls do not attach one.

Suggested ownership:

- `app/test/e2e/helpers/core-rpc-webview.ts`
- `app/test/e2e/helpers/core-rpc-node.ts`
- `app/test/e2e/helpers/core-rpc.ts`
- `app/test/e2e/specs/linux-cef-deb-runtime.spec.ts`
- Any focused tests under `app/src/services/__tests__/coreRpcClient.test.ts` if helper behavior can be unit-tested.

Acceptance criteria:

- Linux WebView helper obtains `core_rpc_token` through Tauri invoke and sends `Authorization: Bearer <token>`.
- Mac2/Node helper has a documented, deterministic auth path. If Node cannot invoke Tauri commands, the E2E launch script should expose an explicit test token path or the helper should avoid direct `/rpc` calls on Mac2.
- A missing token fails with an actionable error instead of a silent 60-second port probe.
- At least one E2E spec that calls `callOpenhumanRpc` proves an authenticated RPC succeeds against the live app.

Validation candidates:

- `pnpm --dir app exec vitest run src/services/__tests__/coreRpcClient.test.ts --config test/vitest.config.ts` - expected blocked until `pnpm install`.
- `pnpm debug e2e test/e2e/specs/linux-cef-deb-runtime.spec.ts linux-cef-deb-runtime` - expected blocked until dependencies, submodules, Tauri driver, and E2E build artifacts exist.
- `pnpm test:e2e:build` - expected currently fail because `app/scripts/e2e-build.sh` calls missing `scripts/stage-core-sidecar.mjs`; should pass after Work Pack 1 and environment setup.

### 3. Modernize isolated worktree bootstrap for pnpm and in-process core

Problem:

`scripts/worktree-bootstrap.sh` is supposed to make new worktrees usable, but it uses `yarn`, stages a removed sidecar binary, and assumes old Tauri resources.

Suggested ownership:

- `scripts/worktree-bootstrap.sh`
- `scripts/work/README.md`
- Possibly `docs/agent-workflows/codex-pr-checklist.md` if bootstrap expectations belong in remote-agent preflight.

Acceptance criteria:

- Bootstrap uses pnpm consistently with `package.json`.
- Bootstrap initializes the two vendor submodules and reports if network/submodule auth blocks it.
- Bootstrap no longer builds or stages `app/src-tauri/binaries/openhuman-core-*`.
- Bootstrap records whether `node_modules`, `app/node_modules`, `target`, and `app/src-tauri/target` are intentionally absent or created.
- README or checklist tells agents what to do when a worktree is missing submodules or dependencies.

Validation candidates:

- `bash -n scripts/worktree-bootstrap.sh` - observed passing now and should remain passing.
- `git submodule status --recursive` - expected leading spaces, not leading `-`, after bootstrap in a network-enabled environment.
- `pnpm install --frozen-lockfile` - expected blocked here because dependency installation and network are out of scope, but should be the documented dependency command.
- `pnpm --filter openhuman-app tauri:ensure` - expected blocked until submodules and dependencies are installed.

### 4. Replace stale local CI/package reproduction script

Problem:

`scripts/test-ci-local.sh` references a missing workflow, stale repo slug, `yarn`, and an absent `skills/` directory.

Suggested ownership:

- `scripts/test-ci-local.sh`
- `scripts/ci-event.json`
- `scripts/ci-secrets.example.json`
- `.github/workflows/*` references in docs if the script is documented elsewhere.

Acceptance criteria:

- The script targets an existing workflow, or it is deleted/renamed as historical if no longer supported.
- The event payload names `tinyhumansai/openhuman` or the intended fork, not `vezuresdotxyz/openhuman-frontend-runner`.
- The script uses pnpm and does not assume an in-repo `skills/` directory.
- The script's dry-run/list mode works without secrets.

Validation candidates:

- `bash -n scripts/test-ci-local.sh` - observed passing now and should remain passing.
- `scripts/test-ci-local.sh --list` - expected currently fail because `.github/workflows/package-and-publish.yml` is absent; should pass after target workflow is corrected.
- `rg -n "package-and-publish|openhuman-frontend-runner|cd skills|yarn install" scripts/test-ci-local.sh scripts/ci-event.json` - expected no stale hits after cleanup.

### 5. Clarify PR target and tracker handoff contract

Problem:

Remote agent instructions disagree on whether PRs target upstream `tinyhumansai/openhuman` or fork `jwalin-shah/openhuman`, and GitHub issue automation exists alongside the global Linear-first policy.

Suggested ownership:

- `AGENTS.md`
- `docs/agent-workflows/codex-pr-checklist.md`
- `scripts/work/README.md`
- `.github/PULL_REQUEST_TEMPLATE.md` if additional handoff evidence belongs there.

Acceptance criteria:

- One doc states the canonical PR target decision tree for local, fork, and upstream-permission cases.
- One doc states when to use Linear versus GitHub issues for implementation work.
- Worker final handoff requirements are explicit: changed files, commit SHA, validation commands, PR URL if opened, blockers, and external tracker update status.
- `scripts/work/start.sh` branch naming is either aligned with the issue contract or documented as GitHub-issue-only tooling.

Validation candidates:

- `rg -n "tinyhumansai/openhuman|jwalin-shah/openhuman|WORK_BRANCH_PREFIX|Linear|GitHub issue" AGENTS.md docs/agent-workflows/codex-pr-checklist.md scripts/work/README.md scripts/work/start.sh` - expected to show a coherent, non-conflicting story after edits.
- `pnpm --filter openhuman-app format:check` - expected blocked until dependencies and submodules are installed; docs-only markdown formatting still goes through Prettier in app workspace.

## Exact validation command candidates

Queue item validation:

- `git status --short` - expected to pass locally. After this report, expected output is `?? docs/overnight/` or `?? docs/overnight/openhuman-workflow-handoff.md` depending on Git's directory display until the report is committed.

Fast read-only proof commands for future handoff audits:

- `git status --short --branch` - expected pass.
- `git submodule status --recursive` - expected pass but may reveal missing submodules with leading `-`.
- `rg --files | wc -l` - expected pass.
- `bash -n app/scripts/e2e-build.sh app/scripts/e2e-run-spec.sh scripts/worktree-bootstrap.sh scripts/test-rust-with-mock.sh scripts/test-ci-local.sh` - each script was checked individually and passed syntax.

Focused validation after dependency and submodule setup:

- `pnpm --filter openhuman-app compile` - expected pass on TypeScript-only changes if dependencies are installed.
- `pnpm --filter openhuman-app lint` - expected pass on app TS/React changes if dependencies are installed.
- `pnpm --filter openhuman-app format:check` - expected pass after formatting and Rust fmt; blocked here until dependencies/submodules exist.
- `cargo fmt --manifest-path Cargo.toml --all --check` - expected pass for root Rust changes.
- `cargo check --manifest-path Cargo.toml` - expected pass for root Rust changes if Rust deps are cached/resolvable.
- `cargo check --manifest-path app/src-tauri/Cargo.toml` - expected blocked here until `app/src-tauri/vendor/*` submodules are initialized.
- `pnpm debug rust <test-filter>` - expected pass for focused Rust behavior once Node deps and mock server runtime are available.
- `pnpm test:e2e:build` - expected fail in the current tree due to missing `scripts/stage-core-sidecar.mjs`; after fixing that and installing deps/submodules, expected to build a debug app for E2E.
- `bash app/scripts/e2e-run-spec.sh test/e2e/specs/<spec>.spec.ts <id>` - expected blocked until the E2E build artifact, driver, deps, and auth helper path are corrected.

## Unknowns

- Whether the CI container initializes vendor submodules in every workflow path. The local worktree currently does not.
- Whether PR #1061 intentionally left compatibility no-ops and old sidecar wording in some docs for standalone harnesses, or whether the drift is accidental.
- Whether Mac2 E2E has a supported way to obtain the in-memory Tauri RPC token from the Node/WebdriverIO process. Current helper code does not show one.
- Whether `build-windows.yml` is still intended to be active on `workflow_dispatch` despite using Yarn.
- Whether `scripts/test-ci-local.sh` should be repaired or deleted as obsolete local release tooling.
- Whether Linear has replaced GitHub issue pickup for this repo in practice; local `scripts/work` still assumes GitHub issues.

## Morning handoff

Changed file:

- `docs/overnight/openhuman-workflow-handoff.md`

No product code, generated data, secrets, external services, deploys, pushes, or PRs were touched.
