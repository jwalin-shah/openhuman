# openhuman-sym206-recovery docs-claims audit

Queue item: `openhuman-sym206-recovery-docs-claims`  
Date: 2026-05-07  
Worker scope: read-only audit plus this report only.

## Repository State

- Purpose from local evidence: OpenHuman is a React + Tauri v2 desktop app with a repo-root Rust crate for core business logic/RPC, plus integrations, channels, memory, local AI, and desktop webview account scanners.
- Current branch: `codex/goal-openhuman-sym206-recovery-docs-claims`.
- Starting HEAD: `f11f217809841cf8e3a7f694d8e80967d8e188b8`.
- Initial dirty state: `git status --short` produced no output.
- Tracked file count: `git ls-files | wc -l` returned `2247`.
- Remotes observed: `origin` and `jwalin-ssh` point at `jwalin-shah/openhuman`; `upstream` points at `tinyhumansai/openhuman`.
- `llm-tldr tree .` eventually emitted a full JSON tree. It was very slow/noisy for this repo, so I used `rtk read`, `rg`, and line-numbered file slices for the audit evidence.

## Commands Run

- `llm-tldr tree .`
- `git status --short`
- `git branch --show-current`
- `git rev-parse HEAD`
- `git ls-files | wc -l`
- `git remote -v`
- `rg --files docs | sort`
- `rg --files ...` targeted over `README.md`, `docs/**`, `app/src/**`, `app/src-tauri/**`, `src/**`, `scripts/**`
- `rtk read README.md`, `docs/ARCHITECTURE.md`, `docs/src/README.md`, `docs/src-tauri/README.md`, `docs/SKILLS-HOW-THEY-WORK.md`, `docs/BUILDING.md`, `docs/install.md`, `docs/E2E-TESTING.md`, `package.json`, `app/package.json`, `Cargo.toml`, `app/src-tauri/Cargo.toml`
- Targeted `rg -n` checks for `core_rpc_relay`, `QuickJS`, `rquickjs`, `Telegram`, `app/src/lib/skills`, `OPENHUMAN_CORE_RUN_MODE`, `OPENHUMAN_CORE_BIN`, `SKILLS_REGISTRY_URL`

## Supported Claims

- Desktop-only product positioning is broadly supported by local docs and package shape. `docs/ARCHITECTURE.md:23-39` says shipped support is Windows/macOS/Linux desktop only, and `app/src-tauri/Cargo.toml:1-17` defines the desktop Tauri package/binary.
- The app is still a React/Vite frontend plus Rust/Tauri shell. `app/package.json:8-18` has Vite/TypeScript scripts, `app/src/App.tsx:50-67` shows the React provider shell, and `Cargo.toml:1-22` defines the repo-root Rust crate/library.
- The current core is embedded in-process inside the Tauri host, not launched as a normal sidecar. `app/src-tauri/src/core_process.rs:1-5` explicitly says the HTTP/JSON-RPC server runs as a tokio task inside the Tauri host, and `app/src-tauri/src/core_process.rs:131-155` spawns `run_server_embedded`.
- Memory docs are partially backed by source: `src/openhuman/memory/README.md:1-3` describes SQLite + FTS5 + vector embeddings + graph relations, and `src/openhuman/memory/README.md:27-30` identifies `UnifiedMemory` as production backend.
- Composio-backed integration claims are supported in current code. `app/src/components/composio/toolkitMeta.tsx:1-13` describes the managed-auth toolkit catalog; the list includes Gmail, Slack, and Notion in `app/src/components/composio/toolkitMeta.tsx:36-75`; Rust provider code in `src/openhuman/composio/providers/mod.rs:1-18` describes native Composio providers.
- Current Skills page source uses channels, Composio, and discovered `SKILL.md` skills through `app/src/services/api/skillsApi.ts`, not the old `app/src/lib/skills` path. `app/src/services/api/skillsApi.ts:165-176` calls `openhuman.skills_list`.
- Local state persistence is intentionally user-scoped through `localStorage`. `app/src/store/index.ts:24-32` wires persisted slices to `userScopedStorage`, and `app/src/store/userScopedStorage.ts:1-19` explains per-user localStorage namespacing.

## Unsupported Or Stale Claims

1. **Core lifecycle and RPC relay docs are stale.**  
   `docs/ARCHITECTURE.md:14-19`, `docs/src/README.md:47`, `docs/src/01-architecture.md:9`, and `docs/src-tauri/01-architecture.md:29-38` still describe a separate `openhuman`/sidecar process and `core_rpc_relay`. Current source contradicts that: `app/package.json:14` says `core:stage` is a no-op because the core is linked in-process, `app/src-tauri/src/core_process.rs:1-5` says there is no sidecar to leak, and `app/src-tauri/src/lib.rs:1741-1782` has no `core_rpc_relay` command in `generate_handler!`.

2. **Build docs name a non-existent core binary.**  
   `docs/BUILDING.md:26-31` tells contributors to run `cargo build --manifest-path Cargo.toml --bin openhuman` and then stage a sidecar. The root manifest defines `[[bin]] name = "openhuman-core"` at `Cargo.toml:8-10`, and `app/package.json:14` says staging is now a no-op.

3. **QuickJS skills docs are materially wrong for this branch.**  
   `docs/ARCHITECTURE.md:134-190`, `docs/SKILLS-HOW-THEY-WORK.md:13-22`, and `docs/SKILLS-HOW-THEY-WORK.md:49-70` describe an active QuickJS runtime and files such as `qjs_engine.rs` and `qjs_skill_instance/*`. Current source says the opposite in `src/openhuman/skills/mod.rs:1` and `src/openhuman/skills/types.rs:1`; `rg --files src/openhuman/skills` shows no `qjs_*` runtime files. Current registered skill controllers are only `skills_list`, `skills_read_resource`, `skills_create`, `skills_install_from_url`, and `skills_uninstall` in `src/openhuman/skills/schemas.rs:180-210`.

4. **Frontend provider/routing docs lag behind the real app shell.**  
   `docs/src/01-architecture.md:18-31` claims the provider chain is `UserProvider -> SocketProvider -> AIProvider -> SkillProvider -> HashRouter`. Current `app/src/App.tsx:50-67` is `Provider -> PersistGate -> CoreStateProvider -> SocketProvider -> ChatRuntimeProvider -> Router -> CommandProvider -> ServiceBlockingGate -> AppShell`. `docs/src/05-pages-routing.md:9-20` still lists `/mnemonic`, `/conversations`, and `/agents`; current `app/src/AppRoutes.tsx:86-104` routes unified chat to `/chat` and adds `/channels`, while `app/src/AppRoutes.tsx:115-140` adds `/notifications`, `/rewards`, and `/webhooks`.

5. **Several Telegram/auth UI claims are legacy or mixed with current channel/webview support.**  
   `docs/src/05-pages-routing.md:145-166` describes a `Login` page with `TelegramLoginButton`; `docs/src/06-components.md` describes `TelegramConnectionModal` and `GmailConnectionIndicator`. Current route source has no `/login` route in `app/src/AppRoutes.tsx:24-140`, while Telegram does still exist as channel/scanner code (`app/src-tauri/src/telegram_scanner/mod.rs`, `app/src/components/channels/TelegramConfig.tsx`). This is not simply "Telegram removed"; `docs/ARCHITECTURE.md:348` says Telegram is removed, but source still has Telegram channel/webview scanner surfaces.

6. **Privacy/local-encryption claims are over-broad.**  
   `README.md:55-76` says workflow data is kept on-device and encrypted locally. Some memory/encryption infrastructure exists (`Cargo.toml:46-47`, `src/openhuman/memory/README.md:27-30`), but current renderer persistence uses localStorage for user-scoped account/channel/notification/thread state (`app/src/store/index.ts:29-60`, `app/src/store/userScopedStorage.ts:150-166`) and Composio flows are backend-proxied (`app/src/lib/composio/hooks.ts:25-37`). The claim needs scoping by data class rather than a blanket product claim.

7. **Some docs reference paths that do not exist in this tree.**  
   `docs/src-tauri/01-architecture.md:17-21` documents `app/src-tauri/src/commands/*`; `rg --files app/src-tauri/src` shows no `commands/` directory. `docs/SKILLS-HOW-THEY-WORK.md:30-40` documents `app/src/lib/skills/*`; `rg --files app/src | rg 'skills|Skills'` shows the active app API is `app/src/services/api/skillsApi.ts` plus page/components, not `app/src/lib/skills`.

## Risks And Stale Assumptions

- **Contributor misbuild risk:** A new worker following `docs/BUILDING.md` will try `--bin openhuman` and sidecar staging, which does not match `Cargo.toml` or `app/package.json`. This wastes setup time and may hide real CEF/build issues behind doc drift.
- **Security review risk:** `core_rpc_relay` is repeatedly referenced as an IPC surface, but it is not registered in `app/src-tauri/src/lib.rs`. Reviewers could audit a non-existent relay while missing the actual direct HTTP bearer-token path in `app/src/services/coreRpcClient.ts:228-249`.
- **Feature ownership risk:** QuickJS runtime docs point future implementation toward removed files and old method families. A worker could add code to the legacy skills module instead of the current Composio/channel/discovered-SKILL.md surfaces.
- **Product-trust risk:** README privacy wording is stronger than the local evidence supports. On-device/encrypted claims should distinguish memory/KV/credential storage, localStorage UI persistence, backend-proxied Composio OAuth/toolkit calls, and any cloud model/API use.
- **Support/debug risk:** Route and provider docs still mention deleted or inactive frontend concepts. E2E or docs-only agents may chase `/conversations`, `/agents`, `UserProvider`, `AIProvider`, or `SkillProvider` even though the app shell now uses `/chat`, `CoreStateProvider`, and `ChatRuntimeProvider`.

## Next Safe Work

1. **Core lifecycle docs refresh**  
   Acceptance: update `docs/ARCHITECTURE.md`, `docs/src/README.md`, `docs/src/01-architecture.md`, `docs/src-tauri/README.md`, `docs/src-tauri/01-architecture.md`, `docs/src-tauri/02-commands.md`, and `docs/src-tauri/03-services.md` so they describe embedded in-process core startup, `core_rpc_url`/`core_rpc_token`, direct HTTP JSON-RPC, and the absence of `core_rpc_relay`.  
   Validation: `rg -n "core_rpc_relay|sidecar|separately built|src/bin/openhuman.rs|app/src-tauri/src/commands" docs README.md`; expected fail before the task, expected only historical/review references after.

2. **Skills docs rewrite for current SKILL.md/Composio surface**  
   Acceptance: replace active QuickJS runtime claims in `docs/SKILLS-HOW-THEY-WORK.md` and the skills sections of `docs/ARCHITECTURE.md` with current `SKILL.md` discovery/create/install/uninstall, Composio providers, and channel/webview scanner surfaces. Remove nonexistent `app/src/lib/skills/*` and `qjs_*` paths or mark them as historical.  
   Validation: `rg -n "QuickJS|rquickjs|qjs_|qjs_skill_instance|app/src/lib/skills|skills_registry_fetch|skills_call_tool|skills_rpc" docs/SKILLS-HOW-THEY-WORK.md docs/ARCHITECTURE.md`; expected fail before, expected only explicitly historical mentions after.

3. **Frontend docs route/provider/state refresh**  
   Acceptance: update `docs/src/01-architecture.md`, `docs/src/02-state-management.md`, `docs/src/05-pages-routing.md`, `docs/src/06-components.md`, and `docs/src/07-providers.md` to match `app/src/App.tsx`, `app/src/AppRoutes.tsx`, `app/src/store/index.ts`, and current components. Remove legacy `/login`, `/mnemonic`, `/conversations`, `/agents`, `authSlice`, `userSlice`, `telegramSlice`, `UserProvider`, `AIProvider`, and `SkillProvider` claims unless clearly marked historical.  
   Validation: `rg -n "UserProvider|AIProvider|SkillProvider|authSlice|telegramSlice|/conversations|/agents|/mnemonic|TelegramLoginButton|TelegramConnectionModal|GmailConnectionIndicator" docs/src`; expected fail before, expected only historical notes after.

4. **Privacy and data-location claim audit**  
   Acceptance: update `README.md`, `docs/ARCHITECTURE.md`, and security/privacy docs to classify data by where it lives and whether it is encrypted: memory store, credentials/profiles, renderer localStorage UI state, Composio/backend-proxied OAuth/tool calls, webview account cache, logs, and crash/analytics state.  
   Validation: `rg -n "encrypted locally|on device|on your machine|No localStorage|workflow data stays" README.md docs`; expected fail before, expected claims to be scoped and cross-linked after.

5. **Build/install docs correction**  
   Acceptance: update `docs/BUILDING.md`, `docs/install.md`, and root command snippets so the root core binary is `openhuman-core`, `core:stage` is documented as a compatibility no-op, and CEF/vendored Tauri CLI requirements remain clear.  
   Validation: `rg -n "--bin openhuman|core:stage|sidecar" docs/BUILDING.md docs/install.md README.md app/package.json Cargo.toml`; expected fail before, expected only current explanatory mentions after.

## Validation Command Candidates

- Required queue validation: `git status --short`  
  Expected after this docs-only report: one added report file under `docs/overnight/`.
- Docs drift guard: `rg -n "core_rpc_relay|QuickJS|rquickjs|app/src/lib/skills|src/bin/openhuman.rs|--bin openhuman" docs README.md`  
  Expected now: fail/find stale claims. Expected after docs remediation: no live-doc references except clearly historical review notes.
- Docs formatting sanity: `git diff --check`  
  Expected: pass for this report and future docs-only edits.
- App docs/source parity smoke: `pnpm --filter openhuman-app format:check`  
  Expected: should pass if docs are Prettier-compatible and Rust formatting is unchanged; not run for this audit because the queue validation command is `git status --short`.
- Type/build confidence for code-touching follow-up: `pnpm typecheck` and `cargo check --manifest-path Cargo.toml --bin openhuman-core`  
  Expected: source unchanged by this audit, but these are the relevant candidates if a follow-up touches source-adjacent docs examples or command wiring.
- Known stale command check: `cargo build --manifest-path Cargo.toml --bin openhuman`  
  Expected now: fail because the manifest defines `openhuman-core`, not `openhuman`.

## Explicit Non-Goals

- No product code changes.
- No generated data, caches, secrets, external services, deploys, pushes, or PR creation.
- No merge, no external tracker state changes, no Linear/GitHub updates.
- No attempt to prove external marketing claims against live websites or release feeds.
- No full build/test run beyond the requested validation command.

## Unknowns

- I did not verify external GitBook pages, install endpoints, release artifacts, package registries, or the latest public release because this queue item is local/read-only and network/external service writes are out of scope.
- I did not run the Tauri app, E2E suite, or core server. Runtime conclusions are source/doc based.
- Some old QuickJS wording in comments may intentionally refer to historical compatibility. A product owner should decide whether to delete it, mark it historical, or move it into migration notes.
- I did not inspect sibling repos from `repos.json`; this repo is large enough for a standalone docs-claims audit, and the queue item requires this single report.

