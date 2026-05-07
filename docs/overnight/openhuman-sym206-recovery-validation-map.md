# Overnight Validation Map: openhuman-sym206-recovery

Queue item: `openhuman-sym206-recovery-validation-map`
Date: 2026-05-07
Scope: read-only validation audit. Product code, generated data, dependency installs, pushes, PR creation, and external tracker updates were out of scope.

## Repo Purpose And State

OpenHuman is a desktop assistant built from three main validation surfaces:

- `app/`: Vite, React, Redux, Vitest, WDIO E2E, and Tauri launch scripts.
- repo-root `src/`: Rust crate `openhuman`, library `openhuman_core`, JSON-RPC/core domains, and CLI bins.
- `app/src-tauri/`: Tauri v2 desktop host, CEF runtime, embedded core lifecycle, IPC commands, and updater/window/platform behavior.

Current local state at audit start:

- `pwd`: `/Users/jwalinshah/projects/agent-stack/.agent-stack-worktrees/2026-05-07-overnight-marathon/openhuman-sym206-recovery-validation-map`
- Branch: `codex/goal-openhuman-sym206-recovery-validation-map`
- HEAD: `f11f217809841cf8e3a7f694d8e80967d8e188b8`
- `git status --short`: empty before this report was created.
- `pnpm --version`: `10.10.0`
- `node --version`: `v25.9.0`
- `cargo --version`: `cargo 1.93.0 (083ac5135 2025-12-15)`
- `rustc --version`: `rustc 1.93.0 (254b59607 2026-01-19)`
- `node_modules/`: absent.
- `git submodule status`: both Tauri vendor submodules are uninitialized, shown with leading `-`:
  - `app/src-tauri/vendor/tauri-cef`
  - `app/src-tauri/vendor/tauri-plugin-notification`

## Evidence Map

Local structure and test inventory:

- `llm-tldr tree .` returned a large repo with `app/`, root `src/`, `tests/`, root `Cargo.toml`, root `package.json`, and Tauri shell under `app/src-tauri/`.
- `rg --files app/src app/test | rg '\.(test|spec)\.(ts|tsx)$' | wc -l` found `210` TypeScript/Vitest/WDIO test or spec files.
- `rg --files tests src | rg '(test|tests|_e2e)\.rs$' | wc -l` found `159` Rust test-related files.
- `rg --files app/test/e2e/specs | wc -l` found `41` WDIO E2E specs.
- `rg --files .github/workflows | wc -l` found `14` workflows.

Command definitions and local runners:

- `package.json` delegates root scripts to `openhuman-app`: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:coverage`, `pnpm test:rust`, and `pnpm debug`.
- `app/package.json` defines the actual app gates: `compile`, `build`, `lint`, `format:check`, `test:unit`, `test:coverage`, `test:rust`, `test:e2e:build`, `test:e2e:all:flows`, `rust:format:check`, `rust:clippy`, and `rust:check`.
- `scripts/debug/README.md` documents compact agent wrappers: `pnpm debug unit`, `pnpm debug rust`, `pnpm debug e2e`, and `pnpm debug logs`.
- `scripts/test-rust-with-mock.sh` starts `scripts/mock-api-server.mjs`, waits on `/__admin/health`, exports `BACKEND_URL` and `VITE_BACKEND_URL`, then runs `cargo test --manifest-path Cargo.toml --workspace`.
- `app/scripts/e2e-build.sh` builds a Tauri debug app with `VITE_BACKEND_URL=http://127.0.0.1:${E2E_MOCK_PORT:-18473}` and calls `node "$REPO_ROOT/scripts/stage-core-sidecar.mjs"`.
- `app/scripts/e2e-run-spec.sh` runs one WDIO spec, starts tauri-driver on Linux or Appium on macOS, writes mock backend config into `$HOME/.openhuman/config.toml`, and cleans platform app caches.
- `app/scripts/e2e-run-all-flows.sh` runs a sequential subset of 17 E2E specs, not all 41 specs under `app/test/e2e/specs`.

Validation config:

- `app/test/vitest.config.ts` uses jsdom, `maxWorkers: 1`, setup file `app/src/test/setup.ts`, includes `src/**/*.test.{ts,tsx}` and `test/*.test.{ts,tsx}`, and emits text/html/lcov coverage reports. Coverage thresholds are commented out.
- `app/test/wdio.conf.ts` uses WDIO with Linux tauri-driver on port `4444` and macOS Appium Mac2 on port `4723`. It captures failure screenshots and page source through `captureFailureArtifacts`.
- `app/eslint.config.js` is an ESLint 9 flat config scoped mainly to `src/**/*.{ts,tsx}`, test files, and E2E files. It ignores `app/**`, `src-tauri/**`, `scripts/**`, `dist/**`, `target/**`, and `coverage/**` from the app working directory, so path interpretation depends on running from `app/`.
- `app/tsconfig.json` is strict (`strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`) and includes `src`, `test/*.test.ts`, and `test/*.test.tsx`.
- `rust-toolchain.toml` pins Rust `1.93.0` with `rustfmt` and `clippy`.
- `pnpm-workspace.yaml` lists only `app` as a pnpm workspace package.

Rust surfaces:

- Root `Cargo.toml` package is `openhuman`, library is `openhuman_core`, and available bins are `openhuman-core`, `slack-backfill`, and `gmail-backfill-3d`.
- `cargo metadata --manifest-path Cargo.toml --no-deps --format-version 1` succeeded and confirmed root targets plus repo-root integration tests like `tests/json_rpc_e2e.rs`, `tests/memory_roundtrip_e2e.rs`, and `tests/webview_apis_bridge.rs`.
- `app/src-tauri/Cargo.toml` package is `OpenHuman`, binary is `OpenHuman`, and it depends on root `openhuman_core` by path.
- `app/src-tauri/Cargo.toml` patches Tauri crates to path dependencies under `app/src-tauri/vendor/tauri-cef` and `app/src-tauri/vendor/tauri-plugin-notification`.
- `app/src-tauri/src/core_process.rs` says the core runs as an in-process tokio task in the Tauri host, not as a leaking sidecar.
- `app/src-tauri/src/main.rs` multiplexes `OpenHuman core <args>` into `openhuman::run_core_from_args`.

CI and policy:

- `.github/workflows/test.yml` runs `pnpm test:coverage`, `cargo test -p openhuman`, and `cargo test --manifest-path app/src-tauri/Cargo.toml`.
- `.github/workflows/typecheck.yml` runs `pnpm --filter openhuman-app compile`, `format:check`, `lint`, `cargo fmt --all -- --check`, and `cargo clippy -p openhuman`.
- `.github/workflows/coverage.yml` runs frontend lcov, root Rust lcov, Tauri lcov, then `diff-cover` with `--fail-under=80` against changed lines.
- `.github/workflows/build.yml` builds the Tauri app in `app/` using `cargo tauri build -c "$TAURI_CONFIG_OVERRIDE" --bundles deb` after `pnpm install --frozen-lockfile`.
- `.github/workflows/pr-quality.yml` has soft PR checks (`continue-on-error: true`) for PR checklist, coverage matrix sync, and markdown links.
- `.github/workflows/e2e-agent-review.yml` is manual-only and explicitly says Linux CEF E2E through tauri-driver is disabled because WebKitWebDriver cannot drive a CEF webview.
- `docs/TESTING-STRATEGY.md` defines the intended layers: Rust unit, Rust integration, Vitest unit, WDIO E2E, and manual smoke.
- `docs/TEST-COVERAGE-MATRIX.md` maps product feature leaves to `RU`, `RI`, `VU`, `WD`, and `MS` evidence; its summary claims 64 covered, 27 partial, 27 missing, and 11 manual-smoke leaves.
- `docs/RELEASE-MANUAL-SMOKE.md` owns non-driver-automatable release checks such as Gatekeeper, code signing, DMG install, TCC prompts, SmartScreen, Linux desktop install, notifications, and auto-update.

## Commands Run

| Command | Result | Notes |
| --- | --- | --- |
| `pwd` | pass | Confirmed correct isolated worktree. |
| `git status --short` | pass | Empty before report creation. |
| `git rev-parse --abbrev-ref HEAD` | pass | `codex/goal-openhuman-sym206-recovery-validation-map`. |
| `git rev-parse HEAD` | pass | `f11f217809841cf8e3a7f694d8e80967d8e188b8`. |
| `llm-tldr tree .` | pass | Large output; confirmed repo shape and major validation surfaces. |
| `rg --files ...` | pass | Located package manifests, scripts, workflows, docs, and tests. |
| `git submodule status` | pass with blocker evidence | Vendor submodules are uninitialized. |
| `ls node_modules` | fail as expected | `node_modules` missing locally. |
| `ls scripts/stage-core-sidecar.mjs` | fail as expected | E2E build script references a missing file. |
| `cargo build --manifest-path Cargo.toml --bin openhuman` | fail as expected | No `openhuman` bin; available bins are `openhuman-core`, `slack-backfill`, `gmail-backfill-3d`. |
| `pnpm --filter openhuman-app exec tsc --version` | fail as expected | `Command "tsc" not found`; `node_modules` absent. |
| `pnpm --filter openhuman-app exec vitest --version` | fail as expected | `Command "vitest" not found`; `node_modules` absent. |
| `cargo fmt --manifest-path Cargo.toml --all --check` | pass | Root Rust formatting check completed with no output. |
| `cargo fmt --manifest-path app/src-tauri/Cargo.toml --all --check` | pass | Tauri Rust formatting check completed with no output. |
| `cargo metadata --manifest-path Cargo.toml --no-deps --format-version 1` | pass | Root manifest target graph resolves without dependency fetch. |
| `cargo metadata --manifest-path app/src-tauri/Cargo.toml --no-deps --format-version 1` | pass with caveat | Manifest graph resolves, but path dependencies under uninitialized vendor submodules are still absent on disk. |
| `pnpm --filter openhuman-app test:e2e:build` | fail | Fails before build: `MODULE_NOT_FOUND` for `scripts/stage-core-sidecar.mjs`, plus warning that `node_modules` is missing. |

## Validation Surface Map

### Cheap local proof commands

These are the lowest-cost checks that can run before a dependency bootstrap:

- `git status --short`: should exit 0; expected output includes only the overnight report after this audit.
- `cargo fmt --manifest-path Cargo.toml --all --check`: observed pass.
- `cargo fmt --manifest-path app/src-tauri/Cargo.toml --all --check`: observed pass.
- `cargo metadata --manifest-path Cargo.toml --no-deps --format-version 1`: observed pass.
- `cargo metadata --manifest-path app/src-tauri/Cargo.toml --no-deps --format-version 1`: observed pass but not sufficient for Tauri build readiness.

### Dependency-required local proof commands

These require `pnpm install --frozen-lockfile` first:

- `pnpm --filter openhuman-app compile`: expected to run TypeScript strict checks after `node_modules` exists.
- `pnpm --filter openhuman-app lint`: expected to run ESLint from `app/`.
- `pnpm --filter openhuman-app format:check`: expected to run Prettier plus Rust fmt checks through `pnpm rust:format:check`.
- `pnpm --filter openhuman-app test:unit`: expected to run Vitest with jsdom and shared setup.
- `pnpm --filter openhuman-app test:coverage`: expected to write `app/coverage/lcov.info`.
- `node scripts/check-coverage-matrix.mjs`: expected to validate `docs/TEST-COVERAGE-MATRIX.md` against `scripts/feature-ids.json`.
- `node scripts/check-pr-checklist.mjs`: expected to inspect `PR_BODY`; not meaningful without a PR body.

### Rust proof commands

These require Rust dependencies and, for Tauri, initialized vendor submodules:

- `cargo check --manifest-path Cargo.toml`: root crate proof.
- `cargo test -p openhuman`: CI root Rust test command from `.github/workflows/test.yml`.
- `pnpm test:rust`: starts the mock API and runs `cargo test --manifest-path Cargo.toml --workspace`.
- `cargo clippy -p openhuman`: CI root clippy command from `.github/workflows/typecheck.yml`.
- `cargo test --manifest-path app/src-tauri/Cargo.toml`: CI Tauri shell test command; blocked locally until `app/src-tauri/vendor/*` submodules are initialized.
- `cargo check --manifest-path app/src-tauri/Cargo.toml`: same submodule caveat.

### E2E proof commands

These require `pnpm install`, initialized Tauri vendor submodules, a built app, and platform driver setup:

- `pnpm --filter openhuman-app test:e2e:build`: currently fails locally because `scripts/stage-core-sidecar.mjs` is missing.
- `bash app/scripts/e2e-run-spec.sh test/e2e/specs/smoke.spec.ts smoke`: requires prior E2E build, tauri-driver on Linux or Appium Mac2 on macOS.
- `pnpm --filter openhuman-app test:e2e:all:flows`: runs the curated sequential flow list in `app/scripts/e2e-run-all-flows.sh`.
- `bash app/scripts/e2e-agent-review.sh`: documented agent-observable artifact flow; not inspected deeply in this audit, but it depends on the same E2E build/driver foundation.

### CI merge gates

The practical merge gate set is split:

- TypeScript, Prettier, ESLint, Rust fmt, and root clippy: `.github/workflows/typecheck.yml`.
- Frontend coverage, root Rust tests, Tauri Rust tests: `.github/workflows/test.yml`.
- Build artifact proof for Linux deb: `.github/workflows/build.yml`.
- Changed-line coverage gate at >= 80 percent: `.github/workflows/coverage.yml`.
- PR checklist, coverage matrix, and markdown links: `.github/workflows/pr-quality.yml`, but currently soft-fail only.

## Risks And Stale Assumptions

1. Stale sidecar validation path. `docs/BUILDING.md`, `docs/src-tauri/README.md`, and `app/scripts/e2e-build.sh` still refer to staging a core sidecar, while `app/package.json` says `core:stage` is a no-op and `app/src-tauri/src/core_process.rs` says core is embedded in-process. This directly breaks `pnpm --filter openhuman-app test:e2e:build` because `scripts/stage-core-sidecar.mjs` is absent.

2. Stale binary name in source-build docs. `docs/BUILDING.md` tells contributors to run `cargo build --manifest-path Cargo.toml --bin openhuman`, but root `Cargo.toml` defines `openhuman-core`, not `openhuman`. The documented command fails locally before compilation.

3. E2E docs do not match CEF CI reality. `docs/E2E-TESTING.md` says Linux is the default CI path and that the default job runs E2E flows, but `.github/workflows/test.yml` has the Linux and macOS E2E jobs commented out, and `.github/workflows/e2e-agent-review.yml` documents CEF/tauri-driver incompatibility.

4. Local Tauri validation has hidden submodule prerequisites. `app/src-tauri/Cargo.toml` depends on path-patched Tauri/notification crates in `app/src-tauri/vendor/*`; this worktree has both submodules uninitialized. `cargo metadata --no-deps` can still look healthy, so a preflight that only reads metadata would miss the actual build blocker.

5. Node validation fails without bootstrap, and the error is noisy. `pnpm --filter openhuman-app exec tsc --version` and `pnpm --filter openhuman-app exec vitest --version` both fail because `node_modules` is missing. The runner should record this as a dependency bootstrap blocker, not a TypeScript or Vitest failure.

6. E2E runner mutates user-level state. `app/scripts/e2e-run-spec.sh` writes/backups `$HOME/.openhuman/config.toml` and deletes platform app caches. It does create temp `OPENHUMAN_WORKSPACE`, but the config write is outside that workspace. This is a validation side effect agents should understand before running E2E locally.

7. PR quality workflow is explicitly soft. `.github/workflows/pr-quality.yml` has `continue-on-error: true`, so checklist, coverage-matrix, and markdown-link issues can be visible but non-blocking. Morning review should not assume green required checks imply those contracts were enforced.

8. Coverage matrix is a useful contract but has aging language. `docs/TEST-COVERAGE-MATRIX.md` contains several "(this PR)" notes and issue references. That may be historical context, not current branch evidence. Agents should verify claimed test paths exist and run.

9. Workspace scope may hide orphan packages. `pnpm-workspace.yaml` includes only `app`, while `packages/npm/package.json` and `remotion/package.json` exist. This may be intentional, but validation commands from root pnpm will not cover those package manifests unless separately wired.

10. CI container differs materially from this local worktree. CI uses `ghcr.io/tinyhumansai/openhuman_ci:rust-1.93.0`, with vendored CEF-aware tauri tooling described in workflows. Local validation cannot assume those tools or system libraries exist.

## Missing Or Blocked Validation

- Full frontend validation (`pnpm typecheck`, `pnpm lint`, `pnpm test:coverage`) was not run because `node_modules` is absent and dependency installation was out of scope.
- Full root Rust tests (`cargo test -p openhuman`, `pnpm test:rust`) were not run; they are large and not required by the queue item validation. The mock-backed wrapper is documented and should be used for Rust behavior changes.
- Tauri shell build/test/check commands were not run because vendor submodules are uninitialized locally.
- E2E build was attempted and failed before any app build due to missing `scripts/stage-core-sidecar.mjs`.
- No browser, external services, release builds, deployment, pushes, PRs, or tracker updates were performed.

## Next Safe Work

1. Reconcile E2E build with embedded core lifecycle.
   - Acceptance criteria: `app/scripts/e2e-build.sh`, `app/package.json`, and Tauri docs agree on whether a sidecar exists. There is no reference to missing `scripts/stage-core-sidecar.mjs`, or the script is restored intentionally.
   - Validation: after `pnpm install --frozen-lockfile` and initialized submodules, `pnpm --filter openhuman-app test:e2e:build` gets past the current `MODULE_NOT_FOUND` failure.

2. Fix source-build documentation and command names.
   - Acceptance criteria: `docs/BUILDING.md`, `docs/src-tauri/README.md`, and `docs/src-tauri/03-services.md` describe current embedded-core behavior and use `openhuman-core` or `OpenHuman core ...` consistently.
   - Validation: `cargo build --manifest-path Cargo.toml --bin openhuman-core` is the documented root binary command, and no docs tell users to build `--bin openhuman`.

3. Add a local validation preflight for agents.
   - Acceptance criteria: a script or documented checklist reports `node_modules` presence, submodule initialization, Node/pnpm/Rust versions, CEF vendor paths, and known E2E side effects before running expensive checks.
   - Validation: preflight exits nonzero in this current worktree with explicit blockers for `node_modules` and uninitialized `app/src-tauri/vendor/*`, and exits zero after bootstrap.

4. Reconcile E2E docs with current CI policy.
   - Acceptance criteria: `docs/E2E-TESTING.md` and `docs/TESTING-STRATEGY.md` clearly state which E2E flows run in required CI today, which are manual/optional, and why CEF blocks Linux tauri-driver automation.
   - Validation: docs mention `.github/workflows/test.yml` commented E2E jobs and `.github/workflows/e2e-agent-review.yml` manual dispatch status.

5. Make PR quality enforcement explicit.
   - Acceptance criteria: either `pr-quality.yml` becomes hard-fail for selected checks, or docs/PR template explicitly state these are advisory and reviewers must inspect them manually.
   - Validation: `node scripts/check-coverage-matrix.mjs` and `node scripts/check-pr-checklist.mjs` behavior is documented with expected pass/fail examples.

6. Reduce E2E local side effects.
   - Acceptance criteria: E2E config writes use `OPENHUMAN_WORKSPACE` or another test-owned directory where possible, and any unavoidable `$HOME` writes are documented at command point.
   - Validation: one focused E2E dry run logs all paths it mutates, and cleanup restores user config even on failure.

## Validation Command Candidates

Expected pass now:

- `git status --short` -- exits 0; after this report, expected output is the untracked/modified report file depending on git state.
- `cargo fmt --manifest-path Cargo.toml --all --check` -- observed pass.
- `cargo fmt --manifest-path app/src-tauri/Cargo.toml --all --check` -- observed pass.
- `cargo metadata --manifest-path Cargo.toml --no-deps --format-version 1` -- observed pass.

Expected fail/block now:

- `pnpm --filter openhuman-app exec tsc --version` -- fails until `pnpm install --frozen-lockfile` creates `node_modules`.
- `pnpm --filter openhuman-app exec vitest --version` -- fails until `node_modules` exists.
- `pnpm --filter openhuman-app test:e2e:build` -- fails now with `MODULE_NOT_FOUND` for `scripts/stage-core-sidecar.mjs`.
- `cargo build --manifest-path Cargo.toml --bin openhuman` -- fails because that bin name does not exist.
- `cargo test --manifest-path app/src-tauri/Cargo.toml` -- expected blocked until Tauri vendor submodules are initialized.

Expected CI-equivalent after bootstrap:

- `pnpm --filter openhuman-app compile`
- `pnpm --filter openhuman-app format:check`
- `pnpm --filter openhuman-app lint`
- `pnpm --filter openhuman-app test:coverage`
- `cargo test -p openhuman`
- `cargo test --manifest-path app/src-tauri/Cargo.toml`
- `cargo clippy -p openhuman`
- `cargo llvm-cov -p openhuman --lcov --output-path lcov-core.info`
- `cargo llvm-cov --manifest-path app/src-tauri/Cargo.toml --lcov --output-path lcov-tauri.info`

## Non-Goals

- Did not change product code.
- Did not install dependencies or initialize submodules.
- Did not run external services or real OAuth/API integrations.
- Did not run release builds, Sentry upload scripts, signing/notarization, or deployment workflows.
- Did not push a branch, create a PR, merge a PR, or mark any external tracker Done.
- Did not attempt to fix the broken E2E build path; this item is audit-only.

## Unknowns

- Whether the missing `scripts/stage-core-sidecar.mjs` is an accidental deletion, a branch-specific regression, or a partially completed migration to embedded core.
- Whether CI has an equivalent stage script injected by image tooling. Local repo evidence says the file is absent, so repo-local E2E build is broken as written.
- Whether `packages/npm/` and `remotion/` are intentionally outside the pnpm workspace or simply not covered by current validation.
- Whether all `docs/TEST-COVERAGE-MATRIX.md` rows marked covered still pass on the current branch; path existence was sampled, not full suite execution.
- Whether full Tauri tests pass after submodule initialization; this worktree cannot prove that without fetching submodules and dependencies.
- Whether local Node `v25.9.0` is acceptable beyond the app engine requirement of `>=24.0.0`; CI workflows often refer to Node 24.

## Handoff

- Report written: `docs/overnight/openhuman-sym206-recovery-validation-map.md`
- Product files changed: none.
- External trackers updated: none.
- PR created: none.
- Required validation: `git status --short` exited 0 after writing this report; output was `?? docs/overnight/`.
