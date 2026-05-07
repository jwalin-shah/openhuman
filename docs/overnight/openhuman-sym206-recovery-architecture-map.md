# openhuman-sym206-recovery architecture-map audit

Date: 2026-05-07

Queue item: `openhuman-sym206-recovery-architecture-map`

Repo path: `/Users/jwalinshah/projects/agent-stack/.agent-stack-worktrees/2026-05-07-overnight-marathon/openhuman-sym206-recovery-architecture-map`

Branch: `codex/goal-openhuman-sym206-recovery-architecture-map`

HEAD at audit time: `f11f217809841cf8e3a7f694d8e80967d8e188b8`

Initial dirty state: clean. `git status --short --branch` printed only `## codex/goal-openhuman-sym206-recovery-architecture-map`.

Report scope: read-only architecture audit. Product code, generated data, external services, pushes, and PR creation were out of scope. The only intended filesystem change is this report.

## Repo Purpose

OpenHuman is a desktop AI assistant application with a React/Vite frontend, a Tauri v2 desktop shell, and a large Rust core crate. The current implementation is not a simple web app wrapped by Tauri: most product rules, JSON-RPC controllers, agent runtime, memory, channel providers, skills, credentials, config, and persistence live in the root Rust crate under `src/openhuman/`. The React app presents workflows and calls the core through HTTP JSON-RPC and Socket.IO. The Tauri host owns desktop process/window concerns, CEF webviews, native scanners, and bootstrapping the embedded core server.

The most important architecture finding is that the runtime has moved from a staged sidecar model to an embedded in-process core model, but a large amount of repo documentation and some scripts still describe the older sidecar architecture. Future agents are likely to make incorrect changes unless this drift is resolved.

## Commands And Local Evidence

Commands run during the audit:

- `git status --short --branch`: confirmed the starting worktree was clean on `codex/goal-openhuman-sym206-recovery-architecture-map`.
- `git rev-parse HEAD`: recorded `f11f217809841cf8e3a7f694d8e80967d8e188b8`.
- `git remote -v`: observed `origin` as `https://github.com/jwalin-shah/openhuman.git`, `jwalin-ssh` as `git@github.com:jwalin-shah/openhuman.git`, and `upstream` as `https://github.com/tinyhumansai/openhuman.git`.
- `llm-tldr tree .`: produced a large repo map with 12,219 lines of output, confirming this is a broad monorepo-style app rather than a small single-crate target.
- `fd -d 3 -t d . .`: confirmed major roots including `app/`, root `src/`, `docs/`, `scripts/`, `tests/`, `packages/`, `gitbooks/`, and `remotion/`.
- `fd -e rs . src | wc -l`: counted 958 Rust files in the root core.
- `fd -e rs . app/src-tauri/src | wc -l`: counted 41 Tauri shell Rust files.
- `fd -e ts -e tsx . app/src | wc -l`: counted 539 frontend TypeScript/TSX files.
- `fd -e test.ts -e test.tsx . app/src app/test | wc -l`: counted 169 frontend test files.
- `fd -e rs . tests | wc -l`: counted 16 Rust integration test files.
- `fd -e md . docs | wc -l`: counted 63 markdown docs under `docs/`.
- `rtk read scripts/stage-core-sidecar.mjs`: failed with `cat: scripts/stage-core-sidecar.mjs: No such file or directory`, while `app/scripts/e2e-build.sh` still calls that script.
- `test -d src/core_server; echo $?`: confirmed the documented `src/core_server/` path is absent in this checkout.
- `rg --files app/src-tauri/src | rg 'commands|utils|session_service|tauriSocket|core_relay'`: found no old Tauri `commands/`, `utils/`, session service, or relay module paths described by current docs.
- `rg --files app/src | rg 'UserProvider|AIProvider|SkillProvider|TelegramProvider|telegram|authSlice|userSlice|telegramSelectors|tauriSocket'`: found only `app/src/assets/icons/telegram.svg`, not the provider/slice architecture described in docs.
- `llm-tldr context ensure_running --project . --lang rust --depth 1`: confirmed the Tauri core lifecycle enters through `CoreProcessHandle::ensure_running`.
- `llm-tldr context callCoreRpc --project . --lang typescript --depth 1`: confirmed the app-side JSON-RPC client enters through `callCoreRpc`.
- `llm-tldr context invoke_method_inner --project . --lang rust --depth 1`: confirmed JSON-RPC first dispatches through the controller registry and only then falls back to dynamic dispatch.

## Current Architecture Map

### Frontend Entry Points And Ownership

The browser-side application starts in `app/src/main.tsx`. It initializes Sentry, registers the API client's token source from the core state snapshot, detects mascot/overlay/main window modes, wires deep links, primes the active user from core state, and renders React.

The current provider chain in `app/src/App.tsx` is:

`Redux Provider` -> `PersistGate` -> `CoreStateProvider` -> `SocketProvider` -> `ChatRuntimeProvider` -> `HashRouter` -> `CommandProvider` -> `ServiceBlockingGate` -> `AppShell`.

This differs from the docs that still describe `UserProvider`, `AIProvider`, and `SkillProvider`. The current app also starts webview account and notification services at module load in `App.tsx`, which means side effects are not confined to a single route.

Routing is centralized in `app/src/AppRoutes.tsx`. Current routes include `/`, `/onboarding/*`, `/home`, `/human`, `/intelligence`, `/skills`, `/chat`, `/channels`, `/invites`, `/notifications`, `/rewards`, `/webhooks`, and `/settings/*`. The route file explicitly notes that `/chat` replaces the older `/conversations` and `/accounts` surfaces, but several docs still describe the older route set.

Redux ownership in `app/src/store/index.ts` is currently focused on socket, thread, chat runtime, channel connections, accounts, notifications, and provider surfaces. The store exposes `window.__OPENHUMAN_STORE__` for WDIO. The docs that describe `authSlice`, `userSlice`, and a Telegram slice are stale for this checkout.

The main app-to-core RPC client is `app/src/services/coreRpcClient.ts`. It normalizes a few legacy method names, obtains the RPC URL via Tauri `core_rpc_url` or a stored override, obtains the bearer token via Tauri `core_rpc_token`, and posts JSON-RPC envelopes to `/rpc`. The file still contains stale token comments describing a `~/.openhuman/core.token` file workflow, even though the Tauri embedded path injects a runtime token into process environment/state.

Realtime chat uses both RPC and Socket.IO. `app/src/services/chatService.ts` sends chat messages through core RPC method `openhuman.channel_web_chat`, while `app/src/services/socketService.ts` connects to the core Socket.IO endpoint using the core RPC URL and bearer token. This split matters for debugging: request initiation and streamed response delivery cross different transports.

### Tauri Shell And Embedded Core

The desktop shell is under `app/src-tauri/src/`. `app/src-tauri/src/lib.rs` declares desktop-only compilation and aliases `AppRuntime = tauri::Cef`, so this checkout is tightly bound to desktop CEF rather than mobile or generic web targets.

The Tauri shell links the core crate directly. `app/src-tauri/Cargo.toml` depends on `openhuman_core = { path = "../..", package = "openhuman", default-features = false }` and comments that the core is embedded in-process to avoid orphan-sidecar bugs. This is reinforced by `app/package.json`, where `core:stage` is a no-op message: `[core:stage] no-op - core is linked in-process; sidecar removed (PR #1061)`.

The core lifecycle is implemented in `app/src-tauri/src/core_process.rs`. Despite the historical name, it now manages an in-process HTTP/JSON-RPC server task. `CoreProcessHandle::ensure_running()` handles stale listener detection, token generation, `OPENHUMAN_CORE_TOKEN`, `CURRENT_RPC_TOKEN`, port selection, and starts `openhuman_core::core::jsonrpc::run_server_embedded(None, Some(port), true)` with `tokio::spawn`.

Tauri setup in `app/src-tauri/src/lib.rs` starts the webview API bridge before starting the embedded core, computes the default core port, sets `OPENHUMAN_CORE_RPC_URL`, manages `CoreProcessHandle`, and spawns `ensure_running()`. It also exposes current runtime discovery commands such as `core_rpc_url` and `core_rpc_token`.

The Tauri command list in `generate_handler!` includes core URL/token commands, update commands, restart commands, account webview commands, notification commands, scanner controls, and other desktop surfaces. It does not match `docs/src-tauri/02-commands.md`, which still lists `greet`, `ai_get_config`, `ai_refresh_config`, `core_rpc_relay`, and `openhuman_service_*` as the core command set.

Large Tauri modules are load-bearing. `app/src-tauri/src/webview_accounts/mod.rs` is over 3,000 lines and owns child webviews, provider URLs, CDP migration behavior, session isolation, recipe events, account opening, and bounds management. `app/src-tauri/src/lib.rs` is over 2,000 lines and owns setup plus command registration. This is a real architecture boundary, not a thin shell in practice.

### Rust Core Entrypoints And Registry

The root crate is declared in `Cargo.toml` as package `openhuman` with library name `openhuman_core`. It has a main binary at `src/main.rs`, but the package also declares `openhuman-core`, `slack-backfill`, and `gmail-backfill-3d` binaries. `src/main.rs` loads environment, initializes Sentry, then delegates to `openhuman_core::run_core_from_args`.

The library entrypoint in `src/lib.rs` exposes `api`, `core`, `openhuman`, and `rpc`. `run_core_from_args` applies startup restart delay policy and delegates CLI parsing to `core::cli::run_from_cli_args`.

The domain map is rooted at `src/openhuman/mod.rs`. It exports many product domains, including `about_app`, `agent`, `app_state`, `billing`, `channels`, `config`, `credentials`, `cron`, `doctor`, `encryption`, `health`, `heartbeat`, `local_ai`, `memory`, `notifications`, `provider_surfaces`, `skills`, `socket`, `team`, `threads`, `tools`, `update`, `voice`, `webhooks`, `webview_accounts`, `webview_apis`, and `workspace`. This is the primary business-logic surface.

The JSON-RPC registry is rooted in `src/core/all.rs`. It collects controller schemas and handler registrations from many domains, builds RPC method names as `openhuman.<namespace>_<function>`, and exposes all schemas for clients. The same file still has a limited standalone CLI adapter path and a stale `update` namespace description mentioning staging newer core binaries.

JSON-RPC transport is in `src/core/jsonrpc.rs`. `invoke_method_inner` validates method names, dispatches through the static controller registry, and then falls back to `crate::core::dispatch::dispatch`. `src/core/dispatch.rs` handles `core.ping` and `core.version`, then falls through to `src/rpc/dispatch.rs`.

The old dynamic fallback is almost gone but not fully deleted. `src/rpc/dispatch.rs` still contains a domain-specific branch for `openhuman.security_policy_info`. The root `PLAN.md` also describes the backend overhaul as controller-registry consolidation and identifies this fallback as remaining leakage. This is a small but important unfinished architecture migration.

### Event Bus, Channels, And Agent Runtime

The shared event bus lives in `src/core/event_bus/`. `src/core/event_bus/mod.rs` documents two singleton surfaces: broadcast pub/sub and native typed request/response. The native request path allows Rust types, trait objects, channels, and oneshot senders to move across modules without serialization, so it is distinct from JSON-RPC.

`src/openhuman/agent/bus.rs` defines the native `agent.run_turn` request/response surface. It passes agent turn state, provider references, tools, history, and optional persistence through the event bus instead of requiring direct harness coupling. This is an important internal boundary between channels and the agent loop.

`src/openhuman/channels/bus.rs` subscribes to inbound channel events and delegates web channel work. `src/openhuman/channels/providers/web.rs` owns the web channel provider, uses `WebChannelEvent` broadcasts, validates thread/client/message inputs, applies prompt injection checks, and starts agent tasks.

The Socket.IO bridge in `src/core/socketio.rs` exposes realtime events and an `rpc:request` path that also flows into `jsonrpc::invoke_method`. It joins client rooms and emits chat/tool/subagent events through `WebChannelEvent`. This makes Socket.IO both a realtime event surface and a second RPC-like adapter.

Domain READMEs give useful boundaries:

- `src/openhuman/agent/README.md` says the agent domain owns the LLM tool-call loop, sub-agent dispatch, trigger triage, and transcript assembly, but not provider HTTP transport, memory storage, or channel adapters.
- `src/openhuman/memory/README.md` says memory owns unified memory store behavior, ingestion, namespace/KV APIs, and conversation persistence. It also admits legacy store and newer tree pipeline coexist.
- `src/openhuman/channels/README.md` says channels owns the `Channel` trait, connectors, runtime supervisor, inbound dispatch, and proactive outbound delivery.
- `src/openhuman/skills/README.md` says skills own `SKILL.md` discovery, trust policies, resource metadata, and prompt injection, while QuickJS runtime details live deeper in the skills runtime.
- `src/openhuman/config/README.md` says config owns TOML-backed config loading, environment overrides, user directory layout, and daemon descriptors, and is consumed widely.

### Webview Bridge And Account Surfaces

Webview account architecture spans Tauri, core, and React:

- `app/src-tauri/src/webview_accounts/mod.rs` owns provider child webviews, session directories, CDP scanner migration behavior, JS bridge setup for deferred providers, and `webview_account_open`.
- `app/src/services/webviewAccountService.ts` starts only in Tauri, listens for native events, updates Redux account state, shows notifications, and may trigger chat sends or core RPC calls.
- `app/src-tauri/src/webview_apis/mod.rs` starts a localhost bridge for Tauri webview APIs but currently has no registered methods. Comments say the Gmail embedded connector was retired.
- `app/src-tauri/src/webview_apis/server.rs` binds the bridge to a configured or random localhost port and exposes start/stop behavior.
- `src/openhuman/webview_apis/mod.rs` and `src/openhuman/webview_apis/client.rs` provide a core-side client mirror that depends on the bridge port environment variable.

This surface is not captured accurately by current architecture docs, which still emphasize a sidecar relay and old command modules instead of the actual Tauri-native webview/account bridge.

## Stale Assumptions And Risks

1. Sidecar architecture drift is widespread. `AGENTS.md`, `CLAUDE.md`, `docs/src-tauri/README.md`, `docs/src-tauri/01-architecture.md`, `docs/src-tauri/02-commands.md`, `docs/src-tauri/03-services.md`, and `docs/src/01-architecture.md` still describe a staged sidecar, `core_rpc_relay`, `src/core_server/`, command folders, and sidecar resources. The implementation links `openhuman_core` in-process and starts an embedded HTTP server from Tauri. This creates high risk that agents will reintroduce sidecar assumptions.

2. E2E build appears stale. `app/scripts/e2e-build.sh` still calls `node "$REPO_ROOT/scripts/stage-core-sidecar.mjs"`, but `scripts/stage-core-sidecar.mjs` is missing. The `core:stage` package script is already a no-op, so this looks like a missed migration. Expected impact: `pnpm test:e2e:build` likely fails before reaching the real Tauri build.

3. Frontend docs describe obsolete providers, routes, and slices. `docs/src/01-architecture.md` and `docs/src/02-state-management.md` mention `UserProvider`, `AIProvider`, `SkillProvider`, `authSlice`, `userSlice`, Telegram-specific state, and `/conversations`. Current code uses `CoreStateProvider`, `ChatRuntimeProvider`, accounts/channel connection slices, and `/chat`. This increases onboarding and automated-change risk.

4. Controller migration has one visible leftover. JSON-RPC correctly prefers the controller registry, but `src/rpc/dispatch.rs` still handles `openhuman.security_policy_info`. The root `PLAN.md` calls out this exact fallback as remaining leakage. Until removed, future controller work must reason about two dispatch paths.

5. Token and update comments are stale in security-sensitive areas. `app/src/services/coreRpcClient.ts` still describes a `~/.openhuman/core.token` file workflow, while the embedded Tauri path uses generated environment/state tokens. `src/core/all.rs` still describes update behavior as staging newer core binaries. These comments sit near auth and update surfaces, so they are higher risk than ordinary stale prose.

6. Tauri is heavier than the docs suggest. `app/src-tauri/src/lib.rs` and `app/src-tauri/src/webview_accounts/mod.rs` contain large setup, bridge, scanner, and account-management surfaces. Architecture docs still frame Tauri mostly as a thin relay. Future work touching webview accounts, notifications, scanner flows, or CEF must treat the Tauri shell as a product boundary.

7. Legacy and new memory systems coexist. `src/openhuman/memory/README.md` explicitly says the legacy `MemoryStore` and newer tree/retrieval pipeline coexist. That may be intentional, but it is a stale-assumption risk for agents who expect one memory backend or one persistence model.

8. Socket.IO is both realtime and RPC-adjacent. `src/core/socketio.rs` handles realtime chat events and an `rpc:request` path that enters JSON-RPC invocation. This complicates validation because successful HTTP RPC tests do not prove realtime delivery or room behavior.

## Next Safe Work

### Task 1: Align Architecture Docs With Embedded Core Runtime

Scope:

- Update `docs/src-tauri/README.md`.
- Update `docs/src-tauri/01-architecture.md`.
- Update `docs/src-tauri/02-commands.md`.
- Update `docs/src-tauri/03-services.md`.
- Update `docs/src/01-architecture.md`.
- Consider matching edits in `AGENTS.md` and `CLAUDE.md` only if the repo owner wants agent-facing instructions updated in the same PR.

Acceptance criteria:

- Docs describe Tauri linking `openhuman_core` in-process and starting `run_server_embedded`.
- Docs describe app RPC through `core_rpc_url` / `core_rpc_token` and HTTP `/rpc`, not `core_rpc_relay`.
- Docs remove references to `scripts/stage-core-sidecar.mjs`, `src/core_server/`, Tauri `commands/` modules, and staged sidecar binaries unless explicitly marked as historical.
- Frontend provider chain in docs matches `app/src/App.tsx`.

Validation command candidates:

- `rg -n "core_rpc_relay|stage-core-sidecar|src/core_server|UserProvider|AIProvider|SkillProvider|authSlice|telegramSelectors" docs/src docs/src-tauri AGENTS.md CLAUDE.md`
  - Expected after task: no unqualified stale hits; any remaining hits should be explicitly in historical migration notes.
- `pnpm format:check`
  - Expected after task: pass if dependencies are installed.

### Task 2: Fix E2E Build Sidecar Staging Drift

Scope:

- Update `app/scripts/e2e-build.sh` so it no longer calls missing `scripts/stage-core-sidecar.mjs`.
- Update any comments in `app/scripts/e2e-build.sh`, `app/package.json`, and Tauri config docs that still imply `bundle.externalBin` is required for the core.
- Keep this separate from broad docs cleanup if possible; it is a validation-breakage fix.

Acceptance criteria:

- `app/scripts/e2e-build.sh` no longer references `stage-core-sidecar.mjs`.
- The E2E build script prepares the embedded-core Tauri app in the current architecture.
- If the build still fails due to CEF, platform, or vendored dependency issues, the failure is a later-stage blocker and not the missing sidecar script.

Validation command candidates:

- `! rg -n "stage-core-sidecar|bundle.externalBin|sidecar" app/scripts/e2e-build.sh app/package.json app/src-tauri/tauri.conf.json`
  - Expected after task: pass or only historical/comment hits intentionally retained.
- `pnpm test:e2e:build`
  - Expected now: likely fail because `scripts/stage-core-sidecar.mjs` is missing.
  - Expected after task: proceed past the removed sidecar-staging step; may still fail on platform dependencies.

### Task 3: Finish The Controller Registry Migration

Scope:

- Move `openhuman.security_policy_info` out of `src/rpc/dispatch.rs` and into a domain-owned controller schema module, likely under a security/about-app domain chosen by the maintainer.
- Register the handler through `src/core/all.rs`.
- Remove or reduce `src/rpc/dispatch.rs` so JSON-RPC has one main controller dispatch path.
- Update `PLAN.md` if the migration is complete.

Acceptance criteria:

- `openhuman.security_policy_info` is included in controller schemas and registered handlers.
- `src/rpc/dispatch.rs` contains no domain-specific JSON-RPC method match.
- Existing unknown-method behavior remains unchanged.

Validation command candidates:

- `cargo test --manifest-path Cargo.toml all_controller_schemas_matches_registered_count`
  - Expected after task: pass.
- `cargo test --manifest-path Cargo.toml security_policy_info`
  - Expected after task: pass if targeted tests are named around that method, otherwise replace with the exact migrated test.
- `cargo check --manifest-path Cargo.toml`
  - Expected after task: pass.

### Task 4: Refresh Frontend State And Route Documentation

Scope:

- Update `docs/src/01-architecture.md`.
- Update `docs/src/02-state-management.md`.
- Update `docs/src/03-services.md`.
- Update `docs/src/05-pages-routing.md` if present in the docs map.

Acceptance criteria:

- Provider chain matches `app/src/App.tsx`.
- Store slices match `app/src/store/index.ts`.
- Route list matches `app/src/AppRoutes.tsx`, including `/chat` replacing older `/conversations` and `/accounts` surfaces.
- Services documentation explains that chat request initiation and chat streaming use different transports.

Validation command candidates:

- `rg -n "UserProvider|AIProvider|SkillProvider|TelegramProvider|authSlice|userSlice|telegramSelectors|/conversations" docs/src`
  - Expected after task: no stale hits unless explicitly marked legacy.
- `pnpm --filter openhuman-app test:unit`
  - Expected after task: pass if dependencies and local test services are available.

### Task 5: Map Webview Account Ownership

Scope:

- Add or update a focused doc for the webview account bridge covering Tauri `webview_accounts`, CDP scanners, frontend `webviewAccountService`, Redux account state, Tauri `webview_apis`, and core `webview_apis`.
- Record which providers are CDP-migrated and which still use JS recipes.

Acceptance criteria:

- A future worker can identify where account windows are opened, where events are emitted, where React state is updated, and how the core calls back into the Tauri bridge.
- The doc no longer implies webview APIs are just a sidecar relay.
- Provider ownership and migration status are documented from code, not assumptions.

Validation command candidates:

- `rg -n "webview_account_open|startWebviewAccountService|webview_apis|PROVIDER_URLS|CDP" app/src-tauri/src app/src src/openhuman docs`
  - Expected after task: docs include intentional references that map to actual code.
- `pnpm --filter openhuman-app test src/services/webviewAccountService`
  - Expected after task: pass if a targeted test exists; otherwise use the closest existing account-service test.

## Validation Map Candidates

Required validation for this queue item:

- `git status --short`
  - Expected after this report is written: exits 0 and shows this report as the only dirty path.

Architecture validation candidates for future implementation tasks:

- `cargo check --manifest-path Cargo.toml`
  - Expected: should pass for Rust-only controller or docs-adjacent changes if dependencies are present. Not run in this audit because product validation beyond `git status --short` was out of scope.
- `cargo test --manifest-path Cargo.toml all_controller_schemas_matches_registered_count`
  - Expected: should pass before and after registry work. Not run in this audit.
- `pnpm format:check`
  - Expected: should pass for docs/script cleanup if dependencies are installed. Not run in this audit.
- `pnpm --filter openhuman-app test:unit`
  - Expected: should pass for frontend docs-adjacent or state-map changes if dependencies and mock server setup are available. Not run in this audit.
- `pnpm test:e2e:build`
  - Expected now: likely fail early due to missing `scripts/stage-core-sidecar.mjs` referenced by `app/scripts/e2e-build.sh`. That failure should be verified and fixed in a separate implementation task.

## Non-Goals

- No product code edits.
- No generated artifacts, dependency installs, or cache cleanup.
- No secrets, external service calls, deploys, pushes, PRs, or tracker updates.
- No attempt to merge or complete external issue state.
- No full sibling-repo comparison; this repo is large enough that the allotted audit time was better spent mapping current local architecture deeply.
- No claim that heavy build or test suites pass, because this queue item only required `git status --short`.

## Unknowns

- Whether upstream already has a separate docs branch that reconciles the in-process core migration.
- Whether maintainers want agent-facing `AGENTS.md` and `CLAUDE.md` updated together with user-facing docs or handled separately.
- Whether `pnpm test:e2e:build` is still intended as a primary local validation command after the embedded-core migration.
- Whether `webview_apis` being empty is a deliberate retired-connector state or a temporary gap before new bridge methods are added.
- Whether standalone `openhuman-core` server mode remains a supported product/runtime path or only a development/CLI utility.
- Whether the remaining `openhuman.security_policy_info` fallback should live under a new `security` domain, `about_app`, or an existing policy/config domain.

## Blockers

No blocker prevented this audit report or the required `git status --short` validation.

Future implementation blocker observed: `app/scripts/e2e-build.sh` references `scripts/stage-core-sidecar.mjs`, but that script is missing in this checkout.
