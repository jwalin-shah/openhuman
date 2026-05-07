# openhuman-sym85 risk-and-validation review

Generated: 2026-05-07  
Queue item: `openhuman-sym85-risk-and-validation-review`  
Branch: `codex/goal-openhuman-sym85-risk-and-validation-review`  
Reviewed HEAD: `f11f217809841cf8e3a7f694d8e80967d8e188b8`

## Scope and inputs

This was a read-only risk-and-validation pass plus this report. No product code was changed.

Evidence sources inspected:

- Repo docs: `AGENTS.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/TESTING-STRATEGY.md`, `docs/TEST-COVERAGE-MATRIX.md`, `docs/E2E-TESTING.md`, `docs/RELEASE-MANUAL-SMOKE.md`, `docs/src-tauri/*`.
- CI/config: `.github/workflows/{build.yml,test.yml,typecheck.yml,coverage.yml,pr-quality.yml,e2e-agent-review.yml,build-windows.yml}`, `.github/Dockerfile`, package/Cargo manifests.
- Test/scripts: `app/test/**`, `scripts/debug/**`, `scripts/test-rust-with-mock.sh`, `app/scripts/e2e-*.sh`, `scripts/mock-api-core.mjs`.
- Current git state: `git status --short --branch` reported a clean worktree on the expected branch before this report.
- Prior overnight outputs: no `docs/overnight/`, `runs/`, `result.json`, or `handoff.md` artifacts existed in this repo before this report.

## Concrete observations

1. `app/package.json` says `core:stage` is a no-op: `core is linked in-process; sidecar removed (PR #1061)`.
2. `app/src-tauri/src/core_process.rs` documents the current behavior: the core HTTP/JSON-RPC server runs as a Tokio task inside the Tauri host, so there is no sidecar process to stage.
3. `AGENTS.md`, `CLAUDE.md`, `docs/src-tauri/README.md`, `docs/src-tauri/01-architecture.md`, and `docs/src-tauri/03-services.md` still describe a staged/spawned `openhuman` sidecar and reference `scripts/stage-core-sidecar.mjs`, but that script is absent.
4. `app/src-tauri/Cargo.toml` depends on `vendor/tauri-cef` and `vendor/tauri-plugin-notification` path crates, and `git submodule status --recursive` showed both submodules with leading `-`, meaning they are not initialized in this worktree.
5. `.github/workflows/test.yml` has the Linux and macOS E2E jobs commented out, while `docs/E2E-TESTING.md` says Linux E2E is the default CI path.
6. `.github/workflows/e2e-agent-review.yml` explicitly says Linux E2E is disabled because `tauri-driver` cannot drive the CEF-backed webview, but the workflow still has a manual-dispatch body that would run the old tauri-driver path.
7. `app/test/e2e/specs/` contains 41 WDIO specs, but `app/scripts/e2e-run-all-flows.sh` runs 16 specs; newer cited flows such as tools, browser, memory, rewards, insights, Slack, WhatsApp, notifications, and webhooks are not in the "all flows" runner.
8. `docs/TEST-COVERAGE-MATRIX.md` reports 27 missing and 27 partial feature leaves, including auth linking/revocation, permission refresh, local AI settings persistence, settings/developer-tool surfaces, state reset, and webhook/runtime-log panels.
9. `.github/workflows/pr-quality.yml` keeps checklist, coverage-matrix, and markdown-link jobs `continue-on-error: true`, so PR checklist and matrix drift are observable but not merge-blocking.
10. `.github/workflows/coverage.yml` is the hard changed-line coverage gate at `diff-cover --fail-under=80` across frontend, core, and Tauri lcov artifacts.
11. `.github/workflows/test.yml` uploads `coverage`, but the coverage workflow and Vitest config place lcov under `app/coverage`; this can produce missing or low-value coverage artifacts in the general test workflow.
12. Root `package.json` enforces pnpm and exposes `pnpm --filter openhuman-app ...` scripts, but `.github/workflows/build-windows.yml` and `app/scripts/e2e-agent-review.sh` still use Yarn commands. `build-windows.yml` also uploads `steps.core-paths.outputs.*` even though no `core-paths` step exists in that workflow.
13. `app/src-tauri/src/lib.rs` is about 2100 lines and `app/src-tauri/src/webview_accounts/mod.rs` is about 3110 lines, far above the repo's preferred ~500-line module guideline, increasing review and regression risk around desktop lifecycle and embedded provider webviews.
14. `scripts/mock-api-core.mjs` is about 1380 lines and is the shared API fixture for unit and E2E tests; new mock coverage is centralized but increasingly hard to audit for per-feature behavior drift.
15. `docs/ONBOARDING-TEST-RESULTS.md` records a 92% onboarding-agent pass rate with 3 failed scenarios and weak checks for `uses_openhuman_link` and `educates_capabilities`, so onboarding is not fully validated despite a high aggregate pass rate.
16. `docs/NOTIFICATION_TESTING_STATUS.md` still lists real Slack notification verification, CEF shim verification, manual helper verification, and post-verification debug cleanup as needed, which are release-risk items not covered by automated CI.

## Risks and blockers

- **Tauri validation is blocked locally until submodules are initialized.** The current worktree has empty vendored directories for CEF and notification plugin path dependencies, so `cargo test --manifest-path app/src-tauri/Cargo.toml`, `cargo check --manifest-path app/src-tauri/Cargo.toml`, and Tauri coverage/builds are expected to fail here without `git submodule update --init --recursive`.
- **Core lifecycle documentation is stale.** Agents following docs may waste time building/staging a removed sidecar or looking for a missing `scripts/stage-core-sidecar.mjs` instead of validating the in-process core path.
- **E2E coverage claims are easy to over-trust.** Matrix rows mark many WDIO specs as covered, but the default PR CI has no active E2E job and the canonical "all flows" script does not run more than half of the specs.
- **Soft PR quality gates allow process drift.** Checklist/matrix/link validation can fail without blocking, even though the PR template treats matrix, feature IDs, failure-path coverage, and manual-smoke updates as required.
- **Windows build workflow has stale package-manager and output references.** `build-windows.yml` still uses Yarn and references undefined `core-paths` outputs, creating high odds that manual Windows validation fails before it reaches product behavior.
- **Release/manual surfaces remain under-tested.** OS notifications, TCC permissions, Gatekeeper, installer flows, and update/relaunch depend on manual smoke, and the notification status doc still lists unresolved real-world Slack verification steps.

## Exact validation commands

Queue validation required by this worker:

```bash
git status --short
```

Useful repo validation commands identified from docs, manifests, and CI:

```bash
pnpm --filter openhuman-app compile
pnpm --filter openhuman-app format:check
pnpm --filter openhuman-app lint
pnpm --filter openhuman-app test:coverage
bash scripts/test-rust-with-mock.sh
cargo test -p openhuman
cargo test --manifest-path app/src-tauri/Cargo.toml
cargo fmt --all -- --check
cargo clippy -p openhuman
pnpm --filter openhuman-app test:e2e:build
bash app/scripts/e2e-run-spec.sh test/e2e/specs/smoke.spec.ts smoke
```

Known local blocker before Tauri validation:

```bash
git submodule update --init --recursive
```

## Implementation-ready follow-up tasks

### 1. Reconcile core lifecycle docs with in-process core

Owned files:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/ARCHITECTURE.md`
- `docs/src-tauri/README.md`
- `docs/src-tauri/01-architecture.md`
- `docs/src-tauri/03-services.md`
- `docs/BUILDING.md`

Acceptance criteria:

- No docs claim that `app/package.json` `core:stage` stages a sidecar for normal desktop operation.
- No docs reference missing `scripts/stage-core-sidecar.mjs`.
- Docs explain current in-process core behavior from `app/src-tauri/src/core_process.rs`, plus the separate standalone CLI/release sidecar cases where they still exist.

Smallest useful validation:

```bash
rg -n "stage-core-sidecar|core:stage|sidecar|linked in-process|run_server_embedded" AGENTS.md CLAUDE.md docs app/package.json app/src-tauri/src/core_process.rs
```

### 2. Make E2E status truthful and define the executable CEF path

Owned files:

- `docs/E2E-TESTING.md`
- `.github/workflows/test.yml`
- `.github/workflows/e2e-agent-review.yml`
- `app/scripts/e2e-run-all-flows.sh`
- `app/scripts/e2e-agent-review.sh`

Acceptance criteria:

- Docs no longer say Linux tauri-driver E2E is default CI while the job is commented out/disabled.
- The "all flows" runner either covers all intended specs or is renamed/scoped to the exact subset it runs.
- `app/scripts/e2e-agent-review.sh` uses pnpm, not Yarn.
- The workflow/doc comment names the current CEF automation blocker and the intended replacement path.

Smallest useful validation:

```bash
rg -n "tauri-driver|default CI|disabled|yarn|test:e2e:all:flows|e2e-linux" docs/E2E-TESTING.md .github/workflows/test.yml .github/workflows/e2e-agent-review.yml app/scripts/e2e-run-all-flows.sh app/scripts/e2e-agent-review.sh
```

### 3. Fix Windows build workflow rot

Owned files:

- `.github/workflows/build-windows.yml`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

Acceptance criteria:

- Windows workflow uses pnpm consistently with the repo package manager.
- Undefined `steps.core-paths.outputs.*` upload references are removed or backed by a real step.
- The workflow either builds only the desktop app or explicitly builds/uploads a standalone CLI artifact with real paths.

Smallest useful validation:

```bash
rg -n "yarn|cache: yarn|core-paths|pnpm" .github/workflows/build-windows.yml package.json pnpm-workspace.yaml
```

### 4. Harden PR process gates after parser confidence

Owned files:

- `.github/workflows/pr-quality.yml`
- `scripts/check-pr-checklist.mjs`
- `scripts/check-coverage-matrix.mjs`
- `scripts/lib/checklist-parser.mjs`
- `scripts/lib/coverage-matrix-parser.mjs`
- `app/test/checklist-parser.test.ts`
- `app/test/coverage-matrix-parser.test.ts`

Acceptance criteria:

- Checklist and coverage-matrix jobs are hard failures for non-doc/non-chore PRs, or the workflow documents an explicit temporary sunset date.
- Parser tests cover `N/A:` checklist items, unchecked items, duplicate matrix IDs, missing catalog IDs, and malformed rows.
- PR body requirements in `.github/PULL_REQUEST_TEMPLATE.md` match what the parser actually enforces.

Smallest useful validation:

```bash
pnpm --filter openhuman-app test -- app/test/checklist-parser.test.ts app/test/coverage-matrix-parser.test.ts
node scripts/check-coverage-matrix.mjs
```

### 5. Split validation-critical mega-files into auditable modules

Owned files:

- `app/src-tauri/src/lib.rs`
- `app/src-tauri/src/webview_accounts/mod.rs`
- `scripts/mock-api-core.mjs`
- Existing adjacent tests under `app/src-tauri/src/*_tests.rs`, `app/src/lib/**`, and `app/test/e2e/specs/**`

Acceptance criteria:

- Extract one low-risk section at a time: app update commands, webview notification forwarding, provider scanner wiring, or mock server route groups.
- Public command names, mock endpoints, and E2E request shapes remain unchanged.
- Parity tests exist for the extracted surface before further refactors stack on top.

Smallest useful validation:

```bash
pnpm --filter openhuman-app test -- app/src/lib/webviewNotifications/service.test.ts app/test/checklist-parser.test.ts
cargo test --manifest-path app/src-tauri/Cargo.toml core_process
```

## Handoff

- Report written: `docs/overnight/2026-05-07-whole-portfolio-review/openhuman-sym85-risk-and-validation-review.md`
- Product code changed: no.
- External services, PRs, pushes, and tracker updates: none.
- Main blocker for deeper local validation: uninitialized Tauri submodules in this worktree.
