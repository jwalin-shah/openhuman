# openhuman-sym85 implementation-readiness review

Date: 2026-05-07
Queue item: `openhuman-sym85-implementation-readiness`
Branch: `codex/goal-openhuman-sym85-implementation-readiness`
HEAD at review start: `f11f217809841cf8e3a7f694d8e80967d8e188b8`

## Scope

This pass is read-only review plus queue prep. I did not edit product code, open PRs, push branches, update trackers, or run external services. The only intended repository change is this report.

The queue issue file path from the goal packet, `items/openhuman-sym85-implementation-readiness/ISSUE.md`, is not present in this checkout. I used the embedded issue body from the goal packet as the task contract and record the missing file as a non-product queue artifact gap.

## Commands run

```bash
git branch --show-current
git rev-parse HEAD
git status --short
rtk read /Users/jwalinshah/projects/agent-stack/repos.json
rg --files
fd ISSUE.md /Users/jwalinshah/projects/agent-stack/.agent-stack-worktrees/2026-05-07-whole-portfolio-review
fd result.json /Users/jwalinshah/projects/agent-stack/.agent-stack-worktrees/2026-05-07-whole-portfolio-review
fd handoff.md /Users/jwalinshah/projects/agent-stack/.agent-stack-worktrees/2026-05-07-whole-portfolio-review
node scripts/check-coverage-matrix.mjs
git submodule status
```

`llm-tldr tree .` eventually returned, but it was too large for practical review. I used targeted `rg`, `fd`, and `rtk read` after that.

Notable command results:

- `git status --short` was clean before this report was created.
- `node scripts/check-coverage-matrix.mjs` passed with `Matrix: 138 rows, 138 catalog IDs, 0 parse errors, 0 missing, 0 duplicates`.
- `fd result.json ...` found no current `runs/*/result.json`.
- `fd handoff.md ...` found only template/tool handoff files in sibling worktrees, not current runner handoffs.
- `git submodule status` showed both Tauri vendor submodules prefixed with `-`, meaning they are not initialized in this worktree.

## File-path observations

1. `/Users/jwalinshah/projects/agent-stack/repos.json` registers `openhuman-sym85` at `/Users/jwalinshah/projects/openhuman-sym85` with validation `git status --short`; this worker is correctly running in an isolated worktree for that repo.
2. `package.json` delegates root commands to the `openhuman-app` workspace via pnpm, while `app/package.json` requires Node `>=24.0.0` and defines the practical app, Rust, and E2E command surface.
3. `app/package.json` now defines `core:stage` as a no-op: `core is linked in-process; sidecar removed (PR #1061)`.
4. `app/src-tauri/src/core_process.rs` is the current source of truth for core lifecycle: it starts the core JSON-RPC server as an embedded Tokio task, ties lifetime to the GUI process, and includes stale-listener takeover policy for port conflicts.
5. `app/src-tauri/src/core_process_tests.rs` already covers port selection, unknown listener refusal, legacy reuse override, listener fingerprint parsing, and bearer token invariants. That makes core-lifecycle follow-up work testable at unit level.
6. `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/src/README.md`, `docs/src-tauri/README.md`, `docs/BUILDING.md`, `docs/TESTING-STRATEGY.md`, and `docs/E2E-TESTING.md` still contain many "sidecar", `core:stage`, or `externalBin` claims that conflict with the in-process core implementation.
7. `src/openhuman/about_app/catalog.rs` still describes `update.apply` as "Download and stage a newer core binary, then restart the sidecar", so the user-facing capability catalog is also stale.
8. `app/src-tauri/Cargo.toml` depends on vendored `tauri-cef` and `tauri-plugin-notification` path dependencies, but `.gitmodules` plus `git submodule status` show those submodules are not initialized locally. Any Tauri shell compile/test task is blocked until `git submodule update --init --recursive` succeeds.
9. `.github/workflows/coverage.yml` enforces changed-line coverage with merged Vitest, core `cargo-llvm-cov`, and Tauri `cargo-llvm-cov` lcov reports, then fails PRs below `80` percent via `diff-cover`.
10. `.github/workflows/typecheck.yml` runs TypeScript compile, Prettier, ESLint, Rust fmt, and clippy; `.github/workflows/test.yml` runs frontend coverage, core tests, and Tauri shell tests, while Linux/macOS E2E jobs are currently commented out or manual.
11. `docs/agent-workflows/codex-pr-checklist.md` gives remote-agent preflight and PR-body requirements, but it does not currently require checking the vendored Tauri submodule files that are necessary for Tauri validation.
12. `scripts/debug/README.md` provides the preferred small-output wrappers for Vitest, WDIO, Rust tests, and saved logs. These are a good default for implementation workers because raw test output is large.
13. `scripts/test-rust-with-mock.sh` starts `scripts/mock-api-server.mjs`, waits for `/__admin/health`, exports `BACKEND_URL` and `VITE_BACKEND_URL`, then runs `cargo test --manifest-path Cargo.toml --workspace`.
14. `app/test/vitest.config.ts` runs jsdom tests serially with shared setup and v8 lcov output; coverage includes `src/**/*.{ts,tsx}` but excludes test files and type-only modules.
15. `app/test/wdio.conf.ts` writes screenshots and source dumps on test failure through `captureFailureArtifacts`, so new E2E slices can be made agent-debuggable without inventing a harness.
16. `docs/TESTING-STRATEGY.md` is clear about test placement and the failure-path requirement, but it still uses sidecar wording for flows that now go through the embedded core server.
17. `docs/TEST-COVERAGE-MATRIX.md` is parseable and synchronized with `scripts/feature-ids.json`, but its human summary says `129 explicit + nested = 200 product features` while the parser reports `138` rows. The matrix guard does not catch stale summary counts.
18. `src/core/all.rs` is the controller registry and `src/core/all_tests.rs` already verifies schema/handler parity. However, `src/rpc/dispatch.rs` still contains a legacy one-off branch for `openhuman.security_policy_info`, contrary to the controller-only migration rule.

## Risks and blockers

- Tauri validation is not locally ready in this worktree because `app/src-tauri/vendor/tauri-cef` and `app/src-tauri/vendor/tauri-plugin-notification` are uninitialized submodules.
- Implementation workers may follow stale sidecar instructions unless the docs and capability catalog are reconciled with `app/package.json` and `app/src-tauri/src/core_process.rs`.
- The queue issue file was missing from disk, so future local runners should either materialize `items/.../ISSUE.md` or explicitly record that the embedded goal packet is authoritative.
- PR quality checks in `.github/workflows/pr-quality.yml` are soft (`continue-on-error: true`), so implementation workers should not treat those as hard merge protection yet.
- The coverage matrix machine guard passes, but the human summary is stale; reviewers can be misled when picking coverage-gap work by status counts alone.

## Implementation-ready follow-up tasks

### 1. Align docs and capability catalog with embedded core lifecycle

Owned files:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/src/README.md`
- `docs/src/01-architecture.md`
- `docs/src/03-services.md`
- `docs/src-tauri/README.md`
- `docs/src-tauri/01-architecture.md`
- `docs/src-tauri/02-commands.md`
- `docs/src-tauri/03-services.md`
- `docs/BUILDING.md`
- `docs/TESTING-STRATEGY.md`
- `docs/E2E-TESTING.md`
- `src/openhuman/about_app/catalog.rs`

Acceptance criteria:

- Current lifecycle docs say the core server runs embedded in the Tauri host by default, with loopback HTTP JSON-RPC still used as the transport.
- `core:stage` is documented as a no-op, not as required sidecar staging.
- Remaining uses of "sidecar" are either removed, renamed to "embedded core", or explicitly marked as historical/manual standalone-core context.
- `about_app` update capability text no longer promises staging/restarting a sidecar.

Smallest useful validation:

```bash
rg -n "stage core sidecar|externalBin|scripts/stage-core-sidecar|core:stage|core sidecar|sidecar" AGENTS.md docs app/package.json src/openhuman/about_app
cargo test --manifest-path Cargo.toml about_app
node scripts/check-coverage-matrix.mjs
pnpm --filter openhuman-app format:check
```

### 2. Migrate `security_policy_info` into the controller registry

Owned files:

- `src/openhuman/security/mod.rs`
- `src/openhuman/security/ops.rs`
- `src/openhuman/security/schemas.rs` (new)
- `src/core/all.rs`
- `src/core/all_tests.rs`
- `src/rpc/dispatch.rs`
- `tests/json_rpc_e2e.rs` if an HTTP-level assertion is added

Acceptance criteria:

- `openhuman.security_policy_info` is declared and registered through the shared controller registry.
- The existing JSON shape from `src/openhuman/security/ops.rs` is unchanged.
- `src/rpc/dispatch.rs` no longer contains a one-off security branch, or the file is removed if no branches remain.
- Registry parity tests fail if the security schema or handler is omitted.

Smallest useful validation:

```bash
cargo test --manifest-path Cargo.toml security_policy_info
cargo test --manifest-path Cargo.toml core::all
bash scripts/test-rust-with-mock.sh --test json_rpc_e2e security_policy_info
```

### 3. Add vendored-submodule readiness to agent preflight and bootstrap docs

Owned files:

- `docs/agent-workflows/codex-pr-checklist.md`
- `scripts/worktree-bootstrap.sh`
- `scripts/work/README.md`
- `scripts/ensure-tauri-cli.sh` if the existing helper should surface a clearer missing-submodule error

Acceptance criteria:

- Remote-agent preflight checks `git submodule status --recursive`.
- Preflight or bootstrap explicitly checks:
  - `app/src-tauri/vendor/tauri-cef/crates/tauri-runtime-cef/Cargo.toml`
  - `app/src-tauri/vendor/tauri-plugin-notification/Cargo.toml`
- Missing submodules produce an actionable message with `git submodule update --init --recursive`.
- Tauri validation blockers are reported before expensive compile commands start.

Smallest useful validation:

```bash
git submodule status --recursive
test -f app/src-tauri/vendor/tauri-cef/crates/tauri-runtime-cef/Cargo.toml
test -f app/src-tauri/vendor/tauri-plugin-notification/Cargo.toml
pnpm --filter openhuman-app rust:check
```

If submodule fetching is blocked by network or credentials, record that exact blocker instead of running `rust:check`.

### 4. Make the coverage-matrix summary machine-checked

Owned files:

- `docs/TEST-COVERAGE-MATRIX.md`
- `scripts/check-coverage-matrix.mjs`
- `scripts/lib/coverage-matrix-parser.mjs`
- `app/test/coverage-matrix-parser.test.ts`
- `scripts/feature-ids.json` only if the ID generator is intentionally rerun

Acceptance criteria:

- The human summary in `docs/TEST-COVERAGE-MATRIX.md` matches parsed row/status counts.
- `node scripts/check-coverage-matrix.mjs` fails if the summary counts drift from parsed rows.
- Parser tests cover summary extraction and mismatch reporting.
- Existing catalog ID parity still passes.

Smallest useful validation:

```bash
node scripts/check-coverage-matrix.mjs
pnpm --dir app exec vitest run test/coverage-matrix-parser.test.ts --config test/vitest.config.ts
```

### 5. Fill one low-risk developer-settings E2E gap

Owned files:

- `app/test/e2e/specs/settings-developer-options-flow.spec.ts` (new or existing equivalent)
- `app/src/components/settings/panels/MemoryDebugPanel.tsx` only for stable `data-testid` anchors if missing
- `app/src/components/settings/panels/WebhooksDebugPanel.tsx` only if choosing webhook inspection instead
- `docs/TEST-COVERAGE-MATRIX.md`

Recommended slice: cover matrix row `13.4.3` (Memory Debug) first because it is a local UI/debug surface and does not require external service credentials.

Acceptance criteria:

- WDIO spec starts from a fresh `OPENHUMAN_WORKSPACE`, reaches Settings > Developer Options > Memory Debug, and asserts the panel's root surface and at least one deterministic empty/loading/data state.
- Spec uses existing E2E helpers, not raw platform selectors.
- Failure artifacts are captured by the existing WDIO hook.
- Matrix row `13.4.3` is updated from missing to the actual coverage level.

Smallest useful validation:

```bash
bash app/scripts/e2e-run-spec.sh test/e2e/specs/settings-developer-options-flow.spec.ts settings-developer-options
node scripts/check-coverage-matrix.mjs
```

## Recommended validation ladder for future implementation workers

Use the smallest command that proves the touched surface, then add the relevant merge gates:

```bash
# Docs / matrix-only
node scripts/check-coverage-matrix.mjs
pnpm --filter openhuman-app format:check

# Frontend unit work
pnpm debug unit <changed-test-file-or-pattern>
pnpm typecheck
pnpm lint

# Core registry or Rust domain work
cargo fmt --manifest-path Cargo.toml --all --check
cargo test --manifest-path Cargo.toml <focused-filter>
bash scripts/test-rust-with-mock.sh --test json_rpc_e2e <focused-filter>

# Tauri shell work, after submodules are initialized
cargo fmt --manifest-path app/src-tauri/Cargo.toml --all --check
pnpm --filter openhuman-app rust:check

# User-visible desktop behavior
pnpm test:e2e:build
bash app/scripts/e2e-run-spec.sh test/e2e/specs/<spec>.spec.ts <id>
```

## Final validation

Required queue validation:

```bash
git status --short
```

Expected final output after writing this report:

```text
?? docs/overnight/
```

No PR was created. No external tracker was updated.
