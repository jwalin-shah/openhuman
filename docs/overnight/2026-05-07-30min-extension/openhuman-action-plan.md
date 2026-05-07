# OpenHuman 30-Minute Extension Audit Action Plan

Date: 2026-05-07
Branch: `codex/goal-openhuman-30min-action-plan`
Base HEAD: `f11f217809841cf8e3a7f694d8e80967d8e188b8`
Scope: read-only planning/synthesis; no product code changed.

2026-05-07 reconciliation note: the sidecar/E2E-build findings in this report
were captured before OpenHuman PR #34 was merged. PR #34 is now merged as
`d3a9bb848c73572e51fbf4a4be7fb1b0ea384a1e`; do not treat the pre-#34
`scripts/stage-core-sidecar.mjs` and sidecar-doc findings below as fresh
blockers unless they still reproduce on current `main`.

## Summary

This pass found no previous `docs/overnight/**` report for OpenHuman in this worktree. The strongest implementation queue is not a new product feature; it is a repo-health cleanup around recent architectural drift:

- The Tauri app now embeds the core in-process, but multiple docs and at least one E2E build script still describe or call a removed sidecar staging path.
- The frontend route/provider docs still describe old `/conversations`, `/agents`, and provider-chain shapes while `AppRoutes.tsx` and `App.tsx` have moved on.
- One domain method, `openhuman.security_policy_info`, still lives in the legacy dispatcher instead of the controller registry that the repo rules identify as canonical.
- Skills docs mix the newer SKILL.md discovery path with older nonexistent frontend file paths and removed in-repo skills bundles.
- The coverage matrix parser is healthy, but its hand-written summary is stale and PR quality gates remain soft.

The implementation-ready tasks below are scoped so each can become a single queue item with owned files, acceptance criteria, and validation commands.

## Previous Report Reconciliation

No prior overnight report was present:

- `rg --files -g 'docs/overnight/**' -g 'runs/**'` returned no files.
- `llm-tldr search "overnight" .` found only product copy in `docs/ONBOARDING-AGENT.md`, `scripts/test-onboarding-judge.mjs`, and `src/openhuman/agent/agents/morning_briefing/prompt.md`.

Related older repo review found:

- `docs/reviews/2026-04-23-adversarial-fixes.md` already covered RPC timeout, core RPC URL fallback visibility, MCP disconnect cleanup, PersistGate recovery, and stale `.claude/rules/` cleanup.
- That review explicitly deferred "RPC errors carry a structured code"; the current `app/src/services/coreRpcClient.ts` still throws a plain `Error(message)` from JSON-RPC error payloads, losing `code` and `data` for callers.
- The old review did not cover the current in-process-core documentation/script drift, the `/chat` route/doc drift, or the remaining legacy RPC dispatcher branch.

Work to move into implementation queue:

- Embedded-core docs and E2E script cleanup.
- Security policy controller migration.
- Current route/provider/capability catalog refresh.
- Skills documentation path reconciliation.
- Structured RPC client errors and coverage-matrix summary hardening.

## Concrete File-Path Observations

1. `app/src-tauri/Cargo.toml` lines 109-115 make `openhuman_core` a path dependency and state the core HTTP/JSON-RPC server runs as a Tokio task inside the Tauri host.
2. `app/src-tauri/src/core_process.rs` starts by documenting the in-process lifecycle and "there is no sidecar to leak"; `CoreProcessHandle::ensure_running` spawns `openhuman_core::core::jsonrpc::run_server_embedded`.
3. `app/package.json` line 14 has `core:stage` as a no-op: "core is linked in-process; sidecar removed (PR #1061)".
4. `app/scripts/e2e-build.sh` lines 39-40 still run `node "$REPO_ROOT/scripts/stage-core-sidecar.mjs"`, but `scripts/stage-core-sidecar.mjs` does not exist.
5. `docs/src-tauri/README.md` lines 3, 17, and 21-23 still describe an `openhuman` sidecar, `scripts/stage-core-sidecar.mjs`, `cargo build --bin openhuman`, and `app/src-tauri/binaries/`.
6. `docs/src-tauri/01-architecture.md` lines 5, 15, 35, 38, and 49 still describe a separately built core binary, `src/bin/openhuman.rs`, sidecar management, and bundling `../../skills/skills`; the current `app/src-tauri/tauri.conf.json` resources include only `../../src/openhuman/agent/prompts` and `recipes/**/*`.
7. `Cargo.toml` defines the root binary as `openhuman-core` at `src/main.rs`; there is no `src/bin/openhuman.rs`.
8. `docs/BUILDING.md` lines 24-33 still instruct `cargo build --manifest-path Cargo.toml --bin openhuman` plus `pnpm core:stage`, which contradicts `Cargo.toml` and the no-op stage script.
9. `app/src/App.tsx` lines 50-67 show the current provider chain: Redux `Provider` -> `PersistGate` -> `CoreStateProvider` -> `SocketProvider` -> `ChatRuntimeProvider` -> `Router` -> `CommandProvider` -> `ServiceBlockingGate`.
10. `docs/src/README.md` lines 33 and 47 still name `UserProvider`, `AIProvider`, `SkillProvider`, and an `openhuman` sidecar, which no longer matches `App.tsx`.
11. `app/src/AppRoutes.tsx` lines 86-95 route unified chat through `/chat` and comment that it replaces `/conversations` and `/accounts`; `docs/src/05-pages-routing.md` lines 12-19 still list `/mnemonic`, `/conversations`, and `/agents`.
12. `src/openhuman/about_app/catalog.rs` lines 40-125 still uses user-facing "Conversations > ..." locations while the route and shell now call the surface `/chat`/Accounts.
13. `src/rpc/dispatch.rs` lines 30-40 still special-case `openhuman.security_policy_info`, while `src/core/jsonrpc.rs` lines 115-123 tries the static controller registry before falling back to legacy dispatch.
14. `src/openhuman/security/mod.rs` exposes `ops as rpc` but has no `schemas.rs` registration for security policy info; `src/core/all.rs` lines 90-188 registers many domains but not `security`.
15. `docs/SKILLS-HOW-THEY-WORK.md` lines 30-40 names nonexistent frontend files under `app/src/lib/skills/*`; the current typed skills client is `app/src/services/api/skillsApi.ts`.
16. `src/openhuman/skills/ops.rs` lines 8-18 and `src/openhuman/skills/ops_discover.rs` lines 12-18 describe the actual new/user/project/legacy skill locations more precisely than `docs/SKILLS-HOW-THEY-WORK.md`'s active runtime storage section.
17. `.github/workflows/test.yml` lines 128-131 correctly say the Tauri shell links the core as a path dependency, but the commented E2E job below still references Yarn, staged sidecars, and old sidecar copy steps.
18. `.github/workflows/coverage.yml` enforces changed-line coverage across Vitest, root Rust, and Tauri shell with `diff-cover --fail-under=80`; this is the strongest current merge gate.
19. `scripts/check-coverage-matrix.mjs` reported `Matrix: 138 rows, 138 catalog IDs, 0 parse errors, 0 missing, 0 duplicates`.
20. `docs/TEST-COVERAGE-MATRIX.md` lines 455-463 still hand-summarize "129 explicit + nested = 200 product features", which does not match the parser's validated row/catalog count.

## Validation Surface

Commands run during this audit:

| Command | Result | Notes |
| --- | --- | --- |
| `git status --short` | Pass, initially clean | Required validation is rerun after writing this report. |
| `git branch --show-current` | Pass | `codex/goal-openhuman-30min-action-plan`. |
| `git rev-parse HEAD` | Pass | `f11f217809841cf8e3a7f694d8e80967d8e188b8`. |
| `llm-tldr tree .` | Pass | Large output confirmed Rust core, React app, Tauri shell, tests, docs, and scripts. |
| `llm-tldr search "overnight" .` | Pass | No previous overnight report found. |
| `node scripts/check-coverage-matrix.mjs` | Pass | `138 rows, 138 catalog IDs, 0 parse errors, 0 missing, 0 duplicates`. |
| `cargo metadata --manifest-path Cargo.toml --format-version 1 --no-deps` | Pass | Confirms root package `openhuman` and binary target `openhuman-core`. |
| `pnpm --version` | Pass | `10.10.0`, matching root `packageManager`. |
| `test -d node_modules` | Failed | Dependencies are not installed in this worktree. |
| `test -d app/node_modules` | Failed | App dependencies are not installed in this worktree. |
| `ls scripts/stage-core-sidecar.mjs` | Failed | File is missing while `app/scripts/e2e-build.sh` still calls it. |
| `git add docs/overnight/2026-05-07-30min-extension/openhuman-action-plan.md` | Blocked | Sandbox cannot write Git worktree metadata at `/Users/jwalinshah/projects/openhuman/.git/worktrees/openhuman-30min-action-plan/index.lock`. |

Health commands to run after each implementation task, chosen from current repo docs and workflows:

- Docs-only tasks: `node scripts/check-coverage-matrix.mjs`, `pnpm --filter openhuman-app format:check` after dependencies are installed.
- Frontend route/provider/client tasks: `pnpm typecheck`, `pnpm lint`, `pnpm --dir app exec vitest run <changed-test-files> --config test/vitest.config.ts`.
- Root Rust controller tasks: `cargo fmt --manifest-path Cargo.toml --all --check`, `cargo test -p openhuman <filter>`.
- Tauri/in-process-core tasks: `cargo fmt --manifest-path app/src-tauri/Cargo.toml --all --check`, `cargo test --manifest-path app/src-tauri/Cargo.toml <filter>`.
- E2E script tasks: `pnpm --filter openhuman-app test:e2e:build`, then `bash app/scripts/e2e-run-spec.sh test/e2e/specs/smoke.spec.ts smoke` when CEF/Tauri driver prerequisites are present.
- Merge-level health: `pnpm test:coverage`, `pnpm test:rust`, and coverage workflow's `diff-cover` gate in CI.

## Known Blockers

- `node_modules/` and `app/node_modules/` are absent, so local Vitest/typecheck/lint cannot run without `pnpm install --frozen-lockfile`.
- `app/scripts/e2e-build.sh` currently fails before Tauri build because it calls missing `scripts/stage-core-sidecar.mjs`.
- E2E requires platform prerequisites not proven in this worktree: Node 24, CEF-vendored Tauri submodules, tauri-driver on Linux or Appium Mac2 on macOS.
- The old commented E2E CI block in `.github/workflows/test.yml` is not trustworthy as a reactivation template until it is updated from Yarn/sidecar staging to pnpm/in-process core.
- Local commit creation is blocked in this sandbox because the Git metadata directory for this worktree is outside the writable roots.
- External tracker updates, pushes, deploys, and PR creation were out of scope for this queue item.

## Implementation-Ready Follow-Up Tasks

### 1. Clean up the in-process core transition

Owned files:

- `app/scripts/e2e-build.sh`
- `docs/ARCHITECTURE.md`
- `docs/BUILDING.md`
- `docs/src/README.md`
- `docs/src/03-services.md`
- `docs/src-tauri/README.md`
- `docs/src-tauri/01-architecture.md`
- `scripts/worktree-bootstrap.sh`
- `scripts/setup-dev-codesign.sh`

Acceptance criteria:

- `app/scripts/e2e-build.sh` no longer calls missing `scripts/stage-core-sidecar.mjs`; it either builds only the embedded Tauri binary or invokes an existing maintained command.
- Docs consistently distinguish the embedded in-process Tauri core from manual `openhuman-core run` harnesses and release-packaged core binaries.
- `rg -n "stage-core-sidecar|cargo build --bin openhuman|src/bin/openhuman.rs|../../skills/skills" docs app/scripts scripts app/src-tauri` returns only intentional historical/release references with clear wording.
- `pnpm --filter openhuman-app test:e2e:build` reaches the real Tauri build step instead of failing on a missing script.
- Validation: `cargo metadata --manifest-path Cargo.toml --format-version 1 --no-deps`, `pnpm --filter openhuman-app test:e2e:build` when dependencies and CEF prerequisites are installed.

### 2. Migrate `openhuman.security_policy_info` into the controller registry

Owned files:

- `src/openhuman/security/schemas.rs`
- `src/openhuman/security/mod.rs`
- `src/core/all.rs`
- `src/rpc/dispatch.rs`
- `src/core/dispatch.rs`
- `src/core/all_tests.rs` or a new focused security schema test under `src/openhuman/security/`

Acceptance criteria:

- `openhuman.security_policy_info` is declared and registered through the same `ControllerSchema`/`RegisteredController` pattern as other domains.
- `src/rpc/dispatch.rs` no longer contains domain-specific security branches; fallback dispatch remains only for true core/legacy paths.
- `/schema` includes `openhuman.security_policy_info`, and parameter validation behavior is covered.
- Existing callers receive the same payload shape as before.
- Validation: `cargo fmt --manifest-path Cargo.toml --all --check`, `cargo test -p openhuman security_policy_info`, `cargo test -p openhuman core::all`.

### 3. Refresh route/provider docs and capability locations for `/chat`

Owned files:

- `docs/src/README.md`
- `docs/src/01-architecture.md`
- `docs/src/05-pages-routing.md`
- `docs/src/07-providers.md`
- `src/openhuman/about_app/catalog.rs`
- `src/openhuman/about_app/catalog_tests.rs`
- `app/src/AppRoutes.tsx` only if a tiny comment correction is needed

Acceptance criteria:

- Frontend docs list the actual provider chain from `app/src/App.tsx`.
- Route docs match `app/src/AppRoutes.tsx`, including `/chat`, `/channels`, `/notifications`, `/rewards`, `/webhooks`, and pre-production-only `/human`; stale `/conversations`, `/agents`, and `/mnemonic` route claims are removed or explicitly marked historical.
- The capability catalog's `how_to` strings use current user-facing navigation labels (`Chat`, `Notifications`, `Settings`, etc.) and do not point users to removed "Conversations" locations.
- Tests assert representative current capability locations so the catalog does not drift silently.
- Validation: `cargo test -p openhuman about_app`, `pnpm --filter openhuman-app format:check`.

### 4. Reconcile skills documentation with the current SKILL.md/API layout

Owned files:

- `docs/SKILLS-HOW-THEY-WORK.md`
- `docs/ARCHITECTURE.md`
- `docs/src-tauri/01-architecture.md`
- `app/src/services/api/skillsApi.ts` doc comments if needed
- `src/openhuman/skills/ops.rs`
- `src/openhuman/skills/ops_discover.rs`

Acceptance criteria:

- Frontend documentation names current files such as `app/src/services/api/skillsApi.ts` and current Skills page/hooks instead of nonexistent `app/src/lib/skills/*`.
- Storage documentation distinguishes remote catalog source (`tinyhumansai/openhuman-skills`/`SKILLS_REGISTRY_URL`) from local SKILL.md installs (`~/.openhuman/skills`, `~/.agents/skills`, `<workspace>/.openhuman/skills`, and legacy `<workspace>/skills`).
- Tauri docs stop claiming that `../../skills/skills` is bundled unless the bundle config is changed to do so.
- `rg -n "app/src/lib/skills|../../skills/skills|workspace/skills/<skill_id>/manifest.json" docs` returns no stale active-runtime claims.
- Validation: docs format check plus focused Rust tests for skills discovery if any code comments/tests change.

### 5. Preserve structured RPC errors and harden repo-quality summaries

Owned files:

- `app/src/services/coreRpcClient.ts`
- `app/src/services/__tests__/coreRpcClient.test.ts`
- `app/src/services/coreCommandClient.ts` if it should surface typed errors
- `docs/reviews/2026-04-23-adversarial-fixes.md` only if closing the deferred item
- `docs/TEST-COVERAGE-MATRIX.md`
- `scripts/check-coverage-matrix.mjs`
- `.github/workflows/pr-quality.yml`

Acceptance criteria:

- `callCoreRpc` rejects with an exported typed error that preserves JSON-RPC `code`, `message`, and optional `data`, while existing message-based callers still see the same `.message`.
- Tests cover JSON-RPC error code/data preservation, HTTP errors, timeouts, and network errors.
- `docs/TEST-COVERAGE-MATRIX.md` summary is generated from or reconciled with `scripts/feature-ids.json`/parser output so it no longer claims 200 leaves when the parser validates 138 IDs.
- The "PR Quality (soft)" workflow either has a current dated rationale for staying soft or is made hard-fail for non-doc/non-chore PRs after parser stability is confirmed.
- Validation: `pnpm --dir app exec vitest run src/services/__tests__/coreRpcClient.test.ts --config test/vitest.config.ts`, `node scripts/check-coverage-matrix.mjs`.

## Suggested Queue Order

1. Task 1 first, because the missing E2E stage script can block any user-visible UI validation.
2. Task 2 second, because it is a narrow Rust registry migration with clear acceptance tests.
3. Task 3 and Task 4 as docs/catalog cleanup slices; they reduce future agent confusion and are mostly independent.
4. Task 5 after the docs/script cleanup, because it touches shared frontend error behavior and should be reviewed with call-site expectations in mind.

## Handoff Notes

- No external tracker was updated.
- No PR was created.
- No product code was edited.
- No local commit was created because `git add` was blocked by sandbox permissions on the worktree metadata directory.
- This report is the only file intended to change for this queue item.
