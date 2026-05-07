# Overnight audit: openhuman-sym208-recovery architecture map

Queue item: `openhuman-sym208-recovery-architecture-map`

Date: 2026-05-07

Worker branch: `codex/goal-openhuman-sym208-recovery-architecture-map`

Starting HEAD: `f11f217809841cf8e3a7f694d8e80967d8e188b8`

Report path: `docs/overnight/openhuman-sym208-recovery-architecture-map.md`

## Scope

This is a read-only architecture audit except for this report. I did not change product code, generated data, secrets, external services, deployments, trackers, branches, or pull requests.

Focus area: architecture map, especially module boundaries, entrypoints, ownership, and stale assumptions.

## Repo Purpose

OpenHuman is a desktop-first assistant app with a React/Vite frontend, a Tauri v2 desktop shell using the CEF runtime, and a Rust core crate (`openhuman_core`) that owns product behavior exposed over local HTTP JSON-RPC. The repo also carries docs, packaging scripts, mock servers, WDIO E2E harnesses, release tooling, and GitBook-style public docs.

The current code shape is not exactly what older docs describe. The Tauri app now links the root Rust core in-process and starts the core HTTP server as a Tokio task. Several docs still describe a staged sidecar binary and a `core_rpc_relay` command path that no longer appears in the Tauri command registry.

## Branch, Dirty State, And Local Context

- `pwd` observed repo root as `/Users/jwalinshah/projects/agent-stack/.agent-stack-worktrees/2026-05-07-overnight-marathon/openhuman-sym208-recovery-architecture-map`.
- `git branch --show-current` returned `codex/goal-openhuman-sym208-recovery-architecture-map`.
- Initial `git status --short` produced no output, so the worktree was clean before creating this report.
- `git rev-parse HEAD` returned `f11f217809841cf8e3a7f694d8e80967d8e188b8`.
- `git remote -v` showed `origin` pointing to `https://github.com/jwalin-shah/openhuman.git`, `upstream` pointing to `https://github.com/tinyhumansai/openhuman.git`, and `jwalin-ssh` pointing to `git@github.com:jwalin-shah/openhuman.git`.
- `llm-tldr tree .` completed and emitted a large JSON tree. It confirmed the repo spans `app/`, `docs/`, `gitbooks/`, `packages/`, `remotion/`, `scripts/`, root Rust `src/`, and root `tests/`.
- `fd -d 3 -t f . .` confirmed key entrypoint files: `Cargo.toml`, `src/main.rs`, `src/lib.rs`, `src/core/*`, `src/openhuman/*`, `app/src/main.tsx`, `app/src/App.tsx`, `app/src/AppRoutes.tsx`, `app/src-tauri/src/lib.rs`, and `app/src-tauri/src/core_process.rs`.
- `rg --files src/openhuman | wc -l` returned `1081`.
- `rg --files app/src | rg '\.(ts|tsx)$' | wc -l` returned `539`.
- `rg --files app/src-tauri/src | wc -l` returned `42`.
- `test -d skills` exited `1`; `fd -t d '^skills$' .` only found `app/src/components/skills/` and `src/openhuman/skills/`, not a root `skills/` package directory.

## Architecture Map

### 1. Root Rust Core

Primary entrypoints:

- `Cargo.toml` declares package `openhuman`, library `openhuman_core`, binary `openhuman-core` at `src/main.rs`, and auxiliary backfill binaries.
- `src/main.rs` loads `.env`, initializes Sentry, scrubs obvious secret patterns, then delegates to `openhuman_core::run_core_from_args`.
- `src/lib.rs` exposes `api`, `core`, `openhuman`, and `rpc`, then routes CLI args through `core::cli::run_from_cli_args` after applying service restart delay behavior.
- `src/core/jsonrpc.rs` builds the Axum router, owns `/rpc`, `/schema`, `/health`, `/events`, `/auth/telegram`, `/ws/dictation`, auth middleware layering, server startup, event-bus bootstrap, socket bootstrap, background services, cron startup, update scheduler, and channel-listener startup.
- `src/core/auth.rs` owns local RPC bearer-token auth. `POST /rpc` is protected; public utility paths include `/`, `/health`, `/schema`, `/events`, `/events/webhooks`, `/auth/telegram`, and `/ws/dictation`.
- `src/core/all.rs` is the central controller registry. It collects declared schemas and registered handlers from OpenHuman domains, validates them, formats RPC names as `openhuman.<namespace>_<function>`, and exposes registry lookup/invocation to JSON-RPC and CLI.
- `src/core/dispatch.rs` is the fallback dispatcher. It handles `core.ping` and `core.version`, then falls through to `src/rpc/dispatch.rs`.
- `src/rpc/dispatch.rs` now only handles `openhuman.security_policy_info`. This is a remaining legacy/dynamic dispatch island next to the controller registry.

Ownership reading:

- The core owns business logic, persistent state, auth/session storage, memory, channels, tools, skills, provider calls, JSON-RPC schemas, and background runtime startup.
- The transport-level seam is `src/core/jsonrpc.rs` plus `src/core/all.rs`: controllers should be registered through domain `schemas.rs` modules, not hand-wired into JSON-RPC.
- The main stale assumption is not in the root core itself, but in docs that still say the desktop app stages and launches a separate sidecar.

### 2. OpenHuman Domain Tree

Primary evidence:

- `src/openhuman/mod.rs` exports more than 50 domains, including `agent`, `channels`, `composio`, `config`, `credentials`, `memory`, `skills`, `tools`, `threads`, `webhooks`, `webview_apis`, `webview_notifications`, and `workspace`.
- `src/openhuman/memory/README.md` documents a layered memory architecture: `traits.rs` contract, `store/` backend, `ingestion/`, `tree/`, `conversations/`, and `slack_ingestion/`.
- `src/openhuman/memory/tree/README.md` says the bucket-seal memory tree is Phase 1 of issue `#707` and references `docs/MEMORY_ARCHITECTURE_LLD.md`, but that file is not present in the repo.
- `src/openhuman/channels/README.md` says channels own the `Channel` trait, provider connectors, runtime supervisor, inbound dispatch, and proactive delivery, but do not own channel prompt copy or credential storage.
- `src/openhuman/channels/controllers/schemas.rs` registers channel RPCs such as `channels.list`, `channels.connect`, `channels.status`, Telegram managed-DM link checks, Discord link checks, send/reaction/thread methods.
- `src/openhuman/channels/runtime/startup.rs` constructs provider runtime, memory, tool registry, skills, system prompt, configured channel instances, cron/proactive/tree subscribers, and the dispatch loop.
- `src/openhuman/channels/bus.rs` also handles inbound channel messages by listening for `DomainEvent::ChannelInboundMessage`, starting web-channel chat, streaming edits/fillers/typing indicators, and replying through backend REST.

Ownership reading:

- Domain modules are generally deep modules with their own `mod.rs`, `schemas.rs`, `ops.rs` or runtime files, tests, and README where mature.
- `memory` is the largest visible migration area: legacy store/ingestion and new `tree/` retrieval coexist by design.
- `channels` has two meaningful inbound paths: configured channel listener startup and event-bus inbound subscriber. The comments explain some split, but ownership is still spread across `runtime/startup.rs`, `bus.rs`, core bootstrap, and backend REST clients.

### 3. Tauri Desktop Shell

Primary evidence:

- `app/src-tauri/Cargo.toml` depends on `openhuman_core = { path = "../..", package = "openhuman" }` and documents that the core HTTP/JSON-RPC server runs as a Tokio task inside the Tauri host.
- `app/src-tauri/src/core_process.rs` explicitly says the core runs in-process so its lifetime is tied to the GUI process and no sidecar leaks on app quit.
- `app/src-tauri/src/core_process.rs` still exposes a port-backed `CoreProcessHandle`, detects stale listeners on the configured port, may kill a stale OpenHuman listener after fingerprinting it, sets `OPENHUMAN_CORE_TOKEN`, then calls `openhuman_core::core::jsonrpc::run_server_embedded`.
- `app/src-tauri/src/core_rpc.rs` only resolves the local RPC URL and applies bearer auth headers. It is not the old broad relay layer described in docs.
- `app/src-tauri/src/lib.rs` registers Tauri commands such as `core_rpc_url`, `core_rpc_token`, app update commands, restart commands, webview account commands, notification commands, screen capture commands, and mascot commands. The visible `generate_handler!` list does not include `core_rpc_relay`.
- `app/src-tauri/tauri.conf.json` bundles `../../src/openhuman/agent/prompts` and `recipes/**/*`; it does not bundle `../../skills/skills`.
- `app/package.json` sets `"core:stage": "echo '[core:stage] no-op - core is linked in-process; sidecar removed (PR #1061)'"`.

Ownership reading:

- Tauri owns native windowing, CEF/webview accounts, native notification interception, core process lifecycle, local RPC token provisioning, update shell operations, screen capture, and OS-specific scanners.
- The Tauri shell has grown meaningful product-adjacent surfaces: account webviews, scanners, notification routing, app update behavior, active-user cache paths, and embedded core lifecycle. This is not just a thin invoke bridge.
- The exact split between "desktop host concern" and "product behavior" needs continual enforcement. Webview scanners live in Tauri because CDP/CEF access is native-host specific; core business rules still need to remain in root `src/openhuman`.

### 4. React Frontend

Primary evidence:

- `app/src/main.tsx` initializes Sentry, sets API client token access, detects main/overlay/mascot windows, sets default hash route, installs deep-link listener, primes active user ID from core, then renders `App`, `OverlayApp`, or `MascotWindowApp`.
- `app/src/App.tsx` wraps the app in `Sentry.ErrorBoundary`, Redux `Provider`, `PersistGate`, `CoreStateProvider`, `SocketProvider`, `ChatRuntimeProvider`, `HashRouter`, `CommandProvider`, and `ServiceBlockingGate`.
- `app/src/AppRoutes.tsx` exposes routes `/`, `/onboarding/*`, `/home`, `/human` in non-prod, `/intelligence`, `/skills`, `/chat`, `/channels`, `/invites`, `/notifications`, `/rewards`, `/webhooks`, and `/settings/*`.
- `app/src/services/coreRpcClient.ts` makes direct HTTP JSON-RPC calls to the local core URL with a bearer token from `core_rpc_token`. It also carries legacy method aliases for older frontend call names.
- `app/src/providers/CoreStateProvider.tsx` polls `fetchCoreAppSnapshot` every 2 seconds, manages auth identity flips, restarts app on user namespace changes, syncs memory client token, handles teams/invites, and writes core state snapshots to a module-level store.
- `app/src/lib/coreState/store.ts` is the frontend's current snapshot cache. It includes a commented-out welcome-lock compatibility function that now always returns false after Joyride walkthrough replacement.
- `app/src/providers/ChatRuntimeProvider.tsx` subscribes to socket chat events and maps inference, tool, subagent, streaming, proactive, done, and error events into Redux chat runtime/thread slices.

Ownership reading:

- The frontend owns user interaction, route gating, rendered state, long-lived UI subscriptions, and local optimistic view state.
- It does not own core business rules, but it does own several process-sensitive behaviors: active-user namespace flips, restarting the app, local RPC auth discovery, and chat-event de-duplication.
- `coreRpcClient.ts` legacy aliases are a compatibility adapter. They are useful but can mask stale callers if no task tracks alias removal.

### 5. Validation And Test Surfaces

Primary evidence:

- `package.json` delegates build, typecheck, lint, format, unit tests, rust tests, debug helpers, and work scripts into `openhuman-app`.
- `app/package.json` provides `test:unit`, `test:coverage`, `test:rust`, `test:e2e:*`, `rust:check`, `rust:format`, `rust:clippy`, `lint`, `format:check`, `knip`, and production build commands.
- `docs/TESTING-STRATEGY.md` defines Rust unit, Rust integration, Vitest, WDIO E2E, and manual smoke layers.
- `scripts/test-rust-with-mock.sh` starts `scripts/mock-api-server.mjs`, exports `BACKEND_URL` and `VITE_BACKEND_URL`, then runs `cargo test --manifest-path Cargo.toml --workspace "$@"`.
- `src/core/all_tests.rs` asserts registry consistency, controller/schema matching, duplicate rejection, RPC method formatting, and known-method invocation.
- `src/core/jsonrpc_tests.rs` tests registry invocation, required/unknown param validation, schema dump inclusion, and fallback `core.ping` / `core.version`.
- `tests/json_rpc_e2e.rs` drives a real Axum stack with a mock upstream API and covers auth middleware, JSON-RPC calls, billing/team methods, voice status, notifications, credentials CRUD, and skills uninstall.

Ownership reading:

- Registry tests are strong enough to protect controller schema drift.
- The test strategy still uses "sidecar" wording in some places, but actual Rust tests call the root server directly.
- E2E and local app tests are likely expensive and environment-sensitive due CEF, Appium/tauri-driver, and OS features.

## Stale Assumptions And Risks

1. Sidecar documentation drift

Evidence:

- `app/package.json` says `core:stage` is a no-op because the core is linked in-process.
- `app/src-tauri/Cargo.toml` says `openhuman_core` is embedded in-process.
- `app/src-tauri/src/core_process.rs` says there is no sidecar to leak.
- `docs/src-tauri/README.md`, `docs/src-tauri/01-architecture.md`, `docs/src-tauri/03-services.md`, `AGENTS.md`, and `CLAUDE.md` still describe sidecar staging, `scripts/stage-core-sidecar.mjs`, `externalBin`, and `core_rpc_relay`.

Risk:

- New agents may waste time building or debugging a removed sidecar path, miss the in-process token model, or choose the wrong validation commands.

2. Root `skills/` claim is stale

Evidence:

- `docs/ARCHITECTURE.md` lists a root `skills/` directory as consumed by the runtime.
- `app/src-tauri/tauri.conf.json` resources only include prompts and recipes, not `../../skills/skills`.
- `test -d skills` exited `1`; no root `skills/` directory exists.
- `AGENTS.md` says canonical skill sources live in `tinyhumansai/openhuman-skills`, not vendored in this tree.
- `src/openhuman/skills/ops.rs` discovers user/project/legacy skill directories such as `~/.openhuman/skills`, `~/.agents/skills`, `<workspace>/.openhuman/skills`, and legacy `<workspace>/skills`.

Risk:

- Skill-runtime contributors may look for a nonexistent bundled skill source tree or assume release packaging includes a root skill bundle.

3. Telegram architecture claims conflict across docs and code

Evidence:

- `docs/ARCHITECTURE.md` says Telegram is "Removed" in the stack table, while earlier examples still show Telegram as an integration and Telegram API example.
- `docs/src/README.md` correctly says there is no `TelegramProvider` or `mtprotoService` in the frontend.
- `docs/src/02-state-management.md`, `docs/src/05-pages-routing.md`, and `docs/src/06-components.md` still describe Telegram Redux slices, selectors, thunks, OAuth button flows, and Telegram modals that do not match the current top-level app route list.
- Current code still has real Telegram surfaces: `src/openhuman/channels/providers/telegram/*`, `src/openhuman/channels/controllers/schemas.rs` managed-DM methods, `app/src/components/channels/TelegramConfig.tsx`, and `app/src-tauri/src/telegram_scanner/*`.

Risk:

- "Telegram removed" is too coarse. MTProto frontend provider appears removed, but bot/channel and webview scanner surfaces remain. Product, QA, and agents need precise language to avoid deleting active code or testing dead flows.

4. Runtime bootstrap ownership is spread across multiple modules

Evidence:

- `src/core/jsonrpc.rs` starts the embedded core server, bootstraps event bus/socket, marks stale turns interrupted, initializes agent definitions, migrates sessions, starts gated services, update scheduler, cron, and channel listeners.
- `src/openhuman/channels/runtime/startup.rs` also initializes event bus, health subscriber, skill cleanup subscriber, conversation persistence, Composio trigger subscriber, periodic sync, agent native handlers, provider runtime, memory, tools, skills, channel listeners, cron delivery, proactive subscriber, and tree summarizer subscriber.
- Comments say some registration is intentionally idempotent or Once-guarded, but not all startup ownership is easy to audit from one file.

Risk:

- Duplicate subscription, missing subscription, or startup-order bugs will be hard to diagnose because the ownership map spans core transport, channel runtime, and domain bus modules.

5. Controller registry is strong, but manual aggregation remains a scaling hotspot

Evidence:

- `src/core/all.rs` manually extends controller/schema lists for every domain.
- `src/core/all_tests.rs` catches declared/registered mismatches and duplicate RPC methods.
- `src/rpc/dispatch.rs` still contains a non-registry fallback for `openhuman.security_policy_info`.

Risk:

- New domains can still be forgotten in the central list until tests run. The remaining fallback path is small, but it keeps a second way to expose domain behavior.

6. Memory tree depends on missing design doc

Evidence:

- `src/openhuman/memory/tree/README.md` references `docs/MEMORY_ARCHITECTURE_LLD.md`.
- `fd` over docs did not find that file.
- The README says legacy store/ingestion and new tree coexist until full replacement.

Risk:

- Future memory work may need to infer design intent from code and README fragments instead of the intended LLD. That increases risk when modifying retrieval, bucket sealing, summarization, or migration boundaries.

7. Frontend snapshot store carries process-level policy

Evidence:

- `CoreStateProvider` handles active-user identity flips, user-scoped storage, restart, socket disconnect, thread cache reset, team cache reset, onboarding status, memory token sync, analytics consent, and 2-second polling.
- `app/src/lib/coreState/store.ts` is a module-global snapshot cache used by API client token access.
- `coreRpcClient.ts` obtains RPC token via Tauri command and talks directly to the core.

Risk:

- Auth/session/process state changes are split between core config, Tauri active-user file access, Redux persistence, module-global snapshot, and socket lifecycle. The current comments are helpful, but the module is a high-leverage failure point and deserves targeted regression coverage around user flips and restart/no-restart cases.

8. Tauri shell contains native product surfaces that should be explicitly owned

Evidence:

- `app/src-tauri/src` has CDP modules and provider scanners for Discord, Google Messages, iMessage, Slack, Telegram, WhatsApp, webview accounts, webview APIs, notification settings, screen capture, mascot native window, and CEF profile handling.
- `docs/src-tauri/README.md` describes a thin desktop host, but the actual shell owns several native integration workers.

Risk:

- "Thin shell" is directionally right for business rules but incomplete for native-webview integrations. Without an explicit native integration ownership map, future refactors can accidentally move platform-only behavior into React/core or duplicate business decisions in Tauri.

## Next Safe Work

### Task 1: Align sidecar/in-process documentation

Files to touch:

- `docs/src-tauri/README.md`
- `docs/src-tauri/01-architecture.md`
- `docs/src-tauri/03-services.md`
- `docs/ARCHITECTURE.md`
- `AGENTS.md` or project-local contributor docs if policy allows
- Optional: `docs/TESTING-STRATEGY.md`, `docs/E2E-TESTING.md`, `docs/BUILDING.md`, `scripts/setup-dev-codesign.sh`, `scripts/worktree-bootstrap.sh`

Acceptance criteria:

- Docs say the Tauri app links `openhuman_core` in-process for the desktop app.
- Docs explain `openhuman-core` can still run as a standalone binary/harness.
- `core:stage` docs match the actual no-op script.
- No docs refer to `scripts/stage-core-sidecar.mjs` or `externalBin` as the current path unless explicitly describing history.

Validation candidates:

- `rg -n "sidecar|core:stage|stage-core|externalBin|linked in-process|embedded in-process" docs AGENTS.md CLAUDE.md app/package.json app/src-tauri`
- `pnpm format:check` expected pass after docs formatting if only Markdown/JSON comments changed.
- Required focused proof: `git diff -- docs/src-tauri docs/ARCHITECTURE.md AGENTS.md`

### Task 2: Write a native integration ownership map for Tauri shell

Files to touch:

- New or updated `docs/src-tauri/04-native-integrations.md`
- `docs/src-tauri/README.md`
- Optional links from `docs/ARCHITECTURE.md`

Acceptance criteria:

- The doc separates shell concerns into CEF/CDP webview accounts, provider scanners, native notifications, screen capture, app update/restart, core process lifecycle, and window/tray/mascot.
- Each Tauri module has an owner category and "does not own" notes.
- The doc names where business logic belongs when a native scanner extracts data.

Validation candidates:

- `rg -n "webview_accounts|telegram_scanner|slack_scanner|imessage_scanner|screen_capture|notification_settings|CoreProcessHandle" docs/src-tauri app/src-tauri/src`
- `pnpm format:check` expected pass if Markdown formatting remains conventional.

### Task 3: Clarify Telegram product surfaces and remove stale frontend docs

Files to touch:

- `docs/ARCHITECTURE.md`
- `docs/src/02-state-management.md`
- `docs/src/05-pages-routing.md`
- `docs/src/06-components.md`
- `docs/channels/telegram.md`
- Optional: `docs/src/README.md`

Acceptance criteria:

- Docs distinguish removed MTProto/frontend provider state from active Telegram Bot API channel, managed-DM linking, channel UI config, and Telegram Web scanner.
- Route docs match `app/src/AppRoutes.tsx` (`/chat`, `/channels`, no `/conversations` route).
- No docs tell agents to look for `store/telegram` thunks/selectors unless those files exist.

Validation candidates:

- `rg -n "TelegramProvider|mtprotoService|store/telegram|selectTelegram|initializeTelegram|/conversations|Telegram OAuth" docs app/src`
- `pnpm test:unit -- TelegramConfig` expected pass for the current channel UI if a code-adjacent doc task also adjusts tests or examples.

### Task 4: Close the last non-registry RPC island or document it as intentional

Files to touch:

- `src/rpc/dispatch.rs`
- `src/openhuman/security/mod.rs`
- New `src/openhuman/security/schemas.rs` if migrating
- `src/core/all.rs`
- `src/core/all_tests.rs` or `src/core/jsonrpc_tests.rs`

Acceptance criteria:

- `openhuman.security_policy_info` is either registered through the controller registry like other domain RPCs or clearly documented as the only allowed fallback.
- `src/rpc/dispatch.rs` no longer claims to route broad domain-specific handlers if it only preserves one legacy method.
- Registry tests cover the method if migrated.

Validation candidates:

- `cargo test --manifest-path Cargo.toml core::all_tests`
- `cargo test --manifest-path Cargo.toml core::dispatch::tests::dispatch_delegates_to_tier2_for_domain_method`
- `cargo test --manifest-path Cargo.toml core::jsonrpc_tests::invoke_method_unknown_method_returns_unknown_error`

### Task 5: Create a startup ownership diagram and regression checklist

Files to touch:

- New `docs/core-runtime-startup.md` or update `docs/ARCHITECTURE.md`
- Optional: `src/core/event_bus/README.md`

Acceptance criteria:

- Startup ordering is documented from Tauri `CoreProcessHandle::ensure_running` through `run_server_embedded`, router construction, auth token initialization, event bus setup, domain subscribers, socket manager, update scheduler, cron, services, and channel listeners.
- Every repeated subscriber/handler registration is labeled as Once-guarded, latest-wins, idempotent, or risky.
- The doc lists the smallest tests for duplicated subscriber/startup regressions.

Validation candidates:

- `rg -n "init_global|subscribe_global|register_.*subscriber|register_agent_handlers|start_periodic_sync|bootstrap_skill_runtime|start_channels" src/core src/openhuman`
- `cargo test --manifest-path Cargo.toml event_bus`
- `cargo test --manifest-path Cargo.toml core_process`

### Task 6: Restore or replace the missing memory-tree LLD reference

Files to touch:

- `src/openhuman/memory/tree/README.md`
- Either add `docs/MEMORY_ARCHITECTURE_LLD.md` or replace references with existing docs.

Acceptance criteria:

- Every in-tree reference to `docs/MEMORY_ARCHITECTURE_LLD.md` resolves.
- The doc states which parts of legacy memory are still authoritative and which parts `tree/` owns.
- The migration stop condition for legacy store/ingestion coexistence is named.

Validation candidates:

- `rg -n "MEMORY_ARCHITECTURE_LLD|legacy memory|bucket-seal|memory_tree" docs src/openhuman/memory`
- `cargo test --manifest-path Cargo.toml memory_tree`

## Validation Command Candidates

Required queue validation:

- `git status --short`
- Expected after this report: one untracked or added report file under `docs/overnight/` if not committed.

Cheap architecture proof commands:

- `rg -n "sidecar|core:stage|stage-core|externalBin|linked in-process|embedded in-process" docs AGENTS.md CLAUDE.md app/package.json app/src-tauri`
- Expected current status: fail as a consistency check because stale sidecar docs and in-process code both exist.

- `rg -n "MEMORY_ARCHITECTURE_LLD" docs src`
- Expected current status: references exist, target doc appears missing.

- `rg -n "TelegramProvider|mtprotoService|store/telegram|selectTelegram|initializeTelegram|/conversations" docs app/src`
- Expected current status: docs contain stale frontend Telegram references; code contains active Telegram channel/webview surfaces.

- `cargo test --manifest-path Cargo.toml core::all_tests`
- Expected likely pass; proves controller registry consistency. Not run in this read-only audit because the queue validation command is `git status --short`.

- `cargo test --manifest-path Cargo.toml core::jsonrpc_tests`
- Expected likely pass; proves JSON-RPC registry/validation behavior. Not run in this read-only audit.

- `cargo check --manifest-path app/src-tauri/Cargo.toml`
- Expected environment-sensitive because vendored CEF/Tauri dependencies may be required; use when touching Tauri shell code.

- `pnpm typecheck`
- Expected environment-sensitive but standard frontend proof if React/TypeScript changes happen.

## Non-Goals

- No product code edits.
- No dependency updates.
- No formatting churn outside this report.
- No attempt to run long Rust, frontend, or E2E suites.
- No external services, credentials, deploys, or tracker changes.
- No pull request creation.
- No merge or external tracker state changes.

## Unknowns

- Whether the sidecar wording in `AGENTS.md` and `CLAUDE.md` is intentionally preserved for non-Tauri harnesses or just stale after PR `#1061`.
- Whether `docs/MEMORY_ARCHITECTURE_LLD.md` exists in another branch, issue, private doc, or external planning system.
- Whether Telegram Web scanner is considered shipped product, experimental native integration, or internal capture harness.
- Whether `src/rpc/dispatch.rs` fallback for `openhuman.security_policy_info` is intentionally kept for backwards compatibility.
- Whether the root repo should be converted to a Cargo workspace that includes `app/src-tauri`, or whether the separate Cargo manifests are intentional for Tauri/CEF dependency isolation.
- Whether current docs should mention `tinyhumansai/openhuman-skills` as the sole canonical skill authoring repo or keep local project/user skill discovery equally prominent.

## Handoff Notes

The highest-leverage cleanup is documentation alignment around in-process core startup. It reduces future agent confusion before any code work starts. The next most valuable implementation-oriented task is closing or documenting the `src/rpc/dispatch.rs` fallback so the controller registry remains the single domain exposure path.

