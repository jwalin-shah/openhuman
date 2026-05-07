# OpenHuman Architecture Map Audit

Queue item: `openhuman-architecture-map`
Branch: `codex/goal-openhuman-architecture-map`
HEAD at audit start: `f11f217809841cf8e3a7f694d8e80967d8e188b8`

## Scope And Dirty State

This was a read-only architecture audit except for this report file.

Initial dirty state:

```text
$ git status --short
<no output>
```

The final dirty state after writing the report is this new untracked report
directory:

```text
$ git status --short
?? docs/overnight/
```

No product code, generated data, secrets, external services, deploys, pushes,
PRs, or tracker updates were touched.

The queue issue file path from the Goal Pack,
`items/openhuman-architecture-map/ISSUE.md`, was not present in this worktree
when checked with `test -f items/openhuman-architecture-map/ISSUE.md`.

## Commands Run

Key local commands used for evidence:

```text
git status --short
git rev-parse HEAD
git branch --show-current
git remote -v
llm-tldr tree .
rg --files -g '!*target*' -g '!node_modules' -g '!dist' -g '!build' -g '!coverage'
rtk read docs/ARCHITECTURE.md
rtk read README.md
rtk read Cargo.toml
rtk read app/package.json
rtk read src/lib.rs
rtk read src/main.rs
rtk read src/openhuman/mod.rs
rtk read src/core/all.rs
rtk read src/core/jsonrpc.rs
rtk read src/core/dispatch.rs
rtk read src/rpc/dispatch.rs
rtk read app/src-tauri/Cargo.toml
rtk read app/src-tauri/src/main.rs
rtk read app/src-tauri/src/lib.rs
rtk read app/src-tauri/src/core_process.rs
rtk read app/src-tauri/src/core_rpc.rs
rtk read app/src/App.tsx
rtk read app/src/AppRoutes.tsx
rtk read app/src/services/coreRpcClient.ts
rtk read app/src/providers/SocketProvider.tsx
rtk read app/src/providers/CoreStateProvider.tsx
rtk read app/src/providers/ChatRuntimeProvider.tsx
rtk read docs/src/01-architecture.md
rtk read docs/src/03-services.md
rtk read docs/src/05-pages-routing.md
rtk read docs/src/07-providers.md
rtk read docs/src-tauri/01-architecture.md
rtk read docs/src-tauri/02-commands.md
rtk read docs/src-tauri/03-services.md
rtk read src/openhuman/skills/mod.rs
rtk read src/openhuman/skills/README.md
rg -n "sidecar|core_rpc_relay|QuickJS|rquickjs|UserProvider|AIProvider|SkillProvider|/conversations|/agents|/mnemonic" docs README.md AGENTS.md app/package.json app/src app/src-tauri/src src
rg --files | rg 'qjs|quickjs|rquickjs|runtime_engine|skill_registry|skill_instance'
wc -l app/src-tauri/src/lib.rs src/core/all.rs src/core/jsonrpc.rs src/openhuman/channels/runtime/dispatch.rs app/src/providers/CoreStateProvider.tsx app/src/services/coreRpcClient.ts
```

`llm-tldr tree .` completed, but produced a very large JSON tree. For the rest
of the audit, targeted `rg --files`, `rg -n`, and `rtk read` were more useful.

## Current Architecture Map

### Root Rust Core

The root crate is the core library and CLI:

- `Cargo.toml` declares library `openhuman_core`, binary `openhuman-core` at
  `src/main.rs`, and helper binaries `slack-backfill` and `gmail-backfill-3d`.
- `src/lib.rs` exports `api`, `core`, `openhuman`, and `rpc`, then delegates CLI
  execution through `run_core_from_args`.
- `src/main.rs` is a thin binary entrypoint around dotenv loading, Sentry setup,
  secret scrubbing, and `openhuman_core::run_core_from_args`.
- `src/openhuman/mod.rs` is the main domain index. It currently declares 52
  domain modules and only three root-level files were observed under
  `src/openhuman`: `mod.rs`, `dev_paths.rs`, and `util.rs`.
- Largest Rust domain surfaces by file count are `memory` (175 files), `agent`
  (138), `tokenjuice` (116), `tools` (98), `channels` (77), and `composio` (50).

The controller registry is the primary public adapter boundary:

- `src/core/all.rs` aggregates declared schemas and registered handlers from
  domains. It builds canonical RPC method names as
  `openhuman.<namespace>_<function>`.
- `src/core/jsonrpc.rs` first checks `src/core/all.rs` for schema-backed
  controllers, validates named params, then falls back to `src/core/dispatch.rs`.
- `src/core/dispatch.rs` handles only `core.ping` and `core.version` directly,
  then delegates to `src/rpc/dispatch.rs`.
- `src/rpc/dispatch.rs` has only one remaining legacy domain route:
  `openhuman.security_policy_info`.

The architecture direction is therefore schema-first controller exposure, with
`src/rpc/dispatch.rs` now acting as a small legacy escape hatch.

### Core HTTP Runtime

`src/core/jsonrpc.rs` owns more than JSON-RPC envelope handling:

- HTTP routes: `/`, `/health`, `/schema`, `/events`, `/events/webhooks`, `/rpc`,
  `/ws/dictation`, and `/auth/telegram`.
- Middleware: CORS, bearer auth via `src/core/auth.rs`, and request logging.
- Bootstrap: memory global init, controller schema dump, event bus init, domain
  subscriber registration, socket manager setup, session recovery, agent
  definition registry init, update scheduler, cron loop, and channel listener
  startup.

This is a real ownership hotspot. The file is 1133 lines and blends transport,
startup orchestration, and long-lived service wiring.

### Tauri Desktop Host

The desktop host is CEF-only and desktop-only:

- `app/src-tauri/src/lib.rs` has a compile-time desktop guard and aliases
  `AppRuntime = tauri::Cef`.
- `app/src-tauri/Cargo.toml` depends on `tauri-runtime-cef` and embeds the core
  crate with `openhuman_core = { path = "../..", package = "openhuman" }`.
- `app/src-tauri/src/main.rs` dispatches `OpenHuman core <args>` directly to
  `openhuman::run_core_from_args`, otherwise starts the GUI with
  `openhuman::run()`.
- `app/src-tauri/src/core_process.rs` is named for the old process boundary, but
  its module comment and implementation now state that the core HTTP server
  runs as an in-process Tokio task. `ensure_running()` sets
  `OPENHUMAN_CORE_TOKEN` and spawns
  `openhuman_core::core::jsonrpc::run_server_embedded(None, Some(port), true)`.
- `app/src-tauri/src/core_rpc.rs` centralizes the localhost RPC URL and applies
  the bearer token from `core_process::current_rpc_token()`.

`app/src-tauri/src/lib.rs` is 2100 lines and currently owns window/tray setup,
app update commands, core lifecycle commands, webview account commands,
notification commands, screen capture commands, dev auto-open helpers, teardown,
and tests. The module layout under `app/src-tauri/src/` has smaller scanner and
CDP modules, but `lib.rs` remains a major host-level coordination hotspot.

### Frontend Runtime

The actual React provider chain in `app/src/App.tsx` is:

```text
Sentry.ErrorBoundary
  Provider
    PersistGate
      CoreStateProvider
        SocketProvider
          ChatRuntimeProvider
            HashRouter
              CommandProvider
                ServiceBlockingGate
                  AppShell/AppRoutes
```

This differs from several docs that still describe `UserProvider`, `AIProvider`,
and `SkillProvider`.

The actual route table in `app/src/AppRoutes.tsx` is:

```text
/              Welcome
/onboarding/*  Onboarding
/home          Home
/human         HumanPage, pre-production only
/intelligence  Intelligence
/skills        Skills
/chat          Accounts, replacing old /conversations and /accounts
/channels      Channels
/invites       Invites
/notifications Notifications
/rewards       Rewards
/webhooks      Webhooks
/settings/*    Settings
*              DefaultRedirect
```

There is no current `/mnemonic`, `/conversations`, or `/agents` route in
`AppRoutes.tsx`.

`app/src/services/coreRpcClient.ts` is now an HTTP JSON-RPC client, not a Tauri
relay wrapper. In Tauri it resolves `core_rpc_url`, fetches `core_rpc_token`,
then posts directly to the local `/rpc` endpoint with `Authorization: Bearer`.
It still preserves a few legacy method aliases.

`SocketProvider` uses the TypeScript Socket.IO client as the single realtime path
and separately asks the core to connect its backend socket with
`openhuman.socket_connect_with_session`. `ChatRuntimeProvider` subscribes to
chat socket events and owns the Redux-side streaming assistant/tool timeline.

### Skills And Tools

The QuickJS runtime assumption is stale:

- `src/openhuman/skills/mod.rs` begins with: "Legacy skill metadata helpers
  retained after QuickJS runtime removal."
- `rg --files | rg 'qjs|quickjs|rquickjs|runtime_engine|skill_registry|skill_instance'`
  returned no files.
- `Cargo.toml` and `app/src-tauri/Cargo.toml` do not declare `rquickjs` or
  QuickJS-related dependencies.

The live skills surface appears to be SKILL.md discovery, parsing, install,
uninstall, resource reading, and per-turn prompt injection:

- `src/openhuman/skills/ops.rs`
- `src/openhuman/skills/ops_parse.rs`
- `src/openhuman/skills/ops_discover.rs`
- `src/openhuman/skills/ops_install.rs`
- `src/openhuman/skills/inject.rs`
- `app/src/services/api/skillsApi.ts`

Agent execution now lives around `src/openhuman/agent/` and `src/openhuman/tools/`.
The channel runtime builds an `AgentTurnRequest` and dispatches it through the
native event bus method `agent.run_turn`; the agent domain owns the handler in
`src/openhuman/agent/bus.rs`.

## Stale Assumptions Found

### Sidecar And Relay Language

Several docs still describe a staged sidecar and `core_rpc_relay` path:

- `docs/ARCHITECTURE.md` says heavy RPC and skills run in the `openhuman`
  process reachable through the Tauri host and `core_rpc_relay`.
- `docs/src/03-services.md` says `coreRpcClient.ts` calls
  `invoke('core_rpc_relay', ...)` and references `commands/core_relay.rs`.
- `docs/src-tauri/README.md` says `core:stage` builds and copies a sidecar into
  `app/src-tauri/binaries/`.
- `docs/src-tauri/01-architecture.md` lists `commands/core_relay.rs`,
  `commands/openhuman.rs`, and `utils/dev_paths.rs`, none of which match the
  current `app/src-tauri/src/` file list.
- `AGENTS.md` repeats sidecar and `core_rpc_relay` guidance.

Current evidence contradicting that:

- `app/package.json` has `core:stage` as a no-op: "core is linked in-process;
  sidecar removed (PR #1061)".
- `app/src-tauri/Cargo.toml` embeds `openhuman_core` as a path dependency.
- `app/src-tauri/src/core_process.rs` starts an embedded server task.
- `app/src/services/coreRpcClient.ts` posts over HTTP directly after resolving
  `core_rpc_url` and `core_rpc_token`.
- The actual `generate_handler!` list in `app/src-tauri/src/lib.rs` contains
  `core_rpc_url` and `core_rpc_token`, but not `core_rpc_relay`.

### QuickJS Runtime Language

The docs still say skills run in QuickJS:

- `docs/ARCHITECTURE.md` has a full "Skills Runtime Engine" section around
  QuickJS, `RuntimeEngine`, and per-skill `AsyncRuntime`.
- `docs/SKILLS-HOW-THEY-WORK.md` repeatedly calls QuickJS the active runtime.
- `docs/skills-runtime-isolation.md` documents QuickJS isolation.
- `docs/src/07-providers.md` says `SkillProvider` discovers skills from the
  QuickJS engine.
- `AGENTS.md` points to non-existent `qjs_skill_instance.rs` and
  `qjs_engine.rs`.

Current evidence contradicting that:

- `src/openhuman/skills/mod.rs` explicitly says QuickJS runtime was removed.
- No `qjs`, `quickjs`, `rquickjs`, `runtime_engine`, `skill_registry`, or
  `skill_instance` files were found by `rg --files`.
- Root `Cargo.toml` does not include `rquickjs`.

### Frontend Provider And Route Drift

Docs under `docs/src/` do not match `app/src`:

- `docs/src/01-architecture.md`, `docs/src/README.md`, and
  `docs/src/07-providers.md` still document `UserProvider`, `AIProvider`, and
  `SkillProvider`.
- `docs/src/05-pages-routing.md` still lists `/mnemonic`, `/conversations`, and
  `/agents`, and includes a sample `/login` route despite saying no top-level
  `/login` route exists.

Current evidence:

- `app/src/App.tsx` uses `CoreStateProvider`, `SocketProvider`, and
  `ChatRuntimeProvider`.
- `app/src/providers/` contains `CoreStateProvider.tsx`,
  `SocketProvider.tsx`, and `ChatRuntimeProvider.tsx`; no `UserProvider`,
  `AIProvider`, or `SkillProvider` files were found.
- `app/src/AppRoutes.tsx` uses `/chat`, `/channels`, `/notifications`,
  `/rewards`, and `/webhooks`; it does not define `/mnemonic`,
  `/conversations`, or `/agents`.

## Ownership And Boundary Risks

1. `src/core/jsonrpc.rs` is a transport file that also owns runtime bootstrap.
   That makes it easy for future transport changes to accidentally affect
   memory init, event bus subscribers, sockets, cron, updates, and channel
   listener startup.

2. `app/src-tauri/src/lib.rs` is doing too much for one host file. At 2100
   lines, it is the shell entrypoint, command registry, updater command module,
   webview lifecycle coordinator, teardown coordinator, tray/window code, dev
   helper launcher, and unit test home.

3. `core_process` naming is now historically loaded. The implementation is
   in-process, but names and comments still mix "process", "sidecar", "child",
   and "embedded server". That makes issue triage harder because current bugs
   can be misdiagnosed as orphan child-process problems.

4. `src/rpc/dispatch.rs` is almost gone but still part of the live fallback
   path. The lone `openhuman.security_policy_info` route is a useful marker for
   completing the controller migration and then removing one routing layer.

5. Docs are a real architecture risk, not just a documentation issue. The
   repository's agent instructions and docs actively steer workers toward
   non-existent files (`commands/core_relay.rs`, `qjs_engine.rs`,
   `UserProvider.tsx`) and stale validation steps (`core:stage` sidecar).

## Decisions During This Audit

- Treated this as a report-only task. No product code or existing docs were
  edited.
- Did not open a PR because the Goal Pack explicitly excludes PR creation.
- Did not run broad build/test commands because acceptance validation for this
  item is `git status --short`, and no behavior code was changed.
- Did not attempt to reconcile the stale architecture docs in-place because the
  queue item asks for exactly one report artifact.

## Validation

Required validation was run after writing this report:

```text
$ git status --short
?? docs/overnight/
```

Result: command exited 0. The output is expected because the only change is the
new queue report directory.

No compile, unit, lint, format, or E2E validation was run. This is intentional:
the only changed file is this Markdown audit report, and the queue validation is
`git status --short`.

## Next Safe Work

### 1. Align Architecture Docs With In-Process Core

Work type: docs-only.

Files likely touched:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/src/01-architecture.md`
- `docs/src/03-services.md`
- `docs/src-tauri/README.md`
- `docs/src-tauri/01-architecture.md`
- `docs/src-tauri/02-commands.md`
- `docs/src-tauri/03-services.md`
- `docs/BUILDING.md`
- `docs/TESTING-STRATEGY.md`

Acceptance criteria:

- Architecture docs describe the embedded in-process core task and tokened HTTP
  RPC path.
- `core_rpc_relay`, `commands/core_relay.rs`, and sidecar staging are either
  removed from current-path docs or explicitly marked historical.
- `app/package.json` `core:stage` no-op is reflected in build docs.
- Current Tauri IPC command list matches `app/src-tauri/src/lib.rs`
  `generate_handler!`.

Suggested validation:

```text
rg -n "core_rpc_relay|stage-core-sidecar|sidecar|commands/core_relay|src/bin/openhuman|openhuman binary" AGENTS.md docs app/src app/src-tauri/src
pnpm --filter openhuman-app format:check
```

### 2. Replace QuickJS Runtime Claims With SKILL.md Injection Model

Work type: docs-only, possibly with a small source comment cleanup if approved.

Files likely touched:

- `docs/ARCHITECTURE.md`
- `docs/SKILLS-HOW-THEY-WORK.md`
- `docs/skills-runtime-isolation.md`
- `docs/src/04-mcp-system.md`
- `docs/src/07-providers.md`
- `src/openhuman/skills/README.md`
- `AGENTS.md`

Acceptance criteria:

- Current architecture docs state that QuickJS runtime execution has been
  removed.
- Live skills ownership is documented as SKILL.md discovery, installation,
  resource reading, and prompt injection.
- Agent/tool execution ownership points to `src/openhuman/agent/` and
  `src/openhuman/tools/`.
- Any historical QuickJS docs are moved under a clearly historical/deprecated
  heading or deleted.

Suggested validation:

```text
rg -n "QuickJS|rquickjs|RuntimeEngine|SkillRegistry|qjs_skill_instance|qjs_engine" AGENTS.md docs src/openhuman/skills
rg --files | rg 'qjs|quickjs|rquickjs|runtime_engine|skill_registry|skill_instance'
```

### 3. Split Host And Core Startup Hotspots

Work type: implementation refactor, no behavior change.

Candidate slices:

- Move Tauri app update commands and update state out of
  `app/src-tauri/src/lib.rs` into a focused module.
- Move core HTTP startup orchestration from `src/core/jsonrpc.rs` into a
  runtime/bootstrap module, leaving `jsonrpc.rs` closer to router and JSON-RPC
  envelope ownership.
- Migrate `openhuman.security_policy_info` out of `src/rpc/dispatch.rs` into
  the schema-backed registry, then remove or shrink the legacy dispatcher.

Acceptance criteria:

- Public command names, RPC method names, route paths, and startup order are
  unchanged.
- Focused parity tests cover the moved public handlers and registry fallback.
- File-size hotspots are reduced without introducing new cross-domain imports.

Suggested validation:

```text
cargo fmt --manifest-path Cargo.toml --all --check
cargo fmt --manifest-path app/src-tauri/Cargo.toml --all --check
pnpm debug rust core
cargo check --manifest-path app/src-tauri/Cargo.toml
```

## Handoff Notes

Changed files expected from this queue item:

- `docs/overnight/openhuman-architecture-map.md`

Current blockers:

- None for the audit report.
- Product/docs reconciliation work should be split into follow-up tasks because
  this queue item is scoped to a single report artifact.
