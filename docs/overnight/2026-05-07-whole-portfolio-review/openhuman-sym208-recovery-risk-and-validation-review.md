# OpenHuman SYM-208 Recovery Risk And Validation Review

Queue item: `openhuman-sym208-recovery-risk-and-validation-review`  
Repo: `openhuman-sym208-recovery`  
Branch reviewed: `codex/goal-openhuman-sym208-recovery-risk-and-validation-review`  
HEAD reviewed: `f11f217809841cf8e3a7f694d8e80967d8e188b8`

## Scope And Local State

- This pass was read-only except for this report file.
- No repo-local previous overnight outputs were found before creating this file under `docs/overnight`, `runs`, or `items`.
- Initial `git status --short` was clean.
- The local checkout has the Tauri vendor submodules recorded but not populated: `git submodule status --recursive` printed `-f1ee955... app/src-tauri/vendor/tauri-cef` and `-36c4004... app/src-tauri/vendor/tauri-plugin-notification`.
- The queue validation command is `git status --short`; final status is recorded in the handoff.

## Concrete Observations

1. `Cargo.toml` defines the root Rust package as `openhuman` version `0.53.16`, exposes the library as `openhuman_core`, and names the main binary `openhuman-core` at `src/main.rs`. This differs from older docs that say `cargo build --bin openhuman`.
2. `app/src-tauri/Cargo.toml` links `openhuman_core = { path = "../..", package = "openhuman", default-features = false }` and documents the core as embedded in-process since PR `#1061`.
3. `app/package.json` has `core:stage` set to a no-op message: `core is linked in-process; sidecar removed (PR #1061)`.
4. `app/scripts/e2e-build.sh` still calls `node "$REPO_ROOT/scripts/stage-core-sidecar.mjs"`, but `scripts/stage-core-sidecar.mjs` is missing. This makes `pnpm --filter openhuman-app test:e2e:build` fail before reaching Tauri.
5. `app/src-tauri/tauri.conf.json` bundles prompt resources and recipes, but no `externalBin`; that supports the in-process-core model and contradicts sidecar staging references.
6. `AGENTS.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/src-tauri/README.md`, `docs/BUILDING.md`, `docs/E2E-TESTING.md`, and `docs/TESTING-STRATEGY.md` still contain sidecar or Linux `tauri-driver` default-CI claims that no longer match the current CEF/in-process implementation.
7. `.github/workflows/test.yml` runs frontend coverage, root Rust tests, and Tauri shell tests, but the Linux and macOS E2E jobs are commented out.
8. `.github/workflows/e2e-agent-review.yml` is manual-only and explicitly says Linux E2E through `tauri-driver` is disabled because the app uses CEF and WebKitWebDriver cannot drive it.
9. `app/test/wdio.conf.ts` still selects `tauri-driver` on Linux and Appium Mac2 on macOS. That may be valid for local or future harness work, but CI docs currently overstate it as a default automated gate.
10. `app/test/e2e/specs/` contains 41 WDIO specs, but current PR CI does not run them by default.
11. `docs/TEST-COVERAGE-MATRIX.md` reports 64 covered, 27 partial, 27 missing, 11 manual-smoke feature leaves, and claims 200 total product features; `node scripts/check-coverage-matrix.mjs` passes with 138 parsed rows and 138 catalog IDs.
12. `.github/workflows/pr-quality.yml` runs checklist, coverage-matrix, and markdown-link jobs with `continue-on-error: true`, so stale PR bodies or matrix drift do not block merges.
13. `docs/agent-workflows/codex-pr-checklist.md` is accurate about reporting blocked commands, but it does not check that the two Tauri vendor submodules are populated before Tauri validation.
14. `PLAN.md` targets removal of domain-specific transport leakage. Current code still has `src/core/agent_cli.rs`, `src/core/memory_cli.rs`, direct adapter dispatch in `src/core/cli.rs`, and the `openhuman.security_policy_info` fallback in `src/rpc/dispatch.rs`.
15. `app/scripts/e2e-run-spec.sh` creates a temp `OPENHUMAN_WORKSPACE`, but still writes `api_url` into `~/.openhuman/config.toml` with backup/restore. That contradicts the "no shared filesystem state" claim in `docs/TESTING-STRATEGY.md` if the script is interrupted before cleanup.

## Risks And Blockers

- E2E build is currently blocked by a missing script reference in `app/scripts/e2e-build.sh`.
- E2E coverage is not a default PR gate despite many user-visible flows living only in WDIO specs.
- Local Tauri validation in this worktree is blocked until submodules are initialized; the expected vendored `Cargo.toml` files under `app/src-tauri/vendor/` are absent.
- Several core architecture docs still teach future agents to stage or reason about a sidecar, increasing the chance of wrong validation commands and stale fixes.
- Soft PR-quality checks allow unchecked checklist items, stale coverage-matrix rows, and docs link failures to pass.
- The controller-registry migration is partially complete, but no drift guard currently prevents new domain-specific transport imports or fallback dispatch from returning.

## Exact Commands Used

```bash
git branch --show-current
git rev-parse HEAD
git status --short
git submodule status --recursive
test -f scripts/stage-core-sidecar.mjs
test -f app/src-tauri/vendor/tauri-cef/crates/tauri/Cargo.toml
test -f app/src-tauri/vendor/tauri-plugin-notification/Cargo.toml
node scripts/check-coverage-matrix.mjs
fd -e ts . app/test/e2e/specs | wc -l
fd -e rs . tests | wc -l
rg -n "stage-core-sidecar|core:stage|sidecar|externalBin|core_rpc_relay|core_rpc" app scripts docs AGENTS.md CLAUDE.md .github -S
rg -n "agent_cli|memory_cli|text_input_cli|screen_intelligence_cli|tree_summarizer_cli|security_policy_info|crate::openhuman::[a-z_]+::" src/core src/rpc -S
```

## Implementation-Ready Follow-Up Tasks

### 1. Fix The E2E Build Contract After In-Process Core

Owned files:
- `app/scripts/e2e-build.sh`
- `app/scripts/e2e-agent-review.sh`
- `app/package.json`
- `docs/E2E-TESTING.md`

Acceptance criteria:
- `app/scripts/e2e-build.sh` no longer calls the missing `scripts/stage-core-sidecar.mjs`.
- Agent-review script copy no longer says it is staging a core sidecar.
- E2E docs describe the in-process core and do not instruct users to stage a sidecar.
- Any remaining `stage-core-sidecar` references are explicitly historical or deleted.

Smallest useful validation:

```bash
bash -n app/scripts/e2e-build.sh app/scripts/e2e-agent-review.sh
! rg -n "stage-core-sidecar" app/scripts app/package.json docs/E2E-TESTING.md
pnpm --filter openhuman-app test:e2e:build
```

### 2. Reconcile E2E CI Claims With The CEF Runtime

Owned files:
- `.github/workflows/test.yml`
- `.github/workflows/e2e-agent-review.yml`
- `docs/E2E-TESTING.md`
- `docs/TESTING-STRATEGY.md`
- `app/test/wdio.conf.ts`

Acceptance criteria:
- Docs no longer say Linux `tauri-driver` is the default CI path while CEF makes that false.
- The workflow either has a real CEF-compatible E2E smoke job or clearly labels E2E as manual/local-only with a tracked owner.
- `app/test/wdio.conf.ts` comments match the supported automation matrix.
- The coverage matrix distinguishes automated WDIO coverage from non-gated/manual E2E specs.

Smallest useful validation:

```bash
rg -n "Linux \\(CI default\\)|default CI|tauri-driver|CEF" docs .github app/test/wdio.conf.ts
node scripts/check-coverage-matrix.mjs
```

### 3. Add A Tauri Vendor Submodule Preflight

Owned files:
- `docs/agent-workflows/codex-pr-checklist.md`
- `scripts/ensure-tauri-cli.sh`
- `.github/workflows/build.yml`
- `.github/workflows/test.yml`

Acceptance criteria:
- Local Tauri validation fails fast with a clear message when `app/src-tauri/vendor/tauri-cef/crates/tauri/Cargo.toml` or `app/src-tauri/vendor/tauri-plugin-notification/Cargo.toml` is absent.
- The Codex checklist tells agents to run `git submodule update --init --recursive` before Tauri checks when submodules are missing.
- CI still checks out submodules recursively for build, Tauri tests, and coverage jobs.

Smallest useful validation:

```bash
test -f app/src-tauri/vendor/tauri-cef/crates/tauri/Cargo.toml
test -f app/src-tauri/vendor/tauri-plugin-notification/Cargo.toml
cargo check --manifest-path app/src-tauri/Cargo.toml
```

### 4. Harden PR Quality And Coverage-Matrix Guards

Owned files:
- `.github/workflows/pr-quality.yml`
- `scripts/check-coverage-matrix.mjs`
- `scripts/lib/coverage-matrix-parser.mjs`
- `.github/PULL_REQUEST_TEMPLATE.md`

Acceptance criteria:
- Checklist and coverage-matrix jobs are hard failures for non-doc/chore PRs.
- The matrix guard rejects stale `(this PR)` annotations after merge.
- The matrix guard verifies non-missing test paths exist for rows marked covered or partial, unless the row is manual smoke.
- PR template language matches the hard-gate behavior.

Smallest useful validation:

```bash
node scripts/check-coverage-matrix.mjs
PR_BODY="$(cat .github/PULL_REQUEST_TEMPLATE.md)" node scripts/check-pr-checklist.mjs
```

### 5. Fence Controller-Registry Drift Before Continuing The Migration

Owned files:
- `PLAN.md`
- `src/core/cli.rs`
- `src/core/agent_cli.rs`
- `src/core/memory_cli.rs`
- `src/rpc/dispatch.rs`
- `src/core/all.rs`
- `.github/workflows/typecheck.yml`

Acceptance criteria:
- `PLAN.md` reflects current reality: `text_input`, `screen_intelligence`, and `tree_summarizer` now live behind domain-owned CLI paths, while `agent_cli`, `memory_cli`, and `security_policy_info` remain unresolved.
- A CI grep guard forbids new domain-specific imports or fallback method branches in `src/core/cli.rs`, `src/core/jsonrpc.rs`, and `src/rpc/dispatch.rs`, except explicitly allowed domain-owned CLI entrypoints.
- `openhuman.security_policy_info` has either been moved into the controller registry or is listed as a deliberate exception with owner and validation.

Smallest useful validation:

```bash
! grep -rE '^\\s*use\\s+crate::openhuman::[a-z_]+::' src/core/cli.rs src/core/jsonrpc.rs src/rpc/dispatch.rs
! grep -rE 'crate::openhuman::[a-z_]+::' src/core/cli.rs src/core/jsonrpc.rs src/rpc/dispatch.rs | grep -vE 'crate::openhuman::[a-z_]+::cli::run_[a-z_]+\\('
cargo test -p openhuman --test json_rpc_e2e
```
