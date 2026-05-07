# OpenHuman SYM208 Recovery Implementation-Readiness Review

Queue item: `openhuman-sym208-recovery-implementation-readiness`  
Branch reviewed: `codex/goal-openhuman-sym208-recovery-implementation-readiness`  
Source HEAD before this report: `f11f217809841cf8e3a7f694d8e80967d8e188b8`  
Review type: implementation-readiness, read-only except for this report

## Summary

This repo is mostly ready for narrowly scoped follow-up work, but the safest next wave should focus on finishing the in-process-core recovery cleanup before adding product depth. The current code already links `openhuman_core` into the Tauri host, but multiple docs, scripts, tests, and user-facing catalog entries still describe the older staged sidecar model. One concrete blocker is already executable: `app/scripts/e2e-build.sh` calls a missing `scripts/stage-core-sidecar.mjs`, so the documented E2E build path cannot be trusted until that is removed or replaced.

No repo-local previous overnight artifacts were available: `docs/overnight`, `runs`, and `items` were absent before this report was created. Current git state was clean before the report. `git submodule status` showed the vendored Tauri/notification submodules prefixed with `-`, so local Tauri build validations in this worktree need submodule initialization before they can be trusted.

## Evidence Observations

1. `app/src-tauri/Cargo.toml:109-115` says the core domain logic is embedded in-process as a path dependency on `openhuman_core`, explicitly avoiding the orphan-sidecar class of bugs from PR #1061.

2. `app/src-tauri/src/core_process.rs:1-5` confirms the runtime model: the core HTTP/JSON-RPC server runs as a Tokio task inside the Tauri host and "there is no sidecar to leak." The actual spawn path at `app/src-tauri/src/core_process.rs:135-143` sets `OPENHUMAN_CORE_TOKEN` and calls `openhuman_core::core::jsonrpc::run_server_embedded`.

3. `app/package.json:14` already made `core:stage` a no-op that prints "core is linked in-process; sidecar removed (PR #1061)". This is the current implementation signal.

4. `app/scripts/e2e-build.sh:39-40` still tries to run `node "$REPO_ROOT/scripts/stage-core-sidecar.mjs"`. A direct existence check returned exit code `1` for `scripts/stage-core-sidecar.mjs`, so `pnpm --filter openhuman-app test:e2e:build` is expected to fail before reaching the useful Tauri build step.

5. `Cargo.toml:8-10` defines the root CLI binary as `openhuman-core`, not `openhuman`. Meanwhile `AGENTS.md:16`, `AGENTS.md:66`, `docs/ARCHITECTURE.md:15`, and `docs/BUILDING.md:26-31` still instruct agents to build or stage `--bin openhuman`, which is not the declared binary name.

6. `docs/src-tauri/README.md:3`, `docs/src-tauri/README.md:17`, and `docs/src-tauri/README.md:21-23` still describe the Tauri shell as managing an `openhuman` sidecar and say `core:stage` runs `scripts/stage-core-sidecar.mjs` for Tauri `externalBin`. This directly conflicts with the in-process code path.

7. `docs/TESTING-STRATEGY.md:14`, `docs/TESTING-STRATEGY.md:29-30`, and `docs/TESTING-STRATEGY.md:114-116` still use "UI -> Tauri -> sidecar -> JSON-RPC" as the E2E contract. The useful validation idea remains correct, but the terminology and setup steps no longer match the current runtime.

8. `app/src-tauri/src/lib.rs:214-239` keeps `check_core_update` and `apply_core_update` as compatibility stubs because the core ships in-process and updates through the Tauri app updater. However `src/openhuman/about_app/catalog.rs:851-870` still advertises user-facing "Check for Core Updates" and "Apply Core Update" capabilities, including "restart the sidecar."

9. `src/openhuman/about_app/catalog_tests.rs:67-87` protects a few added capability IDs, but it does not assert that update/catalog copy matches the current in-process updater model. This makes stale user-facing capability claims easy to reintroduce.

10. `.github/workflows/test.yml:128-131` correctly notes that Tauri shell tests pull the core as a path dependency and require no separate sidecar build. But `.github/workflows/test.yml:133-180` shows the Linux E2E workflow is commented out, so the broken `app/scripts/e2e-build.sh` path may not be caught on ordinary PRs.

11. `.github/workflows/coverage.yml:136-183` enforces `diff-cover --fail-under=80` across frontend, Rust core, and Tauri coverage artifacts. Any implementation slice that touches code should include focused tests for changed lines, even if the immediate queue item only required `git status --short`.

12. `scripts/debug/README.md` and `scripts/test-rust-with-mock.sh` provide agent-friendly validation paths (`pnpm debug unit`, `pnpm debug rust`, mock backend on loopback). These should be the default validation surface for follow-up implementation agents once their slice is selected.

13. `git submodule status` returned `-f1ee9554... app/src-tauri/vendor/tauri-cef` and `-36c4004... app/src-tauri/vendor/tauri-plugin-notification`, meaning the local worktree lacks the vendored submodule checkouts needed by Tauri builds/tests.

14. `docs/TEST-COVERAGE-MATRIX.md:47-54` tracks update/reinstall coverage as partial or manual-smoke heavy. That is acceptable for signed release flows, but the catalog/docs cleanup can still be covered by Rust unit tests and targeted Vitest.

## Risks And Blockers

- E2E build blocker: `app/scripts/e2e-build.sh` invokes a missing script. This is the highest-confidence implementation-ready fix because it has a clear failing command and a small owned file set.
- Local build blocker: this worktree has uninitialized Tauri vendor submodules, so Tauri shell build/test commands need `git submodule update --init --recursive` before meaningful local execution.
- Documentation drift risk: agents following `AGENTS.md`, `docs/ARCHITECTURE.md`, or `docs/src-tauri/README.md` will attempt obsolete sidecar staging and the wrong root binary name.
- User-facing stale-claim risk: the about-app capability catalog still exposes core-update/sidecar language even though Tauri has compatibility stubs and the app updater is the real path.
- CI visibility risk: PR coverage and Rust/Tauri tests run, but default Linux E2E is commented out, so broken E2E scripts can survive unless a follow-up specifically validates them.
- Scope blocker: deciding whether standalone `openhuman-core` update controllers should remain for CLI/tarball distribution is a product/release decision. The implementation-ready slice should only align UI/catalog/docs copy with the current in-app updater unless a human explicitly asks to remove core update functionality.

## Exact Validation Commands

Required queue validation run for this report:

```bash
git status --short
```

Useful evidence/diagnostic commands used during review:

```bash
git status --short --branch
git rev-parse HEAD
git branch --show-current
llm-tldr tree .
rtk read package.json
rtk read Cargo.toml
rtk read app/package.json
rtk grep "SYM-208|sym208|recovery|core:stage|sidecar removed|sidecar|about_app|capability catalog" .
test -e scripts/stage-core-sidecar.mjs
git submodule status
```

Primary validation commands follow-up agents should use by slice:

```bash
pnpm --filter openhuman-app format:check
pnpm typecheck
pnpm --dir app exec vitest run <changed-test-files> --config test/vitest.config.ts
cargo fmt --manifest-path Cargo.toml --all --check
cargo test -p openhuman about_app
cargo test --manifest-path app/src-tauri/Cargo.toml core_update
bash -n app/scripts/e2e-build.sh
pnpm --filter openhuman-app test:e2e:build
bash app/scripts/e2e-run-spec.sh test/e2e/specs/smoke.spec.ts smoke
```

## Implementation-Ready Follow-Up Tasks

### 1. Repair E2E build after the in-process core migration

Owned files: `app/scripts/e2e-build.sh`, `app/package.json`, `docs/E2E-TESTING.md`, `docs/TESTING-STRATEGY.md`.

Acceptance criteria:

- `app/scripts/e2e-build.sh` no longer calls missing `scripts/stage-core-sidecar.mjs`.
- The script keeps baking `VITE_BACKEND_URL=http://127.0.0.1:${E2E_MOCK_PORT:-18473}` into the frontend bundle.
- The script comments describe the in-process core model accurately and do not mention `bundle.externalBin` as the active path.
- Existing `pnpm --filter openhuman-app test:e2e:build` remains the documented entrypoint.

Smallest useful validation:

```bash
bash -n app/scripts/e2e-build.sh
pnpm --filter openhuman-app test:e2e:build
```

Known prerequisite: initialize `app/src-tauri/vendor/*` submodules before the second command.

### 2. Align contributor and architecture docs with the current runtime

Owned files: `AGENTS.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/src-tauri/README.md`, `docs/BUILDING.md`, `docs/TESTING-STRATEGY.md`, `docs/E2E-TESTING.md`.

Acceptance criteria:

- Docs no longer instruct `cargo build --manifest-path Cargo.toml --bin openhuman`; standalone CLI references use `openhuman-core`.
- Docs explain that the desktop app links `openhuman_core` in-process and still exposes HTTP JSON-RPC on the local core port.
- Sidecar language remains only where it is historically or externally accurate, such as legacy stale-process cleanup, standalone `openhuman-core run` harnesses, or release tarball packaging.
- The E2E contract is restated as UI -> Tauri host -> embedded core JSON-RPC, with mock backend isolation unchanged.

Smallest useful validation:

```bash
rg -n "cargo build .*--bin openhuman(\\s|$)|stage-core-sidecar|externalBin|core sidecar" AGENTS.md CLAUDE.md docs/ARCHITECTURE.md docs/src-tauri docs/BUILDING.md docs/TESTING-STRATEGY.md docs/E2E-TESTING.md
pnpm --filter openhuman-app format:check
```

### 3. Align the update capability catalog with app-update reality

Owned files: `src/openhuman/about_app/catalog.rs`, `src/openhuman/about_app/catalog_tests.rs`, `app/src/utils/tauriCommands/core.ts`, `docs/AUTO_UPDATE.md`.

Acceptance criteria:

- User-facing capability catalog copy no longer claims a separate core binary is staged or that applying an update restarts a sidecar.
- Compatibility stubs `check_core_update` / `apply_core_update` remain documented as compatibility only, or the catalog points users to the shell app update flow instead.
- `catalog_tests.rs` asserts the updated capability text or IDs so the stale sidecar copy cannot silently return.
- No removal of standalone `src/openhuman/update/` CLI/RPC behavior unless separately approved.

Smallest useful validation:

```bash
cargo test -p openhuman about_app
pnpm --dir app exec vitest run src/components/__tests__/AppUpdatePrompt.test.tsx src/components/settings/panels/__tests__/AboutPanel.test.tsx --config test/vitest.config.ts
```

### 4. Add a drift guard for stale staged-sidecar references

Owned files: `scripts/check-inprocess-core-docs.mjs` or equivalent new script, `package.json`, `.github/workflows/pr-quality.yml`, `app/test/checklist-parser.test.ts` only if reusing the existing checklist guard pattern.

Acceptance criteria:

- A lightweight script fails on obsolete active instructions such as `scripts/stage-core-sidecar.mjs`, `cargo build --bin openhuman`, or "Tauri externalBin" in active docs/scripts.
- The guard has allow-listed exceptions for release packaging, standalone `openhuman-core` CLI/tarball docs, and historical notes.
- The guard is wired into a local package script and at least soft CI so future migrations cannot reintroduce stale setup instructions unnoticed.

Smallest useful validation:

```bash
node scripts/check-inprocess-core-docs.mjs
pnpm --filter openhuman-app format:check
```

### 5. Restore a bounded agent-observable E2E smoke path

Owned files: `app/scripts/e2e-agent-review.sh`, `app/scripts/e2e-run-spec.sh`, `.github/workflows/test.yml`, `docs/AGENT-OBSERVABILITY.md`, `docs/E2E-TESTING.md`.

Acceptance criteria:

- After task 1, `bash app/scripts/e2e-agent-review.sh` builds or reuses the app without missing sidecar staging and prints an artifact directory.
- A bounded Linux smoke or agent-review E2E job is available in CI or workflow dispatch with clear cache/submodule prerequisites.
- Failure artifacts remain under `app/test/e2e/artifacts/<timestamp>-agent-review/`.
- The docs state which commands are expected to run locally versus in CI.

Smallest useful validation:

```bash
pnpm --filter openhuman-app test:e2e:build
bash app/scripts/e2e-agent-review.sh --skip-build --label sym208-recovery-smoke
```

Known prerequisite: local Tauri/CEF dependencies and submodules must be present.

## Handoff Notes

- Product code was not edited by this pass.
- Exactly one report file was created under `docs/overnight/2026-05-07-whole-portfolio-review/`.
- No external services, deploys, pushes, PRs, destructive cleanup, or tracker updates were performed.
- The next best implementation slice is task 1 because it converts a known broken command into a directly testable fix and unlocks the rest of the E2E recovery work.
