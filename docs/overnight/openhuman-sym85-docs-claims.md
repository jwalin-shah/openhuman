# Overnight Audit: openhuman-sym85-docs-claims

Queue item: `openhuman-sym85-docs-claims`
Focus area: `docs-claims`
Repo path: `/Users/jwalinshah/projects/agent-stack/.agent-stack-worktrees/2026-05-07-overnight-marathon/openhuman-sym85-docs-claims`

## Scope and Decision Log

This is a read-only product/code audit except for this report. I did not change product code, generated data, secrets, external services, deployment state, GitHub, Linear, or release artifacts.

The issue file named by the queue item, `items/openhuman-sym85-docs-claims/ISSUE.md`, is not present inside this repo worktree (`rg --files items` returned "No such file or directory"). I treated the queue item text provided in the prompt as the work order and continued because the required output path was clear.

`docs/overnight/` was also absent before this task (`rg --files docs/overnight` returned "No such file or directory"), so I created the directory only to write the required report file.

## Repo Purpose and State

OpenHuman is a desktop AI assistant application with a React/Vite frontend, a Tauri v2 desktop shell, and a Rust core crate. The public README positions it as an open-source agentic assistant for daily work with local knowledge, local AI, desktop integrations, skills, channels, and community/team features.

Observed repo state at audit start:

- Branch: `codex/goal-openhuman-sym85-docs-claims`
- HEAD: `f11f217809841cf8e3a7f694d8e80967d8e188b8`
- Initial dirty state: `git status --short` printed no rows.
- Required validation for this queue item: `git status --short`.

## Commands and Local Evidence

Commands run for evidence:

- `llm-tldr tree .` succeeded and returned a large JSON tree showing `app/`, root `src/`, `docs/`, `tests/`, root `Cargo.toml`, root `package.json`, and `app/package.json`.
- `git branch --show-current` returned `codex/goal-openhuman-sym85-docs-claims`.
- `git rev-parse HEAD` returned `f11f217809841cf8e3a7f694d8e80967d8e188b8`.
- `git status --short` printed no rows before this report.
- `rg --files docs` showed the local docs set, including `docs/ARCHITECTURE.md`, `docs/src/`, `docs/src-tauri/`, `docs/E2E-TESTING.md`, `docs/TESTING-STRATEGY.md`, `docs/TEST-COVERAGE-MATRIX.md`, `docs/BUILDING.md`, and `docs/install.md`.
- `rg --files app/src | wc -l` returned `552`.
- `rg --files app/src | rg '\.(ts|tsx)$' | wc -l` returned `539`; this makes the `docs/src/README.md` approximate count of `~285` TypeScript/TSX files stale.
- `rg --files app/test/e2e/specs | wc -l` returned `41`.
- `rg --files src/openhuman/skills | wc -l` returned `14`.
- `rg --files | rg '^skills/'` exited with status `1`, showing no top-level vendored `skills/` tree in this worktree.
- `rg --files app/src-tauri/src` showed a flat Tauri source layout with `lib.rs`, `core_process.rs`, `core_rpc.rs`, scanners, `webview_apis/`, `webview_accounts/`, and CDP modules. It did not show the `commands/` directory claimed by `docs/src-tauri/01-architecture.md`.

## Claims That Are Supported Locally

1. Desktop-only Tauri host is supported by code.
   - `docs/ARCHITECTURE.md:25` says the supported end-user platforms are Windows, macOS, and Linux desktop.
   - `app/src-tauri/src/lib.rs:1-2` enforces this with a compile error for non-Windows, non-macOS, and non-Linux targets.
   - `app/src-tauri/tauri.conf.json:82` configures the desktop deep-link plugin section.

2. The repo is a React + Tauri + Rust monorepo.
   - `app/package.json` declares React 19, Vite, Tauri scripts, Vitest, WDIO, and frontend tooling.
   - root `Cargo.toml` defines the Rust crate `openhuman` and library `openhuman_core`.
   - `app/src-tauri/Cargo.toml:115` links the Tauri shell to `openhuman_core` by path.

3. CEF is the current default desktop runtime.
   - `docs/install.md:191-200` describes the vendored CEF-aware Tauri CLI.
   - `app/src-tauri/Cargo.toml:31-37` documents and enables the `cef` feature.
   - `app/src-tauri/Cargo.toml:106-107` depends on vendored `tauri-runtime-cef` and `cef`.
   - `app/package.json:11-13` uses `dev:cef` as the default app path and keeps `dev:wry` as the alternate.

4. A real coverage gate exists.
   - `.github/workflows/coverage.yml` runs Vitest coverage, Rust core `cargo llvm-cov`, Tauri `cargo llvm-cov`, and `diff-cover --fail-under=80`.
   - `.github/PULL_REQUEST_TEMPLATE.md` and issue templates reference the same 80 percent changed-lines gate.

5. E2E specs exist and are broad, even if CI automation docs are stale.
   - `rg --files app/test/e2e/specs | wc -l` returned `41`.
   - Existing specs include `login-flow.spec.ts`, `telegram-flow.spec.ts`, `whatsapp-flow.spec.ts`, `slack-flow.spec.ts`, `skill-lifecycle.spec.ts`, `skill-execution-flow.spec.ts`, `local-model-runtime.spec.ts`, and `notifications.spec.ts`.

6. Runtime config and workspace isolation are real concepts.
   - `.env.example` documents `OPENHUMAN_WORKSPACE`, `OPENHUMAN_CORE_PORT`, `OPENHUMAN_CORE_RPC_URL`, and `OPENHUMAN_CORE_TOKEN`.
   - `app/scripts/e2e-run-spec.sh` creates a temporary `OPENHUMAN_WORKSPACE` when one is not provided.
   - `src/openhuman/config/schema/load.rs` contains `OPENHUMAN_WORKSPACE` resolution paths.

## Stale or Unsupported Docs Claims

1. Sidecar staging and binary names are stale across several docs.
   - `docs/ARCHITECTURE.md:15` says `cargo build --bin openhuman` builds the staged binary.
   - `docs/BUILDING.md` repeats `cargo build --manifest-path Cargo.toml --bin openhuman` and `pnpm core:stage`.
   - root `Cargo.toml:8-10` defines the primary binary as `openhuman-core`, not `openhuman`.
   - `app/package.json:14` makes `core:stage` a no-op and explicitly says the core is linked in-process and the sidecar was removed.
   - `app/src-tauri/src/core_process.rs:1-5` says the HTTP/JSON-RPC server runs as a Tokio task inside the Tauri host and "there is no sidecar to leak".

2. QuickJS runtime docs conflict with current Rust code.
   - `docs/SKILLS-HOW-THEY-WORK.md` says the active runtime path is QuickJS and lists `openhuman.skills_start`, `openhuman.skills_call_tool`, runtime manifests, and `qjs_engine.rs`.
   - `docs/skills-runtime-isolation.md` defines an isolation contract around `QjsSkillInstance`, `AsyncRuntime`, and `AsyncContext`.
   - `docs/ARCHITECTURE.md:161` says the runtime is `rquickjs`.
   - `src/openhuman/skills/mod.rs:1` says legacy skill metadata helpers are retained after QuickJS runtime removal.
   - `src/openhuman/subconscious/situation_report.rs:256` says local QuickJS skills have been removed and users should use Composio and channels.
   - `src/openhuman/webhooks/bus.rs:172-187` routes skill webhook targets to a "skill runtime not available" response.
   - `src/openhuman/skills/schemas.rs` exposes only `skills_list`, `skills_read_resource`, `skills_create`, `skills_install_from_url`, and `skills_uninstall`; it does not expose `skills_start`, `skills_call_tool`, `skills_rpc`, or the registry/runtime methods listed in `docs/SKILLS-HOW-THEY-WORK.md`.

3. The documented top-level `skills/` directory is absent.
   - `docs/ARCHITECTURE.md` lists `skills/` as skill packages consumed by the runtime.
   - The command `rg --files | rg '^skills/'` returned no files.
   - `app/src-tauri/tauri.conf.json:47-49` bundles `../../src/openhuman/agent/prompts` and `recipes/**/*`, not `../../skills/skills`.

4. Frontend routing docs are internally inconsistent and stale.
   - `docs/src/05-pages-routing.md:23` correctly says there is no top-level `/login`.
   - The same file later shows `/login`, `Login.tsx`, `TelegramLoginButton`, `TelegramConnectionIndicator`, and a Telegram-oriented `ConnectStep`.
   - Actual `app/src/AppRoutes.tsx` has `/`, `/onboarding/*`, `/home`, optional `/human`, `/intelligence`, `/skills`, `/chat`, `/channels`, `/invites`, `/notifications`, `/rewards`, `/webhooks`, and `/settings/*`.
   - Actual `app/src/AppRoutes.tsx:87-90` says `/chat` replaced the old `/conversations` and `/accounts` routes.
   - Actual `ProtectedRoute.tsx:25-26` redirects unauthenticated users to `/`, not `/login`.

5. Frontend state docs describe removed slices.
   - `docs/src/02-state-management.md` describes `auth`, `user`, and `telegram` slices, Telegram MTProto thunks, and persisted `telegram.byUser`.
   - Actual `app/src/store/index.ts` registers `socket`, `thread`, `chatRuntime`, `channelConnections`, `accounts`, `notifications`, and `providerSurfaces`.
   - `rg --files app/src/store | rg 'telegram|skill|team|socket|ai|auth|user|channel'` showed socket, userScopedStorage, and channel connection files, but no `authSlice.ts`, `userSlice.ts`, or `store/telegram/`.
   - `app/src/store/channelConnectionsSlice.ts` is the current persisted channel connection state, with Telegram as a channel option rather than a Telegram MTProto app state tree.

6. Tauri shell docs describe a stale module layout.
   - `docs/src-tauri/01-architecture.md` says the shell has `commands/mod.rs`, `commands/core_relay.rs`, `commands/openhuman.rs`, and `commands/window.rs`.
   - `rg --files app/src-tauri/src` shows no `commands/` directory and no `commands.rs`.
   - Current shell command registration is in `app/src-tauri/src/lib.rs`, with core lifecycle in `core_process.rs` and `core_rpc.rs`.

7. E2E CI claims are stale.
   - `docs/E2E-TESTING.md` says the Linux `tauri-driver` job is the default CI path on `ubuntu-22.04`.
   - `.github/workflows/test.yml` has the `e2e-linux` and `e2e-macos` jobs commented out.
   - `.github/workflows/e2e-agent-review.yml` starts with a disabled note explaining that Linux E2E via `tauri-driver` times out because this app uses the CEF runtime and WebKitWebDriver cannot drive the CEF-backed WebView.

8. Environment docs still include obsolete core run-mode language.
   - `.env.example` says `OPENHUMAN_CORE_RUN_MODE=child` means "spawns sidecar".
   - `rg -n OPENHUMAN_CORE_RUN_MODE src app docs .env.example app/.env.example` found this variable only in docs/env examples, not in runtime code.
   - `OPENHUMAN_CORE_BIN` is still used in `src/openhuman/service/common.rs`, so only the run-mode claim appears unsupported, not every core binary override path.

9. `docs/ARCHITECTURE.md` mixes incompatible Telegram claims.
   - The high-level diagram and examples still include Telegram as an integration and message target.
   - The technology stack table says `Telegram | Removed | Telegram integration removed`.
   - Current code still includes `src/openhuman/channels/providers/telegram/`, `app/src-tauri/src/telegram_scanner/`, and UI channel definitions for Telegram. The likely accurate claim is "old MTProto provider removed; Telegram Bot/channel and webview scanning surfaces still exist", but docs do not make that distinction.

10. Product and distribution claims in `README.md` and `docs/install.md` are not fully locally verifiable.
    - README claims "one subscription, many providers", "working agent in a few clicks", local encryption, local AI paths, and desktop installer availability.
    - `docs/install.md` claims Homebrew, apt, npm, curl, checksums, notarization, and release artifact naming.
    - Some supporting code exists, but these claims depend on external release channels, backend behavior, signing/notarization, and hosted services. They should be verified against release CI/artifacts or rephrased as intent where local evidence is insufficient.

## Risks and Stale Assumptions

1. Agents may rebuild removed architecture.
   The QuickJS docs are detailed enough to send a future worker toward non-existent files and JSON-RPC methods. This is the highest-risk docs drift because it can cause large product-code changes in the wrong direction.

2. Build docs can fail immediately.
   `cargo build --bin openhuman` does not match the current `openhuman-core` binary, and `pnpm core:stage` is now a no-op. A new contributor following `docs/BUILDING.md` will either fail or misunderstand the in-process core model.

3. E2E docs overstate CI coverage.
   The repo has many E2E specs, but docs say Linux `tauri-driver` is the default CI path while workflows say that path is disabled for CEF. This can produce false confidence before merges.

4. Frontend docs can route work to dead files and routes.
   The state and routing docs mention `/login`, `/conversations`, `/agents`, `authSlice`, `userSlice`, and Telegram MTProto slices that are absent. That raises onboarding cost and increases wrong-file edits.

5. Security/privacy claims need an evidence matrix.
   "Encrypted locally", "workflow data stays on device", and "no localStorage for sensitive data" are high-trust claims. The code has encryption and user-scoped persistence paths, but the public docs should tie each privacy claim to current code and known exceptions.

6. External distribution docs may be correct but unaudited locally.
   Homebrew, apt, npm, website downloads, notarization, and release assets cannot be proven from this local read-only audit. They need release-artifact review or CI evidence.

## Next Safe Work

1. Refresh core lifecycle and build docs.
   - Files: `docs/ARCHITECTURE.md`, `docs/BUILDING.md`, `docs/src-tauri/README.md`, `docs/src-tauri/01-architecture.md`, `.env.example`, `app/.env.example`.
   - Acceptance criteria: docs consistently say the Tauri host starts an embedded in-process core server; primary root binary is `openhuman-core`; `core:stage` is a no-op unless intentionally restored; stale `commands/` directory references are removed or replaced with actual files.
   - Validation candidates: `git diff --check` expected pass; `rg -n "cargo build --.*--bin openhuman|core:stage.*stage|commands/core_relay|commands/mod.rs|OPENHUMAN_CORE_RUN_MODE=child" docs .env.example app/.env.example` expected to return no stale docs matches except explicitly deprecated notes.

2. Rewrite skills runtime docs around current SKILL.md metadata plus Composio/channels.
   - Files: `docs/SKILLS-HOW-THEY-WORK.md`, `docs/skills-runtime-isolation.md`, `docs/ARCHITECTURE.md`, `src/openhuman/skills/README.md`, `app/test/e2e/specs/skill-execution-flow.spec.ts` comments if the spec is stale.
   - Acceptance criteria: docs no longer describe active `rquickjs`, `QjsSkillInstance`, `skills_start`, or `skills_call_tool` unless those APIs are restored; documented RPC method list matches `src/openhuman/skills/schemas.rs`; removed-runtime history is kept in a short migration note.
   - Validation candidates: `cargo test -p openhuman skills::schemas` expected pass; `rg -n "rquickjs|QjsSkillInstance|skills_start|skills_call_tool|qjs_engine|QuickJS runtime" docs src/openhuman/skills app/test/e2e/specs/skill-execution-flow.spec.ts` expected to return only intentional historical notes.

3. Refresh frontend source docs.
   - Files: `docs/src/README.md`, `docs/src/01-architecture.md`, `docs/src/02-state-management.md`, `docs/src/05-pages-routing.md`, `docs/src/06-components.md`.
   - Acceptance criteria: route map matches `app/src/AppRoutes.tsx`; unauthenticated redirects point to `/`; state docs describe current slices and `CoreStateProvider`; old Telegram MTProto/auth/user docs are removed or explicitly marked historical.
   - Validation candidates: `pnpm debug unit app/src/components/__tests__/ProtectedRoute.test.tsx app/src/components/__tests__/PublicRoute.test.tsx` expected pass; `rg -n "/login|store/telegram|authSlice|userSlice|selectTelegramConnectionStatus|/conversations|/agents" docs/src` expected no stale matches except historical notes.

4. Align E2E/testing docs with current CI reality.
   - Files: `docs/E2E-TESTING.md`, `docs/TESTING-STRATEGY.md`, `docs/TEST-COVERAGE-MATRIX.md`, `.github/workflows/test.yml`, `.github/workflows/e2e-agent-review.yml` if wording changes are needed.
   - Acceptance criteria: docs state that E2E specs exist but Linux `tauri-driver` CI is not currently a default merge gate under CEF; manual/local E2E commands are separated from CI guarantees; coverage matrix uses "spec exists" and "CI gate" distinctly.
   - Validation candidates: `node scripts/check-coverage-matrix.mjs` expected pass; `rg -n "Linux is the default CI path|e2e-linux job runs|every push/PR.*E2E" docs .github/workflows` expected no stale unqualified claims.

5. Build a public-claim evidence matrix.
   - Files: `README.md`, `docs/install.md`, `docs/ARCHITECTURE.md`, `docs/RELEASE_POLICY.md`, `src/openhuman/about_app/` if capability catalog claims need alignment.
   - Acceptance criteria: each high-trust claim is labeled as locally implemented, externally verified, roadmap/beta, or removed; public privacy/security claims cite current implementation files; external distribution claims cite release workflows or are softened.
   - Validation candidates: `git diff --check` expected pass; `rg -n "one subscription|few clicks|encrypted locally|stored on your machine|notarized|apt|npm install -g openhuman" README.md docs/install.md docs/ARCHITECTURE.md` expected each remaining match to have nearby evidence or a scoped qualifier.

## Validation Notes

Required queue validation command:

```bash
git status --short
```

Expected status after writing this report: exit code `0`, with this report shown as the only new tracked/untracked content unless another worker modifies the worktree. A non-empty output is expected because the report itself is the required deliverable.

I did not run build, lint, unit, Rust, or E2E suites for this docs-claims audit. The goal pack validation command is `git status --short`, and broader validation would be disproportionate without code or docs rewrites beyond this report.

## Non-Goals

- No product code changes.
- No generated data or cache cleanup.
- No external services, web browsing, release downloads, deploys, pushes, PRs, or tracker updates.
- No attempt to prove hosted claims such as live website downloads, Homebrew tap status, apt repository availability, npm package behavior, notarization, or backend subscription behavior.
- No attempt to reconcile every historical planning doc under `docs/superpowers/`, `docs/reviews/`, or spike docs; the audit focused on active contributor/product docs and high-risk claims.

## Unknowns

- Whether external release/distribution claims are currently true in production.
- Whether README marketing claims are intentionally aspirational for beta or meant to be strictly implemented today.
- Whether `skill-execution-flow.spec.ts` is intentionally retained as historical coverage or is now a stale test that no longer runs.
- Whether the disabled Linux E2E workflow has an untracked replacement in another CI system.
- Whether `OPENHUMAN_CORE_RUN_MODE` is intentionally kept as a compatibility promise despite no local runtime references.
- Whether Telegram should be documented as removed, channel-only, webview-scanner-supported, or full product-supported.

## Handoff

Changed file intended by this worker: `docs/overnight/openhuman-sym85-docs-claims.md`.

No PR was created because queue scope excludes pushes and PR creation. No external tracker was updated or marked done.
