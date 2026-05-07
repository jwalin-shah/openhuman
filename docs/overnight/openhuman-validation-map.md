# OpenHuman Validation Map Audit

Queue item: `openhuman-validation-map`  
Repo: `openhuman`  
Branch: `codex/goal-openhuman-validation-map`  
Audit date: 2026-05-07  
Auditor scope: read-only validation-map audit, with this report as the only repo write.

## Summary

OpenHuman is a React + Tauri desktop app backed by a Rust core crate. The
current validation surface is broad: TypeScript compile/lint/format, Vitest
unit coverage, Rust core tests, Tauri shell tests, cargo formatting/clippy,
diff coverage via merged lcov, installer smoke tests, release build matrices,
and manually invoked E2E flows.

The strongest cheap signal in this worktree is that the source tree is present
and the coverage matrix parser passes, but most build/test commands are blocked
locally because dependencies and submodules are not installed. The sharpest
validation bug found during the audit is that `app/scripts/e2e-build.sh` calls a
missing `scripts/stage-core-sidecar.mjs` script even though the current app
package and CI comments say the core is now linked in-process and sidecar
staging is no longer needed.

## Repo State

- Purpose: OpenHuman desktop product: `AGENTS.md:1-5` describes a React + Tauri
  v2 app with Rust core JSON-RPC/CLI logic and QuickJS skills.
- Current branch: `codex/goal-openhuman-validation-map`.
- Current HEAD at audit start: `f11f217809841cf8e3a7f694d8e80967d8e188b8`
  (`f11f2178`, "Fix shell injection vulnerability in browser screenshot tool").
- Initial dirty state: `git status --short --branch` returned only
  `## codex/goal-openhuman-validation-map`, so the branch was clean before this
  report.
- Remotes observed: `origin` and `jwalin-ssh` point to
  `jwalin-shah/openhuman`; `upstream` points to `tinyhumansai/openhuman`.
- Local Node/Rust tooling exists: `node --version` -> `v25.9.0`,
  `pnpm --version` -> `10.10.0`, `rustc --version` ->
  `rustc 1.93.0 (254b59607 2026-01-19)`, `cargo --version` ->
  `cargo 1.93.0 (083ac5135 2025-12-15)`.
- Local dependencies are not installed: `test -d node_modules` returned
  `root-node_modules-missing`; `test -d app/node_modules` returned
  `app-node_modules-missing`.
- Local Tauri submodules are not initialized: `git submodule status --recursive`
  printed leading `-` entries for `app/src-tauri/vendor/tauri-cef` and
  `app/src-tauri/vendor/tauri-plugin-notification`.
- `docs/overnight/` did not exist before this report.

## Evidence Map

### Declared command surfaces

- Root `package.json:8-32` delegates app commands through the `openhuman-app`
  workspace: `build`, `compile`, `dev`, `format`, `lint`, `test`,
  `test:coverage`, `test:rust`, `rust:check`, and `typecheck`.
- `pnpm-workspace.yaml:1-2` includes only the `app` workspace. This means
  `packages/npm` and `remotion` are not covered by root `pnpm --filter`
  validation.
- `app/package.json:30-57` declares the main local validation scripts:
  `test`, `test:unit`, `test:coverage`, `test:rust`, E2E commands,
  `rust:check`, `rust:format:check`, `rust:clippy`, `format:check`,
  `lint`, `lint:fix`, `lint:commands-tokens`, and `knip`.
- `app/package.json:14` says `core:stage` is a no-op because the core is linked
  in-process and the sidecar was removed in PR #1061.
- `app/package.json:5-6` requires Node `>=24.0.0`; the local Node 25.9.0
  satisfies this, while CI mostly uses Node 24.
- `Cargo.toml` declares the root Rust package `openhuman` version `0.53.16`
  with bin `openhuman-core` and library `openhuman_core`.
- `app/src-tauri/Cargo.toml` declares the Tauri package `OpenHuman` and depends
  on `openhuman_core = { path = "../..", package = "openhuman" }`, so the core
  is linked into the shell.
- `rust-toolchain.toml` pins Rust `1.93.0` with `rustfmt` and `clippy`.

### Test and coverage contracts

- `docs/TESTING-STRATEGY.md:7-15` defines five layers: Rust unit, Rust
  integration, Vitest unit, WDIO E2E, and manual smoke.
- `docs/TESTING-STRATEGY.md:39-47` requires at least one failure or edge-case
  assertion for every feature leaf.
- `docs/TESTING-STRATEGY.md:51-56` bans real network calls in unit,
  integration, and E2E tests; the shared mock backend is the required test
  surface.
- `docs/TESTING-STRATEGY.md:91-117` lists pre-merge gate candidates:
  `cargo fmt --check`, `cargo check --manifest-path Cargo.toml`,
  `cargo clippy --manifest-path Cargo.toml -- -D warnings`,
  `cargo test --manifest-path Cargo.toml`,
  `cargo check --manifest-path app/src-tauri/Cargo.toml`, `pnpm typecheck`,
  `pnpm lint`, `pnpm format:check`, `pnpm test:unit`, `pnpm test:rust`, and
  targeted E2E build/spec commands.
- `AGENTS.md:110-112` states the changed-lines coverage gate is `>= 80%` and
  is enforced by `.github/workflows/coverage.yml` across Vitest and
  `cargo-llvm-cov`.
- `.github/workflows/coverage.yml:21-61` runs frontend Vitest coverage and
  normalizes lcov paths from `src/` to `app/src/`.
- `.github/workflows/coverage.yml:63-94` runs root Rust core coverage via
  `cargo llvm-cov -p openhuman`.
- `.github/workflows/coverage.yml:96-134` runs Tauri shell coverage via
  `cargo llvm-cov --manifest-path app/src-tauri/Cargo.toml`.
- `.github/workflows/coverage.yml:136-170` gates PR changed-line coverage
  using `diff-cover` over all lcov artifacts.
- `app/test/vitest.config.ts:29-65` configures Vitest with jsdom, one worker,
  shared setup, `src/**/*.test.{ts,tsx}` and `test/*.test.{ts,tsx}` includes,
  and V8 lcov coverage.
- `app/src/test/setup.ts` starts the shared mock server on port `5005` and
  mocks Tauri APIs, config, Sentry, redux-persist, and backend URL access.
- `scripts/test-rust-with-mock.sh:27-49` starts `scripts/mock-api-server.mjs`,
  waits on `/__admin/health`, exports `BACKEND_URL` and `VITE_BACKEND_URL`,
  then runs `cargo test --manifest-path Cargo.toml --workspace "$@"`.
- `app/test/wdio.conf.ts:21-55` resolves built app paths for macOS, Linux, and
  Windows; `app/test/wdio.conf.ts:57-83` chooses tauri-driver on Linux and
  Appium Mac2 elsewhere.
- `app/test/wdio.conf.ts:108-120` captures failure artifacts after failed WDIO
  tests.
- `app/scripts/e2e-run-spec.sh:27-39` creates an isolated
  `OPENHUMAN_WORKSPACE` per run and supports a service mock state file.
- `app/scripts/e2e-run-spec.sh:72-82` deletes user app cache/config paths
  before E2E, and `app/scripts/e2e-run-spec.sh:84-106` writes a temporary
  `~/.openhuman/config.toml` pointing at the mock API.
- `app/scripts/e2e-run-spec.sh:108-123` requires a prebuilt
  `dist/assets/index-*.js` bundle containing the mock server URL.

### CI workflow map

- `.github/workflows/test.yml:23-52` runs frontend unit tests with coverage in
  the `openhuman_ci:rust-1.93.0` container after `pnpm install --frozen-lockfile`.
- `.github/workflows/test.yml:54-87` runs `cargo test -p openhuman` for the root
  Rust core, with submodules checked out.
- `.github/workflows/test.yml:88-131` runs
  `cargo test --manifest-path app/src-tauri/Cargo.toml` for the Tauri shell and
  caches the CEF distribution.
- `.github/workflows/test.yml:133-237` contains a fully commented-out Linux
  E2E job. The commented job still references Yarn and explicit sidecar
  staging, both stale relative to current app scripts.
- `.github/workflows/e2e-agent-review.yml:3-8` explicitly says Linux E2E via
  tauri-driver is disabled because the app uses CEF and tauri-driver cannot
  drive a CEF-backed webview.
- `.github/workflows/e2e-agent-review.yml:89-92` still invokes
  `pnpm --filter openhuman-app test:e2e:build`, then comments that no sidecar
  staging is needed. That conflicts with the current E2E build script.
- `.github/workflows/typecheck.yml:15-45` runs TypeScript compile, Prettier, and
  ESLint after `pnpm install --frozen-lockfile`.
- `.github/workflows/typecheck.yml:46-65` runs `cargo fmt --all -- --check` and
  `cargo clippy -p openhuman`.
- `.github/workflows/build.yml:17-75` builds the Tauri app in the CI image,
  initializes submodules, caches CEF, installs dependencies with pnpm, and
  runs `cargo tauri build`.
- `.github/workflows/build.yml:60-61` says no sidecar build/stage step is needed.
- `.github/workflows/build-windows.yml:24-30` uses Node 24 but sets
  `cache: yarn`; `.github/workflows/build-windows.yml:69-70` runs
  `yarn install --frozen-lockfile`, even though no `yarn.lock` is present.
- `.github/workflows/build-windows.yml:119-124` uploads a `windows-cli`
  artifact from `steps.core-paths.outputs.*`, but this workflow has no
  `core-paths` step. This looks like a stale workflow fragment.
- `.github/workflows/pr-quality.yml` is explicitly soft:
  `checklist-guard`, `coverage-matrix`, and `markdown-link-check` use
  `continue-on-error: true`.
- `.github/workflows/installer-smoke.yml` dry-runs the Unix installer and runs
  Windows PowerShell installer tests plus a dry run.
- `.github/workflows/release-packages.yml` is manually dispatched and says it
  is disabled while core distribution is Docker-only, but its jobs still target
  standalone CLI, Homebrew, apt, npm, and package-manager smoke paths.

### Local command observations

- `llm-tldr tree .` was started for structure discovery and eventually returned
  a very large JSON tree after the targeted audit had enough evidence, so this
  report relies on `rg --files`, `rtk read`, and focused `nl -ba` reads as the
  primary cited evidence.
- `rg --files ...` found core repo validation files including `package.json`,
  `app/package.json`, root `Cargo.toml`, `app/src-tauri/Cargo.toml`,
  `.github/workflows/*`, `docs/TESTING-STRATEGY.md`,
  `docs/E2E-TESTING.md`, `docs/TEST-COVERAGE-MATRIX.md`, and debug wrappers.
- `rg --files app/src app/test src tests | rg '(\.test\.(ts|tsx)$|... )'`
  found a large mixed test surface. Focused counts found 162 app
  `*.test.ts(x)` files and 41 WDIO E2E spec files under
  `app/test/e2e/specs`.
- `rg --files src tests ... | wc -l` returned `974`; this is an approximate
  Rust-related source/test file count, not a cargo test count.
- `node scripts/check-coverage-matrix.mjs` passed:
  `Matrix: 138 rows, 138 catalog IDs, 0 parse errors, 0 missing, 0 duplicates`.
- `cargo metadata --manifest-path Cargo.toml --no-deps` passed and showed the
  root package metadata, including `openhuman-core` and test targets.
- `cargo metadata --manifest-path app/src-tauri/Cargo.toml --no-deps` passed
  and showed path dependencies on the root core crate plus missing local vendor
  paths. It does not prove Tauri compilation because `--no-deps` avoids
  building or resolving the vendored code on disk.
- `pnpm --filter openhuman-app compile` failed immediately:
  `sh: tsc: command not found` and `spawn ENOENT`.
- `pnpm --filter openhuman-app format:check` failed immediately:
  `sh: prettier: command not found` plus the pnpm warning that local
  `package.json` exists but `node_modules` is missing.
- `bash scripts/ensure-tauri-cli.sh` failed immediately because
  `app/src-tauri/vendor/tauri-cef/crates/tauri-cli/Cargo.toml` is missing,
  and suggested `git submodule update --init --recursive`.
- `bash app/scripts/e2e-build.sh` failed immediately after env setup because
  Node could not find `scripts/stage-core-sidecar.mjs`.
- `rg --files scripts app/scripts | rg 'stage|sidecar|core'` returned only
  `scripts/mock-api-core.mjs` and `scripts/release/render-homebrew-core-formula.sh`,
  confirming no stage-core-sidecar script exists in this worktree.
- `git ls-files app/src-tauri/vendor/tauri-cef | wc -l` and the same command
  for `tauri-plugin-notification` each returned `1`, consistent with gitlink
  entries rather than checked-out submodule contents.

## Risks And Stale Assumptions

1. E2E build is currently broken at script entry.
   `app/scripts/e2e-build.sh:39-40` calls missing
   `scripts/stage-core-sidecar.mjs`. This conflicts with `app/package.json:14`,
   `.github/workflows/build.yml:60-61`, and
   `.github/workflows/e2e-agent-review.yml:92`, which all say the core is
   linked in-process and no sidecar staging is needed. Any local or CI path
   that uses `pnpm --filter openhuman-app test:e2e:build` will fail before
   reaching the actual Tauri build.

2. The docs and agent instructions still mix the old sidecar model with the
   in-process core model. `AGENTS.md:16`, `AGENTS.md:29`, `AGENTS.md:56-57`,
   `AGENTS.md:526`, and `docs/src-tauri/README.md` still describe sidecar
   staging. Current implementation in `app/src-tauri/src/core_process.rs`
   says the core runs as an in-process Tokio task. This makes validation
   handoffs ambiguous: agents can waste time staging binaries that no longer
   exist, or skip the actual Tauri path dependency checks.

3. Local validation is not reproducible from a fresh worktree without setup.
   `node_modules` is missing and both Tauri vendor submodules are uninitialized.
   This blocks TypeScript, Prettier, ESLint, Vitest, and Tauri compile checks
   in the current worktree. The repo does document submodule setup in
   `scripts/ensure-tauri-cli.sh`, but the command fails until submodules are
   initialized.

4. Linux E2E is both present and disabled, with contradictory reasons across
   files. `docs/E2E-TESTING.md` presents Linux tauri-driver as the default CI
   path, while `.github/workflows/e2e-agent-review.yml:3-8` states Linux
   tauri-driver cannot drive the CEF runtime and is disabled. `test.yml` keeps
   an old Linux E2E job commented out. Morning review should treat WDIO specs
   as available source coverage but not as currently enforced Linux CI coverage.

5. The root pre-push hook mutates the tree. `.husky/pre-push:54-75` runs
   `pnpm format` or `pnpm lint:fix` after failed checks, then exits using the
   original failure codes. That can surprise automation by leaving formatting
   changes in the worktree during a push attempt. It is useful locally, but it
   is not a pure validation command.

6. Windows validation workflow appears stale. `.github/workflows/build-windows.yml`
   uses Yarn despite pnpm-only lockfiles and tries to upload a `windows-cli`
   artifact from missing `steps.core-paths` outputs. This is manual-dispatch or
   `fix/windows` branch only, but it should not be considered healthy evidence
   for Windows release readiness.

7. The coverage matrix parser passes, but the matrix summary text appears
   stale relative to parser output. The file summary says `129 explicit +
   nested = 200 product features`, while the parser reports 138 catalog IDs and
   138 parsed rows. This is documentation drift, not a parser failure.

8. `remotion/` and `packages/npm/` are local repo directories with their own
   packages, but only `app` is in `pnpm-workspace.yaml`. Root validation does
   not cover Remotion lint/render scripts or the npm package postinstall path.
   That may be intentional, but it should be explicit in a validation map.

## Validation Command Candidates

These are ordered from cheap proof to heavier environment-gated checks.

| Command | Scope | Expected in this worktree | Notes |
| --- | --- | --- | --- |
| `git status --short` | Queue validation | Pass | Required by this queue item. After this report, it should show only `docs/overnight/openhuman-validation-map.md` as a repo write. |
| `node scripts/check-coverage-matrix.mjs` | Coverage matrix parser | Pass | Already passed: 138 rows, 138 catalog IDs, 0 parse/missing/duplicate errors. |
| `cargo metadata --manifest-path Cargo.toml --no-deps` | Root Rust manifest shape | Pass | Already passed without compiling dependencies. |
| `cargo metadata --manifest-path app/src-tauri/Cargo.toml --no-deps` | Tauri manifest shape | Pass but weak | Already passed; it does not prove missing submodule path deps can build. |
| `pnpm --filter openhuman-app compile` | TypeScript typecheck | Fail until deps installed | Already failed: `tsc: command not found` because `app/node_modules` is missing. |
| `pnpm --filter openhuman-app format:check` | Prettier + Rust format | Fail until deps installed | Already failed: `prettier: command not found` because `app/node_modules` is missing. |
| `bash scripts/ensure-tauri-cli.sh` | Vendored CEF CLI setup | Fail until submodules initialized | Already failed: vendored `tauri-cli` not found. |
| `bash app/scripts/e2e-build.sh` | E2E app build | Fail in current source | Already failed: missing `scripts/stage-core-sidecar.mjs`. This is a source-level stale script issue, not only local setup. |
| `pnpm install --frozen-lockfile` | JS dependency install | Not run | Out of scope because it mutates generated dependency state and may need network. Required before TypeScript/Vitest/lint locally. |
| `git submodule update --init --recursive` | Tauri vendor setup | Not run | Out of scope for this read-only audit; required before Tauri compile/build locally. |
| `pnpm test:unit` | App Vitest suite | Blocked locally | Requires `pnpm install`; uses jsdom, one worker, shared mock backend. |
| `pnpm test:coverage` | Frontend lcov | Blocked locally | Requires `pnpm install`; CI normalizes lcov paths in coverage workflow. |
| `pnpm test:rust` | Root Rust integration with mock backend | Not run | Potentially long; starts mock backend and runs cargo workspace tests. |
| `cargo test -p openhuman` | Root Rust tests | Not run | Potentially long; CI command. |
| `cargo test --manifest-path app/src-tauri/Cargo.toml` | Tauri shell tests | Blocked until submodules and CEF deps exist | CI checks out submodules and caches CEF. |
| `pnpm --filter openhuman-app test:e2e:build` | E2E build | Fail | Same missing `stage-core-sidecar.mjs` blocker. |
| `bash app/scripts/e2e-run-spec.sh test/e2e/specs/smoke.spec.ts smoke` | Single WDIO flow | Blocked | Needs successful E2E build, app bundle, driver, and mock URL baked into dist bundle. |

## Next Safe Work

### Task 1: Repair the E2E build script for in-process core

Acceptance criteria:

- `app/scripts/e2e-build.sh` no longer calls missing
  `scripts/stage-core-sidecar.mjs`.
- Comments in `app/scripts/e2e-build.sh` align with in-process core behavior.
- `pnpm --filter openhuman-app test:e2e:build` reaches the Tauri build step in
  a dependency-ready environment rather than failing on a missing Node module.
- No product behavior changes.

Validation:

- `bash app/scripts/e2e-build.sh` in an environment with `node_modules` and
  Tauri submodules initialized.
- `rg -n "stage-core-sidecar|externalBin|core:stage" app/scripts docs AGENTS.md`
  to confirm no stale E2E build path remains.

### Task 2: Align validation docs around CEF and E2E reality

Acceptance criteria:

- `docs/E2E-TESTING.md`, `AGENTS.md`, and `docs/src-tauri/README.md` agree on
  whether Linux tauri-driver is supported for CEF-backed webviews.
- Old sidecar staging instructions are either removed or clearly scoped to
  standalone CLI/debug harnesses.
- The docs name the current cheap E2E path: build requirements, driver
  requirements, known disabled CI status, and expected blockers.

Validation:

- `rg -n "tauri-driver|CEF|sidecar|core:stage|stage-core-sidecar|externalBin" docs AGENTS.md app/scripts .github/workflows`
- `node scripts/check-coverage-matrix.mjs`
- `pnpm --filter openhuman-app format:check` after dependency setup.

### Task 3: Add a preflight validation script for local agents

Acceptance criteria:

- A script such as `scripts/validate-preflight.sh` checks Node, pnpm, Rust,
  `node_modules`, Tauri submodule initialization, vendored `tauri-cli`, and
  required lockfiles without mutating the tree.
- The script prints exact next commands for missing setup, without running
  installs or submodule updates itself.
- Codex PR checklist and agent docs point to the script before heavier gates.

Validation:

- Run preflight in this current incomplete worktree and confirm it reports:
  missing `node_modules`, missing Tauri submodules, and runnable tool versions.
- Run preflight in a fully initialized worktree and confirm it exits 0.
- `shellcheck scripts/validate-preflight.sh` if shellcheck is available.

### Task 4: Fix or retire stale Windows build workflow outputs

Acceptance criteria:

- `.github/workflows/build-windows.yml` uses pnpm consistently or adds a
  committed Yarn lockfile if Yarn is genuinely intended.
- The `windows-cli` upload either has a real producing step or is removed.
- The workflow declares whether standalone CLI artifacts are still supported.

Validation:

- `act` or GitHub Actions manual dispatch in a safe branch, if available.
- Static check: `rg -n "yarn|core-paths|windows-cli" .github/workflows/build-windows.yml`
- `pnpm --filter openhuman-app format:check` after dependency setup.

### Task 5: Make workspace coverage explicit for non-app packages

Acceptance criteria:

- Decide whether `remotion/` and `packages/npm/` are intentionally outside root
  validation.
- If intentionally excluded, document that in the validation docs.
- If included, add workspace entries or dedicated CI/scripts that validate
  Remotion lint/render and npm package install behavior.

Validation:

- `pnpm -r list --depth -1` should show the intended workspace set.
- If Remotion is included: `pnpm --dir remotion lint`.
- If npm package is included: a dry-run package/install smoke that does not
  publish or hit external package registries.

## Non-Goals

- No product code changes.
- No dependency installation.
- No submodule initialization.
- No generated coverage, build, or target artifacts.
- No external service calls, deploys, pushes, PRs, or tracker mutations.
- No attempt to merge, close, or mark anything Done.
- No broad docs cleanup outside this single validation report.

## Unknowns

- Whether a fully initialized local worktree with `pnpm install` and
  submodules would pass TypeScript, lint, Vitest, Rust, or Tauri checks.
- Whether the CI image currently masks local setup issues by preinstalling the
  vendored CEF-aware `cargo-tauri`.
- Whether Linux CEF E2E is intentionally disabled forever or waiting on a new
  ChromeDriver-compatible harness.
- Whether `remotion/` is production-owned or an auxiliary asset workspace that
  should remain outside root validation.
- Whether standalone `openhuman-core` packaging is intentionally Docker-only or
  still expected by some install docs and release scripts.

## Commands Run

- `llm-tldr tree .` (returned a very large JSON tree after targeted audit moved
  on; not used as primary cited evidence).
- `git status --short --branch`
- `git rev-parse HEAD`
- `git branch --show-current`
- `pwd`
- `rg --files ...` for package, Cargo, docs, and workflow discovery.
- `rtk read package.json`
- `rtk read app/package.json`
- `rtk read Cargo.toml`
- `rtk read app/src-tauri/Cargo.toml`
- `rtk read docs/agent-workflows/codex-pr-checklist.md`
- `rtk read docs/TESTING-STRATEGY.md`
- `rtk read docs/E2E-TESTING.md`
- `rtk read scripts/debug/README.md`
- `rtk read scripts/test-rust-with-mock.sh`
- `rtk read app/scripts/e2e-run-spec.sh`
- `rtk read app/scripts/e2e-build.sh`
- `rtk read .github/workflows/coverage.yml`
- `rtk read .github/workflows/pr-quality.yml`
- `rtk read .github/workflows/test.yml`
- `rtk read .github/workflows/typecheck.yml`
- `rtk read .github/workflows/build.yml`
- `rtk read .github/workflows/build-desktop.yml`
- `rtk read .github/workflows/installer-smoke.yml`
- `rtk read .github/workflows/e2e-agent-review.yml`
- `rtk read .github/Dockerfile`
- `rtk read rust-toolchain.toml`
- `rtk read app/test/vitest.config.ts`
- `rtk read app/test/wdio.conf.ts`
- `rg --files app/src app/test src tests ...` for test inventory.
- `rg --files app/test/e2e/specs | wc -l`
- `rg --files app/src | rg '\.test\.(ts|tsx)$' | wc -l`
- `rg -n "test:e2e|tauri-driver|CEF|sidecar|..." docs .github scripts app/package.json package.json AGENTS.md`
- `rg -n "stage-core-sidecar|externalBin|openhuman-core|core:stage|..." app scripts src .github docs AGENTS.md Cargo.toml`
- `rtk read app/scripts/e2e-run-all-flows.sh`
- `rtk read scripts/debug/cli.sh`
- `rtk read scripts/debug/unit.sh`
- `rtk read scripts/debug/rust.sh`
- `rtk read scripts/debug/e2e.sh`
- `rtk read .husky/pre-push`
- `rtk read scripts/check-coverage-matrix.mjs`
- `rtk read scripts/check-pr-checklist.mjs`
- `rtk read docs/TEST-COVERAGE-MATRIX.md`
- `rtk read scripts/lib/coverage-matrix-parser.mjs`
- `node --version`
- `pnpm --version`
- `rustc --version`
- `cargo --version`
- `git submodule status --recursive`
- `test -d node_modules`
- `test -d app/node_modules`
- `test -d app/src-tauri/vendor/tauri-cef/crates/tauri-cli`
- `node scripts/check-coverage-matrix.mjs`
- `git ls-files app/src-tauri/vendor/tauri-cef | wc -l`
- `git ls-files app/src-tauri/vendor/tauri-plugin-notification | wc -l`
- `rg -n "node_modules|vendor/tauri-cef|..." .gitignore .dockerignore app/.gitignore`
- `rtk read app/src-tauri/tauri.conf.json`
- `rtk read scripts/stage-core-sidecar.mjs` (failed: missing file)
- `rtk read scripts/ensure-tauri-cli.sh`
- `rtk read app/src-tauri/src/core_process.rs`
- `rg --files scripts app/scripts | rg 'stage|sidecar|core'`
- `bash app/scripts/e2e-build.sh` (failed: missing stage-core-sidecar script)
- `pnpm --filter openhuman-app compile` (failed: missing `tsc`)
- `cargo metadata --manifest-path Cargo.toml --no-deps`
- `cargo metadata --manifest-path app/src-tauri/Cargo.toml --no-deps`
- `pnpm --filter openhuman-app format:check` (failed: missing `prettier`)
- `bash scripts/ensure-tauri-cli.sh` (failed: missing vendored submodule)
- `rtk read app/src/test/setup.ts`
- `rtk read app/test/e2e/mock-server.ts`
- `rtk read app/test/e2e/helpers/core-rpc.ts`
- `rtk read scripts/mock-api-core.mjs`
- `rtk read packages/npm/package.json`
- `rtk read remotion/package.json`
- `rtk read pnpm-workspace.yaml`
- `rtk read .github/workflows/release-packages.yml`
- `rtk read .github/workflows/docker-ci-image.yml`
- `rtk read .github/workflows/build-windows.yml`
- `rtk read .github/workflows/release-production.yml`
- `rg --files -g 'yarn.lock' -g 'package-lock.json' -g 'pnpm-lock.yaml'`
- `nl -ba ...` focused line-number reads for cited files.

## Handoff

- Files changed by this queue item: `docs/overnight/openhuman-validation-map.md`.
- Product code changed: none.
- Commit created: none.
- Current HEAD SHA: `f11f217809841cf8e3a7f694d8e80967d8e188b8`.
- PR created: none, per Goal Pack scope.
- Required validation command: `git status --short`.
- Expected validation result after writing this report: the command should run
  successfully and show this report as the only worktree change.
- Blockers: local JS dependencies are missing, Tauri submodules are not
  initialized, and `app/scripts/e2e-build.sh` references a missing
  `scripts/stage-core-sidecar.mjs` file.
