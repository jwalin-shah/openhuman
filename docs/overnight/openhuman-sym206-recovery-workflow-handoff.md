# Overnight Audit: openhuman-sym206-recovery Workflow Handoff

Queue item: `openhuman-sym206-recovery-workflow-handoff`
Focus area: `workflow-handoff`
Repo path: `/Users/jwalinshah/projects/agent-stack/.agent-stack-worktrees/2026-05-07-overnight-marathon/openhuman-sym206-recovery-workflow-handoff`
Audit date: 2026-05-07

## Purpose And Local State

OpenHuman is a desktop-focused React + Tauri v2 app with a Rust core crate. The
root Rust package is `openhuman` with binary `openhuman-core`; the Tauri shell
links `openhuman_core` as a path dependency and starts the core JSON-RPC server
in-process.

Local state observed during the audit:

- `git branch --show-current` -> `codex/goal-openhuman-sym206-recovery-workflow-handoff`.
- `git rev-parse HEAD` -> `f11f217809841cf8e3a7f694d8e80967d8e188b8`.
- Initial `git status --short` and `git status --porcelain=v1` -> no output, clean before this report.
- `git remote -v` -> `origin` is `https://github.com/jwalin-shah/openhuman.git`, `jwalin-ssh` is `git@github.com:jwalin-shah/openhuman.git`, and `upstream` is `https://github.com/tinyhumansai/openhuman.git`.
- `git log --oneline -5` starts with `f11f2178` (`Fix shell injection vulnerability in browser screenshot tool`) followed by `a7479237` (`docs: add Codex PR checklist for remote agents`).
- `pnpm --version` -> `10.10.0`; `node --version` -> `v25.9.0`; `rustc --version` -> `rustc 1.93.0`; `cargo --version` -> `cargo 1.93.0`.
- `test -d node_modules` and `test -d app/node_modules` exited 1, so this worktree does not currently have JS dependencies installed.
- `git submodule status --recursive` shows leading `-` for both vendored Tauri submodules:
  `app/src-tauri/vendor/tauri-cef` at `f1ee9554...` and
  `app/src-tauri/vendor/tauri-plugin-notification` at `36c4004...`.
- `rg --files app/src-tauri/vendor/tauri-cef` and
  `rg --files app/src-tauri/vendor/tauri-plugin-notification` exited 1, confirming those submodule working trees have no checked-out files here.

## Evidence Map

These are the local files and command observations another worker should treat
as the handoff baseline:

- `README.md` positions the product as early beta, desktop-focused, local-first,
  and broad in feature claims.
- `CLAUDE.md` is the most current agent guide in several places: it documents
  PRs targeting `main`, pushes to the user's fork, Node 24, pnpm, CEF runtime,
  no new JS injection into migrated provider webviews, and in-process core
  lifecycle after PR #1061.
- `AGENTS.md` and `docs/BUILDING.md` still describe `cd app && pnpm core:stage`
  as a real sidecar staging step.
- `app/package.json` sets `core:stage` to a no-op string:
  `[core:stage] no-op - core is linked in-process; sidecar removed (PR #1061)`.
- `app/src-tauri/Cargo.toml` links `openhuman_core = { path = "../..", package = "openhuman" }`
  and comments that the core runs in-process to avoid orphan-sidecar bugs.
- `app/src-tauri/src/core_process.rs` confirms the runtime behavior: it spawns
  `openhuman_core::core::jsonrpc::run_server_embedded(...)` as an in-process
  Tokio task, still using port `7788` and stale-listener takeover logic.
- `app/src-tauri/tauri.conf.json` has no `bundle.externalBin`; bundled
  resources are only prompts and `recipes/**/*`.
- `docs/src-tauri/README.md`, `docs/src-tauri/01-architecture.md`, and
  `docs/src-tauri/03-services.md` still describe a separately built `openhuman`
  sidecar and a `commands/` source directory that is not present under
  `app/src-tauri/src/`.
- `app/scripts/e2e-build.sh` still executes
  `node "$REPO_ROOT/scripts/stage-core-sidecar.mjs"`, but
  `scripts/stage-core-sidecar.mjs` is missing (`rtk read` failed and
  `rg --files | rg '^scripts/stage-core-sidecar\.mjs$'` exited 1).
- `app/scripts/e2e-agent-review.sh` still calls
  `yarn workspace openhuman-app test:e2e:build`, while `package.json` pins pnpm
  and there is no `yarn.lock`.
- `.github/workflows/e2e-agent-review.yml` is explicit that Linux E2E is
  disabled/manual because CEF has no tauri-driver automation path, but
  `docs/E2E-TESTING.md` still presents Linux tauri-driver as the default CI path.
- `scripts/debug/README.md` and `scripts/debug/*.sh` provide the best bounded
  validation interface for agents (`pnpm debug unit`, `pnpm debug rust`,
  `pnpm debug e2e`), but several older scripts and docs still reference yarn.
- `.github/workflows/typecheck.yml` runs TypeScript compile, Prettier check,
  ESLint, cargo fmt, and clippy in the CI image.
- `.github/workflows/test.yml` runs frontend coverage, `cargo test -p openhuman`,
  and Tauri shell tests, while its Linux/macOS E2E jobs are commented out.
- `.github/workflows/coverage.yml` enforces `diff-cover >= 80%` on changed lines
  by merging frontend, Rust core, and Tauri lcov artifacts.
- `.github/workflows/pr-quality.yml` has PR checklist, coverage matrix, and
  markdown link checks as soft gates (`continue-on-error: true`) for non-docs
  and non-chore PRs.
- `.github/PULL_REQUEST_TEMPLATE.md` requires tests, diff coverage, coverage
  matrix updates, release smoke updates when applicable, and issue closure.
- `docs/agent-workflows/codex-pr-checklist.md` is the clearest remote-agent PR
  handoff contract: preflight, branch rules, validation commands, PR body
  requirements, and CI follow-up.
- `docs/TESTING-STRATEGY.md`, `docs/TEST-COVERAGE-MATRIX.md`, and
  `docs/RELEASE-MANUAL-SMOKE.md` define test layering, coverage ownership, and
  manual-smoke exceptions.
- `scripts/work/README.md` and `scripts/work/start.sh` automate issue pickup
  with `gh`, sync `main`, create a branch, and launch an LLM CLI, but currently
  assume GitHub issues rather than Linear.
- `PLAN.md` is still useful as a controller-registry consolidation plan, but
  its current-leakage list is stale: `src/core/agent_cli.rs`,
  `src/core/memory_cli.rs`, and `src/rpc/dispatch.rs` remain, while
  `text_input`, `tree_summarizer`, and `screen_intelligence` now live under
  domain-owned `cli.rs` modules.

## Workflow Risks And Stale Assumptions

1. Sidecar-to-in-process migration is only partially reflected in docs and
   scripts. `app/src-tauri/src/core_process.rs` and `app/src-tauri/Cargo.toml`
   show the current in-process core, but `AGENTS.md`, `CLAUDE.md` sections,
   `docs/BUILDING.md`, `docs/src-tauri/*`, and `app/scripts/e2e-build.sh` still
   send agents toward staging a sidecar or a missing `scripts/stage-core-sidecar.mjs`.

2. E2E handoff is ambiguous. `docs/E2E-TESTING.md` says Linux tauri-driver is
   the default CI path, while `.github/workflows/e2e-agent-review.yml` says the
   CEF runtime cannot be driven by WebKitWebDriver and the Linux path is
   workflow-dispatch only. A worker could burn a long session trying to make
   the wrong E2E path pass.

3. Package manager drift remains in handoff surfaces. Root `package.json` pins
   pnpm, yet `app/scripts/e2e-agent-review.sh`, `scripts/worktree-bootstrap.sh`,
   `scripts/test-ci-local.sh`, `scripts/setup-dev-codesign.sh`, and older docs
   still say yarn. Because Yarn 1.22.22 is installed locally, stale commands may
   fail late or mutate the wrong lockfile expectations.

4. This worktree is not ready for Rust/Tauri validation without bootstrap. The
   two required vendored submodules are registered but not checked out, and
   there are no local JS dependencies. Any Tauri build, Tauri test, or app
   command should first run `git submodule update --init --recursive` and
   `pnpm install --frozen-lockfile`.

5. PR routing differs across docs. `CLAUDE.md` says push branches to `origin`
   (`senamakel/openhuman`) and open PRs against upstream `main`; `AGENTS.md`
   says upstream `tinyhumansai/openhuman` and `main`; `CONTRIBUTING.md` still
   says PRs target `develop`. Remote agents need one current rule, or they will
   create review artifacts in the wrong place.

6. The controller-registry plan has progressed but the plan file was not
   reconciled. `PLAN.md` still lists six CLI adapters, while current grep shows
   only `src/core/agent_cli.rs`, `src/core/memory_cli.rs`, and the
   `openhuman.security_policy_info` fallback in `src/rpc/dispatch.rs` remain in
   the transport layer.

7. Some current scripts are directly broken in this checkout. The missing
   `scripts/stage-core-sidecar.mjs` makes `app/scripts/e2e-build.sh` fail before
   it reaches Tauri. That cascades into `pnpm --filter openhuman-app test:e2e:build`
   and any wrapper that depends on it.

## Decisions For The Next Worker

- Treat `CLAUDE.md`, `app/src-tauri/Cargo.toml`, `app/src-tauri/src/core_process.rs`,
  and `.github/workflows/build.yml` as more current than the sidecar-staging
  language in older docs.
- Do not use E2E as the default proof for normal product work until the CEF
  automation story is clarified. Prefer focused Vitest, Rust unit/integration,
  and the bounded `pnpm debug` wrappers; use manual smoke or workflow-dispatch
  E2E only when the issue explicitly calls for it.
- For any future implementation slice, bootstrap first with submodules and pnpm
  install. This audit did not mutate dependencies because the queue item is
  read-only except for this report.
- For the controller-registry recovery work, start from current grep results
  rather than the stale `PLAN.md` leakage table.

## Next Safe Work Packs

### 1. Reconcile in-process core docs and broken E2E build script

Problem: Core lifecycle docs and `app/scripts/e2e-build.sh` still mention or
execute removed sidecar staging.

Scope:

- Update `AGENTS.md`, `CLAUDE.md`, `docs/BUILDING.md`,
  `docs/src-tauri/README.md`, `docs/src-tauri/01-architecture.md`,
  `docs/src-tauri/03-services.md`, and any obvious command snippets to describe
  the in-process core accurately.
- Remove or guard the missing `node "$REPO_ROOT/scripts/stage-core-sidecar.mjs"`
  call in `app/scripts/e2e-build.sh`.
- Keep release-only standalone CLI sidecar language where it is still true
  (`.github/workflows/build-desktop.yml` has a `build_sidecar` input).

Acceptance criteria:

- `rg -n "scripts/stage-core-sidecar|core:stage|externalBin|sidecar" AGENTS.md CLAUDE.md docs app/scripts app/package.json app/src-tauri/tauri.conf.json`
  shows only intentional, current references.
- `pnpm --filter openhuman-app test:e2e:build` no longer fails because
  `scripts/stage-core-sidecar.mjs` is missing, assuming dependencies and
  submodules are bootstrapped.
- Docs distinguish production in-process core from optional standalone
  `openhuman-core` CLI/release artifact surfaces.

Validation candidates:

- `git submodule update --init --recursive` - expected pass before Tauri work.
- `pnpm install --frozen-lockfile` - expected pass in a network-enabled/dev
  environment.
- `pnpm --filter openhuman-app test:e2e:build` - currently expected fail in this
  unbootstrapped worktree; after the fix and bootstrap, expected to reach the
  normal Tauri/CEF build path.
- `pnpm --filter openhuman-app format:check` - expected pass after doc/script
  formatting.

### 2. Normalize package-manager and PR-routing handoff rules

Problem: Handoff surfaces mix pnpm/yarn and `main`/`develop`/fork/upstream PR
rules.

Scope:

- Replace active yarn commands in `app/scripts/e2e-agent-review.sh`,
  `scripts/worktree-bootstrap.sh`, `scripts/setup-dev-codesign.sh`, and docs
  that are not clearly historical archives.
- Decide whether `CONTRIBUTING.md` is public historical guidance or current
  contributor guidance. If current, update it to pnpm and `main`; if historical,
  add a banner that agent workflows should follow `CLAUDE.md` and
  `docs/agent-workflows/codex-pr-checklist.md`.
- Update `scripts/work/README.md` or script prompts if Linear is now the source
  of truth for planned product work; otherwise document that `pnpm work` is
  GitHub-issue-only.

Acceptance criteria:

- `rg -n "yarn" app/scripts scripts docs .github package.json app/package.json`
  has only intentional historical or release-package references.
- `rg -n "develop|main|origin|upstream|senamakel|jwalin-shah" CLAUDE.md AGENTS.md CONTRIBUTING.md docs/agent-workflows/codex-pr-checklist.md`
  presents one non-contradictory path for agent PRs.
- The PR template and agent checklist agree on commit SHA, validation, coverage,
  and PR body requirements.

Validation candidates:

- `pnpm --filter openhuman-app format:check` - expected pass for edited markdown
  and shell snippets once dependencies are installed.
- `bash -n app/scripts/e2e-agent-review.sh scripts/worktree-bootstrap.sh scripts/setup-dev-codesign.sh` - expected pass after shell edits.
- `node scripts/check-pr-checklist.mjs` with a fixture PR body - expected pass
  only when all required template checklist items are checked or marked `N/A`.

### 3. Finish current controller-registry recovery slice from actual state

Problem: `PLAN.md` overstates remaining CLI leakage. Current grep shows only
`agent`, `memory`, and `security_policy_info` transport fallback remain.

Scope:

- Update `PLAN.md` or create a fresh issue/work pack based on current files:
  `src/core/agent_cli.rs`, `src/core/memory_cli.rs`, `src/core/cli.rs`,
  `src/core/mod.rs`, `src/rpc/dispatch.rs`, `src/openhuman/security/ops.rs`,
  and domain `schemas.rs` files.
- Split into separate implementation tasks:
  1. migrate `openhuman.security_policy_info` into a domain controller and
     remove `src/rpc/dispatch.rs` fallback,
  2. migrate or domain-own `memory` CLI adapter,
  3. migrate or domain-own `agent` CLI adapter,
  4. add a focused guard that rejects new domain imports in transport files.
- Include parity smoke commands for each public CLI command before deleting an
  adapter.

Acceptance criteria:

- `rg -n "crate::core::memory_cli|crate::core::agent_cli|openhuman.security_policy_info" src/core src/rpc`
  is empty or only appears in tests explicitly proving removal.
- `src/core/all.rs` owns registered controller discovery; `src/core/cli.rs`
  has only generic dispatch plus explicitly allowed domain-owned CLI adapter
  calls.
- Existing CLI method names and JSON-RPC method names remain unchanged unless a
  follow-up issue explicitly approves a break.

Validation candidates:

- `cargo fmt --manifest-path Cargo.toml --all --check` - expected pass after
  Rust edits.
- `cargo test -p openhuman core::all core::cli rpc::dispatch` - expected pass
  for focused registry and CLI tests after updating filters to valid Cargo
  test names.
- `pnpm debug rust json_rpc_e2e` - expected pass once JS deps and mock backend
  can start locally.
- Manual CLI smoke, after `cargo build --bin openhuman-core`:
  `./target/debug/openhuman-core call --method openhuman.security_policy_info --params '{}'`
  should either still work through the new controller or be replaced with the
  documented canonical method name.

### 4. Clarify CEF E2E strategy and agent-observable artifacts

Problem: The repo has a good artifact-capture layer, but the normal E2E driver
story is contradictory for CEF.

Scope:

- Update `docs/E2E-TESTING.md` to say which E2E paths are active, disabled,
  manual, or macOS-only.
- Link `.github/workflows/e2e-agent-review.yml` and
  `docs/AGENT-OBSERVABILITY.md` from the main testing strategy.
- Decide whether `scripts/debug e2e` should refuse to run on Linux CEF unless a
  supported driver is present.

Acceptance criteria:

- `docs/E2E-TESTING.md`, `.github/workflows/e2e-agent-review.yml`, and
  `docs/TESTING-STRATEGY.md` agree on CEF/Linux status.
- `bash app/scripts/e2e-agent-review.sh --help` uses pnpm and does not claim to
  stage a removed sidecar.
- New workers can choose between unit, Rust integration, E2E artifact capture,
  and manual smoke without reading workflow source.

Validation candidates:

- `pnpm debug e2e test/e2e/specs/agent-review.spec.ts agent-review --verbose`
  - expected fail in this unbootstrapped local worktree; expected pass only
  after dependencies, submodules, built app, and a supported driver are present.
- `rg -n "tauri-driver|CEF|WebKitWebDriver|agent-review" docs .github app/scripts`
  - expected to show a consistent status narrative after docs edits.

## Validation Command Candidates

Required queue validation:

- `git status --short` - expected pass (exit 0). After this report is written
  and before commit, expected output is `?? docs/overnight/` because the new
  report directory is untracked.

Cheap read-only/audit validation:

- `git status --porcelain=v1` - expected pass; clean before this report.
- `git submodule status --recursive` - expected pass; current output marks
  vendored submodules with leading `-`, meaning not initialized.
- `pnpm --version`, `node --version`, `rustc --version`, `cargo --version` -
  expected pass; observed versions are listed above.

Pre-implementation bootstrap validation:

- `git submodule update --init --recursive` - expected pass where network and
  GitHub access are available; required before CEF/Tauri work.
- `pnpm install --frozen-lockfile` - expected pass where npm registry access is
  available; required before frontend validation because local `node_modules`
  is absent.

Merge-gate validation for future product changes:

- `pnpm --filter openhuman-app format:check` - expected pass after formatting.
- `pnpm typecheck` - expected pass after TS changes.
- `pnpm lint` - expected pass after app changes.
- `pnpm debug unit <changed-test-file-or-name>` - expected pass for focused
  frontend logic.
- `pnpm debug rust <test-filter>` - expected pass for focused Rust behavior
  once mock backend and dependencies are available.
- `cargo fmt --manifest-path Cargo.toml --all --check` and
  `cargo fmt --manifest-path app/src-tauri/Cargo.toml --all --check` - expected
  pass for Rust edits.

Known likely failures in this exact worktree without bootstrap:

- `pnpm --filter openhuman-app test:e2e:build` can fail because
  `app/scripts/e2e-build.sh` calls missing `scripts/stage-core-sidecar.mjs` and
  because dependencies/submodules are not installed.
- Any Tauri build/check using `app/src-tauri/Cargo.toml` can fail while
  `app/src-tauri/vendor/tauri-cef` and
  `app/src-tauri/vendor/tauri-plugin-notification` are empty submodule dirs.

## Non-Goals

- No product code changes.
- No dependency installation, submodule checkout, generated artifacts, or cache
  mutation.
- No external service calls, deployments, pushes, PR creation, issue updates, or
  tracker state changes.
- No attempt to run broad build/test suites in an unbootstrapped worktree.
- No decision on product behavior; this report only maps handoff risk and next
  safe implementation slices.

## Unknowns

- Whether this worktree is intentionally shallow/unbootstrapped by the overnight
  runner or whether missing submodules are a setup bug.
- Whether `CONTRIBUTING.md` should remain public contributor guidance targeting
  `develop` or should be updated to the agent/current `main` workflow.
- Whether Linux CEF automation has a planned replacement for tauri-driver, or
  whether E2E should be considered macOS/manual-only until that lands.
- Whether `scripts/stage-core-sidecar.mjs` was intentionally deleted after
  PR #1061 or accidentally omitted while scripts/docs still reference it.
- Whether `PLAN.md` should be maintained as an active execution plan or replaced
  by Linear/GitHub issues for the remaining controller-registry work.

## Handoff

Files changed by this queue item:

- `docs/overnight/openhuman-sym206-recovery-workflow-handoff.md`

Commit SHA at audit time:

- `f11f217809841cf8e3a7f694d8e80967d8e188b8`

Validation run:

- `git status --short` exited 0 after writing this report and printed
  `?? docs/overnight/`.

PR URL:

- None. PR creation is out of scope for this goal pack item.

Blockers:

- None for the required docs-only report.
- Future implementation work is blocked until the worker bootstraps submodules
  and JS dependencies.
- Future E2E work is blocked on clarifying CEF-compatible automation, because
  the current Linux tauri-driver story is documented as disabled in workflow
  comments.
