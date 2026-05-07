# openhuman-sym85 workflow-handoff audit

Queue item: `openhuman-sym85-workflow-handoff`
Branch: `codex/goal-openhuman-sym85-workflow-handoff`
Audit date: 2026-05-07
Focus area: `workflow-handoff`

## Scope

This was a read-only workflow handoff audit for the local OpenHuman worktree.
No product code, generated data, external services, deploys, pushes, merges, or
tracker state were changed. The only intended write is this report.

The queue file path named by the runner, `items/openhuman-sym85-workflow-handoff/ISSUE.md`,
is missing from this worktree. I used the inline queue issue text supplied by
the local Goal Worker prompt as the work order and recorded the missing file as
a handoff blocker.

## Repo state

- Purpose: OpenHuman is a React + Tauri desktop app with a Rust `openhuman_core`
  crate, an `openhuman-core` CLI/RPC binary, a CEF-backed Tauri shell, and
  QuickJS-based skills/runtime infrastructure.
- Current branch: `codex/goal-openhuman-sym85-workflow-handoff`.
- Current HEAD: `f11f217809841cf8e3a7f694d8e80967d8e188b8`.
- Initial dirty state: `git status --short --branch` reported only
  `## codex/goal-openhuman-sym85-workflow-handoff`.
- Remotes: `origin` and `jwalin-ssh` point at `jwalin-shah/openhuman`;
  `upstream` points at `tinyhumansai/openhuman`.
- Local issue file: `rtk read items/openhuman-sym85-workflow-handoff/ISSUE.md`
  failed with `No such file or directory`.

## Commands run

- `llm-tldr tree .` - produced a large JSON tree; notable top-level surfaces
  include `app/`, root `src/`, `tests/`, `docs/`, `.github/`, and scripts.
- `fd -a 'ISSUE.md|AGENTS.md|CLAUDE.md|README.md|package.json|Cargo.toml|pnpm-workspace.yaml|docs' . | head -120`
  - confirmed the project docs and manifests are present, but no queue
  `items/.../ISSUE.md` path appeared.
- `rg --files -g 'ISSUE.md' ...` - found repo docs and manifests, but no local
  `ISSUE.md` under `items/`.
- `git log --oneline -5` - HEAD is `f11f2178` and the latest five commits
  include security, Codex PR checklist, webview/GMeet, channel overflow, and
  orchestrator worker changes.
- `git remote -v` - confirmed fork/upstream layout.
- `git submodule status --recursive` - both submodules are uninitialized:
  `app/src-tauri/vendor/tauri-cef` and `app/src-tauri/vendor/tauri-plugin-notification`
  are prefixed with `-`.
- `test -f scripts/stage-core-sidecar.mjs` - exit code `1`; the script referenced
  by several docs and `app/scripts/e2e-build.sh` is missing.
- `test -d node_modules`, `test -d app/node_modules` - both exit code `1`;
  JS dependencies are not installed in this worktree.
- `pnpm --filter openhuman-app exec vitest --version` - failed with
  `Command "vitest" not found`.
- `pnpm --filter openhuman-app exec tsc --version` - failed with
  `Command "tsc" not found`.
- `node -v`, `pnpm --version`, `cargo --version`, `rustc --version` -
  local tools are present: Node `v25.9.0`, pnpm `10.10.0`, Cargo `1.93.0`,
  rustc `1.93.0`.
- `cargo metadata --manifest-path Cargo.toml --no-deps --format-version 1`
  succeeded and identified package `openhuman 0.53.16`.
- Inventory counts: 2247 tracked files, 16 root Rust integration tests,
  41 WDIO E2E specs, 169 app unit test files, 32 Rust-domain README files,
  and 14 GitHub workflow files.

## Evidence map

1. `README.md` describes OpenHuman as a desktop-focused, open-source personal
   AI assistant with local knowledge, skills, local AI, screen intelligence,
   autocomplete, and voice features.
2. `AGENTS.md` is the strongest local agent contract. It documents repo layout,
   runtime boundaries, commands, coverage requirements, controller migration
   rules, event-bus rules, debug logging expectations, and upstream PR policy.
3. `package.json` delegates root commands to the `openhuman-app` workspace and
   declares `packageManager: pnpm@10.10.0`.
4. `app/package.json` requires Node `>=24.0.0`, exposes app build/test/lint
   scripts, and defines `core:stage` as a no-op message saying the core is
   linked in-process and the sidecar was removed in PR `#1061`.
5. `Cargo.toml` defines package `openhuman`, library `openhuman_core`, and
   binaries `openhuman-core`, `slack-backfill`, and `gmail-backfill-3d`.
6. `app/src-tauri/Cargo.toml` embeds `openhuman_core` as a path dependency and
   says the core HTTP/JSON-RPC server runs as a Tokio task inside the Tauri host.
7. `app/src-tauri/src/core_process.rs` confirms the current lifecycle is
   in-process core hosting with stale-listener takeover logic for port drift.
8. `docs/agent-workflows/codex-pr-checklist.md` is the clearest remote-agent
   checklist: preflight, branch/PR rules, validation before PR, parity rules,
   PR body requirements, and CI review handoff.
9. `scripts/debug/README.md` documents the agent-friendly validation wrappers
   (`pnpm debug unit`, `pnpm debug e2e`, `pnpm debug rust`, `pnpm debug logs`).
10. `scripts/work/README.md` and `scripts/work/start.sh` fetch GitHub issues,
    sync `main`, initialize submodules, create a branch, and hand off to an
    LLM CLI with repo conventions.
11. `scripts/review/README.md` and `scripts/review/lib.sh` provide PR sync,
    review, fix, and merge helpers. The merge helper is powerful and should stay
    outside ordinary implementation-agent prompts unless explicitly requested.
12. `.github/PULL_REQUEST_TEMPLATE.md` requires summary, problem, solution,
    checklist, impact, related links, changed-lines coverage, coverage matrix
    updates, and manual-smoke consideration.
13. `.github/workflows/coverage.yml` enforces changed-line coverage through
    merged Vitest, Rust core, and Tauri lcov artifacts with `diff-cover`.
14. `.github/workflows/pr-quality.yml` runs checklist, coverage matrix, and
    markdown link checks as soft `continue-on-error` jobs for non-doc/non-chore
    PRs.
15. `.github/workflows/test.yml` runs frontend coverage, core tests, and Tauri
    shell tests. The Linux and macOS E2E jobs are present but commented out.
16. `.github/workflows/typecheck.yml` runs TypeScript compile, Prettier, ESLint,
    Rust fmt, and Rust clippy.
17. `docs/TESTING-STRATEGY.md` defines the layer decision tree and says no real
    network is allowed in unit, integration, or E2E tests.
18. `docs/TEST-COVERAGE-MATRIX.md` is the feature-test contract and includes
    many explicit missing or partial rows.
19. `docs/AGENT-OBSERVABILITY.md`, `app/scripts/e2e-agent-review.sh`, and
    `app/test/e2e/specs/agent-review.spec.ts` define a canonical agent-readable
    artifact flow for onboarding/privacy E2E review.
20. `.gitmodules` contains the CEF and notification plugin submodules required
    by Tauri shell builds.

## Workflow map

The intended implementation handoff shape is:

1. Start from a tracked issue or PR, not hidden chat memory.
2. Verify repo binding with the Codex PR checklist preflight.
3. Sync `main`, initialize submodules, and create one branch per issue.
4. Implement narrowly according to `AGENTS.md` domain ownership rules.
5. Validate with focused checks through `scripts/debug` where possible, then
   run the relevant merge gates.
6. Fill the PR template with issue link, commit SHA, files changed, validations,
   blocked commands, intended behavior change, and follow-ups.
7. Do not mark external trackers done before PR review/merge.

This map is partly encoded in scripts, but it is split across `AGENTS.md`,
`docs/agent-workflows/codex-pr-checklist.md`, `scripts/work`, `scripts/debug`,
the PR template, and CI workflows. A new worker can follow it, but only if it
notices the contradictions below.

## Risks and stale assumptions

1. Sidecar documentation is stale relative to current code.
   - `AGENTS.md`, `CLAUDE.md`, `docs/BUILDING.md`, `docs/src-tauri/README.md`,
     and `docs/src/README.md` still describe building/staging an `openhuman`
     sidecar through `core:stage` and a missing `scripts/stage-core-sidecar.mjs`.
   - `app/package.json` says `core:stage` is a no-op because the core is linked
     in-process after PR `#1061`.
   - `app/src-tauri/Cargo.toml` and `app/src-tauri/src/core_process.rs` confirm
     the current implementation is in-process core hosting, not a staged child
     sidecar as the main docs say.

2. Some handoff scripts are likely broken for a fresh worktree.
   - `app/scripts/e2e-build.sh` calls missing `scripts/stage-core-sidecar.mjs`.
   - `app/scripts/e2e-agent-review.sh` uses `yarn workspace openhuman-app`
     despite the repo being pnpm-managed.
   - `scripts/worktree-bootstrap.sh` also uses yarn and sidecar staging language.
   - Result: a worker following these scripts can fail before reaching app E2E,
     even if the product code is healthy.

3. Branch and PR target instructions disagree.
   - `AGENTS.md`, `scripts/work/start.sh`, and the Codex PR checklist target
     `main`.
   - `CONTRIBUTING.md` says all PRs target `develop`.
   - For agent handoffs, this creates avoidable risk of PRs against the wrong
     base branch.

4. Fresh worktree validation needs explicit bootstrap gates.
   - `node_modules` and `app/node_modules` are absent in this worktree.
   - `app/src-tauri/vendor/tauri-cef` is not initialized, while Tauri scripts
     and workflows require it.
   - Lightweight checks show Vitest and TypeScript are unavailable until
     dependencies are installed.

5. CI and documentation overstate E2E confidence.
   - `docs/E2E-TESTING.md` describes Linux/macOS E2E workflows, and the repo
     has 41 E2E specs.
   - In `.github/workflows/test.yml`, the Linux and macOS E2E jobs are currently
     commented out.
   - The agent-observability path is valuable, but the wrapper currently depends
     on stale yarn/build assumptions.

6. The PR quality gates are soft.
   - `scripts/check-pr-checklist.mjs` and `scripts/check-coverage-matrix.mjs`
     can fail.
   - `.github/workflows/pr-quality.yml` marks those jobs `continue-on-error:
     true`, so a PR can merge unless another hard gate catches the issue.

7. Local env expectations are easy to miss.
   - `.env`, `app/.env`, and `app/.env.local` are absent in this worktree.
   - Several app scripts source `scripts/load-dotenv.sh`, which exits when the
     default root `.env` file is missing.
   - `app/scripts/e2e-build.sh` tolerates missing `.env`, but `pnpm dev:app`
     does not.

8. External-service and release workflows are high-risk surfaces.
   - `.env.example` points at staging backend URLs and includes JWT/debug fields.
   - Release and review scripts can upload, sign, merge, or call GitHub.
   - These are useful for humans but should not be pulled into implementation
     worker prompts without explicit approval and credential boundaries.

## Next safe work

### Task 1: Align core lifecycle documentation with in-process hosting

Summary: Update agent-facing and developer docs so they describe the current
embedded core model instead of a staged `openhuman` sidecar.

Candidate files:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/BUILDING.md`
- `docs/src-tauri/README.md`
- `docs/src/README.md`
- `.env.example`

Acceptance criteria:

- Docs consistently name the actual root binary as `openhuman-core`.
- Docs distinguish the current in-process Tauri core from the standalone
  `openhuman-core run/serve` debug harness.
- Removed or updated references to missing `scripts/stage-core-sidecar.mjs`.
- `.env.example` no longer implies `OPENHUMAN_CORE_RUN_MODE=child` is the
  default Tauri path unless that is still intentionally supported.
- No product code changes.

Validation command candidates:

- `rg -n "stage-core-sidecar|cargo build --manifest-path Cargo.toml --bin openhuman|core:stage|sidecar" AGENTS.md CLAUDE.md docs .env.example app/package.json app/src-tauri`
  - Expected before task: finds stale and intentional sidecar references.
  - Expected after task: only intentional legacy/debug/release references remain.
- `pnpm --filter openhuman-app format:check`
  - Expected here: currently blocked until JS deps are installed.
- `git diff --check`
  - Expected pass for docs-only changes.

### Task 2: Repair the agent E2E/observability handoff path

Summary: Make `bash app/scripts/e2e-agent-review.sh` and the app E2E build path
match pnpm and the current in-process core lifecycle.

Candidate files:

- `app/scripts/e2e-agent-review.sh`
- `app/scripts/e2e-build.sh`
- `app/scripts/e2e-run-all-flows.sh`
- `app/scripts/e2e-run-spec.sh`
- `docs/AGENT-OBSERVABILITY.md`
- `docs/E2E-TESTING.md`

Acceptance criteria:

- Wrapper scripts use pnpm consistently.
- E2E build no longer calls the missing `scripts/stage-core-sidecar.mjs`, or the
  missing staging script is restored only if it is still intentionally required.
- The agent-observability doc names exact prerequisites: pnpm install,
  submodule init, optional `.env`, and CEF cache requirements.
- The script prints a deterministic artifact directory on success and a clear
  blocker on missing submodules/dependencies.

Validation command candidates:

- `bash app/scripts/e2e-agent-review.sh --help`
  - Expected pass after shell-only fixes.
- `pnpm --filter openhuman-app test:e2e:build`
  - Expected here: blocked until dependencies and submodules are initialized.
- `bash app/scripts/e2e-agent-review.sh --skip-build`
  - Expected pass only after a valid debug bundle exists.

### Task 3: Create a single "agent bootstrap and PR handoff" work pack

Summary: Consolidate the scattered implementation-worker contract into one
short work-pack document that a future agent can follow without reading every
workflow script first.

Candidate files:

- `docs/agent-workflows/codex-pr-checklist.md`
- `scripts/work/README.md`
- `scripts/debug/README.md`
- `.github/PULL_REQUEST_TEMPLATE.md`

Acceptance criteria:

- One canonical doc names preflight, bootstrap, branch, validation, PR body,
  and blocker-reporting requirements.
- It explains which scripts are read-only, which can mutate local branches, and
  which can merge or push.
- It explicitly says `scripts/review/merge.sh` is not for implementation
  workers unless a human asks for merge handling.
- It includes an example final handoff block with changed files, commit SHA,
  validation commands, PR URL, and blockers.

Validation command candidates:

- `rg -n "codex-pr-checklist|pnpm debug|scripts/review/merge|git status --porcelain|PR Body Requirements" docs/agent-workflows scripts`
  - Expected pass as evidence of linked surfaces.
- `pnpm --filter openhuman-app format:check`
  - Expected here: blocked until JS deps are installed.
- `git diff --check`
  - Expected pass for Markdown/script text edits.

### Task 4: Make fresh-worktree blockers machine-checkable

Summary: Add or repair a non-destructive preflight command that reports the
missing pieces before an implementation worker starts expensive validation.

Candidate files:

- `scripts/worktree-bootstrap.sh`
- `scripts/ensure-tauri-cli.sh`
- `docs/agent-workflows/codex-pr-checklist.md`
- possibly a new docs-only checklist or script test under `scripts/`

Acceptance criteria:

- The preflight reports missing `node_modules`, missing submodules, missing
  `.env` when required, and missing Tauri vendored CLI prerequisites.
- It does not run network installs unless the caller explicitly asks.
- It prints exact recovery commands.
- It avoids yarn in pnpm-managed paths.

Validation command candidates:

- `bash scripts/worktree-bootstrap.sh --check` or equivalent if added.
  - Expected after task: exits nonzero here with clear missing-dependency
    messages, without mutating the worktree.
- `git submodule status --recursive`
  - Expected here: currently shows uninitialized submodules.
- `pnpm --filter openhuman-app exec tsc --version`
  - Expected here: blocked until dependencies are installed.

## Validation candidates by surface

- Queue-item validation: `git status --short`
  - Expected after this audit: one untracked or added report file unless the
    runner commits reports later.
- Docs-only follow-up: `git diff --check`
  - Expected pass if no trailing whitespace or conflict markers are introduced.
- Fresh dependency check: `pnpm --filter openhuman-app exec tsc --version`
  - Expected fail in this worktree until `pnpm install` is run.
- App typecheck: `pnpm typecheck`
  - Expected blocked here until dependencies are installed.
- App unit smoke: `pnpm debug unit <changed-test-file-or-pattern>`
  - Expected blocked here until dependencies are installed.
- Core-only Rust metadata: `cargo metadata --manifest-path Cargo.toml --no-deps --format-version 1`
  - Observed pass in this worktree.
- Core Rust tests: `pnpm debug rust <filter>` or `bash scripts/test-rust-with-mock.sh --test json_rpc_e2e`
  - Expected potentially runnable after JS/node mock dependencies are installed;
    not run for this read-only audit.
- Tauri shell checks: `cargo check --manifest-path app/src-tauri/Cargo.toml`
  - Expected blocked here until CEF submodule is initialized.
- Agent-observability E2E: `bash app/scripts/e2e-agent-review.sh`
  - Expected blocked here by missing dependencies/submodules and stale script
    references until Task 2 is fixed.

## Non-goals

- No product behavior changes.
- No edits to Rust, TypeScript, workflow YAML, scripts, package manifests, env
  examples, generated files, or submodules.
- No dependency installation.
- No submodule initialization.
- No cargo build/test, Vitest, WDIO, lint, format, or coverage runs beyond
  lightweight command availability checks.
- No pushes, PR creation, PR merges, external tracker updates, release actions,
  signing, uploads, or remote service calls.

## Unknowns

- Whether PRs should currently target `main` or `develop`; local docs disagree.
- Whether `scripts/stage-core-sidecar.mjs` was intentionally removed after PR
  `#1061` or accidentally dropped while scripts still depended on it.
- Whether the inactive/commented E2E jobs in `.github/workflows/test.yml` are
  intentionally paused or stale.
- Whether `scripts/worktree-bootstrap.sh` is still used by humans; it appears
  materially stale for pnpm and in-process core.
- Whether the uninitialized `app/src-tauri/vendor/tauri-cef` submodule is
  expected in this Goal Pack worktree or is a runner bootstrap gap.
- Whether external Linear/GitHub issue state exists for the queue item; the
  local `items/.../ISSUE.md` file is absent and external trackers were out of
  scope.

## Final handoff for this audit

- Files changed: `docs/overnight/openhuman-sym85-workflow-handoff.md`.
- Product code changed: none.
- Commit SHA at audit time: `f11f217809841cf8e3a7f694d8e80967d8e188b8`.
- PR URL: none; PR creation is out of scope for this queue item.
- Blockers: missing local queue issue file; missing JS dependencies;
  uninitialized `tauri-cef` submodule; missing `scripts/stage-core-sidecar.mjs`
  despite script/doc references; contradictory branch/PR target docs.
