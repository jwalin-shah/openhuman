# OpenHuman SYM206 Recovery: Risk And Validation Review

Queue item: `openhuman-sym206-recovery-risk-and-validation-review`
Branch reviewed: `codex/goal-openhuman-sym206-recovery-risk-and-validation-review`
Repo path: `/Users/jwalinshah/projects/agent-stack/.agent-stack-worktrees/2026-05-07-whole-portfolio-review/openhuman-sym206-recovery-risk-and-validation-review`
Review date: 2026-05-07
Reviewed HEAD: `f11f217809841cf8e3a7f694d8e80967d8e188b8`

## Scope And Method

This was a read-only risk and validation pass. I did not edit product code, open PRs, push branches, deploy, or update external trackers. The only intended file change is this report.

The queue's referenced issue file, `items/openhuman-sym206-recovery-risk-and-validation-review/ISSUE.md`, is not present in this checkout. The issue body from the Goal Pack prompt was used as the work order.

No repo-local `docs/overnight/` reports existed before this review, so there were no previous overnight outputs in this branch to reconcile.

## Concrete Observations

1. `app/package.json:14` makes `core:stage` a no-op and explicitly says the "core is linked in-process; sidecar removed (PR #1061)".
2. `app/src-tauri/Cargo.toml:109-114` depends on `openhuman_core` as a path dependency and documents the core HTTP/JSON-RPC server running inside the Tauri host.
3. `app/src-tauri/src/core_process.rs:4-18` says there is no sidecar to leak and only allows legacy attachment with `OPENHUMAN_CORE_REUSE_EXISTING=1`.
4. `app/scripts/e2e-build.sh:39-40` still says it stages a Rust core sidecar and calls `scripts/stage-core-sidecar.mjs`; that file is absent.
5. `scripts/release/local-dmg-version-dry-run.sh:50-58` builds `openhuman-core` and calls `scripts/release/stage-sidecar.sh`; that file is absent.
6. `docs/src-tauri/README.md:21-23`, `docs/src-tauri/01-architecture.md:5-38`, `docs/src/README.md:47`, and `docs/BUILDING.md:29-31` still describe sidecar staging or a separately built core process.
7. `.github/workflows/e2e-agent-review.yml:2-8` correctly documents Linux tauri-driver E2E as disabled for the CEF runtime, but `docs/E2E-TESTING.md:131-139` still claims the `e2e-linux` job runs by default on every push/PR.
8. `.github/workflows/test.yml:133-238` has the Linux and macOS E2E jobs commented out, so PR validation currently covers Vitest, Rust core tests, and Tauri shell tests, but not desktop E2E.
9. `.github/workflows/coverage.yml:137-183` enforces diff coverage >= 80% using merged Vitest, core Rust, and Tauri shell LCOV artifacts.
10. `.github/workflows/pr-quality.yml:13-50` keeps checklist, coverage-matrix, and markdown-link checks on `continue-on-error: true`, so they are advisory rather than merge-blocking.
11. `docs/TEST-COVERAGE-MATRIX.md:455-461` records 27 missing and 27 partial feature leaves, including auth, permissions, settings, developer options, and data reset gaps.
12. `app/test/vitest.config.ts:30-39` forces Vitest to one worker and uses `app/src/test/setup.ts`, which reduces intra-run mock-port collisions.
13. `app/src/test/setup.ts:198-200` starts the unit-test mock backend on fixed port `5005`; `scripts/test-rust-with-mock.sh:14-15` uses fixed port `18505`; `app/scripts/e2e-run-spec.sh:16` defaults E2E to `18473`.
14. `app/scripts/e2e-run-spec.sh:114-123` checks the built bundle for the mock URL twice with nearly identical error paths.
15. `src/openhuman/tools/impl/browser/screenshot.rs:37-55` now passes Linux screenshot output paths to `sh -c` via `$1`, avoiding direct string interpolation.
16. `.jules/sentinel.md:1-4` records the shell-injection lesson, but the screenshot unit tests in `src/openhuman/tools/impl/browser/screenshot.rs` mainly exercise unsafe filenames, not a malicious workspace path.
17. `git rev-list --left-right --count HEAD...upstream/main` returned `2 154`, so this review branch is 2 commits ahead and 154 commits behind the local `upstream/main` ref.
18. `git diff --stat upstream/main...HEAD` showed a large branch delta: 583 files changed, including release workflows, app shell, memory modules, tests, docs, and the sentinel screenshot fix.

## Risks And Blockers

### High Risk: E2E Build Path Is Statically Broken

`app/scripts/e2e-build.sh` calls `node "$REPO_ROOT/scripts/stage-core-sidecar.mjs"`, but `scripts/stage-core-sidecar.mjs` is missing. Any command that runs `pnpm --filter openhuman-app test:e2e:build`, `pnpm test:e2e`, or `bash app/scripts/e2e-agent-review.sh` will fail before reaching WDIO unless that script is restored or the staging call is removed.

Smallest proof command:

```bash
test -f scripts/stage-core-sidecar.mjs
```

Expected current result: non-zero, because the file is absent.

### High Risk: Release Dry-Run References Deleted Sidecar Staging

`scripts/release/local-dmg-version-dry-run.sh` still calls `scripts/release/stage-sidecar.sh` and verifies a packaged `openhuman-core` binary inside the app bundle. The current `app/src-tauri/tauri.conf.json` has no `bundle.externalBin`, and production/staging workflows set `build_sidecar: false`, so this local release validation script is stale and likely unusable.

Smallest proof command:

```bash
test -f scripts/release/stage-sidecar.sh
```

Expected current result: non-zero, because the file is absent.

### Medium Risk: E2E Documentation Does Not Match CI Reality

The E2E docs still tell contributors that Linux E2E is the default CI path, while the CI workflow has both E2E jobs commented out and the agent-review workflow says CEF cannot be driven by tauri-driver. This creates false confidence that user-visible desktop flows are covered on PRs.

Smallest proof command:

```bash
rg -n "e2e-linux|Default \\(every push/PR\\)|tauri-driver" .github/workflows/test.yml docs/E2E-TESTING.md .github/workflows/e2e-agent-review.yml
```

### Medium Risk: Stale Sidecar Claims Can Send Agents Into Invalid Work

Multiple docs still direct agents to stage or reason about a sidecar even though the app now links `openhuman_core` in-process. This is especially risky because the stale docs are in high-authority onboarding paths (`docs/src-tauri/README.md`, `docs/BUILDING.md`, `docs/src/README.md`).

Smallest proof command:

```bash
rg -n "sidecar|stage-core|core:stage|separately built" docs app/scripts scripts app/package.json app/src-tauri/Cargo.toml app/src-tauri/src/core_process.rs
```

### Medium Risk: PR Quality Gates Are Still Soft

Diff coverage is hard-gated, but checklist, coverage-matrix sync, and markdown links are advisory. The PR template demands matrix updates and related feature IDs, but `.github/workflows/pr-quality.yml` cannot block omissions while `continue-on-error: true` remains.

Smallest proof command:

```bash
rg -n "continue-on-error|check-pr-checklist|check-coverage-matrix" .github/workflows/pr-quality.yml
```

### Medium Risk: Screenshot Fix Lacks The Exact Regression Test

The latest commit fixes direct interpolation of output paths in Linux screenshot shell commands. The existing tests reject shell-unsafe filenames, but the sentinel note names `workspace_dir` as the risky input. A regression test should verify that a workspace path containing shell metacharacters is not interpolated into the script body.

Smallest useful validation:

```bash
pnpm debug rust screenshot_rejects_all_unsafe_chars
pnpm debug rust screenshot_command_does_not_interpolate_output_path
```

The second command names the proposed new regression test.

### Low Risk: Mock Backend Ports Are Safer But Still Hard-Coded

Vitest is single-worker and uses port `5005`; Rust mock tests use `18505`; E2E defaults to `18473`. That separation reduces SYM206-style port collision risk, but fixed ports still collide across concurrent local worktrees or overlapping manual runs. A deterministic per-process free-port allocator would be safer for overnight fanout.

Smallest proof command:

```bash
rg -n "5005|18473|18505|startMockServer|MOCK_API_PORT|E2E_MOCK_PORT" app/src/test/setup.ts scripts/test-rust-with-mock.sh app/scripts/e2e-run-spec.sh scripts/mock-api-core.mjs
```

## Validation Commands

Commands run during this review:

```bash
git status --short --branch
git rev-parse HEAD
rg --files -g 'README*' -g 'AGENTS.md' -g 'docs/**' -g '.github/**' -g 'scripts/**' -g 'tests/**' -g 'app/test/**' -g 'app/scripts/**' -g 'package.json' -g 'app/package.json' -g 'Cargo.toml' -g 'app/src-tauri/Cargo.toml'
rg --files docs/overnight
git branch -vv
git log --oneline -8
git show --stat --oneline HEAD
git remote -v
git diff --stat upstream/main...HEAD
git rev-list --left-right --count HEAD...upstream/main
rtk read package.json
rtk read app/package.json
rtk read Cargo.toml
rtk read app/src-tauri/Cargo.toml
rtk read .github/workflows/coverage.yml
rtk read .github/workflows/pr-quality.yml
rtk read .github/workflows/test.yml
rtk read .github/workflows/build-desktop.yml
rtk read docs/agent-workflows/codex-pr-checklist.md
rtk read docs/TEST-COVERAGE-MATRIX.md
rtk read docs/E2E-TESTING.md
rtk read app/scripts/e2e-build.sh
rtk read app/scripts/e2e-run-spec.sh
rtk read scripts/release/local-dmg-version-dry-run.sh
rtk read src/openhuman/tools/impl/browser/screenshot.rs
```

Required Goal Pack validation to run after writing this report:

```bash
git status --short
```

Recommended validation for follow-up PRs:

```bash
pnpm --filter openhuman-app format:check
pnpm typecheck
pnpm debug unit
pnpm debug rust
cargo fmt --manifest-path Cargo.toml --all --check
cargo fmt --manifest-path app/src-tauri/Cargo.toml --all --check
pnpm --filter openhuman-app test:e2e:build
bash app/scripts/e2e-agent-review.sh --skip-build
```

## Implementation-Ready Follow-Ups

### 1. Repair E2E Build After In-Process Core Migration

Owned files:

- `app/scripts/e2e-build.sh`
- `app/scripts/e2e-agent-review.sh`
- `docs/E2E-TESTING.md`
- `docs/AGENT-OBSERVABILITY.md`

Acceptance criteria:

- `app/scripts/e2e-build.sh` no longer calls missing `scripts/stage-core-sidecar.mjs`.
- Agent-review wrapper text no longer claims it stages a sidecar.
- E2E docs describe the current in-process core startup and CEF automation limitation.
- The build either succeeds or fails on a real Tauri/CEF prerequisite, not on a missing staging script.

Smallest useful validation:

```bash
test ! -e scripts/stage-core-sidecar.mjs
pnpm --filter openhuman-app test:e2e:build
```

### 2. Update High-Authority Sidecar Docs To The In-Process Core Model

Owned files:

- `docs/src-tauri/README.md`
- `docs/src-tauri/01-architecture.md`
- `docs/src-tauri/03-services.md`
- `docs/src/README.md`
- `docs/BUILDING.md`
- `docs/TESTING-STRATEGY.md`

Acceptance criteria:

- Docs describe `openhuman_core` running in-process inside the Tauri host by default.
- Remaining `openhuman-core` mentions are explicitly limited to standalone CLI/debug harness contexts.
- `core:stage` is documented as obsolete/no-op, not as a required build step.
- A grep for sidecar/staging terms has no misleading contributor workflow claims.

Smallest useful validation:

```bash
rg -n "sidecar|stage-core|core:stage|separately built" docs app/package.json app/src-tauri/Cargo.toml app/src-tauri/src/core_process.rs
```

### 3. Rework Local DMG Dry-Run For Current Packaging

Owned files:

- `scripts/release/local-dmg-version-dry-run.sh`
- `scripts/release/sign-and-notarize-macos.sh`
- `scripts/build-macos-signed.sh`
- `docs/RELEASE-MANUAL-SMOKE.md`

Acceptance criteria:

- Local DMG dry-run no longer calls missing `scripts/release/stage-sidecar.sh`.
- The script verifies the packaged `OpenHuman` app version through the current Tauri binary or app metadata instead of expecting an `openhuman-core` resource.
- Signing/notarization helpers either remove stale sidecar assumptions or clearly guard them as optional legacy standalone-CLI handling.
- Manual smoke docs reflect the updated verification command.

Smallest useful validation:

```bash
bash -n scripts/release/local-dmg-version-dry-run.sh
test ! -f scripts/release/stage-sidecar.sh
```

On macOS release machines, also run:

```bash
bash scripts/release/local-dmg-version-dry-run.sh
```

### 4. Make Desktop E2E Coverage Status Executable And Honest

Owned files:

- `.github/workflows/test.yml`
- `.github/workflows/e2e-agent-review.yml`
- `docs/E2E-TESTING.md`
- `docs/TEST-COVERAGE-MATRIX.md`
- `app/test/wdio.conf.ts`

Acceptance criteria:

- CI docs and workflows agree on whether desktop E2E is disabled, manual-only, or required.
- If CEF cannot use tauri-driver, docs name the supported local/macOS path and the unavailable Linux path.
- Coverage matrix rows that imply WDIO coverage point to runnable specs and note any manual-only status.
- Agent-review artifacts remain available through the supported path.

Smallest useful validation:

```bash
rg -n "e2e-linux|tauri-driver|CEF|workflow_dispatch|manual" .github/workflows/test.yml .github/workflows/e2e-agent-review.yml docs/E2E-TESTING.md docs/TEST-COVERAGE-MATRIX.md
node scripts/check-coverage-matrix.mjs
```

### 5. Add The Exact Screenshot Shell-Injection Regression Test

Owned files:

- `src/openhuman/tools/impl/browser/screenshot.rs`
- `.jules/sentinel.md`

Acceptance criteria:

- A unit test covers an output path/workspace path containing shell metacharacters.
- The test asserts the inline Linux script body does not contain the output path and receives the path only as an argument.
- Existing filename sanitization tests remain intact.
- Sentinel guidance names the regression test so future agents can run it directly.

Smallest useful validation:

```bash
pnpm debug rust screenshot_command_does_not_interpolate_output_path
cargo fmt --manifest-path Cargo.toml --all --check
```

### 6. Graduate PR Quality Checks From Advisory To Blocking

Owned files:

- `.github/workflows/pr-quality.yml`
- `scripts/check-pr-checklist.mjs`
- `scripts/check-coverage-matrix.mjs`
- `app/test/checklist-parser.test.ts`
- `app/test/coverage-matrix-parser.test.ts`

Acceptance criteria:

- `pr-quality.yml` no longer masks checklist, coverage-matrix, or markdown-link failures for non-doc/chore PRs.
- The checklist parser requires a non-empty N/A reason when a box is left unchecked as N/A.
- Coverage-matrix parser tests cover malformed rows and duplicate feature IDs.
- Docs/chore exemptions remain explicit and intentional.

Smallest useful validation:

```bash
node scripts/check-pr-checklist.mjs
node scripts/check-coverage-matrix.mjs
pnpm --dir app exec vitest run test/checklist-parser.test.ts test/coverage-matrix-parser.test.ts --config test/vitest.config.ts
```

## Recommended Execution Order

1. Repair E2E build script removal of sidecar staging.
2. Update docs to the in-process core model.
3. Rework local DMG dry-run.
4. Reconcile desktop E2E CI/docs/coverage-matrix truth.
5. Add the screenshot workspace-path regression test.
6. Harden PR quality gates once the above validation surfaces are aligned.

## Handoff Notes

- Product code was not edited.
- External trackers were not updated.
- No PR was created.
- Local commit creation was blocked by sandbox permissions: `git add docs/overnight/2026-05-07-whole-portfolio-review/openhuman-sym206-recovery-risk-and-validation-review.md` failed because Git could not create the worktree index lock under `/Users/jwalinshah/projects/openhuman/.git/worktrees/openhuman-sym206-recovery-risk-and-validation-review/index.lock`.
- The branch is substantially stale against `upstream/main` (`2 154` from `git rev-list --left-right --count HEAD...upstream/main`), so implementation follow-ups should start from a fresh branch off the intended base.
