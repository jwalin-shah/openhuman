# OpenHuman risk and validation review

Queue item: `openhuman-risk-and-validation-review`  
Branch: `codex/goal-openhuman-risk-and-validation-review`  
Reviewed HEAD: `f11f217809841cf8e3a7f694d8e80967d8e188b8`  
Review date: 2026-05-07

2026-05-07 reconciliation note: the sidecar/E2E-build findings in this report
were captured before OpenHuman PR #34 was merged. PR #34 is now merged as
`d3a9bb848c73572e51fbf4a4be7fb1b0ea384a1e`; do not treat the pre-#34
`scripts/stage-core-sidecar.mjs` and sidecar-doc findings below as fresh
blockers unless they still reproduce on current `main`.

## Scope and local state

- This pass is read-only queue prep except for this report.
- Product code was not edited.
- No previous `docs/overnight/2026-05-07-whole-portfolio-review/` report existed in this checkout before this file was created.
- No `runs/*/result.json` or `runs/*/handoff.md` files were present in this repo checkout.
- Initial `git status --short` was clean.
- `git submodule status` shows `app/src-tauri/vendor/tauri-cef` and `app/src-tauri/vendor/tauri-plugin-notification` with leading `-`, meaning the local worktree has not initialized those vendored submodules. Several Tauri build/check paths require them.

## Commands run

```bash
git status --short
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
llm-tldr tree .
rg --files --hidden -g '.github/**'
rg --files -g 'docs/overnight/**'
rg --files -g 'runs/**'
rg --files -g 'scripts/**'
rg --files -g '*test*' -g '*spec*'
git submodule status
node scripts/check-coverage-matrix.mjs
pnpm --filter openhuman-app test:e2e:build
```

Results:

- `node scripts/check-coverage-matrix.mjs` passed: `Matrix: 138 rows, 138 catalog IDs, 0 parse errors, 0 missing, 0 duplicates`.
- `pnpm --filter openhuman-app test:e2e:build` failed before building because `app/scripts/e2e-build.sh` calls missing `scripts/stage-core-sidecar.mjs`.
- Required queue validation command: `git status --short`.

## Concrete observations

1. `app/scripts/e2e-build.sh` still runs `node "$REPO_ROOT/scripts/stage-core-sidecar.mjs"`, but `scripts/stage-core-sidecar.mjs` is not present. The local E2E build command fails immediately with `MODULE_NOT_FOUND`.
2. `app/package.json` says `core:stage` is a no-op because the core is linked in-process since PR #1061, which conflicts with `app/scripts/e2e-build.sh` and older docs that still require sidecar staging.
3. `.github/workflows/test.yml` has the Linux and macOS E2E jobs commented out, while `docs/E2E-TESTING.md` still says the Linux `e2e-linux` job runs by default on every push/PR.
4. `.github/workflows/e2e-agent-review.yml` documents why Linux E2E is disabled for CEF-backed WebViews, but it still contains a manual workflow that attempts `pnpm --filter openhuman-app test:e2e:build`, which currently hits the missing sidecar-staging script.
5. `docs/TEST-COVERAGE-MATRIX.md` lists 27 missing and 27 partial feature leaves, with important user-facing gaps around auth/session revocation, permission resync, settings developer tools, cache/app reset, local AI RAM persistence, and integration permission resync.
6. `.github/workflows/pr-quality.yml` sets `continue-on-error: true` on checklist, coverage-matrix, and markdown-link jobs. These are useful signals but not merge blockers.
7. `.github/workflows/coverage.yml` is a hard changed-line coverage gate with Vitest, core Rust `cargo-llvm-cov`, Tauri Rust `cargo-llvm-cov`, and `diff-cover --fail-under=80`.
8. `scripts/check-coverage-matrix.mjs` validates that `docs/TEST-COVERAGE-MATRIX.md` matches `scripts/feature-ids.json`, and the current checkout passes that structural check.
9. `docs/TESTING-STRATEGY.md` requires no real network in unit/integration/E2E and says missing failure-path tests are incomplete. The matrix still has many rows whose notes say "assertion shallow", "thin", or `_missing_`.
10. `scripts/test-rust-with-mock.sh` gives Rust tests a deterministic mock backend, but it runs `cargo test --manifest-path Cargo.toml --workspace`, so local execution depends on the vendored Tauri submodules being initialized if workspace tests traverse the Tauri crate.
11. `app/test/e2e/specs/telegram-flow.spec.ts` and `app/test/e2e/specs/local-model-runtime.spec.ts` use `describe.skip`, yet `app/scripts/e2e-run-all-flows.sh` still includes both specs in its all-flows list. That can make an all-flows run look broader than it is.
12. `app/test/e2e/specs/conversations-web-channel-flow.spec.ts` skips the suite on Linux, matching the CEF automation limitation but leaving an important conversation flow outside the default Linux automation path.
13. `docs/src-tauri/README.md`, `docs/BUILDING.md`, and parts of `docs/ARCHITECTURE.md` still describe the desktop host as staging/spawning an `openhuman` sidecar from `scripts/stage-core-sidecar.mjs`, while `app/src-tauri/Cargo.toml` and CI comments say the core is now linked in-process.
14. `.github/workflows/build-windows.yml` uses Yarn despite the root `package.json` declaring pnpm and no `yarn.lock` existing in this checkout. It also uploads a standalone CLI artifact from `steps.core-paths.outputs.*`, but no `core-paths` step is defined in that workflow.
15. `docs/AUTO_UPDATE.md` points at `.github/workflows/release.yml`, but the repo has `release-production.yml`, `release-staging.yml`, `release-packages.yml`, and reusable `build-desktop.yml` instead.
16. `.github/workflows/build.yml` and `.github/workflows/build-desktop.yml` correctly state that the core is linked into the Tauri binary as a path dependency and no sidecar staging is needed, so CI has newer truth than several local docs and E2E scripts.

## Risk assessment

- High: E2E build is currently not executable from the documented command because of the removed `scripts/stage-core-sidecar.mjs` call. Any implementation task that asks for desktop E2E validation will block before test execution.
- High: Default PR CI does not exercise CEF-backed E2E flows. The repo has many WDIO specs, but Linux CEF automation is disabled and macOS E2E is not a default PR gate.
- High: Windows build workflow appears stale: mixed package manager usage and undefined `core-paths` outputs can break manual Windows artifact generation or hide stale CLI expectations.
- Medium: Coverage process has two layers that can diverge. The hard `coverage.yml` gate enforces changed-line coverage, but `pr-quality.yml` coverage-matrix/checklist enforcement is soft.
- Medium: Test coverage matrix is structurally valid, but it records significant product risk: 54 partial or missing feature leaves out of the documented matrix.
- Medium: Documentation still mixes old sidecar architecture with in-process core. That increases risk for future agents choosing the wrong validation command or debugging the wrong runtime model.
- Medium: Local worktree submodules are uninitialized. Tauri shell checks/builds may fail locally even when code is otherwise valid unless workers run `git submodule update --init --recursive` first.
- Low: No prior overnight report or runner output existed locally, so this review cannot compare trend or regression history from earlier goal-pack artifacts.

## Blockers and caveats

- `pnpm --filter openhuman-app test:e2e:build` is blocked by missing `scripts/stage-core-sidecar.mjs`.
- Full Tauri build/test validation was not attempted because this review is queue prep and the local vendored submodules are uninitialized.
- No external PRs, tracker updates, deploys, pushes, or service calls were made.

## Implementation-ready follow-up tasks

### 1. Fix the E2E build script after in-process core migration

Owned files:

- `app/scripts/e2e-build.sh`
- `app/package.json`
- `docs/E2E-TESTING.md`
- `docs/src-tauri/README.md`

Acceptance criteria:

- `pnpm --filter openhuman-app test:e2e:build` no longer references `scripts/stage-core-sidecar.mjs`.
- Docs describe the current in-process core model and any remaining standalone `openhuman-core run` harness separately.
- The script still bakes `VITE_BACKEND_URL=http://127.0.0.1:${E2E_MOCK_PORT:-18473}` into the frontend bundle.

Smallest useful validation:

```bash
pnpm --filter openhuman-app test:e2e:build
```

If build time is too high, first smoke:

```bash
bash app/scripts/e2e-build.sh
```

### 2. Reconcile E2E documentation with the CEF automation reality

Owned files:

- `docs/E2E-TESTING.md`
- `docs/TESTING-STRATEGY.md`
- `.github/workflows/test.yml`
- `.github/workflows/e2e-agent-review.yml`
- `app/scripts/e2e-run-all-flows.sh`

Acceptance criteria:

- Docs no longer claim Linux E2E is a default PR path while the workflow is commented out.
- The CEF limitation is documented in the main E2E guide, not only in the disabled workflow comments.
- `e2e-run-all-flows.sh` either excludes fully skipped specs or labels them as intentionally skipped.
- Each feature relying on disabled/skipped E2E has an explicit fallback validation path or matrix status.

Smallest useful validation:

```bash
rg -n "e2e-linux|tauri-driver|describe.skip|test:e2e:build|stage-core-sidecar" docs .github app/scripts app/test/e2e/specs
```

### 3. Repair the Windows build workflow stale CLI/package-manager path

Owned files:

- `.github/workflows/build-windows.yml`
- `package.json`
- `pnpm-workspace.yaml`
- `.github/workflows/build-desktop.yml`

Acceptance criteria:

- `build-windows.yml` uses pnpm consistently or checks in/justifies Yarn lock usage.
- The standalone CLI upload step is removed, made conditional on a real `core-paths` step, or wired the same way as reusable `build-desktop.yml`.
- Workflow comments match the current in-process core model.

Smallest useful validation:

```bash
rg -n "yarn|core-paths|Upload standalone CLI|build_sidecar" .github/workflows/build-windows.yml .github/workflows/build-desktop.yml package.json pnpm-workspace.yaml
```

For full validation when allowed:

```bash
gh workflow run build-windows.yml
```

### 4. Harden PR-quality checks or make their soft status explicit in the PR checklist

Owned files:

- `.github/workflows/pr-quality.yml`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `docs/agent-workflows/codex-pr-checklist.md`
- `scripts/check-pr-checklist.mjs`
- `scripts/check-coverage-matrix.mjs`

Acceptance criteria:

- The team chooses hard-fail or explicitly documents the soft-gate status in the PR template and Codex checklist.
- If kept soft, PR authors must manually paste `node scripts/check-coverage-matrix.mjs` and checklist results into PR validation.
- If made hard, docs/chore label exemptions remain intentional and tested against expected PR bodies.

Smallest useful validation:

```bash
node scripts/check-coverage-matrix.mjs
```

For checklist parsing:

```bash
PR_BODY="$(cat .github/PULL_REQUEST_TEMPLATE.md)" node scripts/check-pr-checklist.mjs
```

### 5. Convert highest-risk coverage matrix gaps into executable tests

Owned files:

- `docs/TEST-COVERAGE-MATRIX.md`
- `app/src/components/settings/panels/**`
- `app/src/store/**`
- `app/src/services/**`
- `app/test/e2e/specs/**`
- `src/openhuman/local_ai/**`
- `src/openhuman/credentials/**`
- `src/openhuman/channels/**`

Acceptance criteria:

- Pick five rows currently marked `_missing_` or shallow partial, prioritizing auth/session revocation, permission resync, settings reset/debug tools, local AI RAM persistence, and integration permission resync.
- Each selected row gains a happy-path and failure/edge assertion or is reclassified to manual smoke with a concrete `docs/RELEASE-MANUAL-SMOKE.md` entry.
- `docs/TEST-COVERAGE-MATRIX.md` and `scripts/feature-ids.json` remain synchronized.

Smallest useful validation:

```bash
node scripts/check-coverage-matrix.mjs
pnpm debug unit <changed-vitest-file>
pnpm debug rust <changed-rust-test-filter>
```

Use a single E2E spec only when the fixed row genuinely crosses UI to Tauri to core:

```bash
pnpm --filter openhuman-app test:e2e:build
bash app/scripts/e2e-run-spec.sh app/test/e2e/specs/<spec>.spec.ts <id>
```
