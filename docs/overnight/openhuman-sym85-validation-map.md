# openhuman-sym85 validation-map audit

Queue item: `openhuman-sym85-validation-map`
Focus area: validation-map
Audit date: 2026-05-07
Repo path: `/Users/jwalinshah/projects/agent-stack/.agent-stack-worktrees/2026-05-07-overnight-marathon/openhuman-sym85-validation-map`

## Scope and decision log

This audit is read-only for product code. The only intended repository change is this report under `docs/overnight/`.

Decision made during audit: do not install dependencies, initialize submodules, run broad test suites, launch E2E drivers, touch external services, create a PR, or push. The queue validation command is `git status --short`; heavier validation was mapped and probed only where probes were cheap and local.

## Repo purpose and current state

OpenHuman is a React + Tauri v2 desktop app with a Rust core crate and CLI in the repo root. Validation is split across TypeScript checks, Vitest unit coverage, Rust core tests, Rust Tauri shell tests, WDIO desktop E2E, installer smoke checks, release asset checks, and a diff-cover gate.

Observed state:

- `pwd` returned `/Users/jwalinshah/projects/agent-stack/.agent-stack-worktrees/2026-05-07-overnight-marathon/openhuman-sym85-validation-map`.
- `git branch --show-current` returned `codex/goal-openhuman-sym85-validation-map`.
- `git rev-parse HEAD` returned `f11f217809841cf8e3a7f694d8e80967d8e188b8`.
- Initial `git status --short --branch` returned only `## codex/goal-openhuman-sym85-validation-map`; the worktree started clean.
- `llm-tldr tree .` completed and showed the main surfaces: `app/`, repo-root `src/`, `tests/`, `.github/workflows/`, `scripts/`, `docs/`, root `Cargo.toml`, `app/package.json`, and `app/src-tauri/Cargo.toml`.

## Local tool observations

- `node --version` returned `v25.9.0`.
- `pnpm --version` returned `10.10.0`, matching the root `packageManager` field in `package.json`.
- `rustc --version` returned `rustc 1.93.0 (254b59607 2026-01-19)`, matching `rust-toolchain.toml`.
- `cargo --version` returned `cargo 1.93.0 (083ac5135 2025-12-15)`.
- `bash -lc 'test -d node_modules ...'` reported `root-node-modules-missing`.
- `bash -lc 'test -d app/node_modules ...'` reported `app-node-modules-missing`.
- `bash -lc 'test -x node_modules/.bin/vitest ...'` reported `vitest-missing`.

These observations mean JS validation commands are defined but not runnable in this worktree until `pnpm install --frozen-lockfile` is performed in an environment with package cache or network access.

## Validation surfaces found

### Root package scripts

Evidence: `package.json`.

The root package is a thin command router into the `openhuman-app` workspace:

- `pnpm build` maps to `pnpm --filter openhuman-app build`.
- `pnpm compile` and `pnpm typecheck` map to the app TypeScript compile path.
- `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:coverage`, and `pnpm test:rust` map into app scripts.
- `pnpm debug` maps to `bash scripts/debug/cli.sh`.
- `pnpm rust:check` maps to `pnpm --filter openhuman-app rust:check`.

This is a useful entry surface, but the actual validation behavior lives mostly in `app/package.json` and shell scripts.

### App package scripts

Evidence: `app/package.json`.

Important app scripts:

- `compile`: `tsc --noEmit`.
- `build`: `tsc && vite build`.
- `test` and `test:unit`: `vitest run --config test/vitest.config.ts`.
- `test:coverage`: `vitest run --config test/vitest.config.ts --coverage`.
- `test:rust`: `bash ../scripts/test-rust-with-mock.sh`.
- `test:e2e:build`: `bash ./scripts/e2e-build.sh`.
- `test:e2e:all:flows`: `bash ./scripts/e2e-run-all-flows.sh`.
- `test:all`: `pnpm test:coverage && pnpm test:rust && pnpm test:e2e`.
- `rust:check`: `cargo check --manifest-path src-tauri/Cargo.toml`.
- `rust:format:check`: checks both repo-root and Tauri manifests.
- `lint`: `eslint . --ext .ts,.tsx --cache`.

Local blocker: `pnpm --filter openhuman-app exec vitest --version` failed with `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "vitest" not found`, and `pnpm --filter openhuman-app exec tsc --version` failed the same way for `tsc`. This is expected with missing `node_modules`.

### Vitest unit harness

Evidence: `app/test/vitest.config.ts` and `app/src/test/setup.ts`.

The Vitest setup is well-scoped for app unit tests:

- Root is `app/`.
- Environment is `jsdom`.
- Workers are pinned to one worker for determinism.
- Tests include `src/**/*.test.{ts,tsx}` and `test/*.test.{ts,tsx}`.
- Coverage includes `app/src/**/*.{ts,tsx}` and excludes test files, generated types, and test harness code.
- `app/src/test/setup.ts` starts the shared mock backend on port `5005`, mocks Tauri APIs, mocks config defaults, and resets request logs and mock behavior between tests.

Observed inventory:

- `rg --files app/src -g "*.test.ts" -g "*.test.tsx" | wc -l` returned `162`.
- `rg --files app/test/e2e/specs -g "*.spec.ts" | wc -l` returned `41`.

### Rust core validation

Evidence: `Cargo.toml`, `rust-toolchain.toml`, `scripts/test-rust-with-mock.sh`, and `tests/`.

The root Rust crate is `openhuman` version `0.53.16`; its library is `openhuman_core`, and its main CLI binary is `openhuman-core`.

Observed:

- `cargo metadata --no-deps --format-version 1` passed for the repo-root manifest.
- `rg --files tests -g "*.rs" | wc -l` returned `16` root integration test files.
- `rg --files src -g "*_tests.rs" -g "tests.rs" | wc -l` returned `147` Rust test modules under `src/`.

`scripts/test-rust-with-mock.sh` starts `scripts/mock-api-server.mjs`, waits on `/__admin/health`, exports `BACKEND_URL` and `VITE_BACKEND_URL`, and runs `cargo test --manifest-path Cargo.toml --workspace "$@"`. It is the right default for Rust integration tests that need the mock backend.

### Tauri shell validation

Evidence: `app/src-tauri/Cargo.toml`, `app/src-tauri/vendor/`, and `.gitmodules` state from `git submodule status --recursive`.

The Tauri shell embeds `openhuman_core` as a path dependency and depends on vendored CEF-aware Tauri crates:

- `tauri-runtime-cef = { path = "vendor/tauri-cef/crates/tauri-runtime-cef" }`.
- `[patch.crates-io]` points Tauri crates at `vendor/tauri-cef/crates/...`.
- `tauri-plugin-notification = { path = "vendor/tauri-plugin-notification" }`.

Critical local blocker:

- `git submodule status --recursive` showed both vendor submodules with a leading `-`: `app/src-tauri/vendor/tauri-cef` and `app/src-tauri/vendor/tauri-plugin-notification` are not initialized.
- `rg --files app/src-tauri/vendor/tauri-cef` and `rg --files app/src-tauri/vendor/tauri-plugin-notification` returned no files.
- `CARGO_NET_OFFLINE=true cargo check --manifest-path app/src-tauri/Cargo.toml --locked` failed with `failed to read ... app/src-tauri/vendor/tauri-cef/crates/tauri/Cargo.toml: No such file or directory`.

Result: all Tauri validation, Tauri shell tests, desktop builds, and E2E builds are blocked in this worktree until submodules are initialized.

### WDIO E2E validation

Evidence: `app/test/wdio.conf.ts`, `app/scripts/e2e-build.sh`, `app/scripts/e2e-run-spec.sh`, `app/scripts/e2e-run-all-flows.sh`, and `docs/E2E-TESTING.md`.

Current E2E design:

- Linux uses `tauri-driver` on port `4444`.
- macOS uses Appium Mac2 on port `4723`.
- Specs are single-instance with `maxInstances: 1`.
- Failures trigger screenshot and page-source capture through `captureFailureArtifacts`.
- `app/scripts/e2e-run-spec.sh` creates a temp `OPENHUMAN_WORKSPACE` when absent, configures mock backend URLs, starts the platform driver, and runs `pnpm exec wdio run test/wdio.conf.ts --spec`.
- `app/scripts/e2e-run-all-flows.sh` runs 17 named specs sequentially, while the repo contains 41 spec files.

Local blockers and side effects:

- E2E requires a prior `pnpm test:e2e:build` and a compiled `app/dist/assets/index-*.js`.
- `app/scripts/e2e-build.sh` calls `node "$REPO_ROOT/scripts/stage-core-sidecar.mjs"`, but `bash -lc 'test -f scripts/stage-core-sidecar.mjs ...'` reported `stage-core-sidecar-missing`.
- `app/package.json` now defines `core:stage` as a no-op because the core is linked in-process. This conflicts with `app/scripts/e2e-build.sh` and some docs that still assume sidecar staging.
- `app/scripts/e2e-run-spec.sh` writes and later restores `~/.openhuman/config.toml`, and deletes local OpenHuman cache/data directories. That is acceptable for isolated E2E runners, but it is not a cheap or side-effect-free validation command for general agents.

### Debug wrappers

Evidence: `scripts/debug/README.md`, `scripts/debug/unit.sh`, `scripts/debug/rust.sh`, and `scripts/debug/e2e.sh`.

The debug wrappers are the best local iteration surface once dependencies exist:

- `pnpm debug unit` wraps Vitest with bounded stdout and full logs under `target/debug-logs/`.
- `pnpm debug rust` wraps `scripts/test-rust-with-mock.sh`.
- `pnpm debug e2e <spec>` wraps `app/scripts/e2e-run-spec.sh`.

Risk: the wrappers are useful, but they inherit the blockers above: missing JS dependencies, missing submodules for Tauri shell checks, and missing E2E build artifacts.

### CI workflows

Evidence: `.github/workflows/test.yml`, `.github/workflows/typecheck.yml`, `.github/workflows/coverage.yml`, `.github/workflows/build.yml`, `.github/workflows/pr-quality.yml`, `.github/workflows/docker-ci-image.yml`, `.github/workflows/installer-smoke.yml`, and `.github/workflows/build-windows.yml`.

CI validation layers:

- `.github/workflows/typecheck.yml` runs app compile, Prettier check, ESLint, `cargo fmt --all -- --check`, and `cargo clippy -p openhuman`.
- `.github/workflows/test.yml` runs frontend coverage, `cargo test -p openhuman`, and `cargo test --manifest-path app/src-tauri/Cargo.toml`. Linux and macOS E2E jobs are currently commented out in this workflow.
- `.github/workflows/build.yml` builds the Tauri app on Ubuntu using the project CI image and recursive submodules.
- `.github/workflows/coverage.yml` generates frontend, Rust core, and Rust Tauri lcov reports, then enforces diff-cover `--fail-under=80` on changed lines for PRs.
- `.github/workflows/pr-quality.yml` has soft checks for PR checklist, coverage matrix sync, and markdown links. Jobs are `continue-on-error: true`.
- `.github/workflows/installer-smoke.yml` dry-runs Unix and Windows installers.
- `.github/workflows/docker-ci-image.yml` builds `ghcr.io/tinyhumansai/openhuman_ci:rust-1.93.0`; it needs recursive submodules because it compiles the vendored CEF-aware Tauri CLI.

Current CI/documentation drift:

- `.github/workflows/build-windows.yml` still uses `yarn install --frozen-lockfile`, while this repo is configured for pnpm.
- `.github/workflows/build-windows.yml` uploads a standalone CLI using `steps.core-paths.outputs...`, but no `core-paths` step exists in that workflow. A similarly named step exists only in `.github/workflows/build-desktop.yml`.
- `scripts/test-ci-local.sh` points at `.github/workflows/package-and-publish.yml`; `bash -lc 'test -f .github/workflows/package-and-publish.yml ...'` reported `missing`.

### Coverage matrix guard

Evidence: `docs/TEST-COVERAGE-MATRIX.md`, `scripts/check-coverage-matrix.mjs`, `scripts/lib/coverage-matrix-parser.mjs`, and `app/test/coverage-matrix-parser.test.ts`.

Observed:

- `node scripts/check-coverage-matrix.mjs` passed with `Matrix: 138 rows, 138 catalog IDs, 0 parse errors, 0 missing, 0 duplicates`.
- The parser has unit coverage in `app/test/coverage-matrix-parser.test.ts`.
- The soft PR workflow runs this check only for non-docs and non-chore PRs and marks it `continue-on-error: true`.

This is useful as a cheap docs/coverage-contract check, but it does not prove test behavior or matrix truthfulness.

## Stale assumptions and risks

1. Tauri shell validation is broken in this worktree until submodules are initialized. The failure is deterministic: `app/src-tauri/vendor/tauri-cef/crates/tauri/Cargo.toml` is missing, so `cargo check --manifest-path app/src-tauri/Cargo.toml --locked` cannot load the patched `tauri` dependency.

2. E2E build instructions are internally inconsistent after the in-process core migration. `app/package.json` says `core:stage` is a no-op, but `app/scripts/e2e-build.sh`, `docs/src-tauri/README.md`, `AGENTS.md`, `CLAUDE.md`, and `docs/BUILDING.md` still reference sidecar staging or `scripts/stage-core-sidecar.mjs`.

3. Several docs/scripts reference a non-existent binary name. Root `Cargo.toml` defines `openhuman-core`, but `AGENTS.md`, `CLAUDE.md`, `docs/BUILDING.md`, `docs/ARCHITECTURE.md`, and `docs/src-tauri/README.md` still mention `cargo build --bin openhuman`.

4. Some local validation helpers are stale. `scripts/test-ci-local.sh` targets missing `.github/workflows/package-and-publish.yml` and still uses `yarn` plus a `skills` directory path that is not present in the current workspace. This can waste agent time before any real validation begins.

5. Windows validation appears likely broken or at least stale. `.github/workflows/build-windows.yml` uses Yarn despite pnpm being the package manager and references undefined `steps.core-paths.outputs...` in the upload step.

6. E2E is not side-effect-free. `app/scripts/e2e-run-spec.sh` deletes local OpenHuman cache/config directories and edits `~/.openhuman/config.toml` before restoring it. Agents need to treat it as an isolated-runner command, not a default proof command on a developer workstation.

7. CI E2E coverage is ambiguous. `docs/E2E-TESTING.md` says Linux E2E is the default CI path, but `.github/workflows/test.yml` has the Linux and macOS E2E jobs commented out. The E2E specs exist, but this audit did not find an active PR CI job running them from `test.yml`.

8. Coverage matrix enforcement is soft in PR quality. `.github/workflows/pr-quality.yml` is marked `continue-on-error: true` for the matrix and checklist jobs, while `.github/workflows/coverage.yml` is hard for diff coverage. Reviewers should not assume matrix sync blocks merges yet.

## Validation command candidates

| Command | Layer | Expected current status | Evidence or blocker |
| --- | --- | --- | --- |
| `git status --short` | Queue validation | Pass, exits 0 and should show only this report as untracked/modified after audit | Required queue validation command |
| `node scripts/check-coverage-matrix.mjs` | Docs/coverage contract | Pass | Observed pass: `Matrix: 138 rows, 138 catalog IDs, 0 parse errors, 0 missing, 0 duplicates` |
| `pnpm install --frozen-lockfile` | JS bootstrap | Unknown locally, required before JS checks | `node_modules` and `app/node_modules` missing |
| `pnpm --filter openhuman-app compile` | TypeScript | Fail now, should pass only after install | Probe showed `tsc` command not found |
| `pnpm --filter openhuman-app test:unit` | Vitest unit | Fail now, should pass only after install | Probe showed `vitest` command not found |
| `pnpm debug unit <pattern>` | Focused Vitest | Fail now, useful after install | Wrapper is valid, but inherits missing Vitest |
| `cargo metadata --no-deps --format-version 1` | Rust core metadata | Pass | Observed pass for repo-root manifest |
| `cargo check --manifest-path Cargo.toml` | Rust core compile | Unknown locally without running heavy compile | Root metadata loads; actual compile depends on cached crates/system deps |
| `pnpm test:rust` or `pnpm debug rust <filter>` | Rust integration with mock backend | Unknown locally; likely expensive | Uses `scripts/test-rust-with-mock.sh`, starts mock API, then cargo tests |
| `CARGO_NET_OFFLINE=true cargo check --manifest-path app/src-tauri/Cargo.toml --locked` | Tauri shell compile | Fail now | Observed missing vendored CEF submodule Cargo.toml |
| `cargo fmt --manifest-path Cargo.toml --all --check` | Rust formatting | Not run; likely cheap | Defined by app `rust:format:check` and CI |
| `pnpm --filter openhuman-app format:check` | Prettier and Rust fmt | Fail now because app deps missing before Prettier | Required by CI and Codex checklist |
| `pnpm --filter openhuman-app lint` | ESLint | Fail now because app deps missing | Defined in app and CI |
| `pnpm test:e2e:build` | E2E build | Fail now | Missing JS deps, missing Tauri submodules, and missing `scripts/stage-core-sidecar.mjs` |
| `bash app/scripts/e2e-run-spec.sh test/e2e/specs/smoke.spec.ts smoke` | Single E2E spec | Fail until E2E build exists | Script requires `app/dist/assets/index-*.js` containing mock URL |
| `bash scripts/install.sh --dry-run --verbose` | Unix installer smoke | Candidate pass | Active in `.github/workflows/installer-smoke.yml`; not run locally |
| `pwsh -NoProfile -File scripts/tests/OpenHumanWindowsInstall.Tests.ps1` | Windows installer helper tests | Candidate pass on Windows/PowerShell | Active in installer smoke; not run on this macOS audit host |

## Next safe work

1. Repair E2E build after the in-process core migration.

   Files to inspect or change: `app/scripts/e2e-build.sh`, `app/package.json`, `docs/src-tauri/README.md`, `docs/BUILDING.md`, `AGENTS.md`, `CLAUDE.md`.

   Acceptance criteria:
   - `app/scripts/e2e-build.sh` no longer calls missing `scripts/stage-core-sidecar.mjs`.
   - Docs no longer claim `core:stage` stages a sidecar when `app/package.json` marks it no-op.
   - The E2E build path documents exactly what it needs: installed JS deps, initialized submodules, CEF cache, and platform driver.

   Validation commands:
   - `bash -n app/scripts/e2e-build.sh`
   - `pnpm --filter openhuman-app test:e2e:build` in a prepared worktree with submodules and dependencies

2. Add a cheap prerequisite validator for local agents.

   Files to inspect or change: `scripts/`, `scripts/debug/README.md`, `docs/agent-workflows/codex-pr-checklist.md`, maybe `package.json`.

   Acceptance criteria:
   - One command checks package manager, Node version, Rust version, `node_modules`, required submodules, and key local binaries without building.
   - Failure messages point to exact repair commands, such as `pnpm install --frozen-lockfile` and `git submodule update --init --recursive`.
   - The command is documented as the first step before TypeScript, Rust Tauri, or E2E validation.

   Validation commands:
   - `bash scripts/check-dev-prereqs.sh`
   - `git submodule status --recursive`
   - `pnpm --version`
   - `rustc --version`

3. Normalize stale validation helpers to pnpm and current workflows.

   Files to inspect or change: `.github/workflows/build-windows.yml`, `scripts/test-ci-local.sh`, `scripts/worktree-bootstrap.sh`, `app/scripts/e2e-run-all-flows.sh`, `app/scripts/e2e-run-spec.sh`.

   Acceptance criteria:
   - No active validation workflow uses Yarn unless intentionally supported and documented.
   - `scripts/test-ci-local.sh` targets an existing workflow or is removed/replaced.
   - `.github/workflows/build-windows.yml` no longer references undefined `steps.core-paths`.
   - E2E scripts stop printing Yarn repair advice when pnpm is the package manager.

   Validation commands:
   - `rg --fixed-strings "yarn" app/scripts scripts .github/workflows docs`
   - `rg --fixed-strings "package-and-publish.yml" .`
   - `actionlint .github/workflows/build-windows.yml` if `actionlint` is available

4. Create a documented validation ladder for change types.

   Files to inspect or change: `docs/TESTING-STRATEGY.md`, `docs/agent-workflows/codex-pr-checklist.md`, `scripts/debug/README.md`.

   Acceptance criteria:
   - The docs distinguish cheap proof commands, focused commands, merge-gate commands, and isolated-runner E2E commands.
   - Each ladder entry states expected prerequisites and known side effects.
   - The docs explicitly state that `app/scripts/e2e-run-spec.sh` touches `~/.openhuman` and local app cache paths.

   Validation commands:
   - `node scripts/check-coverage-matrix.mjs`
   - `pnpm --filter openhuman-app format:check` after dependency install

## Non-goals

- No product code changes.
- No dependency installation.
- No submodule initialization.
- No test suite, Tauri build, E2E driver, Docker build, release build, deploy, external service call, PR, push, or tracker update.
- No attempt to prove current CI status beyond local file evidence.

## Unknowns

- Whether `pnpm install --frozen-lockfile` succeeds in this environment with network restricted.
- Whether Rust core tests pass after dependency/cache availability is confirmed.
- Whether the vendored CEF submodules are healthy at their pinned commits once initialized.
- Whether CI currently has additional branch protection beyond the workflow files inspected locally.
- Whether the commented E2E jobs in `.github/workflows/test.yml` are intentionally superseded by another runner not visible from local workflow files.

