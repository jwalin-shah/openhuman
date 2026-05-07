# openhuman-sym208-recovery-workflow-handoff

Queue item: `openhuman-sym208-recovery-workflow-handoff`  
Focus area: workflow handoff  
Repo path: `/Users/jwalinshah/projects/agent-stack/.agent-stack-worktrees/2026-05-07-overnight-marathon/openhuman-sym208-recovery-workflow-handoff`  
Report date: 2026-05-07

## Scope and Contract

This audit was read-only except for this report. No product code, generated data,
secrets, external services, deploys, pushes, PRs, or tracker state were changed.

The queue metadata pointed at
`items/openhuman-sym208-recovery-workflow-handoff/ISSUE.md`, but that file and
the `items/` directory are absent in this worktree. I used the issue text from
the Goal Pack prompt as the task contract and recorded the missing local issue
file as a handoff risk.

## Repo Purpose and Current State

OpenHuman is a desktop AI assistant monorepo with a React/Vite frontend under
`app/`, a Tauri v2 desktop host under `app/src-tauri/`, and a Rust core crate at
repo root under `src/`. Local docs and manifests describe a broad surface:
controller-registry RPC, skills, memory, webview connectors, E2E harnesses,
release/install scripts, and AI-agent workflow helpers.

Observed git state before writing this report:

| Observation | Evidence |
|---|---|
| Current branch | `git rev-parse --abbrev-ref HEAD` -> `codex/goal-openhuman-sym208-recovery-workflow-handoff` |
| Initial dirty state | `git status --short --branch` -> branch line only; `git status --porcelain=v1` -> empty |
| Initial HEAD | `git rev-parse HEAD` -> `f11f217809841cf8e3a7f694d8e80967d8e188b8` |
| Local branch vs origin | `git rev-list --left-right --count origin/main...HEAD` -> `0 0` |
| Local branch vs local upstream ref | `git rev-list --left-right --count upstream/main...HEAD` -> `154 2` |
| Local `main` is not current | `git for-each-ref ... main origin/main upstream/main` -> `main` at `b1b82f42`, `origin/main` at `f11f2178`, `upstream/main` at `a6c7b0f8` |
| Remotes | `origin` and `jwalin-ssh` point to `jwalin-shah/openhuman`; `upstream` points to `tinyhumansai/openhuman` |
| Queue issue file | `rtk read items/openhuman-sym208-recovery-workflow-handoff/ISSUE.md` -> no such file |
| `items/` directory | `test -d items` -> missing |

The most important state for the next worker: this branch is current with the
fork remote's `origin/main`, but the local `upstream/main` ref is much newer.
I did not fetch remotes during this audit, so treat the divergence as local-ref
evidence, not a live remote claim.

## Local Evidence Read

Structural evidence:

- `llm-tldr tree .` completed with a very large JSON tree; it showed the
  expected `app/`, `src/`, `docs/`, `scripts/`, `.github/`, and `tests/` trees.
- `rg --files ... | sed -n '1,220p'` confirmed root Rust files
  (`src/core/all.rs`, `src/core/jsonrpc.rs`, `src/rpc/dispatch.rs`), docs,
  release scripts, and app files.
- `fd -d 2 . app .github tests docs/overnight` showed `.github/workflows/`,
  `app/package.json`, `app/src-tauri/Cargo.toml`, `app/test/`, and root
  `tests/*.rs`.
- `rg --files app/src | wc -l` -> `552` app source files.
- `rg --files src/openhuman | wc -l` -> `1081` Rust domain files.
- `rg --files app/src -g '*.test.ts' -g '*.test.tsx' | wc -l` -> `162` app
  unit test files.
- `rg --files app/test/e2e/specs | wc -l` -> `41` WDIO E2E specs.
- `rg --files tests -g '*.rs' | wc -l` -> `16` root Rust integration tests.

Workflow and validation evidence:

- `AGENTS.md` describes repo layout, command conventions, Linear/Codex PR
  checklist use, debug wrappers, coverage gates, and controller registry rules.
- `docs/agent-workflows/codex-pr-checklist.md` defines Codex preflight, branch
  rules, validation commands, PR body requirements, and Linear update
  expectations.
- `scripts/work/README.md`, `scripts/work/cli.sh`, and
  `scripts/work/start.sh` automate picking up GitHub issues, branch creation,
  and LLM CLI handoff.
- `scripts/review/README.md` and `scripts/review/lib.sh` automate PR sync,
  review, fix, and merge-helper flows.
- `scripts/debug/README.md`, `scripts/debug/unit.sh`, and `scripts/debug/rust.sh`
  provide bounded-output validation wrappers under `pnpm debug`.
- `.github/workflows/typecheck.yml`, `.github/workflows/test.yml`,
  `.github/workflows/build.yml`, `.github/workflows/coverage.yml`, and
  `.github/workflows/pr-quality.yml` define CI gates and soft gates.
- `docs/TESTING-STRATEGY.md`, `docs/E2E-TESTING.md`,
  `docs/TEST-COVERAGE-MATRIX.md`, and `.github/PULL_REQUEST_TEMPLATE.md`
  document coverage and E2E expectations.

Runtime transition evidence:

- `app/package.json` has `core:stage` as a no-op: "core is linked in-process;
  sidecar removed (PR #1061)".
- `app/src-tauri/Cargo.toml` depends on `openhuman_core` by path and says the
  core HTTP/JSON-RPC server runs as a Tokio task inside the Tauri host.
- `app/src-tauri/src/core_process.rs` begins with "In-process core lifecycle"
  and states there is no sidecar to leak on Cmd+Q.
- `cargo metadata --no-deps --format-version 1 | jq ...` shows the root binary
  target is `openhuman-core`, not `openhuman`.
- `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/src/README.md`,
  `docs/src-tauri/README.md`, `docs/BUILDING.md`, and `app/scripts/e2e-build.sh`
  still contain sidecar/staging language.
- `if [ -f scripts/stage-core-sidecar.mjs ]; then echo present; else echo missing; fi`
  -> `missing`, while `app/scripts/e2e-build.sh` still runs
  `node "$REPO_ROOT/scripts/stage-core-sidecar.mjs"`.

Environment and dependency evidence:

- `pnpm --version` -> `10.10.0`.
- `node --version` -> `v25.9.0`, satisfying `app/package.json` engine
  `node >=24.0.0`.
- `rustc --version` -> `rustc 1.93.0 (254b59607 2026-01-19)`.
- `cargo --version` -> `cargo 1.93.0 (083ac5135 2025-12-15)`.
- `git submodule status` shows leading `-` for
  `app/src-tauri/vendor/tauri-cef` and
  `app/src-tauri/vendor/tauri-plugin-notification`, meaning the Tauri vendor
  submodules are not initialized in this worktree.

Search evidence:

- `llm-tldr search "SYM-208" .` returned `[]`.
- `rg -n "SYM-208|recovery|handoff|CODEX_WORKPAD|Work Pack|Linear|codex" ...`
  found no SYM-208-specific local issue/workpad, but did find generic handoff
  code/docs such as `docs/agent-workflows/codex-pr-checklist.md`,
  `src/openhuman/agent/harness/subagent_runner/handoff.rs`, and
  handoff/recovery product code.
- `rg --files -g 'CODEX_WORKPAD.md' -g 'ISSUE.md' -g '*WORKPAD*' -g '*handoff*' -g '*recovery*'`
  found only `src/openhuman/agent/harness/subagent_runner/handoff.rs`; no local
  issue or workpad artifact exists for this queue item.

## Workflow Handoff Map

The current handoff path has four overlapping sources of truth:

1. Repo rules in `AGENTS.md`, including Linear-first language, upstream GitHub
   issue/PR rules, debug wrappers, coverage requirements, and implementation
   lane guidance.
2. Codex-specific checklist in `docs/agent-workflows/codex-pr-checklist.md`,
   including required preflight, validation commands, branch/PR rules, PR body
   requirements, and Linear update requirements.
3. Local issue/PR scripts in `scripts/work/` and `scripts/review/`, which are
   GitHub-issue and GitHub-PR oriented and shell out to `gh`, `jq`, and an LLM
   CLI.
4. CI workflows in `.github/workflows/`, where core unit/type/build/coverage
   gates are present, PR quality gates are soft, and Linux E2E is effectively
   disabled/commented except a manual `e2e-agent-review` workflow.

This is enough to hand work to a strong agent, but it is not yet a single,
boring lane. The biggest issue is not missing instructions; it is drift between
instructions, scripts, and current runtime architecture.

## Risks and Stale Assumptions

1. **Branch source of truth drift.** This worktree is at `origin/main`, but
   local `upstream/main` is `154` commits ahead and `2` commits behind. Repo
   rules in `AGENTS.md` say upstream issues/PRs are canonical, while the local
   branch is fork-current. A worker starting implementation here could miss a
   large upstream integration window unless the lane explicitly says to use the
   fork snapshot.

2. **Missing queue artifact.** The configured issue file
   `items/openhuman-sym208-recovery-workflow-handoff/ISSUE.md` is absent, and
   there is no `CODEX_WORKPAD.md`. A future agent without the Goal Pack prompt
   would not have the task contract or acceptance criteria locally.

3. **Sidecar vs in-process core drift.** Current code embeds the core in the
   Tauri process (`app/src-tauri/Cargo.toml`, `app/src-tauri/src/core_process.rs`)
   and `app/package.json` makes `core:stage` a no-op, but multiple handoff docs
   still tell agents to build/stage a sidecar or run `cargo build --bin openhuman`.
   This can send workers toward nonexistent or stale commands.

4. **E2E build script appears broken for the current tree.** `app/scripts/e2e-build.sh`
   still calls `scripts/stage-core-sidecar.mjs`, but that file is missing. Any
   handoff that asks for `pnpm test:e2e:build` likely fails before reaching Tauri
   unless this script is restored or updated for in-process core.

5. **Tauri submodules are not initialized.** `git submodule status` shows leading
   `-` for the CEF and notification vendor submodules. Tauri shell build/check
   commands are expected to fail locally until `git submodule update --init --recursive`
   runs in an environment allowed to fetch them.

6. **Handoff scripts target GitHub issues, not Linear.** The global workflow is
   Linear-first, but `scripts/work/start.sh` fetches `gh issue view`, names
   branches with `issue/<number>-<slug>` by default, and prompts the agent to
   open a PR for a GitHub issue. That is useful, but it does not preserve the
   Linear issue URL/key/acceptance contract unless the orchestrator adds it.

7. **PR target rules conflict.** `AGENTS.md` says open PRs against
   `tinyhumansai/openhuman` unless told otherwise. `docs/agent-workflows/codex-pr-checklist.md`
   says PRs should target `jwalin-shah/openhuman:main` unless upstream
   permissions allow upstream. The scripts resolve repo from `upstream` unless
   overridden. Workers may open or update different canonical PRs.

8. **Validation docs overstate E2E availability.** `docs/E2E-TESTING.md` says
   Linux E2E is the default CI path, but `.github/workflows/test.yml` has the
   Linux E2E job commented out and `.github/workflows/e2e-agent-review.yml` is
   manual-dispatch-only with a note that CEF cannot be driven by tauri-driver.
   Handoffs that require CI-backed E2E proof need to state the current blocker.

9. **Soft gates can be mistaken for hard gates.** `.github/workflows/pr-quality.yml`
   marks checklist, matrix, and markdown-link checks `continue-on-error: true`.
   These are useful signals, but not merge blockers in their current form.

10. **Root test command names are easy to misuse.** `app/package.json` has
    `test:unit`, but root `package.json` does not. `AGENTS.md` includes a late
    gotcha that root `pnpm test:unit` does not exist, while other docs still
    show `pnpm test:unit` without always specifying `app/` or `--filter`.

## Next Safe Work

### Task 1: Align core runtime handoff docs and scripts

Summary: Make sidecar/in-process core instructions internally consistent for
implementation agents.

Acceptance criteria:

- `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/src/README.md`,
  `docs/src-tauri/README.md`, `docs/BUILDING.md`, and `docs/E2E-TESTING.md`
  agree on whether the Tauri app uses an in-process embedded core, an external
  `openhuman-core run` harness, or both.
- Commands use the actual root binary name `openhuman-core` where a standalone
  binary is needed.
- `app/scripts/e2e-build.sh` no longer references a missing
  `scripts/stage-core-sidecar.mjs`, or that script is restored with current
  in-process semantics.
- A grep for `cargo build --bin openhuman`, `stage-core-sidecar.mjs`, and
  `core:stage` leaves only intentional, current references.

Validation candidates:

- `rg -n "cargo build --bin openhuman|stage-core-sidecar|core:stage|sidecar" AGENTS.md docs app/scripts app/package.json app/src-tauri`
  should show only current, intentionally documented references.
- `cargo metadata --no-deps --format-version 1 | jq -r '.packages[] | select(.name=="openhuman") | .targets[] | [.kind[0], .name] | @tsv'`
  should still show `bin openhuman-core`.
- `pnpm --filter openhuman-app test:e2e:build` should get past the missing
  sidecar script. Current expected status: fail before Tauri build because
  `scripts/stage-core-sidecar.mjs` is missing and submodules are uninitialized.

### Task 2: Make the implementation handoff lane unambiguous

Summary: Decide and encode the canonical source of work, branch naming, PR
target, and tracker update behavior for agents.

Acceptance criteria:

- `docs/agent-workflows/codex-pr-checklist.md`, `AGENTS.md`, and
  `scripts/work/start.sh` agree on whether normal agent work starts from
  Linear, upstream GitHub issues, or fork GitHub issues.
- Branch naming matches the chosen contract. For Linear work, use
  `codex/<ISSUE-KEY>-<short-title>`; for GitHub issues, document the GitHub
  `issue/<number>-<slug>` path as a separate lane.
- PR target selection is explicit and testable: upstream vs fork target should
  not depend on hidden permission assumptions.
- The generated agent prompt includes acceptance criteria, validation command,
  tracker URL/key, required PR body fields, and a stop condition for missing
  submodules or unavailable credentials.

Validation candidates:

- `bash -n scripts/work/cli.sh scripts/work/start.sh scripts/review/*.sh` should
  pass.
- `pnpm work --help` should show the updated contract without needing external
  credentials.
- A dry-run mode, if added, should print the branch name and prompt without
  contacting `gh` or changing git state.

### Task 3: Add a repo-local validation profile for agents

Summary: Give agents a small, current validation map that distinguishes cheap
proof commands from slow or currently blocked commands.

Acceptance criteria:

- Add or update a doc that lists validation profiles: docs-only, app unit,
  Rust core, Tauri shell, E2E, release/build.
- Each profile names the exact working directory, command, expected runtime,
  required prerequisites, and known blockers.
- The doc reflects the current local facts: root `pnpm test:unit` is absent,
  Tauri vendor submodules must be initialized, Linux E2E via tauri-driver is
  blocked for CEF, and `pnpm debug` wrappers are preferred for focused runs.
- PR template/checklist language points agents to the profile instead of
  repeating stale command fragments.

Validation candidates:

- `pnpm debug unit <changed-test-pattern>` should be the recommended focused
  app proof command.
- `pnpm debug rust <test-filter>` should be the recommended focused Rust proof
  command.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm test` remain
  the app-facing merge-gate candidates.
- `cargo fmt --all -- --check` and `cargo test -p openhuman` remain core
  candidates. Current expected status: unknown/not run in this audit.

### Task 4: Restore local queue artifacts for Goal Pack workers

Summary: Ensure future overnight workers do not depend on hidden prompt context.

Acceptance criteria:

- The runner writes `items/<item-id>/ISSUE.md` or an equivalent local work order
  before launching a worker.
- The work order includes repo path, branch, acceptance criteria, validation
  command, stop conditions, and non-goals.
- If the issue file is absent, the worker should write a short blocker report
  or the runner should fail before work starts.
- Optional: write `CODEX_WORKPAD.md` only when the repo already uses that
  artifact for implementation lanes; read-only audit lanes can rely on the
  required `docs/overnight/<item-id>.md` report.

Validation candidates:

- `test -f items/openhuman-sym208-recovery-workflow-handoff/ISSUE.md` should
  pass in future workers.
- `git status --short` after a read-only audit should show exactly the intended
  report file if the report is left uncommitted, or be clean if the report is
  committed by the runner.

## Validation Command Candidates

These are candidate commands for future implementation handoffs. Only the queue
validation command was required for this read-only report.

| Command | Expected status from this audit |
|---|---|
| `git status --short` | Passes as a command. After this report, expected output includes only this report file unless committed. |
| `git submodule status` | Currently shows uninitialized vendor submodules with leading `-`; Tauri checks/builds are blocked until initialized. |
| `pnpm --version` | Passed: `10.10.0`. |
| `node --version` | Passed: `v25.9.0`, compatible with app `node >=24.0.0`. |
| `rustc --version && cargo --version` | Passed: Rust/Cargo `1.93.0`. |
| `cargo metadata --no-deps --format-version 1 ...` | Passed and confirmed `openhuman-core` is the root binary target. |
| `pnpm --filter openhuman-app test:e2e:build` | Expected to fail now because `app/scripts/e2e-build.sh` calls missing `scripts/stage-core-sidecar.mjs`, then would also need initialized Tauri vendor submodules. Not run. |
| `cargo check --manifest-path app/src-tauri/Cargo.toml` | Expected to fail now until `app/src-tauri/vendor/tauri-cef` and `app/src-tauri/vendor/tauri-plugin-notification` are initialized. Not run. |
| `pnpm test:unit` from repo root | Expected to fail because root `package.json` lacks `test:unit`; use `pnpm test`, `pnpm --filter openhuman-app test:unit`, or `pnpm debug unit`. Not run. |
| `pnpm debug unit <pattern>` | Expected focused app test path, assuming dependencies are installed. Not run. |
| `pnpm debug rust <filter>` | Expected focused Rust path through `scripts/test-rust-with-mock.sh`, assuming dependencies build. Not run. |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check` | Expected app merge-gate candidates. Not run in this audit. |
| `cargo fmt --all -- --check`, `cargo test -p openhuman` | Expected core merge-gate candidates. Not run in this audit. |

## Non-goals

- No product code changes.
- No generated data changes.
- No dependency installation or submodule initialization.
- No credential, token, backend, deploy, or external-service access.
- No GitHub PR creation, push, or merge.
- No Linear/GitHub tracker updates.
- No full test, build, E2E, or release validation run beyond the required
  `git status --short` command.

## Unknowns

- Whether `upstream/main` local ref is fresh; I did not fetch remotes.
- Whether the fork intentionally carries the two commits absent from the local
  `upstream/main` ref.
- Whether the Goal Pack runner intentionally omits `items/<item-id>/ISSUE.md`
  because the prompt is considered authoritative.
- Whether `scripts/stage-core-sidecar.mjs` was intentionally deleted without
  updating `app/scripts/e2e-build.sh`, or whether the worktree is missing a file
  that exists elsewhere.
- Whether local `pnpm install` has been run; I only verified tool versions.
- Whether current CI failures exist on GitHub; external CI inspection was out
  of scope.

## Handoff Summary

Changed files: this report only.

Recommended morning review order:

1. Decide whether workers should start from fork `origin/main` or upstream
   `tinyhumansai/openhuman` for this recovery lane.
2. Fix the sidecar/in-process documentation and `app/scripts/e2e-build.sh`
   mismatch before assigning any E2E-heavy implementation task.
3. Initialize or explicitly document Tauri vendor submodule requirements in
   the worker bootstrap.
4. Convert the three highest-value tasks above into Linear or GitHub work
   orders with exact acceptance criteria and validation commands.
