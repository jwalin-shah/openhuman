# OpenHuman Validation Queue Readiness Audit

Queue item: `openhuman-validation-queue-plan`  
Goal pack: `2026-05-07-30min-extension-b`  
Branch: `codex/goal-openhuman-validation-queue-plan`  
HEAD at audit start: `f11f217809841cf8e3a7f694d8e80967d8e188b8`  
Scope: read-only planning/synthesis; this report is the only intended repo write.

2026-05-07 reconciliation note: the sidecar/E2E-build findings in this report
were captured before OpenHuman PR #34 was merged. PR #34 is now merged as
`d3a9bb848c73572e51fbf4a4be7fb1b0ea384a1e`; do not treat the pre-#34
`scripts/stage-core-sidecar.mjs` and sidecar-doc findings below as fresh
blockers unless they still reproduce on current `main`.

## Executive Summary

This second-pass audit confirms the first-pass finding: OpenHuman's most urgent validation-readiness blocker is not missing product code, but drift between the current in-process Tauri core and older sidecar-era scripts/docs. The current `app/package.json` says `core:stage` is a no-op because the sidecar was removed, yet `app/scripts/e2e-build.sh` still calls the missing `scripts/stage-core-sidecar.mjs`, so E2E build validation fails before it reaches Tauri.

The rest of the validation surface is broad but environment-gated. CI covers TypeScript, Prettier, ESLint, Rust fmt/clippy, Vitest coverage, root Rust tests, Tauri Rust tests, and diff coverage. In this isolated worktree, local JS dependencies and Tauri vendor submodules are absent, so typecheck/lint/Vitest/Tauri commands cannot be trusted until setup is made explicit. The coverage matrix parser does pass from this worktree.

No product code was changed. No external tracker was updated. No PR was created.

## First-Pass Reconciliation

There is no existing `docs/overnight/` report in this worktree, but there is a first-pass extension report in the sibling goal pack:

- `../openhuman-30min-action-plan/docs/overnight/2026-05-07-30min-extension/openhuman-action-plan.md`

That first pass identified sidecar/in-process-core drift, route/provider docs drift, the remaining `openhuman.security_policy_info` legacy dispatcher branch, skills docs drift, and stale coverage-matrix summary text.

This second pass reconciles that report with earlier overnight audits:

- `openhuman-validation-map` confirmed the same missing `scripts/stage-core-sidecar.mjs` blocker and showed local `node_modules` plus Tauri submodules were absent.
- `openhuman-workflow-handoff` added handoff risks around stale worktree bootstrap, stale local CI scripts, PR target ambiguity, and E2E core RPC helper auth.
- `openhuman-docs-claims` confirmed QuickJS, sidecar, route, and integration maturity docs drift.
- `openhuman-risk-register` surfaced security-related next tasks, but most are product/security work rather than validation-queue readiness.

The queue-ready implementation work should therefore prioritize validation harness repair and setup clarity before broader product/security fixes.

## Concrete File-Path Observations

1. `app/package.json` declares `core:stage` as a no-op: `core is linked in-process; sidecar removed (PR #1061)`.
2. `app/scripts/e2e-build.sh` still executes `node "$REPO_ROOT/scripts/stage-core-sidecar.mjs"`, but `scripts/stage-core-sidecar.mjs` is missing.
3. `.github/workflows/build.yml` says no separate sidecar build/stage step is needed and builds the Tauri app through the CEF-aware cargo Tauri path.
4. `.github/workflows/e2e-agent-review.yml` says Linux E2E is disabled for CEF/tauri-driver reasons, yet still invokes `pnpm --filter openhuman-app test:e2e:build`, which currently fails on the missing sidecar script.
5. `.github/workflows/test.yml` runs frontend coverage, `cargo test -p openhuman`, and `cargo test --manifest-path app/src-tauri/Cargo.toml`, but its commented E2E block still contains old Yarn and sidecar staging references.
6. `.github/workflows/coverage.yml` is the strongest hard merge gate: it gathers Vitest, root Rust, and Tauri lcov artifacts and enforces `diff-cover --fail-under=80`.
7. `.github/workflows/pr-quality.yml` keeps checklist, coverage-matrix, and markdown-link checks soft with `continue-on-error: true`.
8. `.github/workflows/build-windows.yml` uses Node 24 but configures `cache: yarn`, runs `yarn install --frozen-lockfile`, and uploads `windows-cli` from missing `steps.core-paths.outputs.*`.
9. `pnpm-workspace.yaml` includes only `app`, so repo-level pnpm validation does not cover `packages/npm/` or `remotion/`.
10. `scripts/check-coverage-matrix.mjs` validates `docs/TEST-COVERAGE-MATRIX.md` against `scripts/feature-ids.json` and currently reports `138 rows, 138 catalog IDs, 0 parse errors, 0 missing, 0 duplicates`.
11. `docs/TEST-COVERAGE-MATRIX.md` still hand-summarizes `129 explicit + nested = 200 product features`, which conflicts with the parser's 138-row/catalog result.
12. `scripts/debug/README.md` documents the right agent-facing compact wrappers: `pnpm debug unit`, `pnpm debug e2e`, `pnpm debug rust`, and `pnpm debug logs`.
13. `scripts/test-rust-with-mock.sh` starts `scripts/mock-api-server.mjs`, waits for `/__admin/health`, exports `BACKEND_URL` and `VITE_BACKEND_URL`, then runs `cargo test --manifest-path Cargo.toml --workspace`.
14. `app/scripts/e2e-run-spec.sh` isolates `OPENHUMAN_WORKSPACE`, writes a mock `~/.openhuman/config.toml`, checks the built bundle for the mock URL, then starts Appium or tauri-driver.
15. `app/scripts/e2e-run-spec.sh` also kills OpenHuman and removes app cache/support directories, which is useful for deterministic E2E but should be called out as destructive outside a disposable test profile.
16. `app/test/wdio.conf.ts` resolves macOS `.app`, Linux `OpenHuman`, and Windows `.exe` build outputs and captures failure artifacts after failed tests.
17. `app/src-tauri/Cargo.toml` depends on root `openhuman_core` as a path dependency and on vendored Tauri CEF/plugin paths under `app/src-tauri/vendor/`.
18. `git submodule status --recursive` shows `app/src-tauri/vendor/tauri-cef` and `app/src-tauri/vendor/tauri-plugin-notification` with leading `-`, so both submodules are uninitialized in this worktree.
19. `package.json` delegates root validation to the app workspace for `typecheck`, `lint`, `format:check`, `test:coverage`, `test:rust`, and `debug`.
20. `.husky/pre-push` can mutate the tree by running `pnpm format` and `pnpm lint:fix` after failed checks, so it is not a pure validation command for overnight automation.

## Validation Reality

Commands run in this worktree:

| Command | Result | Notes |
| --- | --- | --- |
| `git status --short` | Pass, initially clean | Required validation rerun after this report. |
| `git branch --show-current` | Pass | `codex/goal-openhuman-validation-queue-plan`. |
| `git rev-parse HEAD` | Pass | `f11f217809841cf8e3a7f694d8e80967d8e188b8`. |
| `llm-tldr tree .` | Pass | Very large repo tree; confirmed app/core/Tauri/docs/tests layout. |
| `node --version` | Pass | `v25.9.0`; app requires Node `>=24.0.0`. |
| `pnpm --version` | Pass | `10.10.0`, matching root package manager. |
| `rustc --version` | Pass | `rustc 1.93.0`. |
| `cargo --version` | Pass | `cargo 1.93.0`. |
| `git submodule status --recursive` | Pass with blocker signal | Both Tauri vendor submodules are uninitialized. |
| `node scripts/check-coverage-matrix.mjs` | Pass | `138 rows, 138 catalog IDs, 0 parse errors, 0 missing, 0 duplicates`. |
| `bash -n app/scripts/e2e-build.sh` | Pass | Syntax is valid, runtime is broken. |
| `bash -n app/scripts/e2e-run-spec.sh` | Pass | Syntax is valid. |
| `ls -ld node_modules` | Failed | `node_modules` missing. |
| `ls -ld app/node_modules` | Failed | `app/node_modules` missing. |
| `ls -ld app/src-tauri/vendor/tauri-cef/crates/tauri-cli` | Failed | Tauri CEF submodule not initialized. |
| `ls -l scripts/stage-core-sidecar.mjs` | Failed | Script missing. |
| `cargo metadata --manifest-path Cargo.toml --format-version 1 --no-deps` | Pass | Confirms root package and `openhuman-core` binary target. |
| `cargo metadata --manifest-path app/src-tauri/Cargo.toml --format-version 1 --no-deps` | Pass but weak | Shows vendored path deps, but `--no-deps` does not prove those paths can build. |
| `pnpm --filter openhuman-app compile` | Failed | `tsc: command not found`; `app/node_modules` missing. |
| `bash scripts/ensure-tauri-cli.sh` | Failed | Vendored Tauri CLI missing; suggests `git submodule update --init --recursive`. |
| `bash app/scripts/e2e-build.sh` | Failed | `MODULE_NOT_FOUND` for `scripts/stage-core-sidecar.mjs`. |

Useful validation commands after setup or implementation:

```bash
pnpm install --frozen-lockfile
git submodule update --init --recursive
pnpm --filter openhuman-app compile
pnpm --filter openhuman-app lint
pnpm --filter openhuman-app format:check
pnpm --dir app exec vitest run <changed-test-files> --config test/vitest.config.ts
cargo fmt --manifest-path Cargo.toml --all --check
cargo test -p openhuman <filter>
cargo fmt --manifest-path app/src-tauri/Cargo.toml --all --check
cargo test --manifest-path app/src-tauri/Cargo.toml <filter>
pnpm debug rust <filter>
pnpm --filter openhuman-app test:e2e:build
bash app/scripts/e2e-run-spec.sh test/e2e/specs/smoke.spec.ts smoke
node scripts/check-coverage-matrix.mjs
```

## Known Blockers

- Local JS dependencies are not installed: `node_modules` and `app/node_modules` are absent.
- Tauri vendor submodules are not initialized: `app/src-tauri/vendor/tauri-cef` and `app/src-tauri/vendor/tauri-plugin-notification` show leading `-` in `git submodule status --recursive`.
- `app/scripts/e2e-build.sh` fails before any real build because it calls missing `scripts/stage-core-sidecar.mjs`.
- Linux E2E status is contradictory across surfaces: `.github/workflows/e2e-agent-review.yml` says tauri-driver cannot drive the CEF runtime, while docs and scripts still present Linux tauri-driver paths as ordinary E2E usage.
- Windows workflow validation is stale: `.github/workflows/build-windows.yml` still uses Yarn and references missing `steps.core-paths` outputs.
- Coverage-matrix parser passes, but the markdown summary text is stale relative to the parser/catalog count.
- PR quality workflow checks are soft, so checklist and coverage-matrix drift can pass CI unless reviewers notice.
- The current repo checkout does not contain the queue `items/` or `runs/` directories; the issue body came from the goal-pack prompt, not a local `items/openhuman-validation-queue-plan/ISSUE.md`.
- External services, pushes, PR creation, tracker updates, deploys, and destructive cleanup are out of scope for this queue item.

## Dirty State And Handoff Risks

- Initial `git status --short` was clean.
- After this report, the intended dirty state is exactly one untracked report under `docs/overnight/2026-05-07-30min-extension-b/`.
- The pre-push hook is not safe as a read-only validation check because it auto-runs format and lint fixes.
- E2E scripts are not safe to run casually on a real user profile because they kill OpenHuman and remove app support/cache paths.
- A worker that follows stale sidecar docs may waste validation time building or staging the wrong binary instead of fixing the current E2E entrypoint.

## Five Safe Implementation Tasks

### 1. Repair E2E build for in-process core

Owned files:

- `app/scripts/e2e-build.sh`
- `app/package.json`
- `docs/E2E-TESTING.md`
- `docs/src-tauri/README.md`
- `docs/BUILDING.md`
- `.github/workflows/e2e-agent-review.yml`

Acceptance criteria:

- `app/scripts/e2e-build.sh` no longer calls `scripts/stage-core-sidecar.mjs`.
- E2E build comments match the current in-process core model.
- Docs describe the embedded Tauri core and do not instruct normal desktop/E2E workers to stage a sidecar.
- `rg -n "stage-core-sidecar|core:stage|sidecar" app/scripts docs .github/workflows/e2e-agent-review.yml` returns only intentional no-op or historical references.

Smallest useful validation:

```bash
bash -n app/scripts/e2e-build.sh
ls -l scripts/stage-core-sidecar.mjs
pnpm --filter openhuman-app test:e2e:build
```

Expected note: the final command still requires dependencies, submodules, and CEF/Tauri prerequisites, but it should no longer fail with `MODULE_NOT_FOUND` for the removed staging script.

### 2. Add a non-mutating local validation preflight

Owned files:

- `scripts/validate-preflight.sh`
- `docs/agent-workflows/codex-pr-checklist.md`
- `scripts/debug/README.md`
- `AGENTS.md` only if repo-local instructions are updated

Acceptance criteria:

- Preflight checks Node, pnpm, Rust, root/app `node_modules`, Tauri submodule status, vendored Tauri CLI path, lockfiles, and current branch without installing or modifying anything.
- Missing setup prints exact next commands, including `pnpm install --frozen-lockfile` and `git submodule update --init --recursive`.
- The script exits non-zero in this incomplete worktree and reports the same blockers found in this audit.
- The script exits zero in a fully initialized worktree.

Smallest useful validation:

```bash
bash -n scripts/validate-preflight.sh
bash scripts/validate-preflight.sh
git status --short
```

### 3. Reconcile E2E support docs and helper auth

Owned files:

- `docs/E2E-TESTING.md`
- `app/test/e2e/helpers/core-rpc.ts`
- `app/test/e2e/helpers/core-rpc-webview.ts`
- `app/test/e2e/helpers/core-rpc-node.ts`
- `app/test/wdio.conf.ts`
- `.github/workflows/e2e-agent-review.yml`

Acceptance criteria:

- Docs clearly state which E2E backend is currently supported on macOS, Linux, and CI for the CEF runtime.
- Any direct `/rpc` E2E helper sends the required bearer token or documents why that path is not supported on that backend.
- Missing token or unsupported backend failures are immediate and actionable, not long port/session timeouts.
- At least one focused E2E path that uses `callOpenhumanRpc` has a documented validation command.

Smallest useful validation:

```bash
pnpm --dir app exec vitest run src/services/__tests__/coreRpcClient.test.ts --config test/vitest.config.ts
pnpm debug e2e test/e2e/specs/linux-cef-deb-runtime.spec.ts linux-cef-deb-runtime
```

Expected note: E2E remains environment-gated until dependencies, submodules, driver/Appium, and the E2E build are available.

### 4. Modernize Windows and package-manager workflow assumptions

Owned files:

- `.github/workflows/build-windows.yml`
- `scripts/test-ci-local.sh`
- `scripts/worktree-bootstrap.sh`
- `scripts/work/README.md`
- `pnpm-workspace.yaml` only if package scope changes

Acceptance criteria:

- Windows workflow uses pnpm consistently or adds a real committed Yarn lockfile if Yarn is intentionally retained.
- `windows-cli` upload either has a producing `core-paths` step or is removed/marked disabled.
- `scripts/test-ci-local.sh` targets an existing workflow and does not assume `skills/` or Yarn.
- Worktree bootstrap initializes Tauri submodules and uses pnpm without staging removed sidecars.

Smallest useful validation:

```bash
bash -n scripts/test-ci-local.sh
bash -n scripts/worktree-bootstrap.sh
rg -n "yarn|core-paths|windows-cli|package-and-publish|cd skills|stage-core-sidecar" .github/workflows/build-windows.yml scripts/test-ci-local.sh scripts/worktree-bootstrap.sh
```

### 5. Make coverage and PR quality gates trustworthy

Owned files:

- `docs/TEST-COVERAGE-MATRIX.md`
- `scripts/check-coverage-matrix.mjs`
- `scripts/lib/coverage-matrix-parser.mjs`
- `scripts/feature-ids.json`
- `.github/workflows/pr-quality.yml`
- `.github/PULL_REQUEST_TEMPLATE.md`

Acceptance criteria:

- Coverage matrix summary text matches parser/catalog output or is generated from it.
- `node scripts/check-coverage-matrix.mjs` fails if summary counts drift.
- PR template and checklist explain when coverage matrix updates are required.
- `.github/workflows/pr-quality.yml` either becomes hard-fail for non-doc/non-chore PRs or records a current dated reason for staying soft.

Smallest useful validation:

```bash
node scripts/check-coverage-matrix.mjs
pnpm --dir app exec vitest run test/coverage-matrix-parser.test.ts test/checklist-parser.test.ts --config test/vitest.config.ts
```

## Suggested Queue Order

1. Fix `app/scripts/e2e-build.sh` and in-process-core docs first, because it removes a source-level blocker from every UI/E2E validation path.
2. Add preflight next, so future workers can distinguish local setup blockers from source failures before spending test budget.
3. Reconcile E2E support and RPC helper auth after the build entrypoint is fixed.
4. Modernize Windows/package-manager assumptions before relying on cross-platform CI as release evidence.
5. Harden coverage/PR-quality gates once the command surface is less contradictory.

## Handoff

- Changed files: `docs/overnight/2026-05-07-30min-extension-b/openhuman-validation-queue-plan.md`
- Product code changed: none
- Commit created: none
- Current HEAD SHA: `f11f217809841cf8e3a7f694d8e80967d8e188b8`
- PR URL: none
- External tracker updates: none
- Required validation command: `git status --short`
- Expected validation result after report creation: command succeeds and shows only this new report path under `docs/overnight/2026-05-07-30min-extension-b/`.
