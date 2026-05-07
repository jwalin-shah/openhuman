# Overnight Architecture Map Audit: openhuman-sym85

Queue item: `openhuman-sym85-architecture-map`

Repo path:
`/Users/jwalinshah/projects/agent-stack/.agent-stack-worktrees/2026-05-07-overnight-marathon/openhuman-sym85-architecture-map`

Audit date: 2026-05-07

## Handoff Summary

OpenHuman is a desktop-first React + Tauri + Rust app. The current codebase no
longer matches several major architecture claims in the docs: the Tauri app now
embeds the Rust core in-process, `core_rpc_relay` is documented but not
registered as a Tauri command, and local QuickJS skills appear to have been
removed while multiple docs and comments still describe them as the primary
skills runtime.

This report is read-only except for this file. Product code, generated data,
secrets, external services, deploys, pushes, PR creation, and tracker state
changes were out of scope.

## Repo State

- Branch at audit start: `codex/goal-openhuman-sym85-architecture-map`
- HEAD at audit start: `f11f217809841cf8e3a7f694d8e80967d8e188b8`
- Dirty state at audit start: `git status --short` returned no output.
- Required validation command: `git status --short`
- Final validation status: `git status --short` ran successfully and returned
  `?? docs/overnight/`. With `--untracked-files=all`, the only changed file is
  `docs/overnight/openhuman-sym85-architecture-map.md`.
- PR URL: not created. The goal pack explicitly scoped this worker to a local
  read-only audit report.
- Commit SHA for handoff: no commit created; current HEAD remains
  `f11f217809841cf8e3a7f694d8e80967d8e188b8` unless an orchestrator commits
  reports later.

## Commands Run

- `git status --short` -> no output at audit start.
- `git rev-parse --abbrev-ref HEAD` -> `codex/goal-openhuman-sym85-architecture-map`.
- `git rev-parse HEAD` -> `f11f217809841cf8e3a7f694d8e80967d8e188b8`.
- `llm-tldr tree .` -> completed, but produced a very large repository tree; useful observation is that this is a large monorepo with `app/`, repo-root `src/`, `docs/`, `scripts/`, and `tests/`.
- `rg --files src app/src app/src-tauri docs tests scripts` -> confirmed broad Rust, React, Tauri, docs, test, and script surfaces.
- `rg -n "core_rpc_relay" app/src app/src-tauri/src docs/src docs/src-tauri docs/ARCHITECTURE.md` -> found only documentation hits, no app/Tauri source registration.
- `rg -n "rquickjs|quickjs|qjs|deno_core|v8" Cargo.toml Cargo.lock src app/src-tauri/Cargo.toml` -> found no runtime dependency evidence for QuickJS/V8 in manifests; only stale comments/tests.
- `test -d skills` -> `skills directory missing`.
- `wc -l src/core/all.rs app/src-tauri/src/lib.rs app/src-tauri/src/core_process.rs app/src/services/coreRpcClient.ts app/src/App.tsx src/openhuman/mod.rs docs/ARCHITECTURE.md docs/src-tauri/README.md docs/src/README.md` -> `app/src-tauri/src/lib.rs` has 2100 lines, `src/core/all.rs` has 493 lines.
- `fd -HI -tf . src/openhuman | wc -l` -> `1081` files under `src/openhuman`.
- `rg -n "^pub mod " src/openhuman/mod.rs` -> 56 public domain modules exported from the root `openhuman` module.
- `rg -n "webview_apis|gmail_list_labels|gmail\\.list_labels|OPENHUMAN_WEBVIEW_APIS_PORT" tests src app/test app/src-tauri/src app/src` -> confirmed core-side Gmail webview controllers and a Tauri-side router that currently rejects all bridge methods.

## Repo Purpose

OpenHuman is a desktop application with three main execution surfaces:

1. React UI in `app/src/`.
2. Tauri desktop host in `app/src-tauri/`.
3. Rust core library and CLI in repo-root `src/`.

The deepest current implementation module is the Rust core. It owns domain
logic, persistence, JSON-RPC controllers, event-bus subscribers, agents,
channels, memory, tools, Composio/provider integrations, local AI, and updater
logic. The React UI is an HTTP JSON-RPC client plus route/state/UI shell. The
Tauri layer owns desktop-only concerns, CEF/webview hosting, native commands,
embedded-core lifecycle, and several provider scanner modules.

## Current Entrypoints and Module Map

### Rust core CLI and library

- `Cargo.toml` declares package `openhuman`, library `openhuman_core`, and the
  `openhuman-core` binary at `src/main.rs`.
- `src/main.rs` initializes Sentry, resolves release/environment metadata,
  scrubs secrets, then delegates to `openhuman_core::run_core_from_args`.
- `src/lib.rs` exposes `api`, `core`, `openhuman`, and `rpc`; its
  `run_core_from_args` calls `openhuman::service::apply_startup_restart_delay_from_env()`
  and `core::cli::run_from_cli_args`.
- `src/core/jsonrpc.rs` owns the Axum JSON-RPC server, `rpc_handler`,
  `invoke_method`, and startup/background task bootstrap.
- `src/core/all.rs` is the central controller registry. It aggregates declared
  schemas and registered handlers from domain modules and validates duplicate or
  missing handlers at runtime.
- `src/core/dispatch.rs` is the fallback dispatcher for `core.ping`,
  `core.version`, and legacy dynamic paths.
- `src/rpc/dispatch.rs` still handles `openhuman.security_policy_info` outside
  the registry. This is a small but real exception to the documented
  controller-only exposure rule.

### Domain modules

- `src/openhuman/mod.rs` exports 56 public modules and has
  `#![allow(dead_code)]`, which makes the public interface broad and permissive.
- `src/openhuman/memory/mod.rs`, `src/openhuman/channels/mod.rs`,
  `src/openhuman/agent/mod.rs`, `src/openhuman/tools/mod.rs`, and
  `src/openhuman/skills/mod.rs` re-export large domain surfaces.
- `src/core/event_bus/` is a real seam for decoupled event publication plus
  typed in-process native request/response. `src/core/jsonrpc.rs` registers
  long-lived subscribers at startup.
- `src/openhuman/webview_apis/` is a core-side WebSocket client and JSON-RPC
  proxy layer intended to reach live webview actions in the Tauri host.
- `src/openhuman/skills/` currently describes "Legacy skill metadata helpers
  retained after QuickJS runtime removal" in `mod.rs`, while exposing SKILL.md
  discovery, install, uninstall, resource reading, and per-turn injection.

### Tauri host

- `app/src-tauri/src/lib.rs` is the desktop host entrypoint and command
  registrar. It has desktop-only compilation guardrails and aliases the runtime
  to CEF.
- `app/src-tauri/src/core_process.rs` runs the core HTTP/JSON-RPC server as an
  embedded Tokio task inside the Tauri process. It generates an RPC bearer
  token, sets `OPENHUMAN_CORE_TOKEN`, starts
  `openhuman_core::core::jsonrpc::run_server_embedded`, and refuses to attach
  to unknown stale listeners.
- `app/src-tauri/Cargo.toml` depends on repo-root `openhuman_core` by path and
  explicitly says the core is embedded in-process to avoid orphan sidecars.
- `app/src-tauri/src/core_rpc.rs` only resolves the core RPC URL and applies
  auth. It is not a full relay command surface.
- `app/src-tauri/src/webview_accounts/mod.rs` owns embedded provider webviews,
  allowed hosts, provider URLs, recipe injection, and native CDP scanner
  routing for providers such as WhatsApp, Telegram, Slack, Discord, Google
  Meet, Zoom, and LinkedIn.
- `app/src-tauri/src/webview_apis/router.rs` currently returns
  `unknown webview_apis method` for every method.

### React app

- `app/src/App.tsx` is the provider shell: Redux `Provider`, `PersistGate`,
  `CoreStateProvider`, `SocketProvider`, `ChatRuntimeProvider`, `HashRouter`,
  `CommandProvider`, `ServiceBlockingGate`, and `AppShell`.
- `app/src/AppRoutes.tsx` defines the active route table. Current active routes
  include `/`, `/onboarding/*`, `/home`, `/human` pre-prod, `/intelligence`,
  `/skills`, `/chat`, `/channels`, `/invites`, `/notifications`, `/rewards`,
  `/webhooks`, and `/settings/*`.
- `app/src/services/coreRpcClient.ts` calls the local core directly over HTTP.
  It resolves `core_rpc_url` and `core_rpc_token` through Tauri commands, adds
  `Authorization: Bearer`, normalizes several legacy method aliases, and uses a
  bounded fetch timeout.
- `app/src/services/api/skillsApi.ts` calls
  `openhuman.skills_list`, `openhuman.skills_read_resource`,
  `openhuman.skills_create`, `openhuman.skills_install_from_url`, and
  `openhuman.skills_uninstall`.
- `app/src/pages/Skills.tsx` is a large UI composition that mixes built-in
  skill tiles, channel setup, Composio connectors, discovered SKILL.md skills,
  modals, category filters, and status hooks.

## Evidence Highlights

1. `docs/ARCHITECTURE.md` still says the WebView reaches the Rust process via
   `core_rpc_relay` and describes the core as an `openhuman` process.
2. `docs/src-tauri/README.md` says the shell bridges to an `openhuman` Rust
   sidecar and that `core:stage` builds/copies a sidecar.
3. `app/package.json` says `core:stage` is a no-op because the core is linked
   in-process and the sidecar was removed in PR #1061.
4. `app/src-tauri/Cargo.toml` says the core domain logic is embedded
   in-process via the `openhuman_core` path dependency.
5. `app/src-tauri/src/core_process.rs` says there is no sidecar to leak on
   Cmd+Q and starts an embedded core server task.
6. `app/src-tauri/src/lib.rs` registers `core_rpc_url` and `core_rpc_token`,
   but no `core_rpc_relay` command.
7. `app/src/services/coreRpcClient.ts` sends JSON-RPC directly with `fetch()`
   to the resolved core URL, not via a Tauri relay.
8. `src/openhuman/skills/mod.rs` says QuickJS runtime was removed.
9. `Cargo.toml` and `Cargo.lock` have no `rquickjs`, `quickjs`, `deno_core`, or
   `v8` dependency evidence.
10. `docs/ARCHITECTURE.md`, `docs/skills-runtime-isolation.md`, and
    `docs/SKILLS-HOW-THEY-WORK.md` still describe a QuickJS `RuntimeEngine`,
    `QjsSkillInstance`, or runtime paths that do not exist locally.
11. `src/openhuman/webview_apis/schemas.rs` registers seven Gmail webview API
    controllers.
12. `app/src-tauri/src/webview_apis/router.rs` rejects every bridge method as
    unknown.
13. `tests/webview_apis_bridge.rs` proves the core-side client against a mock
    WebSocket server, but not the actual Tauri router that currently rejects
    methods.
14. `src/core/all.rs` manually extends both registered controllers and declared
    schemas for every domain, making this registry a high-conflict module.
15. `src/openhuman/mod.rs` exports 56 modules from one root module and allows
    dead code globally.

## Architecture Risks and Stale Assumptions

### 1. Sidecar and relay documentation no longer matches runtime

The current implementation is in-process core plus direct HTTP JSON-RPC, while
the docs repeatedly describe an `openhuman` sidecar and `core_rpc_relay`.
This is not cosmetic: future agents following `docs/src-tauri/README.md`,
`docs/src/README.md`, or `docs/ARCHITECTURE.md` will look for
`app/src-tauri/src/commands/core_relay.rs`, sidecar staging, and relay commands
that are absent.

Risk: implementation work can land against the wrong seam, especially around
auth, startup, updater, E2E, and app shutdown.

### 2. QuickJS skill-runtime claims conflict with local code

The local code says QuickJS runtime was removed, but top-level architecture
docs still present QuickJS as the defining runtime. `docs/SKILLS-HOW-THEY-WORK.md`
references many missing files such as `src/openhuman/skills/qjs_engine.rs`,
`src/openhuman/skills/skill_registry.rs`, and `app/src/lib/skills/runtime.ts`.
The current skills module is a SKILL.md metadata/injection/install surface.

Risk: morning implementation agents may spend time rebuilding or patching a
nonexistent runtime instead of working on current Composio, channel, tools, or
SKILL.md injection modules.

### 3. webview_apis has a registered core interface but no live Tauri adapter

The core registers Gmail controllers in `src/openhuman/webview_apis/schemas.rs`
and handlers proxy to bridge methods such as `gmail.list_labels`. The Tauri
side starts a loopback WebSocket bridge, but `app/src-tauri/src/webview_apis/router.rs`
returns `unknown webview_apis method` for every method. The existing
`tests/webview_apis_bridge.rs` uses a mock bridge, so it does not catch this
adapter mismatch.

Risk: `openhuman.webview_apis_gmail_*` methods are discoverable but likely
fail in the actual desktop runtime. This is a shallow seam: the core interface
promises Gmail behavior, but the only real Tauri adapter is empty.

### 4. Tauri shell is more than a thin host

Project docs say Tauri should remain a delivery vehicle and avoid duplicating
product logic. In practice, `app/src-tauri/src/webview_accounts/mod.rs` owns
provider support lists, navigation policy, native deep-link rewriting,
recipe selection, and CDP scanner routing. Dedicated Tauri modules exist for
WhatsApp, Telegram, Slack, Discord, Google Messages, iMessage, screen capture,
notifications, CEF profile management, and webview APIs.

Risk: provider behavior is split across React UI, Tauri shell, and Rust core.
Without an explicit ownership map, agents can fix the same provider bug in the
wrong module or add new provider state in multiple places.

### 5. Controller registration is centralized and manual

`src/core/all.rs` is a real interface seam for JSON-RPC and CLI exposure, and
its validation is useful. But every new domain must update two central lists:
registered controllers and declared schemas. This file already aggregates many
domains and is likely to be a hot file for parallel workers.

Risk: small domain additions create conflicts and omissions. The registry is
deep for callers, but shallow for maintainers adding domains because they must
remember global wiring details.

### 6. Legacy dynamic dispatch remains

`src/core/jsonrpc.rs` checks the static registry first, then falls back to
`src/core/dispatch.rs`, which calls `src/rpc/dispatch.rs`. That legacy path
still exposes `openhuman.security_policy_info`. This contradicts the stated
controller-only exposure rule in the project instructions.

Risk: schema discovery and controller validation can miss behavior that still
ships over RPC.

### 7. Root domain interface is very broad

`src/openhuman/mod.rs` exports 56 modules and globally allows dead code. This
helps large migration work proceed, but it weakens locality: callers can reach
many internals through one root module, and unused public surface can persist
without pressure.

Risk: module depth is hard to judge because the public interface is much wider
than the actual product surface.

### 8. Validation confidence varies by seam

There are good focused tests for core registry behavior, skills API wrappers,
and the webview bridge client. But the webview bridge test does not cover the
actual Tauri router, and many docs claim end-to-end behaviors that were not
validated in this audit.

Risk: passing available unit tests may not prove architecture claims that cross
React, Tauri, embedded core, and provider webviews.

## Deepening Opportunities

1. Documentation truth module for runtime shape
   - Files: `docs/ARCHITECTURE.md`, `docs/src/README.md`,
     `docs/src-tauri/README.md`, `docs/src-tauri/01-architecture.md`,
     `docs/src-tauri/02-commands.md`, `docs/src-tauri/03-services.md`.
   - Problem: callers must know whether the core is a sidecar, an embedded
     task, or a service-managed process.
   - Solution: make one current runtime-shape doc the source of truth and
     reduce secondary docs to links plus small local notes.
   - Benefit: better leverage for future startup, auth, updater, and E2E work;
     better locality for architecture claims.

2. Skills surface split: SKILL.md catalog vs removed QuickJS runtime
   - Files: `src/openhuman/skills/mod.rs`, `src/openhuman/skills/README.md`,
     `docs/SKILLS-HOW-THEY-WORK.md`, `docs/skills-runtime-isolation.md`,
     `docs/ARCHITECTURE.md`, `app/src/services/api/skillsApi.ts`.
   - Problem: one name, "skills", carries stale QuickJS runtime assumptions
     and current SKILL.md metadata behavior.
   - Solution: explicitly document current skills as SKILL.md discovery,
     injection, create/install/uninstall, and resource reading. Archive or
     delete runtime docs unless the runtime is being restored.
   - Benefit: callers get a smaller interface; tests can target the current
     behavior rather than a removed adapter.

3. webview_apis bridge contract
   - Files: `src/openhuman/webview_apis/schemas.rs`,
     `src/openhuman/webview_apis/rpc.rs`,
     `app/src-tauri/src/webview_apis/router.rs`,
     `tests/webview_apis_bridge.rs`.
   - Problem: core exposes Gmail webview API methods while the real Tauri
     adapter rejects them.
   - Solution: either remove the Gmail controllers from the registry or add
     real Tauri router handlers and a test that exercises the actual router.
   - Benefit: the interface becomes honest. Consumers either lose dead methods
     or gain a tested adapter.

4. Provider ownership map
   - Files: `app/src-tauri/src/webview_accounts/mod.rs`,
     `app/src/pages/Skills.tsx`, `app/src/components/accounts/WebviewHost.tsx`,
     `src/openhuman/provider_surfaces/`, `src/openhuman/channels/`,
     `src/openhuman/composio/`.
   - Problem: provider behavior spans UI, shell, core channels, provider
     surfaces, and Composio.
   - Solution: publish a provider matrix with owner module, event path, storage
     owner, validation command, and which providers use recipes vs native CDP.
   - Benefit: better locality for provider bugs and clearer handoff for adding
     new providers.

5. Controller registry add-domain guide or generator
   - Files: `src/core/all.rs`, `src/core/all_tests.rs`,
     `src/openhuman/*/schemas.rs`.
   - Problem: `src/core/all.rs` is a manual hot file.
   - Solution: document the exact add-domain checklist in a local guide or
     generate registry lists from domain exports in a controlled way.
   - Benefit: lower merge risk and fewer missing schema/handler pairs.

## Next Safe Work

### Task 1: Correct the core runtime architecture docs

Acceptance criteria:

- `docs/ARCHITECTURE.md`, `docs/src/README.md`, and `docs/src-tauri/*` describe
  embedded in-process core startup and direct authenticated HTTP JSON-RPC.
- `core_rpc_relay` is removed from docs unless a real command is reintroduced.
- Sidecar terminology is retained only for historical notes, CLI packaging, or
  external/manual `openhuman-core run` harnesses, with explicit dates/context.

Validation commands:

- `rg -n "core_rpc_relay|commands/core_relay|core:stage|sidecar" docs app/src app/src-tauri`
  - Expected now: fail as an absence check because stale claims are present.
  - Expected after task: only intentional historical/harness references remain.
- `pnpm --dir app format:check`
  - Expected: pass if docs formatting stays standard.

### Task 2: Reconcile or archive QuickJS skills runtime docs

Acceptance criteria:

- `docs/ARCHITECTURE.md`, `docs/SKILLS-HOW-THEY-WORK.md`, and
  `docs/skills-runtime-isolation.md` no longer claim a current QuickJS
  `RuntimeEngine` unless product decides to restore it.
- Current `src/openhuman/skills/` behavior is documented as SKILL.md metadata,
  prompt injection, resource reading, install, uninstall, and create flows.
- Missing file references such as `qjs_engine.rs`, `skill_registry.rs`, and
  `app/src/lib/skills/runtime.ts` are deleted or moved to an archived history
  section.

Validation commands:

- `rg -n "rquickjs|QuickJS|QjsSkillInstance|RuntimeEngine|qjs_engine|skill_registry" docs src/openhuman/skills app/src`
  - Expected now: fail as an absence check because stale claims are present.
  - Expected after task: only historical archived references or tests remain.
- `cargo test --manifest-path Cargo.toml skills`
  - Expected: pass after docs-only work if no Rust changed; run if code comments
    or rustdoc are updated.

### Task 3: Make webview_apis honest

Acceptance criteria:

- Either remove the Gmail `openhuman.webview_apis_*` schemas and handlers, or
  implement matching Tauri router methods for `gmail.list_labels`,
  `gmail.list_messages`, `gmail.search`, `gmail.get_message`, `gmail.send`,
  `gmail.trash`, and `gmail.add_label`.
- Add a validation path that uses the real Tauri router or a router-level
  adapter test, not only a mock WebSocket server.
- Document whether Gmail embedded-webview actions are retired, replaced by
  Composio, or still product-supported.

Validation commands:

- `cargo test --manifest-path Cargo.toml --test webview_apis_bridge`
  - Expected now: pass for the mock bridge, but insufficient for actual Tauri
    adapter correctness.
- `cargo test --manifest-path app/src-tauri/Cargo.toml webview_apis`
  - Expected now: likely pass only the unknown-method router test; add a
    router test that fails before implementation/removal and passes after.
- `rg -n "unknown webview_apis method|gmail.list_labels|webview_apis_gmail" app/src-tauri/src src/openhuman tests`
  - Expected now: shows adapter mismatch evidence.

### Task 4: Publish provider ownership matrix

Acceptance criteria:

- A doc maps each provider (`whatsapp`, `telegram`, `linkedin`, `slack`,
  `discord`, `google-meet`, `zoom`, `browserscan`, Composio-backed providers,
  and channel providers) to its owner module, data path, event path, and
  validation command.
- The doc explicitly states which providers are native CDP scanner based,
  recipe based, Composio based, channel based, or backend/API based.
- The `Skills` page's mixed catalog role is documented so agents do not treat
  all tiles as SKILL.md skills.

Validation commands:

- `rg -n "provider_url|provider_recipe_js|KNOWN_COMPOSIO_TOOLKITS|ChannelDefinition|SkillSummary" app/src app/src-tauri/src src/openhuman`
  - Expected now: pass as discovery evidence.
- `pnpm --dir app test -- src/pages/__tests__/Skills.discovered-skills.test.tsx`
  - Expected: pass if no UI behavior changes.

### Task 5: Close the legacy RPC dispatch exception

Acceptance criteria:

- `openhuman.security_policy_info` is registered through a normal domain
  `schemas.rs` controller or explicitly documented as the sole legacy fallback
  method with a deprecation path.
- `src/rpc/dispatch.rs` becomes empty/deleted or has a narrow, tested purpose.
- Schema discovery lists every shipped `openhuman.*` RPC method.

Validation commands:

- `cargo test --manifest-path Cargo.toml core::all_tests`
  - Expected: pass after registry wiring.
- `cargo test --manifest-path Cargo.toml rpc::dispatch`
  - Expected now: pass legacy tests; after task, tests should move or assert
    no legacy openhuman methods.

## Validation Candidates and Expected Status

- `git status --short`
  - Required by queue item.
  - Observed final status: pass command execution; output was
    `?? docs/overnight/`.
- `git status --short --untracked-files=all`
  - Observed final status: pass command execution; output was
    `?? docs/overnight/openhuman-sym85-architecture-map.md`.
- `cargo check --manifest-path Cargo.toml`
  - Expected: likely pass, but not run in this read-only audit because the
    requested validation command is `git status --short`.
- `cargo check --manifest-path app/src-tauri/Cargo.toml`
  - Expected: may be environment-sensitive because CEF and vendored Tauri
    dependencies are required. Not run.
- `pnpm --dir app typecheck`
  - Expected: likely pass if dependencies are installed and Node >= 24 is
    available. Not run.
- `pnpm --dir app test -- src/services/api/__tests__/skillsApi.test.ts`
  - Expected: likely pass for the current SKILL.md API wrapper. Not run.
- `cargo test --manifest-path Cargo.toml --test webview_apis_bridge`
  - Expected: likely pass for the mock bridge but does not prove the Tauri
    adapter. Not run.
- `rg -n "core_rpc_relay" app/src app/src-tauri/src`
  - Expected now: pass as absence check, no source hits.
- `rg -n "core_rpc_relay" docs`
  - Expected now: fail as absence check, stale docs remain.

## Explicit Non-Goals

- No product code edits.
- No generated data edits.
- No secrets inspection.
- No external services, deploys, pushes, or PR creation.
- No Linear/GitHub tracker state changes.
- No attempt to decide whether QuickJS should return; this audit only maps the
  mismatch between current code and current docs.
- No attempt to run heavy validation beyond the queue validation command.

## Unknowns

- Whether PR #1061 intentionally removed all sidecar architecture or only
  changed default desktop runtime while preserving external sidecar packaging.
- Whether QuickJS skills are permanently removed, temporarily removed, or being
  replaced by SKILL.md injection plus Composio/native tools.
- Whether Gmail webview APIs are intended to be restored, removed, or replaced
  by Composio Gmail.
- Whether old routes and pages such as `app/src/pages/Conversations.tsx` and
  `app/src/pages/Mnemonic.tsx` are intentionally retained for future use or are
  dead UI inventory.
- Whether the current CI baseline is green. This audit did not run full cargo,
  Vitest, E2E, or formatting gates.

## Morning Review Notes

The safest first action is a docs-only correction for runtime shape. It reduces
future wrong-path implementation without touching product behavior. The next
highest-leverage implementation audit is `webview_apis`: it has an exposed core
interface, an empty real adapter, and a mock-only test that can hide the gap.
