# Overnight validation-map audit: openhuman-sym208-recovery

Queue item: `openhuman-sym208-recovery-validation-map`
Focus area: `validation-map`
Repo path: `/Users/jwalinshah/projects/agent-stack/.agent-stack-worktrees/2026-05-07-overnight-marathon/openhuman-sym208-recovery-validation-map`
Branch: `codex/goal-openhuman-sym208-recovery-validation-map`
HEAD observed: `f11f2178` (`Sentinel: [CRITICAL] Fix shell injection vulnerability in browser screenshot tool (#20)`)

## Purpose and current state

OpenHuman is a combined desktop application and Rust core repository. The root
crate (`Cargo.toml`) is the `openhuman` Rust package with the `openhuman_core`
library and binaries including `openhuman-core`; the `app/` pnpm workspace is a
Vite/React application plus a Tauri v2 shell at `app/src-tauri/`.

Initial state was clean:

- `git status --short --branch` returned only `## codex/goal-openhuman-sym208-recovery-validation-map`.
- `git remote -v` showed `origin` and `jwalin-ssh` pointing to `jwalin-shah/openhuman`, and `upstream` pointing to `tinyhumansai/openhuman`.
- `llm-tldr tree .` confirmed the main validation surfaces: root Rust (`src/`, `tests/`, `Cargo.toml`), app workspace (`app/package.json`, `app/test/`, `app/src-tauri/`), shell scripts under `scripts/`, and CI under `.github/workflows/`.

No product code was changed. This report is the only intended file addition.

## Local validation prerequisites observed

- `node --version` returned `v25.9.0`; `app/package.json` requires `node >=24.0.0`, so the Node major version satisfies the app engine constraint.
- `pnpm --version` returned `10.10.0`, matching root `package.json`'s pinned pnpm 10.10.0 package manager.
- `cargo --version` returned `cargo 1.93.0`; `rustc --version` returned `rustc 1.93.0`; `rust-toolchain.toml` pins `channel = "1.93.0"` with `rustfmt` and `clippy`.
- `test -d node_modules` and `test -d app/node_modules` both returned false (`root_node_modules=1`, `app_node_modules=1`), so pnpm-based validations are not runnable in this worktree without an install.
- `git submodule status --recursive` returned leading `-` entries for `app/src-tauri/vendor/tauri-cef` and `app/src-tauri/vendor/tauri-plugin-notification`, meaning required Tauri vendor submodules are not initialized here.
- `env | rg '^(CARGO|RUST|SCCACHE|RUSTC)_'` showed `CARGO_TARGET_DIR=/Users/jwalinshah/.cargo-target-shared`, `RUSTC_WRAPPER=sccache`, and `SCCACHE_DIR=/Users/jwalinshah/.cache/sccache`. In this sandbox, `cargo check` cannot open `/Users/jwalinshah/.cargo-target-shared/debug/.cargo-lock`.
- `pnpm test:rust -- --test json_rpc_e2e` could not start the shared mock backend because local TCP listen was denied: `/tmp/openhuman-mock-api.log` showed `listen EPERM: operation not permitted 127.0.0.1:18505`.

## Validation surfaces found

### Root package scripts

`package.json` delegates nearly all app validations to the `openhuman-app`
workspace:

- `pnpm build` -> `pnpm --filter openhuman-app build`
- `pnpm typecheck` -> `pnpm --filter openhuman-app compile`
- `pnpm lint` -> `pnpm --filter openhuman-app lint`
- `pnpm format:check` -> `pnpm --filter openhuman-app format:check`
- `pnpm test` -> `pnpm --filter openhuman-app test`
- `pnpm test:coverage` -> `pnpm --filter openhuman-app test:coverage`
- `pnpm test:rust` -> `pnpm --filter openhuman-app test:rust`
- `pnpm debug ...` -> `scripts/debug/cli.sh`

This means a root-level validation plan can be short, but it still depends on
the app workspace's installed dev dependencies.

### App workspace scripts

`app/package.json` is the practical validation command catalog:

- `compile`: `tsc --noEmit`
- `build`: `tsc && vite build`
- `test` / `test:unit`: `vitest run --config test/vitest.config.ts`
- `test:coverage`: `vitest run --config test/vitest.config.ts --coverage`
- `lint`: `eslint . --ext .ts,.tsx --cache`
- `format:check`: `prettier --check . && pnpm rust:format:check`
- `rust:format:check`: root and Tauri `cargo fmt --check`
- `rust:check`: `cargo check --manifest-path src-tauri/Cargo.toml`
- `test:rust`: `bash ../scripts/test-rust-with-mock.sh`
- `test:e2e:build`: `bash ./scripts/e2e-build.sh`
- `test:e2e:all:flows`: `bash ./scripts/e2e-run-all-flows.sh`

One important migration clue: `core:stage` is now a no-op and prints
`[core:stage] no-op - core is linked in-process; sidecar removed (PR #1061)`.

### Rust manifests

`Cargo.toml` defines package `openhuman` version `0.53.16`, library
`openhuman_core`, and binaries:

- `openhuman-core` at `src/main.rs`
- `slack-backfill` at `src/bin/slack_backfill.rs`
- `gmail-backfill-3d` at `src/bin/gmail_backfill_3d.rs`

`app/src-tauri/Cargo.toml` defines the Tauri package `OpenHuman` and links the
core in process via `openhuman_core = { path = "../..", package = "openhuman",
default-features = false }`. It also depends on vendored paths under
`app/src-tauri/vendor/tauri-cef` and `app/src-tauri/vendor/tauri-plugin-notification`.

`cargo metadata --manifest-path Cargo.toml --no-deps --locked --format-version 1`
and `cargo metadata --manifest-path app/src-tauri/Cargo.toml --no-deps --locked
--format-version 1` both completed, so manifest shape can be inspected without
compilation. Compilation itself is blocked in this sandbox by the shared target
dir permission and, for Tauri, by uninitialized vendor submodules.

### Vitest

`app/test/vitest.config.ts` sets:

- root: `app/`
- environment: `jsdom`
- setup file: `app/src/test/setup.ts`
- includes: `src/**/*.test.{ts,tsx}` and `test/*.test.{ts,tsx}`
- `maxWorkers = 1` and `minWorkers = 1`
- coverage provider: `v8`
- coverage reporters: `text`, `text-summary`, `html`, `lcov`

A file count command observed 171 TypeScript test files under `app/src` and
`app/test`. `pnpm --filter openhuman-app exec vitest --version` failed because
`vitest` is not installed in this worktree (`Command "vitest" not found`).

### Rust tests

Root `tests/` contains 16 integration-style Rust test files, including
`tests/json_rpc_e2e.rs`, `tests/memory_roundtrip_e2e.rs`,
`tests/screen_intelligence_vision_e2e.rs`, and `tests/webview_apis_bridge.rs`.

`scripts/test-rust-with-mock.sh` starts `scripts/mock-api-server.mjs`, waits for
`GET /__admin/health`, exports `BACKEND_URL` and `VITE_BACKEND_URL`, then runs:

```bash
cargo test --manifest-path Cargo.toml --workspace "$@"
```

In this sandbox the wrapper fails before cargo because listening on
`127.0.0.1:18505` is not permitted.

### Agent-friendly debug wrappers

`scripts/debug/README.md` documents compact wrappers:

- `pnpm debug unit [pattern] [-t name]`
- `pnpm debug rust [test-filter]`
- `pnpm debug e2e <spec> [suffix]`
- `pnpm debug logs ...`

The wrappers tee full output into `target/debug-logs/` and print bounded
summaries. `scripts/debug/rust.sh` delegates to `scripts/test-rust-with-mock.sh`;
`scripts/debug/unit.sh` directly invokes `pnpm exec vitest`; `scripts/debug/e2e.sh`
delegates to `app/scripts/e2e-run-spec.sh`.

These are the right iteration commands for agents once dependencies and local
network permissions exist.

### WDIO E2E

`app/test/wdio.conf.ts` discovers `app/test/e2e/specs/**/*.spec.ts`, runs
single-instance WDIO, and selects Linux `tauri-driver` on port 4444 or macOS
Appium Mac2 on port 4723. It captures screenshots and page source on test
failure through `captureFailureArtifacts`.

`app/scripts/e2e-run-spec.sh` creates a temporary `OPENHUMAN_WORKSPACE`, writes
mock backend config to `~/.openhuman/config.toml`, verifies a prebuilt `dist`
bundle contains the mock backend URL, starts the platform driver, then runs
`pnpm exec wdio run test/wdio.conf.ts --spec "$SPEC"`.

`app/scripts/e2e-run-all-flows.sh` currently sequences 17 specs even though
there are 41 `*.spec.ts` files under `app/test/e2e/specs`.

`app/scripts/e2e-build.sh` is currently broken in this worktree before it
reaches Tauri:

```text
Error: Cannot find module '.../scripts/stage-core-sidecar.mjs'
```

That script still calls `node "$REPO_ROOT/scripts/stage-core-sidecar.mjs"` even
though `app/package.json` says sidecar staging is a no-op after PR #1061 and
`app/src-tauri/tauri.conf.json` has no `bundle.externalBin` entry.

### CI and coverage gates

`.github/workflows/test.yml` runs:

- frontend coverage via `pnpm test:coverage`
- Rust core tests via `cargo test -p openhuman`
- Tauri shell tests via `cargo test --manifest-path app/src-tauri/Cargo.toml`

The Linux and macOS E2E jobs in `test.yml` are commented out.

`.github/workflows/coverage.yml` is the hard changed-line coverage gate:

- frontend lcov from `pnpm test:coverage`
- Rust core lcov from `cargo llvm-cov -p openhuman`
- Tauri lcov from `cargo llvm-cov --manifest-path app/src-tauri/Cargo.toml`
- `diff-cover ... --fail-under=80`

`.github/workflows/pr-quality.yml` adds a PR checklist guard, coverage matrix
sync, and markdown link check, but all three jobs currently use
`continue-on-error: true`, so they are soft signals.

`node scripts/check-coverage-matrix.mjs` passed locally without npm installs:

```text
Matrix: 138 rows, 138 catalog IDs, 0 parse errors, 0 missing, 0 duplicates
```

## Known broken or stale validation definitions

1. Sidecar staging is internally inconsistent.
   - Evidence: `app/package.json` says `core:stage` is a no-op because the core
     is linked in process.
   - Evidence: `app/src-tauri/tauri.conf.json` has no `bundle.externalBin`.
   - Evidence: `app/scripts/e2e-build.sh` still calls missing
     `scripts/stage-core-sidecar.mjs` and fails immediately.
   - Evidence: `docs/BUILDING.md`, `docs/src-tauri/README.md`, and `AGENTS.md`
     still describe sidecar staging as a required build step.

2. Several docs still use the old Rust binary name.
   - Evidence: `Cargo.toml` exposes `openhuman-core`, not `openhuman`.
   - Evidence: `cargo build --manifest-path Cargo.toml --bin openhuman --locked
     --color=never` fails with `no bin target named 'openhuman'`.
   - Evidence: docs and AGENTS references still say `cargo build --bin openhuman`.

3. E2E docs say Linux CI is the default, but CI disables Linux E2E.
   - Evidence: `docs/E2E-TESTING.md` says Linux is the default CI path.
   - Evidence: `docs/TESTING-STRATEGY.md` says WDIO E2E uses Linux CI with
     `tauri-driver`.
   - Evidence: `.github/workflows/test.yml` has the E2E jobs commented out.
   - Evidence: `.github/workflows/e2e-agent-review.yml` explicitly says Linux
     E2E is disabled because CEF has no WebDriver automation support.

4. Windows build workflow has stale package-manager and output assumptions.
   - Evidence: `.github/workflows/build-windows.yml` uses `cache: yarn` and
     `yarn install --frozen-lockfile` in a pnpm workspace.
   - Evidence: the same workflow uploads a standalone CLI from
     `steps.core-paths.outputs.*`, but there is no `id: core-paths` step in
     that workflow.

5. Local CI helper appears obsolete.
   - Evidence: `scripts/test-ci-local.sh` points at
     `.github/workflows/package-and-publish.yml`, which is not present.
   - Evidence: it uses `yarn install`, a `skills` directory, and old frontend
     runner repository names that do not match the current pnpm workspace.

6. PR quality checks are documented as governance, but currently soft.
   - Evidence: `.github/workflows/pr-quality.yml` uses `continue-on-error: true`
     for checklist, coverage matrix, and markdown-link checks.
   - Evidence: `docs/TESTING-STRATEGY.md` says CI will guard the coverage
     matrix once issue #965 lands; the present workflow is not hard-failing.

## Validation command candidates

| Command | Current local status | Expected use |
| --- | --- | --- |
| `git status --short` | Runs; before this report it was clean. | Required queue validation and final dirty-state evidence. |
| `cargo fmt --manifest-path Cargo.toml --all --check` | Passed. | Cheap Rust formatting proof for root core changes. |
| `cargo fmt --manifest-path app/src-tauri/Cargo.toml --all --check` | Passed. | Cheap Rust formatting proof for Tauri shell changes. |
| `node scripts/check-coverage-matrix.mjs` | Passed. | Cheap docs/process proof when editing the coverage matrix or feature IDs. |
| `cargo metadata --manifest-path Cargo.toml --no-deps --locked --format-version 1` | Passed. | Safe manifest inspection; does not prove compilation. |
| `cargo metadata --manifest-path app/src-tauri/Cargo.toml --no-deps --locked --format-version 1` | Passed. | Safe Tauri manifest inspection; does not prove vendor submodules are initialized. |
| `pnpm --filter openhuman-app core:stage` | Passed, but only prints a no-op message. | Useful evidence that staging is intentionally removed; not a build proof. |
| `pnpm --filter openhuman-app exec vitest --version` | Failed: `Command "vitest" not found`. | Blocked until `pnpm install --frozen-lockfile`. |
| `pnpm --filter openhuman-app exec eslint --version` | Failed: `Command "eslint" not found`. | Blocked until `pnpm install --frozen-lockfile`. |
| `pnpm --filter openhuman-app exec tsc --version` | Failed: `Command "tsc" not found`. | Blocked until `pnpm install --frozen-lockfile`. |
| `pnpm --filter openhuman-app exec prettier --version` | Failed: `Command "prettier" not found`. | Blocked until `pnpm install --frozen-lockfile`. |
| `cargo check --manifest-path Cargo.toml --bin openhuman-core --locked` | Failed locally: cannot open shared target dir lock under `/Users/jwalinshah/.cargo-target-shared`. | Candidate root Rust compile proof after setting a writable `CARGO_TARGET_DIR` or running outside this sandbox. |
| `pnpm test:rust -- --test json_rpc_e2e` | Failed locally: mock backend could not listen on `127.0.0.1:18505` (`EPERM`). | Candidate JSON-RPC integration proof when localhost listen is allowed. |
| `bash app/scripts/e2e-build.sh` | Failed: missing `scripts/stage-core-sidecar.mjs`. | Known broken E2E build script; should be fixed before relying on WDIO flow commands. |
| `cargo build --manifest-path Cargo.toml --bin openhuman --locked --color=never` | Failed: no bin target named `openhuman`; available targets include `openhuman-core`. | Stale docs detector, not a valid current build command. |

## Risks and stale assumptions

1. Agents can follow documented E2E instructions and fail immediately before any
   useful Tauri signal because `app/scripts/e2e-build.sh` references a deleted
   sidecar staging script.

2. Docs and workflow comments disagree about whether the core is a sidecar or
   in-process. That creates validation ambiguity: a worker may build or stage a
   binary that the app no longer uses, or skip a path that a stale script still
   requires.

3. Linux E2E coverage may be overclaimed. The docs describe Linux `tauri-driver`
   as the default CI path, but CI has the E2E job disabled and a dedicated
   workflow says CEF cannot be driven by WebKitWebDriver.

4. The local worktree is not validation-ready by default: no node modules, no
   initialized Tauri submodules, sandbox-blocked localhost listeners, and a
   shared Cargo target outside the writable root all block ordinary validation.

5. Windows CI may be non-runnable or artifact-incomplete because it mixes yarn
   with pnpm and references undefined `steps.core-paths` outputs.

6. Soft PR quality checks can let coverage-matrix and checklist drift through
   CI unless reviewers notice the warning status.

## Next safe work

### 1. Repair E2E build after in-process core migration

Acceptance criteria:

- `app/scripts/e2e-build.sh` no longer calls missing
  `scripts/stage-core-sidecar.mjs`.
- E2E build docs no longer mention `bundle.externalBin` or required sidecar
  staging unless a current script actually implements it.
- `app/package.json`'s `core:stage` no-op, `app/src-tauri/tauri.conf.json`, and
  E2E scripts tell the same story.

Validation commands:

- `bash app/scripts/e2e-build.sh` in an environment with `pnpm install` and
  initialized submodules. Expected: it reaches the Tauri build rather than
  failing on missing `stage-core-sidecar.mjs`.
- `rg -n "stage-core-sidecar|cargo build --bin openhuman|bundle.externalBin" app/scripts docs AGENTS.md`. Expected: either no stale hits or hits only in explicitly historical notes.

### 2. Reconcile E2E docs and CI truth

Acceptance criteria:

- `docs/E2E-TESTING.md`, `docs/TESTING-STRATEGY.md`, and `AGENTS.md` state the
  current E2E reality: Linux `tauri-driver` is not an active merge gate while
  CEF lacks a compatible driver path.
- `.github/workflows/test.yml` has either an active, working E2E job or a short
  non-commented pointer to the disabled workflow rationale.
- `app/scripts/e2e-run-all-flows.sh` documents why it runs 17 specs while 41
  specs exist, or expands to a named complete set.

Validation commands:

- `rg -n "Linux \\(CI default\\)|tauri-driver|E2E \\(Linux\\)|test:e2e:all:flows" docs .github app/scripts`
- `node scripts/check-coverage-matrix.mjs`

### 3. Add an agent validation preflight

Acceptance criteria:

- A script such as `scripts/agent-validation-preflight.sh` checks Node, pnpm,
  Rust toolchain, `node_modules`, initialized submodules, writable Cargo target
  dir, and ability to bind a local mock-backend port.
- The script prints exact remediation for each missing prerequisite without
  installing dependencies or mutating product code.
- PR checklist docs point agents to the preflight before expensive validation.

Validation commands:

- `bash scripts/agent-validation-preflight.sh`. Expected in this worktree:
  reports missing `node_modules`, uninitialized submodules, blocked localhost
  listen, and unwritable `CARGO_TARGET_DIR`.
- `git status --short`. Expected: only intended script/docs edits.

### 4. Fix or remove stale Windows workflow outputs

Acceptance criteria:

- `.github/workflows/build-windows.yml` uses pnpm consistently.
- The undefined `steps.core-paths.outputs.*` upload is removed or backed by a
  real `id: core-paths` step.
- The workflow's artifact outputs match the current in-process core packaging
  model.

Validation commands:

- `actionlint .github/workflows/build-windows.yml` if available.
- `rg -n "yarn|steps\\.core-paths|openhuman-core" .github/workflows/build-windows.yml`

### 5. Decide whether PR quality checks should become hard gates

Acceptance criteria:

- The team explicitly decides whether checklist, coverage-matrix sync, and docs
  link checks are informational or blocking.
- If blocking, remove `continue-on-error: true` from the relevant jobs in
  `.github/workflows/pr-quality.yml` after confirming false positives are low.
- If informational, update docs to stop implying they are merge gates.

Validation commands:

- `node scripts/check-coverage-matrix.mjs`
- `PR_BODY="$(cat .github/PULL_REQUEST_TEMPLATE.md)" node scripts/check-pr-checklist.mjs`
- `rg -n "continue-on-error|coverage matrix|checklist" .github/workflows/pr-quality.yml docs`

## Non-goals

- No dependency installation.
- No submodule initialization.
- No product-code edits.
- No generated build artifacts.
- No external service access.
- No pushes, PRs, merges, or external tracker updates.
- No attempt to repair validation scripts in this queue item.

## Unknowns

- Whether the overnight runner is expected to initialize submodules and install
  pnpm dependencies before each validation audit worktree.
- Whether Linux CEF E2E is expected to be revived with a ChromeDriver-compatible
  harness, replaced with macOS-only Appium coverage, or treated as manual smoke.
- Whether standalone `openhuman-core` distribution is intentionally paused for
  all surfaces or only for desktop release packaging.
- Whether the shared `CARGO_TARGET_DIR` is intentional for all local agents, and
  what writable fallback should be used in sandboxed worktrees.
- Which file is the current source of truth for sidecar versus in-process core
  language: `app/package.json`, `docs/ARCHITECTURE.md`, `docs/src-tauri/README.md`,
  or `AGENTS.md`.

## Command log

- `llm-tldr tree .` -> large JSON tree; confirmed repo layout.
- `git status --short --branch` -> clean branch state before report.
- `git remote -v` -> local fork and upstream remotes.
- `jq '.scripts' package.json` and `jq '.scripts' app/package.json` -> root and app validation scripts.
- `rtk read Cargo.toml` and `rtk read app/src-tauri/Cargo.toml` -> Rust targets and Tauri path deps.
- `rtk read app/test/vitest.config.ts` and `rtk read app/test/wdio.conf.ts` -> unit and E2E harness configuration.
- `rtk read scripts/test-rust-with-mock.sh` -> Rust mock-backend wrapper.
- `rtk read scripts/debug/README.md`, `scripts/debug/unit.sh`, `scripts/debug/rust.sh`, and `scripts/debug/e2e.sh` -> agent debug surfaces.
- `rtk read .github/workflows/test.yml`, `coverage.yml`, `build.yml`, `build-desktop.yml`, `build-windows.yml`, `pr-quality.yml`, `e2e-agent-review.yml` -> CI validation and release surfaces.
- `rtk read docs/TESTING-STRATEGY.md`, `docs/TEST-COVERAGE-MATRIX.md`, `docs/E2E-TESTING.md`, `docs/BUILDING.md`, and `docs/agent-workflows/codex-pr-checklist.md` -> documented validation contracts.
- `git submodule status --recursive` -> vendor submodules not initialized.
- `node --version && pnpm --version && cargo --version && rustc --version` -> local tool versions.
- `cargo metadata --manifest-path Cargo.toml --no-deps --locked --format-version 1` -> root manifest metadata passed.
- `cargo metadata --manifest-path app/src-tauri/Cargo.toml --no-deps --locked --format-version 1` -> Tauri manifest metadata passed.
- `cargo fmt --manifest-path Cargo.toml --all --check` -> passed.
- `cargo fmt --manifest-path app/src-tauri/Cargo.toml --all --check` -> passed.
- `cargo check --manifest-path Cargo.toml --bin openhuman-core --locked` -> failed on unwritable shared Cargo target dir.
- `pnpm --filter openhuman-app exec vitest --version`, `eslint --version`, `tsc --version`, and `prettier --version` -> failed because app dev dependencies are absent.
- `cargo build --manifest-path Cargo.toml --bin openhuman --locked --color=never` -> failed because `openhuman` is not a current binary target.
- `bash app/scripts/e2e-build.sh` -> failed because `scripts/stage-core-sidecar.mjs` is missing.
- `pnpm test:rust -- --test json_rpc_e2e` -> failed because the mock backend could not bind `127.0.0.1:18505`.
- `node scripts/check-coverage-matrix.mjs` -> passed.

