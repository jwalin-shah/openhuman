# OpenHuman Implementation Readiness Review

Date: 2026-05-07
Queue item: `openhuman-implementation-readiness`
Branch: `codex/goal-openhuman-implementation-readiness`
Repo: `openhuman`
Pass type: implementation-readiness

2026-05-07 reconciliation note: the sidecar/E2E-build findings in this report
were captured before OpenHuman PR #34 was merged. PR #34 is now merged as
`d3a9bb848c73572e51fbf4a4be7fb1b0ea384a1e`; do not treat the pre-#34
`scripts/stage-core-sidecar.mjs` and sidecar-doc findings below as fresh
blockers unless they still reproduce on current `main`.

## Scope And Inputs

This is a repo-local, read-only implementation readiness pass. I did not edit product code and did not use external services, pushes, PRs, deploys, or tracker updates.

Local evidence inspected:

- Repo structure via `llm-tldr tree .`
- Git state via `git status --short`, `git branch --show-current`, `git log --oneline -10`, `git remote -v`, and `git submodule status`
- Package and crate metadata in `package.json`, `app/package.json`, `Cargo.toml`, and `app/src-tauri/Cargo.toml`
- Architecture and testing docs under `docs/`, especially `docs/ARCHITECTURE.md`, `docs/TESTING-STRATEGY.md`, `docs/E2E-TESTING.md`, `docs/TEST-COVERAGE-MATRIX.md`, `docs/src/README.md`, and `docs/src-tauri/*`
- Agent and PR workflow docs in `AGENTS.md`, `CLAUDE.md`, and `docs/agent-workflows/codex-pr-checklist.md`
- Harness scripts in `scripts/debug/*`, `scripts/test-rust-with-mock.sh`, `app/scripts/e2e-build.sh`, `app/scripts/e2e-run-spec.sh`, and `scripts/ensure-tauri-cli.sh`
- CI workflows under `.github/workflows/`
- Recent repo-local QA reports in `docs/qa/GMEET-PARITY.md`, `docs/qa/WHATSAPP-PARITY.md`, `docs/qa/SLACK-PARITY.md`, `docs/NOTIFICATION_TESTING_STATUS.md`, and `docs/TAURI_CEF_FINDINGS_AND_CHANGES.md`

No previous overnight output was available in this checkout before this report: `rg --files docs/overnight runs items` returned missing-path errors for all three roots.

## Current Readiness Summary

OpenHuman has a strong implementation base for normal vertical slices: clear Rust/domain layering, React/Tauri boundaries, focused debug wrappers, a shared mock backend, many Vitest and Rust tests, and CI coverage gates. The safest next wave should prioritize build and harness correctness before adding broad feature work, because several local contracts still describe the pre-PR-1061 sidecar architecture while the current app runs the core in-process.

The highest leverage implementation-ready work is:

1. Fix stale E2E build/bootstrap assumptions around a missing sidecar staging script.
2. Reconcile docs and agent instructions with the embedded in-process core.
3. Make CEF submodule readiness fail fast for local worktrees and agents.
4. Stop advertising Linux `tauri-driver` E2E as the default automated path while CEF blocks it.
5. Fill small, low-risk coverage matrix gaps with focused unit/component tests before larger feature work.

## Concrete Observations

| # | Evidence | Implementation-readiness observation |
|---|----------|--------------------------------------|
| 1 | `app/package.json` | `core:stage` is now a no-op: "core is linked in-process; sidecar removed (PR #1061)". This is the current package contract. |
| 2 | `app/src-tauri/src/core_process.rs` | The core server is spawned as an embedded Tokio task inside the Tauri host and publishes `OPENHUMAN_CORE_TOKEN`; comments explicitly say there is no sidecar to leak on Cmd+Q. |
| 3 | `app/src/services/coreRpcClient.ts` | Frontend RPC now resolves `core_rpc_url` and `core_rpc_token`, then posts directly over HTTP with `Authorization: Bearer`. The `serviceManaged` relay argument is kept only for compatibility and ignored. |
| 4 | `docs/src-tauri/README.md` | Still says `core:stage` runs `scripts/stage-core-sidecar.mjs` and builds/copies a sidecar into `externalBin`. This contradicts `app/package.json` and `core_process.rs`. |
| 5 | `docs/src-tauri/01-architecture.md` | Documents a `commands/core_relay.rs` module and `core_rpc_relay` path, but the current `app/src-tauri/src/` tree has only `core_rpc.rs` and `core_process.rs`; `rg --files app/src-tauri/src | rg 'core|relay|command'` found no `commands/core_relay.rs`. |
| 6 | `AGENTS.md`, `CLAUDE.md`, `docs/src/README.md`, `docs/TESTING-STRATEGY.md` | Multiple contributor-facing docs still instruct agents to stage or reason about a separate core sidecar. These stale instructions can lead implementation agents to touch the wrong files or validate with dead commands. |
| 7 | `app/scripts/e2e-build.sh` | The script still calls `node "$REPO_ROOT/scripts/stage-core-sidecar.mjs"`, but `rg --files scripts app/scripts | rg 'stage|sidecar|core'` found no such script. `test -f scripts/stage-core-sidecar.mjs` exits 1. |
| 8 | `.gitmodules` and `app/src-tauri/Cargo.toml` | The Tauri shell depends on path crates under `app/src-tauri/vendor/tauri-cef` and `app/src-tauri/vendor/tauri-plugin-notification`. The current worktree has submodules uninitialized: `git submodule status` shows leading `-` for both, and `test -d app/src-tauri/vendor/tauri-cef/crates/tauri` exits 1. |
| 9 | `scripts/ensure-tauri-cli.sh` | This script already gives a useful failure if the CEF submodule is missing and tells the user to run `git submodule update --init --recursive`; implementation agents should hit this preflight before Tauri work. |
| 10 | `.github/workflows/test.yml` | Unit, Rust core, and Rust Tauri tests run in CI, but the Linux and macOS E2E jobs are commented out. User-visible desktop flows are not currently part of the default PR test workflow. |
| 11 | `.github/workflows/e2e-agent-review.yml` | The workflow-level comment says Linux E2E via `tauri-driver` is disabled because this app uses CEF and CEF has no WebDriver automation support. This conflicts with docs that still call Linux `tauri-driver` the default CI path. |
| 12 | `docs/E2E-TESTING.md` | Still documents Linux `tauri-driver` as the default CI path and says `e2e-linux` runs on every push/PR, which is false in `.github/workflows/test.yml` and contradicted by `.github/workflows/e2e-agent-review.yml`. |
| 13 | `docs/TEST-COVERAGE-MATRIX.md` | The matrix is valuable, but it reports 27 partial and 27 missing leaves. It also contains many "(this PR)" notes that are stale in `main`-like docs and should be normalized into current-state language. |
| 14 | `scripts/debug/README.md` | The debug wrappers give implementation agents compact validation surfaces: `pnpm debug unit`, `pnpm debug rust`, and `pnpm debug e2e`. These are the right default commands once the harness contracts are repaired. |
| 15 | `docs/qa/SLACK-PARITY.md` | Slack parity has concrete follow-ups, but several formerly blocking items appear already fixed in current code: `app/src-tauri/src/lib.rs` now manages `slack_scanner::ScannerRegistry::new()` directly. The QA doc still has older status text that should be reconciled before filing duplicate work. |
| 16 | `docs/qa/WHATSAPP-PARITY.md` | WhatsApp follow-ups are implementation-ready where they avoid product judgment: IDB chat-name gaps, DOM correlation, and codec/build investigation are well-scoped. Voice/video call behavior needs a browser control test before treating it as an OpenHuman bug. |
| 17 | `docs/qa/GMEET-PARITY.md` | Meet caption ingestion and background effects are documented as deferred issues. Caption ingestion likely needs privacy/product decisions before implementation; background effects are a CEF runtime investigation. |
| 18 | `.github/workflows/coverage.yml` | The hard coverage gate enforces `diff-cover >= 80%` on changed lines across frontend, Rust core, and Tauri shell LCOV. Follow-up implementation tasks need focused tests in the same PR as changed behavior. |

## Risks And Blockers

- Local Tauri validation is blocked in this worktree until submodules are initialized. `app/src-tauri/Cargo.toml` path dependencies require `app/src-tauri/vendor/tauri-cef/crates/*`, but `git submodule status` shows the CEF submodule is not checked out.
- `pnpm --filter openhuman-app test:e2e:build` is not implementation-ready because `app/scripts/e2e-build.sh` calls a missing `scripts/stage-core-sidecar.mjs`.
- E2E confidence is overstated in docs. The workflow that claims Linux `tauri-driver` support is disabled/commented out because the CEF runtime cannot be driven by WebKitWebDriver.
- Agent-facing docs still describe `core_rpc_relay`, sidecar staging, and service-managed core paths that are no longer the primary implementation. This can waste implementation time and produce wrong validation commands.
- Previous overnight outputs were absent locally, so this report cannot reconcile against `runs/*/result.json`, `runs/*/handoff.md`, or earlier `docs/overnight` reports.
- QA documents are useful but mixed-status: some findings are already fixed in current code while others are deferred or need product/browser-control judgment. They should be used as evidence, not copied directly into new tickets without re-checking current code.

## Exact Validation Commands

Queue validation command:

```bash
git status --short
```

Useful preflight commands for implementation agents:

```bash
git branch --show-current
git submodule status --recursive
test -f AGENTS.md
test -f docs/src/README.md
test -f Cargo.toml
test -f app/package.json
test -d app/src-tauri/vendor/tauri-cef/crates/tauri
```

Smallest validation commands by surface:

```bash
pnpm --filter openhuman-app compile
pnpm --filter openhuman-app lint
pnpm --filter openhuman-app format:check
pnpm debug unit <test-file-or-pattern>
pnpm debug rust <test-filter>
cargo fmt --manifest-path Cargo.toml --all --check
cargo fmt --manifest-path app/src-tauri/Cargo.toml --all --check
cargo check --manifest-path Cargo.toml
cargo check --manifest-path app/src-tauri/Cargo.toml
```

E2E commands are only useful after the stale sidecar call and CEF automation path are reconciled:

```bash
pnpm --filter openhuman-app test:e2e:build
bash app/scripts/e2e-run-spec.sh test/e2e/specs/<spec>.spec.ts <id>
```

## Implementation-Ready Follow-Up Tasks

### 1. Repair The E2E Build Contract After In-Process Core Migration

Owned files:

- `app/scripts/e2e-build.sh`
- `app/package.json`
- `docs/E2E-TESTING.md`
- `docs/TESTING-STRATEGY.md`

Problem:

`app/scripts/e2e-build.sh` still tries to execute missing `scripts/stage-core-sidecar.mjs` even though `app/package.json` says the core is linked in-process and `core:stage` is a no-op.

Acceptance criteria:

- `app/scripts/e2e-build.sh` no longer references `scripts/stage-core-sidecar.mjs`.
- Script comments describe the embedded core path instead of `bundle.externalBin`.
- `app/package.json` E2E scripts still call the same public entrypoints.
- Docs state that E2E build requires initialized CEF submodules and no separate core staging.
- No product code behavior changes.

Smallest useful validation:

```bash
bash -n app/scripts/e2e-build.sh
rg -n "stage-core-sidecar|bundle.externalBin|core sidecar" app/scripts/e2e-build.sh app/package.json docs/E2E-TESTING.md docs/TESTING-STRATEGY.md
```

Full validation when submodules are available:

```bash
pnpm --filter openhuman-app test:e2e:build
```

### 2. Reconcile Agent And Architecture Docs With The Embedded Core

Owned files:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/ARCHITECTURE.md`
- `docs/src/README.md`
- `docs/src-tauri/README.md`
- `docs/src-tauri/01-architecture.md`
- `docs/src-tauri/02-commands.md`
- `docs/src-tauri/03-services.md`
- `docs/agent-workflows/codex-pr-checklist.md`

Problem:

Contributor docs still tell agents to stage, spawn, or relay to a separate sidecar via `core_rpc_relay`, while current code uses an embedded in-process core task plus `core_rpc_url` and `core_rpc_token`.

Acceptance criteria:

- Docs distinguish current in-process core behavior from legacy sidecar/standalone CLI language.
- Dead references to `scripts/stage-core-sidecar.mjs`, `commands/core_relay.rs`, and primary `core_rpc_relay` flow are removed or explicitly marked legacy.
- Validation guidance points implementation agents to `core_process.rs`, `core_rpc.rs`, and `coreRpcClient.ts`.
- The PR checklist preflight includes submodule readiness for Tauri work.

Smallest useful validation:

```bash
rg -n "stage-core-sidecar|core_rpc_relay|commands/core_relay|separately built|externalBin" AGENTS.md CLAUDE.md docs
pnpm --filter openhuman-app format:check
```

### 3. Add A Local Submodule Readiness Preflight For Tauri Worktrees

Owned files:

- `scripts/ensure-tauri-cli.sh`
- `scripts/worktree-bootstrap.sh`
- `scripts/work/start.sh`
- `docs/agent-workflows/codex-pr-checklist.md`
- `docs/install.md`

Problem:

The Tauri shell cannot build without recursive submodules, but this worktree currently has uninitialized `app/src-tauri/vendor/tauri-cef` and `app/src-tauri/vendor/tauri-plugin-notification`. CI checks out submodules recursively, but local/agent worktrees can miss that step.

Acceptance criteria:

- A single preflight command or script reports missing Tauri submodules with exact recovery command.
- Worktree bootstrap and issue-start scripts call the preflight before Tauri validation.
- Docs tell agents that `git submodule update --init --recursive` is required before Tauri shell checks or E2E builds.
- The preflight does not try to fetch network resources unless the user explicitly runs the recovery command.

Smallest useful validation:

```bash
bash scripts/ensure-tauri-cli.sh
git submodule status --recursive
```

Expected current-worktree blocker:

```text
app/src-tauri/vendor/tauri-cef is not initialized; run git submodule update --init --recursive
```

### 4. Normalize The E2E Reality In Docs And CI Metadata

Owned files:

- `docs/E2E-TESTING.md`
- `docs/TESTING-STRATEGY.md`
- `.github/workflows/test.yml`
- `.github/workflows/e2e-agent-review.yml`
- `app/test/wdio.conf.ts`
- `app/scripts/e2e-run-spec.sh`

Problem:

Docs describe Linux `tauri-driver` as the default CI path, but CI comments and the dedicated workflow say CEF cannot be driven by WebKitWebDriver. This makes WDIO specs look more merge-blocking than they are and hides the actual validation gap.

Acceptance criteria:

- Docs clearly state which E2E paths are currently runnable, optional, disabled, or manual.
- CI workflow comments match the docs and no longer imply a disabled job runs on every PR.
- `app/scripts/e2e-run-spec.sh` fails fast with an actionable message if asked to use an unsupported CEF/tauri-driver combination.
- The coverage matrix distinguishes "covered by spec file" from "covered by CI gate" where relevant.

Smallest useful validation:

```bash
bash -n app/scripts/e2e-run-spec.sh
rg -n "Linux \\(CI default\\)|e2e-linux|tauri-driver|CEF" docs/E2E-TESTING.md docs/TESTING-STRATEGY.md .github/workflows/test.yml .github/workflows/e2e-agent-review.yml app/scripts/e2e-run-spec.sh
```

### 5. Fill Low-Risk Coverage Matrix Gaps In Settings And Debug Panels

Owned files:

- `docs/TEST-COVERAGE-MATRIX.md`
- `app/src/components/settings/panels/DeveloperOptionsPanel.tsx`
- `app/src/components/settings/panels/WebhooksDebugPanel.tsx`
- `app/src/components/settings/panels/MemoryDebugPanel.tsx`
- `app/src/components/settings/panels/__tests__/DeveloperOptionsPanel.test.tsx`
- `app/src/components/settings/panels/__tests__/WebhooksDebugPanel.test.tsx`
- `app/src/components/settings/panels/__tests__/MemoryDebugPanel.test.tsx`

Problem:

The coverage matrix marks developer settings leaves as missing or shallow: runtime logs, webhook inspection, and memory debug. These are good first implementation slices because they can be covered with Vitest and mocked core-command calls rather than brittle desktop E2E.

Acceptance criteria:

- Add focused tests for rendering, empty/error states, and core-command invocation for the selected panels.
- Update `docs/TEST-COVERAGE-MATRIX.md` rows `13.4.1`, `13.4.2`, and `13.4.3` from missing to the actual new test paths.
- Include at least one failure/edge assertion per updated leaf, matching `docs/TESTING-STRATEGY.md`.
- No changes to panel UX beyond what is required to make behavior testable.

Smallest useful validation:

```bash
pnpm --dir app exec vitest run app/src/components/settings/panels/__tests__/DeveloperOptionsPanel.test.tsx app/src/components/settings/panels/__tests__/WebhooksDebugPanel.test.tsx app/src/components/settings/panels/__tests__/MemoryDebugPanel.test.tsx --config test/vitest.config.ts
pnpm --filter openhuman-app compile
```

## Suggested Queue Order

1. Repair `app/scripts/e2e-build.sh` so the repo's own E2E entrypoint no longer calls a missing script.
2. Reconcile sidecar/in-process docs so future agents receive the right architecture contract.
3. Add or enforce submodule preflight in local worktree bootstrap paths.
4. Normalize E2E docs/CI reality before trusting WDIO matrix rows as merge coverage.
5. Start low-risk coverage gap work in settings/debug panels, then move to larger QA-derived webview follow-ups after the harness is trustworthy.

## Handoff Notes

- No product code was changed.
- No external trackers were updated.
- No PR was created.
- Current branch observed: `codex/goal-openhuman-implementation-readiness`.
- Current HEAD observed before this report: `f11f2178`.
- Expected validation output after this report is a dirty worktree containing this docs-only report.
