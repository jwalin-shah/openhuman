# Overnight Docs Claims Audit: openhuman-sym208-recovery

Queue item: `openhuman-sym208-recovery-docs-claims`
Focus area: `docs-claims`
Repo/worktree: `openhuman-sym208-recovery`
Branch observed: `codex/goal-openhuman-sym208-recovery-docs-claims`
Starting HEAD observed: `f11f217809841cf8e3a7f694d8e80967d8e188b8`

## Scope

This was a read-only product/code audit with one docs artifact as the only intended change:
`docs/overnight/openhuman-sym208-recovery-docs-claims.md`.

Non-goals:

- No product code edits.
- No generated data changes.
- No secret, credential, external-service, release, deploy, push, or PR work.
- No tracker state changes.
- No attempt to verify remote marketing pages, GitBook pages, npm/Homebrew/apt publication state, or GitHub release availability over the network.

## Repo Purpose And Current State

OpenHuman is a desktop-first React + Tauri v2 app with a Rust core crate. The user-facing product surface is a desktop assistant for chat, skills/integrations, channels, memory/intelligence, local AI, screen intelligence, autocomplete, voice, teams, notifications, webhooks, and rewards. Local evidence for that purpose is spread across `README.md`, `docs/ARCHITECTURE.md`, `app/src/AppRoutes.tsx`, `app/src/pages/Skills.tsx`, `src/openhuman/about_app/catalog.rs`, and the Rust domains under `src/openhuman/`.

Initial dirty state:

- `git status --short --branch` returned only `## codex/goal-openhuman-sym208-recovery-docs-claims`.
- `git rev-parse --abbrev-ref HEAD` returned `codex/goal-openhuman-sym208-recovery-docs-claims`.
- `git rev-parse HEAD` returned `f11f217809841cf8e3a7f694d8e80967d8e188b8`.

Notable repo shape:

- `llm-tldr tree .` showed the monorepo split across `app/`, root `src/`, `docs/`, `tests/`, `.github/`, and scripts.
- `rg --files docs .github` showed a large local docs set including `docs/ARCHITECTURE.md`, `docs/BUILDING.md`, `docs/E2E-TESTING.md`, `docs/SKILLS-HOW-THEY-WORK.md`, `docs/TEST-COVERAGE-MATRIX.md`, `docs/src/*`, `docs/src-tauri/*`, and CI workflows.
- `ls -d skills app/src-tauri/binaries app/src-tauri/vendor/tauri-cef` returned missing `skills` and missing `app/src-tauri/binaries`, but present `app/src-tauri/vendor/tauri-cef`.
- `rg --files src/openhuman/skills` returned SKILL.md-oriented files such as `ops.rs`, `ops_discover.rs`, `ops_install.rs`, `schemas.rs`, `inject.rs`, and `mod.rs`; it did not return `qjs_engine.rs`, `registry_ops.rs`, `manifest.rs`, or `qjs_skill_instance/*`.

## Commands Run

Key commands used for evidence:

- `llm-tldr tree .`
- `git status --short --branch`
- `git rev-parse --abbrev-ref HEAD`
- `git rev-parse HEAD`
- `rg --files docs .github`
- `rtk read README.md`
- `rtk read package.json`
- `rtk read app/package.json`
- `rtk read Cargo.toml`
- `rtk read app/src-tauri/Cargo.toml`
- `rtk read docs/ARCHITECTURE.md`
- `rtk read docs/BUILDING.md`
- `rtk read docs/install.md`
- `rtk read docs/E2E-TESTING.md`
- `rtk read docs/src/README.md`
- `rtk read docs/src/05-pages-routing.md`
- `rtk read docs/src-tauri/README.md`
- `rtk read docs/src-tauri/01-architecture.md`
- `rtk read docs/src-tauri/03-services.md`
- `rtk read docs/SKILLS-HOW-THEY-WORK.md`
- `rtk read src/openhuman/skills/mod.rs`
- `rtk read src/openhuman/skills/README.md`
- `rtk read src/openhuman/skills/schemas.rs`
- `rtk read app/src/services/api/skillsApi.ts`
- `rtk read app/src/App.tsx`
- `rtk read app/src/AppRoutes.tsx`
- `rtk read src/openhuman/about_app/catalog.rs`
- `rtk read src/openhuman/channels/providers/mod.rs`
- `rtk read app/src/types/accounts.ts`
- `rtk read app/src/components/composio/toolkitMeta.tsx`
- `rtk read app/src/lib/composio/hooks.ts`
- `rtk read .github/workflows/coverage.yml`
- `rtk read docs/TEST-COVERAGE-MATRIX.md`
- `rtk read docs/agent-workflows/codex-pr-checklist.md`
- `rg -n "sidecar|core:stage|openhuman-core|--bin openhuman|Telegram|MTProto|Neo4j|encrypted|encryption|one click|one-click|Teams|Rewards|notifications\\.spec|skills/|skill packages|CEF|coverage|diff-cover|Subconscious|Screen Intelligence|Autocomplete|Voice" README.md docs AGENTS.md app/package.json Cargo.toml app/src-tauri/Cargo.toml`
- `rg -n "registry_ops|qjs_engine|RuntimeEngine|qjs_skill_instance|manifest.json|SKILLS_LOCAL_DIR|SKILLS_REGISTRY_URL|skills_registry_fetch|skills_list_available|skills_start|skills_call_tool|openhuman.skills_list_available|openhuman.skills_start|workspace/skills" src/openhuman/skills src/core src/openhuman app/src docs/SKILLS-HOW-THEY-WORK.md .env.example`

## Claim Audit Summary

### 1. README Product Claims Are Broad But Mostly Backed By Local Surfaces

The README positions OpenHuman as a private, UI-first desktop assistant with skills, local knowledge, local AI, screen intelligence, autocomplete, voice, channels, teams, and rewards.

Supported by local evidence:

- `app/src/AppRoutes.tsx` mounts `/home`, `/intelligence`, `/skills`, `/chat`, `/channels`, `/invites`, `/notifications`, `/rewards`, `/webhooks`, and `/settings/*`.
- `app/src/types/accounts.ts` defines embedded account providers for WhatsApp Web, Telegram Web, LinkedIn, Slack, Discord, Google Meet, Zoom, and a dev BrowserScan provider.
- `app/src/components/composio/toolkitMeta.tsx` contains a local managed-auth integration catalog with 118 Composio toolkit entries according to its comment, including Gmail, Slack, Notion, GitHub, Google services, Microsoft Teams, WhatsApp Business, Zoom, and many more.
- `app/src/lib/composio/hooks.ts` polls toolkit and connection state via `listToolkits()` and `listConnections()`, so the broad integration grid is not just static UI copy.
- `src/openhuman/channels/providers/mod.rs` registers many channel backends including Telegram, Discord, Slack, WhatsApp, Signal, Mattermost, Matrix behind a feature, email, iMessage, web, and others.
- `src/openhuman/local_ai/`, `src/openhuman/voice/`, `src/openhuman/screen_intelligence/`, and `src/openhuman/autocomplete/` exist with schemas/tests or engine files that support the README's local AI, voice, screen, and autocomplete claims.
- `src/openhuman/about_app/catalog.rs` is a runtime capability catalog covering conversations, prompt injection guard, skills, local AI, teams, auth, screen intelligence, channels, billing, webhooks, cron automation, and updates.
- `app/test/e2e/specs/` contains local E2E specs for screen intelligence, autocomplete, voice mode, local model runtime, Telegram, Slack, WhatsApp, Gmail, Notion, rewards, notifications, webhooks, skill execution, and more.

But the README's privacy language is too compressed. `README.md` says workflow data is kept on device, encrypted locally, and treated as yours. That is directionally consistent with `src/openhuman/encryption/`, `src/openhuman/credentials/`, and `src/openhuman/about_app/catalog.rs`, but not universally true without qualifiers:

- `src/openhuman/about_app/catalog.rs` explicitly distinguishes `LOCAL_RAW`, `LOCAL_CREDENTIALS`, `DERIVED_TO_BACKEND`, `DIAGNOSTICS_TO_BACKEND`, and `MODEL_DOWNLOAD`.
- `app/src/utils/config.ts` defaults production/staging backend URLs to `https://api.tinyhumans.ai` or `https://staging-api.tinyhumans.ai`.
- `app/src/services/api/rewardsApi.ts` fetches rewards state from `/rewards/me` through the backend API.
- `docs/ARCHITECTURE.md` claims OpenAI embeddings and Neo4j are part of memory/search, which implies at least some derived data can leave the device.

Safe claim shape: "raw/local workspace data is designed to stay local for specified features; derived summaries, diagnostics, account metadata, model downloads, and backend API calls may leave the device depending on the feature."

### 2. Embedded Core Migration Left Multiple Sidecar Claims Stale

The highest-confidence stale docs cluster is around the core binary and sidecar lifecycle.

Stale or conflicting claims:

- `AGENTS.md` says `cargo build --bin openhuman` produces the sidecar and `cd app && pnpm core:stage` stages it.
- `docs/ARCHITECTURE.md` says root `Cargo.toml` builds an `openhuman` binary staged into `app/src-tauri/binaries/`.
- `docs/BUILDING.md` says to run `cargo build --manifest-path Cargo.toml --bin openhuman`, then `cd app && pnpm core:stage`.
- `docs/src-tauri/README.md` says `core:stage` runs `scripts/stage-core-sidecar.mjs`, builds `cargo build --bin openhuman`, and copies the binary into `app/src-tauri/binaries/`.
- `docs/src-tauri/01-architecture.md` says the Tauri shell relays JSON-RPC to a separately built `openhuman` core binary.
- `docs/src-tauri/03-services.md` says `CoreProcessHandle` resolves a staged `openhuman` executable and starts/attaches to the core process.

Contradicting local evidence:

- `Cargo.toml` defines the root binary as `openhuman-core`, not `openhuman`.
- `app/package.json` defines `core:stage` as `echo '[core:stage] no-op -- core is linked in-process; sidecar removed (PR #1061)'`.
- `app/src-tauri/Cargo.toml` depends on `openhuman_core = { path = "../..", package = "openhuman" }` and says the core domain logic is embedded in-process to avoid orphan-sidecar bugs.
- `app/src-tauri/src/core_process.rs` starts with "In-process core lifecycle" and states there is no sidecar to leak on Cmd+Q.
- `app/src-tauri/src/core_process.rs` calls `openhuman_core::core::jsonrpc::run_server_embedded(...)` inside a Tokio task.
- `app/src-tauri/src/lib.rs` has `run_core_from_args` dispatching directly through linked `openhuman_core` instead of shelling out.
- `ls -d app/src-tauri/binaries` failed because that directory is not present in this worktree.

Nuance: there is still a standalone `openhuman-core run` harness and the embedded app still uses localhost JSON-RPC on port 7788, so not every "core process" phrase is wrong. The stale claim is specifically the packaged app requiring a separately staged sidecar named `openhuman`.

### 3. Skills Docs Are Split Between Current SKILL.md Reality And Removed QuickJS Runtime

`docs/SKILLS-HOW-THEY-WORK.md` is now the most misleading single docs file found in this audit.

It claims:

- Active runtime path is QuickJS skills managed by Rust.
- Key files include `src/openhuman/skills/registry_ops.rs`, `src/openhuman/skills/qjs_engine.rs`, `src/openhuman/skills/manifest.rs`, `src/openhuman/skills/skill_registry.rs`, `src/openhuman/skills/qjs_skill_instance/*`, and `src/openhuman/skills/quickjs_libs/bootstrap.js`.
- Installed skills are `manifest.json` plus JS entry files under `workspace/skills/<skill_id>/`.
- RPC methods include `openhuman.skills_registry_fetch`, `openhuman.skills_list_available`, `openhuman.skills_install`, `openhuman.skills_start`, `openhuman.skills_call_tool`, and others.

Contradicting local evidence:

- `src/openhuman/skills/mod.rs` says "Legacy skill metadata helpers retained after QuickJS runtime removal."
- `rg --files src/openhuman/skills` found no `registry_ops.rs`, `qjs_engine.rs`, `manifest.rs`, `skill_registry.rs`, `qjs_skill_instance/*`, or `quickjs_libs/bootstrap.js`.
- `src/openhuman/skills/README.md` describes the domain as agentskills.io-style `SKILL.md` discovery, parsing, resource reading, install/uninstall, and per-turn injection.
- `src/openhuman/skills/schemas.rs` exposes only `skills_list`, `skills_read_resource`, `skills_create`, `skills_install_from_url`, and `skills_uninstall`.
- `app/src/services/api/skillsApi.ts` calls `openhuman.skills_list`, `openhuman.skills_read_resource`, `openhuman.skills_create`, `openhuman.skills_install_from_url`, and `openhuman.skills_uninstall`.
- `app/src/pages/Skills.tsx` imports `skillsApi` from `app/src/services/api/skillsApi.ts`, not `app/src/lib/skills/skillsApi.ts`.
- `rtk read app/src/lib/skills/skillsApi.ts` failed because that file does not exist.

Additional drift:

- `.env.example` still documents `SKILLS_REGISTRY_URL` and `SKILLS_LOCAL_DIR` in terms of a manifest/index.js skill registry. That may be dead config or preserved for a future/sibling runtime, but no current local code path found in `src/openhuman/skills` consumes it.

### 4. Routing And Frontend Architecture Docs Lag The Current App Shell

`docs/src/README.md` gets some high-level intent right, but `docs/src/05-pages-routing.md` and `docs/src/01-architecture.md` are stale in important details.

Stale route claims:

- `docs/src/05-pages-routing.md` lists `/mnemonic`, `/conversations`, and `/agents`.
- It includes a top-level `/login` example even though the same doc says there is no top-level `/login`.
- It describes a Telegram OAuth login page and Telegram connection-focused onboarding snippets that do not match the current route file.

Current route evidence:

- `app/src/AppRoutes.tsx` mounts `/`, `/onboarding/*`, `/home`, optionally `/human` outside production, `/intelligence`, `/skills`, `/chat`, `/channels`, `/invites`, `/notifications`, `/rewards`, `/webhooks`, and `/settings/*`.
- `app/src/AppRoutes.tsx` does not mount `/login`, `/mnemonic`, `/conversations`, or `/agents`.
- The code comment says `/chat` replaces the old `/conversations` and `/accounts` routes.

Stale provider-chain claims:

- `docs/src/01-architecture.md` describes `Redux -> PersistGate -> UserProvider -> SocketProvider -> AIProvider -> SkillProvider -> HashRouter`.
- `app/src/App.tsx` actually composes `Redux Provider -> PersistGate -> CoreStateProvider -> SocketProvider -> ChatRuntimeProvider -> HashRouter -> CommandProvider -> ServiceBlockingGate -> AppShell`.
- `App.tsx` starts `startWebviewAccountService`, `startWebviewNotificationsService`, and `startNativeNotificationsService` at app boot, which is not reflected in the older docs.

### 5. Telegram Claims Need Precise Terminology

Docs correctly warn there is no active MTProto provider, but other Telegram claims are mixed.

Evidence for active Telegram surfaces:

- `src/openhuman/channels/providers/mod.rs` exports `telegram`.
- `src/openhuman/channels/providers/telegram/*` exists.
- `app/src/types/accounts.ts` includes `telegram` as an embedded Telegram Web account provider.
- `app/test/e2e/specs/telegram-flow.spec.ts` exists.
- `docs/channels/telegram.md` exists.
- `src/core/jsonrpc.rs` still has a `/auth/telegram` handler for bot-style auth callback.

Conflicting docs:

- `docs/ARCHITECTURE.md` diagrams a Telegram integration and Telegram API flow, then later lists `Telegram | Removed | Telegram integration removed`.
- `docs/src/04-mcp-system.md` and project instructions appear more precise: there is no large Telegram MCP tool pack or MTProto provider.

Safe wording: "MTProto and old Telegram-provider assumptions are removed; Telegram remains present as bot/channel/web-account surfaces."

### 6. Distribution And Install Claims Need External Verification

Local install docs claim official Homebrew, apt, npm, curl/manual, signed/notarized app, release assets, and latest stable binaries.

Local support:

- `scripts/install.sh` and `scripts/install.ps1` exist.
- `scripts/release/*` includes package, apt, npm, Homebrew, updater, signing, and artifact scripts.
- `.github/workflows/release-packages.yml`, `release-staging.yml`, `release-production.yml`, `build-desktop.yml`, and `installer-smoke.yml` exist.
- `docs/homebrew-core.md` notes the binary name/install layout is currently `openhuman-core` with an `openhuman` symlink.

Unverified from local-only audit:

- Whether Homebrew tap, apt repo, npm package, website download, and latest GitHub release currently publish the exact documented artifacts.
- Whether macOS binaries are currently notarized.
- Whether all release artifact names in `docs/install.md` and `docs/BUILDING.md` match current release scripts and workflow outputs.

This should be treated as a release-doc audit task, not assumed correct from repo files alone.

### 7. Validation And Coverage Claims Are Substantial But Should Be Treated As Claims Unless Run

Local evidence supports that validation infrastructure exists:

- `package.json` exposes root scripts for `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`, `pnpm test:rust`, and debug wrappers.
- `app/package.json` exposes Vitest, WDIO E2E, Rust checks, format, lint, and coverage scripts.
- `.github/workflows/coverage.yml` runs frontend Vitest coverage, Rust core `cargo llvm-cov`, Rust Tauri `cargo llvm-cov`, and a `diff-cover >= 80%` changed-lines gate.
- `docs/agent-workflows/codex-pr-checklist.md` documents validation commands and PR body requirements.
- `docs/TEST-COVERAGE-MATRIX.md` maps product features to RU/RI/VU/WD/MS coverage and known gaps.
- Many referenced test files exist, including `app/test/e2e/specs/notifications.spec.ts`, `rewards-unlock-flow.spec.ts`, `screen-intelligence.spec.ts`, `voice-mode.spec.ts`, `autocomplete-flow.spec.ts`, `tests/json_rpc_e2e.rs`, `tests/memory_graph_sync_e2e.rs`, and `tests/screen_intelligence_vision_e2e.rs`.

Limit:

- I did not run any broad validation suite because this queue item's required validation is `git status --short`, and the task scope is a read-only docs claims audit plus one report. The matrix status counts should remain docs claims until CI or local test runs confirm them.

## Risks And Stale Assumptions

1. Embedded-core migration docs are stale enough to waste agent time.
   Agents following `docs/BUILDING.md`, `docs/ARCHITECTURE.md`, or `docs/src-tauri/*` may try to build `--bin openhuman`, stage a missing sidecar, or look for `app/src-tauri/binaries/`. The current app links `openhuman_core` in-process and `core:stage` is a no-op.

2. Skills docs describe files and RPC methods that do not exist.
   `docs/SKILLS-HOW-THEY-WORK.md` points agents toward removed QuickJS runtime files and `openhuman.skills_*` methods that are absent from the current controller surface. This is high-risk because it can cause implementation work in dead paths.

3. Privacy claims are too absolute for the current backend/integration architecture.
   The code has local encryption and local raw-data classifications, but it also has backend API calls, Composio integration state, model downloads, diagnostics, and derived-to-backend capability metadata. Docs should not say all workflow data stays on device without a feature-by-feature qualifier.

4. Routing docs can mislead UI agents into editing nonexistent pages.
   The docs still mention `/login`, `/mnemonic`, `/conversations`, and `/agents`, while current routing uses `/chat`, `/channels`, `/notifications`, `/rewards`, and `/webhooks`.

5. Telegram removal language is ambiguous.
   "Telegram integration removed" is false if read broadly; Telegram still exists as channel/web-account/bot callback surfaces. The removed thing appears to be MTProto or an older Telegram tool-pack/provider model.

6. Distribution docs include remote claims that local files cannot prove.
   Install docs may be correct, but the current audit did not verify external package availability, signing, notarization, latest release assets, or public tap/repo state.

7. Several docs still use "sidecar" as a generic term after the architecture changed.
   Some historical or standalone-harness references are legitimate, but package/runtime docs should explicitly distinguish embedded in-process core, localhost JSON-RPC server, and optional standalone `openhuman-core run` harness.

## Independently Grabbable Next Tasks

### Task 1: Refresh Embedded-Core And Build Docs

Scope:

- Update `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/BUILDING.md`, `docs/src-tauri/README.md`, `docs/src-tauri/01-architecture.md`, and `docs/src-tauri/03-services.md`.
- Replace `cargo build --bin openhuman` with `cargo build --manifest-path Cargo.toml --bin openhuman-core` where a standalone core harness is intended.
- Replace sidecar-staging instructions with the current in-process core model and `core:stage` no-op behavior.
- Preserve explicit docs for the standalone `openhuman-core run` harness where relevant.

Acceptance criteria:

- Docs clearly state that the packaged app embeds `openhuman_core` in-process.
- Docs clearly state that localhost JSON-RPC remains the app/core protocol boundary.
- No active build instructions tell contributors to stage `app/src-tauri/binaries/` for normal app builds.
- Any remaining "sidecar" references are marked historical, standalone-harness, or external-service sidecar references.

Validation candidates:

- `rg -n "--bin openhuman|stage-core-sidecar|app/src-tauri/binaries|separately built.*openhuman|spawn/monitor openhuman sidecar" AGENTS.md docs app/package.json app/src-tauri`
  - Expected after fix: no active docs hits outside historical notes or code comments that intentionally mention prior behavior.
- `cargo build --manifest-path Cargo.toml --bin openhuman`
  - Expected now: fail, because the bin target is `openhuman-core`; after docs fix, this should no longer be recommended.
- `cargo build --manifest-path Cargo.toml --bin openhuman-core`
  - Expected: should be the correct standalone-core build command, although full compile may be long.
- `cd app && pnpm core:stage`
  - Expected now: pass as no-op with the "core is linked in-process" message.

### Task 2: Replace Or Archive The Obsolete QuickJS Skills Runtime Doc

Scope:

- Rewrite `docs/SKILLS-HOW-THEY-WORK.md` around the current `SKILL.md` discovery/injection/install system.
- Align paths with `src/openhuman/skills/README.md`, `src/openhuman/skills/schemas.rs`, and `app/src/services/api/skillsApi.ts`.
- Remove or explicitly archive QuickJS runtime, manifest/index.js registry, `qjs_*`, and `skills_list_available` claims.
- Audit `.env.example` `SKILLS_REGISTRY_URL` and `SKILLS_LOCAL_DIR`; either remove them or mark as obsolete/future if no current code consumes them.

Acceptance criteria:

- The doc names only files that exist or explicitly marks missing paths as archived/removed.
- The JSON-RPC section lists `openhuman.skills_list`, `openhuman.skills_read_resource`, `openhuman.skills_create`, `openhuman.skills_install_from_url`, and `openhuman.skills_uninstall`.
- The UI path points to `app/src/services/api/skillsApi.ts`.
- The storage section describes `~/.openhuman/skills`, `~/.agents/skills`, workspace `.openhuman/skills`, workspace `.agents/skills`, and legacy `<workspace>/skills` accurately.

Validation candidates:

- `rg -n "qjs|QuickJS|registry_ops|qjs_engine|qjs_skill_instance|manifest.json|index.js|skills_list_available|skills_call_tool|skills_start|SKILLS_LOCAL_DIR|SKILLS_REGISTRY_URL" docs/SKILLS-HOW-THEY-WORK.md .env.example src/openhuman/skills app/src/services/api/skillsApi.ts`
  - Expected after fix: only intentional archived/future notes or current config references with verified code owners.
- `cargo test --manifest-path Cargo.toml skills`
  - Expected: focused Rust skill-domain tests should pass if dependencies are available.
- `pnpm --dir app exec vitest run src/services/api/__tests__/skillsApi.test.ts --config test/vitest.config.ts`
  - Expected: app API wrapper tests should pass if JS deps are installed.

### Task 3: Refresh Frontend Routing And Provider Docs

Scope:

- Update `docs/src/README.md`, `docs/src/01-architecture.md`, and `docs/src/05-pages-routing.md`.
- Match current `app/src/App.tsx` provider chain and services started at boot.
- Match current `app/src/AppRoutes.tsx` route table.
- Remove outdated `/login`, `/mnemonic`, `/conversations`, and `/agents` examples unless documenting historical migration.

Acceptance criteria:

- Route docs list `/chat`, `/channels`, `/notifications`, `/rewards`, `/webhooks`, optional `/human`, and current settings routing.
- Provider docs mention `CoreStateProvider`, `ChatRuntimeProvider`, `CommandProvider`, and `ServiceBlockingGate`.
- Docs no longer imply a standalone Login page or Telegram-only onboarding flow.

Validation candidates:

- `rg -n "/login|/mnemonic|/conversations|/agents|UserProvider|AIProvider|SkillProvider|TelegramLoginButton|TelegramConnectionModal" docs/src app/src/App.tsx app/src/AppRoutes.tsx`
  - Expected after fix: no active docs references except historical notes.
- `pnpm --dir app exec vitest run src/components/commands/__tests__/CommandProvider.test.tsx src/components/__tests__/ProtectedRoute.test.tsx src/components/__tests__/PublicRoute.test.tsx --config test/vitest.config.ts`
  - Expected: targeted route/provider-adjacent app tests should pass if JS deps are installed.

### Task 4: Qualify Privacy And Data-Residency Claims

Scope:

- Update `README.md`, `docs/ARCHITECTURE.md`, `docs/install.md` if needed, and any onboarding/security docs that state all workflow data stays local.
- Ground the wording in `src/openhuman/about_app/catalog.rs` privacy classifications.
- Separate local raw data, local credentials, derived summaries to backend, diagnostics to backend, model downloads, and external OAuth/integration data.

Acceptance criteria:

- No doc says "everything stays on device" without a nearby qualifier.
- README still communicates local-first intent but accurately mentions backend/integration exceptions.
- Architecture docs reconcile OpenAI embeddings/Neo4j/backend usage with local memory/encryption claims.

Validation candidates:

- `rg -n "everything.*(local|device)|all .*stays|workflow data.*stays|encrypted locally|on your machine|cloud dossier|Neo4j|OpenAI|DERIVED_TO_BACKEND|DIAGNOSTICS_TO_BACKEND" README.md docs src/openhuman/about_app/catalog.rs`
  - Expected after fix: each broad privacy claim has scoped wording or links to the capability catalog.
- `cargo test --manifest-path Cargo.toml about_app`
  - Expected: capability catalog tests should pass if Rust deps are available.

### Task 5: Run A Release/Install Docs Verification Pass

Scope:

- Audit `docs/install.md`, `docs/BUILDING.md`, `docs/homebrew-core.md`, release workflows, and `scripts/release/*`.
- Verify remote package channels only with explicit approval/network-capable environment.
- Confirm exact artifact names, binary names, signatures/notarization language, npm wrapper behavior, apt repo setup, and Homebrew tap/core story.

Acceptance criteria:

- Local build/install docs distinguish app bundle artifacts from standalone `openhuman-core` archives.
- External channel claims cite the workflow/script or mark "requires release-channel verification".
- The manual checksum example uses a current or intentionally illustrative version.

Validation candidates:

- `rg -n "openhuman-core-|OpenHuman_|npm install -g openhuman|brew install|apt|notarized|sha256|install.sh|install.ps1|homebrew" docs scripts .github/workflows`
  - Expected: every external distribution claim maps to a current script/workflow or is marked unverified.
- `bash scripts/install.sh --dry-run --verbose`
  - Expected: should preview manual install actions locally; may require network depending on script behavior.
- `pwsh -NoProfile -File scripts/tests/OpenHumanWindowsInstall.Tests.ps1`
  - Expected: Windows install-script tests should pass in an environment with PowerShell.

## Validation Command Candidates

Required queue validation:

- `git status --short`
  - Expected: exits 0. Before committing the report, it should show only `docs/overnight/openhuman-sym208-recovery-docs-claims.md` as new/modified. After committing, it should be clean.

Cheap docs-only validation candidates:

- `git diff --check`
  - Expected: pass for this report or any future docs-only cleanup.
- `rg -n "--bin openhuman|stage-core-sidecar|qjs_engine|skills_list_available|/conversations|/agents|/mnemonic" docs AGENTS.md README.md`
  - Expected now: many hits; expected after follow-up docs cleanup: only intentional historical/archive references.

Project validation candidates discovered from manifests/docs:

- `pnpm --filter openhuman-app format:check`
  - Expected: should be the formatting gate for app/docs-visible changes if JS deps are installed.
- `pnpm typecheck`
  - Expected: should run `tsc --noEmit` through the app workspace if JS deps are installed.
- `pnpm test:coverage`
  - Expected: should run app Vitest coverage; potentially long.
- `pnpm test:rust`
  - Expected: should run Rust tests through `scripts/test-rust-with-mock.sh`; potentially long.
- `cargo fmt --manifest-path Cargo.toml --all --check`
  - Expected: relevant for Rust source changes, not this report.
- `cargo fmt --manifest-path app/src-tauri/Cargo.toml --all --check`
  - Expected: relevant for Tauri source changes, not this report.
- `cargo build --manifest-path Cargo.toml --bin openhuman`
  - Expected now: fail because local `Cargo.toml` defines `openhuman-core`, not `openhuman`. This is a docs drift detector.
- `cargo build --manifest-path Cargo.toml --bin openhuman-core`
  - Expected: correct standalone core binary build command, though compile time/dependencies may be heavy.

## Unknowns

- I did not verify remote package registries, taps, apt repos, latest GitHub releases, website downloads, or GitBook pages.
- I did not run test/lint/build suites beyond the required queue validation command.
- I did not inspect sibling repos from `repos.json`; this repo was large enough for the requested deep standalone audit and touching other repos was out of scope.
- I did not determine whether stale docs reflect an intentionally paused migration, a branch-specific recovery state, or simply unmaintained documentation.
- I did not validate whether `SKILLS_REGISTRY_URL` and `SKILLS_LOCAL_DIR` are consumed in another non-`src/openhuman/skills` path or preserved for planned work; the current skills domain does not show the QuickJS registry files named by the docs.

## Handoff Notes

This report should be enough for a morning reviewer to open focused docs-only work packs. The safest order is:

1. Fix embedded-core/build docs first, because they affect every implementation agent.
2. Rewrite/archive the QuickJS skills doc second, because it points to nonexistent files and methods.
3. Refresh frontend route/provider docs third, because they are important but less likely to break build setup.
4. Run a privacy/data-residency claims pass before any public README/website copy changes.
5. Verify distribution claims in a network-approved release-doc audit.
