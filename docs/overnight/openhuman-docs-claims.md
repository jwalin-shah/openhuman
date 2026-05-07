# OpenHuman Docs Claims Audit

Queue item: `openhuman-docs-claims`  
Focus area: `docs-claims`  
Branch: `codex/goal-openhuman-docs-claims`  
HEAD at audit start: `f11f217809841cf8e3a7f694d8e80967d8e188b8`

## Scope And Decision

This was a read-only documentation audit plus the required overnight report. I did not modify product code, generated data, secrets, deploy configuration, external services, trackers, or PR state. The only intended write is this report at `docs/overnight/openhuman-docs-claims.md`.

Primary decision: do not patch the stale docs in this slice. Several claims are broad and cross-cutting enough that fixing them should be split into targeted docs work with owner review, especially around current product positioning, QuickJS removal, Composio-backed integrations, and in-process core lifecycle.

## Repo Purpose And State

OpenHuman is a React + Tauri desktop application with a Rust core crate. The current repo spans desktop UI (`app/src`), the Tauri host (`app/src-tauri`), core business/RPC domains (`src/openhuman`, `src/core`), integration tests (`tests`), docs (`docs`), and packaging scripts. The docs currently describe both a personal desktop AI assistant and, in places, a crypto-community automation platform.

Observed state before writing this report:

- `git status --short --branch` returned `## codex/goal-openhuman-docs-claims` with no dirty entries.
- `git rev-parse HEAD` returned `f11f217809841cf8e3a7f694d8e80967d8e188b8`.
- `git diff --stat` returned no output before this report was added.
- `rg --files docs/overnight` failed with `No such file or directory`, so this report creates the first `docs/overnight` file in this worktree.
- `llm-tldr tree .` confirmed a large monorepo with `app/`, root `src/`, `tests/`, `docs/`, root `Cargo.toml`, `app/package.json`, and `app/src-tauri/Cargo.toml`. The command output was very large and truncated by the tool, but enough to confirm the major structure.

## Evidence Map

The following local evidence supports the findings below:

- `README.md:51-61` positions OpenHuman as a simple, UI-first personal AI assistant with local knowledge, local AI, voice, autocomplete, screen intelligence, and desktop integrations.
- `README.md:55` and `README.md:72` claim one-click Gmail/Slack/Notion skills, local encryption, and webhooks for instant feedback.
- `docs/ARCHITECTURE.md:3-5` says OpenHuman is a crypto-community communication and automation platform, while also saying desktop is the shipped surface.
- `docs/ARCHITECTURE.md:14-19` says root `src/` builds an `openhuman` CLI binary and that a local `skills/` directory contains runtime skill packages.
- `docs/ARCHITECTURE.md:55-76` and `docs/ARCHITECTURE.md:134-171` describe QuickJS as the active skills runtime.
- `docs/ARCHITECTURE.md:243-252` and `docs/ARCHITECTURE.md:276-282` claim AES/Argon2 memory encryption, local credential handling, and no localStorage for credentials/tokens.
- `docs/BUILDING.md:26-34` tells contributors to build `cargo build --manifest-path Cargo.toml --bin openhuman`, run `pnpm core:stage`, then `pnpm build`.
- `docs/BUILDING.md:194-198` is more current and says the Tauri host spawns a fresh embedded core after stale listener takeover.
- `docs/src-tauri/README.md:3`, `docs/src-tauri/README.md:17`, and `docs/src-tauri/README.md:21-23` still describe a Rust sidecar and `core:stage` copying a sidecar binary.
- `app/package.json:14` says `core:stage` is a no-op because the core is linked in-process and the sidecar was removed in PR `#1061`.
- `app/src-tauri/Cargo.toml:109-115` says the core HTTP/JSON-RPC server is embedded in-process inside the Tauri host.
- `app/src-tauri/src/core_process.rs:101-180` implements `ensure_running()` by starting `openhuman_core::core::jsonrpc::run_server_embedded(...)` in a Tokio task.
- `Cargo.toml:1-13` defines package `openhuman`, but the primary binary is named `openhuman-core`, not `openhuman`.
- `rg --files skills` failed with `No such file or directory`, contradicting docs that list a repo-local `skills/` runtime directory.
- `rg -n "rquickjs|quickjs|QuickJS" Cargo.toml Cargo.lock app/src-tauri/Cargo.toml app/src-tauri/Cargo.lock src app/src-tauri/src app/src` found no `rquickjs` dependency and only stale/comment/test references plus removal notes.
- `src/openhuman/skills/mod.rs:1` says "Legacy skill metadata helpers retained after QuickJS runtime removal."
- `src/openhuman/skills/schemas.rs:1-17` and `src/openhuman/skills/schemas.rs:180-212` expose `skills.list`, `skills.read_resource`, `skills.create`, `skills.install_from_url`, and `skills.uninstall` for SKILL.md/legacy metadata, not the QuickJS runtime methods described in `docs/SKILLS-HOW-THEY-WORK.md`.
- `src/openhuman/subconscious/situation_report.rs:255-257` says local QuickJS skills have been removed and current integration state should come from Composio and channels.
- `app/src/services/api/skillsApi.ts:165-295` matches the current SKILL.md metadata RPC surface.
- `app/src/pages/Skills.tsx:347-360` discovers SKILL.md skills via `skillsApi.listSkills()`.
- `app/src/pages/Skills.tsx:396-476` renders Composio toolkits separately from discovered SKILL.md skills.
- `app/src/components/composio/toolkitMeta.tsx:1-13` says the UI keeps a local catalog of Composio managed-auth toolkits, while live backend allowlist wins for runtime availability.
- `app/src/components/composio/toolkitMeta.tsx:78`, `:112`, and `:129` include Gmail, Notion, and Slack in the broad managed toolkit catalog.
- `src/openhuman/composio/providers/registry.rs:76-88` registers built-in Gmail, Notion, and Slack Composio providers.
- `src/openhuman/about_app/catalog.rs:229-238` lists Slack memory ingestion as beta.
- `src/openhuman/about_app/catalog.rs:270-318` lists several skills features as stable/beta.
- `src/openhuman/about_app/catalog.rs:350-367` lists Google and Notion connection capabilities as `ComingSoon`, which conflicts with blanket README language.
- `docs/src/05-pages-routing.md:9-23` claims routes like `/mnemonic`, `/conversations`, and `/agents`, and says there is no `/login` route.
- `docs/src/05-pages-routing.md:27-57` then shows a sample route config with `/login`, contradicting its own line 23.
- `app/src/AppRoutes.tsx:26-153` shows the actual current routes: `/`, `/onboarding/*`, `/home`, optional `/human`, `/intelligence`, `/skills`, `/chat`, `/channels`, `/invites`, `/notifications`, `/rewards`, `/webhooks`, `/settings/*`, and catch-all. There is no `/mnemonic`, `/conversations`, `/agents`, or `/login`.
- `src/openhuman/encryption/mod.rs:1-5` supports the AES-256-GCM / Argon2id memory-encryption claim.
- `src/openhuman/security/secrets.rs:1-21` says secrets are stored with ChaCha20-Poly1305 and a local key file, with plaintext allowed when `secrets.encrypt = false`.
- `app/src/store/userScopedStorage.ts` and `app/src/utils/configPersistence.ts` use `localStorage` for non-secret user scoping and RPC URL persistence; this does not prove token leakage, but docs should avoid implying localStorage is unused.
- `docs/PROMPT_INJECTION_GUARD.md` is well grounded: it points to `src/openhuman/prompt_injection/`, app advisory checks, and concrete unit/integration tests.
- `docs/TESTING-STRATEGY.md` gives a useful validation map across Rust unit/integration, Vitest, WDIO E2E, and manual smoke, and root `package.json:8-32` exposes matching wrapper scripts.
- `docs/install.md:95-97` says the npm package requires Node.js >= 18, while `app/package.json:5-6` requires Node >= 24 for app source work. This may be valid for binary-wrapper install, but it should be explicitly separated from source-build requirements.

## Claim Findings

### 1. Product positioning is inconsistent.

The README describes a personal AI super-intelligence for daily life and local desktop workflows (`README.md:49-61`). `docs/ARCHITECTURE.md:3-5` instead opens with "crypto communities" and repeats crypto-specific rationale at `docs/ARCHITECTURE.md:93`. Current code and capability catalog are much broader: conversations, intelligence, Slack ingestion, skills, local AI, screen intelligence, channels, settings, service management, and privacy controls.

Risk: morning reviewers or new agents can make product decisions against the wrong north star. The crypto-community framing looks stale relative to the app surface and README.

### 2. Core lifecycle and build docs are stale.

Multiple docs still describe a staged sidecar (`docs/ARCHITECTURE.md:15-19`, `docs/src-tauri/README.md:21-23`, `docs/BUILDING.md:26-34`). Current package and Tauri evidence says the core is embedded in-process: `app/package.json:14`, `app/src-tauri/Cargo.toml:109-115`, and `app/src-tauri/src/core_process.rs:140-144`.

The build command `cargo build --manifest-path Cargo.toml --bin openhuman` is also suspect: root `Cargo.toml` defines `[[bin]] name = "openhuman-core"`. This matters because copy-pasted build instructions may fail or reinforce the removed sidecar model.

### 3. QuickJS skills-runtime docs are substantially stale.

`docs/ARCHITECTURE.md` and `docs/SKILLS-HOW-THEY-WORK.md` describe QuickJS as the active runtime with `RuntimeEngine`, `manifest.json`, per-skill memory limits, bridge APIs, registry fetch, install, start/stop, and `openhuman.skills_*` runtime methods. Current code points the other way:

- `src/openhuman/skills/mod.rs:1` says QuickJS was removed.
- `src/openhuman/subconscious/situation_report.rs:255-257` explicitly says local QuickJS skills have been removed.
- `src/openhuman/skills/schemas.rs` exposes SKILL.md discovery/create/install/read/uninstall controllers, not QuickJS lifecycle methods.
- `rg` found no `rquickjs` dependency in Cargo manifests or locks.

Risk: this is the largest docs-claims gap. A contributor could build new work against a removed runtime instead of current SKILL.md metadata injection, Composio providers, channels, and tools.

### 4. Integration claims are directionally true but overbroad.

There is real Gmail/Slack/Notion evidence: `src/openhuman/composio/providers/registry.rs:80-83` registers provider implementations, the Skills page renders Composio connectors, and the UI catalog includes Gmail, Notion, and Slack. But README language says "one-click skills" for Gmail/Slack/Notion with local encryption and webhooks as if the whole integration stack is fully shipped.

The runtime capability catalog complicates that claim: Slack memory ingestion is beta (`src/openhuman/about_app/catalog.rs:229-238`), while Google and Notion connection capabilities are `ComingSoon` (`src/openhuman/about_app/catalog.rs:350-367`). The UI also intentionally renders a broad local catalog before the live backend allowlist expands (`app/src/components/composio/toolkitMeta.tsx:1-13`).

Risk: user-facing docs may promise more integration maturity than the runtime catalog and backend availability can guarantee.

### 5. Routing docs are stale and self-contradictory.

`docs/src/05-pages-routing.md:9-23` lists `/mnemonic`, `/conversations`, and `/agents`; the actual route table in `app/src/AppRoutes.tsx:26-153` does not include those routes. The same doc says there is no `/login` route at line 23, then includes `/login` in its sample at lines 33-35 and redirects unauthenticated users to `/login` at line 97.

Risk: UI work could target dead routes, reintroduce removed login assumptions, or miss current routes such as `/chat`, `/channels`, `/notifications`, `/rewards`, and `/webhooks`.

### 6. Privacy and local-data claims need qualification.

Some security claims are supported: AES/Argon2 memory encryption exists (`src/openhuman/encryption/mod.rs:1-5`), prompt injection guard docs cite actual tests, and secret storage has an authenticated-encryption implementation (`src/openhuman/security/secrets.rs:1-21`). However, README wording such as "workflow data is kept on device" and "Everything is stored on your machine" is too broad when the capability catalog marks several workflows as derived data leaving the device (`src/openhuman/about_app/catalog.rs:14-18`, `:50-68`, `:140-147`) and Composio/backend services mediate integrations.

The architecture doc's "No localStorage for credentials or tokens" claim is plausible for secrets, but localStorage is used for non-secret bootstrapping and config persistence. Docs should say "no credentials/tokens in localStorage" rather than letting readers infer "no localStorage."

### 7. Validation docs are useful but need drift cleanup.

`docs/TESTING-STRATEGY.md` is one of the better-grounded docs: it maps Rust unit/integration, Vitest, WDIO E2E, manual smoke, and pre-merge commands. Root `package.json` exposes many matching wrapper scripts. The stale parts are mostly in build/install docs and sidecar references rather than the test strategy itself.

## Risks And Stale Assumptions

1. QuickJS runtime drift is high risk. Architecture and skills docs describe active executable behavior that current code says was removed.
2. Sidecar/in-process drift is high risk. Build docs and Tauri docs still tell agents to stage or reason about a sidecar, while current code embeds the core server in the Tauri process.
3. Product-positioning drift is medium risk. README, architecture, capability catalog, and UI surfaces do not share one concise description of the product.
4. Integration maturity drift is medium risk. README claims one-click Gmail/Slack/Notion broadly, while capability statuses and runtime availability vary by provider and Composio/backend state.
5. Routing drift is medium risk. Docs point to routes that no longer exist and omit current routes.
6. Privacy wording risk is medium to high. "Everything stays on device" style claims can become compliance-sensitive unless tied to the capability privacy catalog.
7. Distribution docs may be stale. Source-build Node version and binary-wrapper Node version might both be true, but the docs do not clearly separate those contexts.

## Next Safe Work

1. **Update core lifecycle/build docs.**  
   Acceptance criteria: `docs/ARCHITECTURE.md`, `docs/src-tauri/README.md`, `docs/src-tauri/01-architecture.md`, `docs/src-tauri/03-services.md`, `docs/BUILDING.md`, and contributor docs no longer claim `core:stage` copies an active sidecar for normal desktop builds; build commands refer to the current `openhuman-core` binary or package scripts.  
   Validation candidates: `rg -n "core:stage|sidecar|externalBin|--bin openhuman|openhuman binary" docs README.md AGENTS.md app/package.json`; `cargo check --manifest-path app/src-tauri/Cargo.toml`.

2. **Retire or rewrite active QuickJS runtime docs.**  
   Acceptance criteria: active docs do not describe `rquickjs`, `RuntimeEngine`, `manifest.json` install/start/stop, or QuickJS memory limits as current runtime behavior unless explicitly marked historical; docs explain current SKILL.md metadata, Composio, channels, and tool registry boundaries.  
   Validation candidates: `rg -n "QuickJS|rquickjs|RuntimeEngine|manifest.json|openhuman\\.skills_list_available|skills_start|skills_call_tool" docs README.md src/openhuman/skills`; `cargo test --manifest-path Cargo.toml skills`.

3. **Reconcile README claims with the capability catalog.**  
   Acceptance criteria: README and docs state which data stays local, which derived data can leave the device, which providers are stable/beta/coming soon, and how Composio/backend services fit into one-account provider access.  
   Validation candidates: `cargo test --manifest-path Cargo.toml about_app`; `rg -n "stays on device|Everything is stored|one-click|Gmail|Slack|Notion|ComingSoon|Derived" README.md docs src/openhuman/about_app/catalog.rs`.

4. **Refresh frontend routing docs from `AppRoutes.tsx`.**  
   Acceptance criteria: `docs/src/05-pages-routing.md`, `docs/src/README.md`, and component docs list the current routes and remove stale `/login`, `/mnemonic`, `/conversations`, and `/agents` examples unless they are explicitly historical.  
   Validation candidates: `rg -n "/login|/mnemonic|/conversations|/agents" docs/src app/src/AppRoutes.tsx`; `pnpm typecheck`.

5. **Split source-build and binary-install prerequisites.**  
   Acceptance criteria: install docs explain npm wrapper Node requirements separately from source-development Node requirements, and source-build docs cite `app/package.json` Node >= 24 and `rust-toolchain.toml` Rust 1.93.0.  
   Validation candidates: `rg -n "Node|node|pnpm|rust-toolchain|1\\.93|>=24|>= 18" docs README.md package.json app/package.json rust-toolchain.toml`; `pnpm --filter openhuman-app compile`.

## Validation Command Candidates

Required queue validation:

- `git status --short`  
  Expected final status: one untracked or modified report file only, `docs/overnight/openhuman-docs-claims.md`.

Cheap docs-claim checks for future work:

- `rg -n "QuickJS|rquickjs|RuntimeEngine|core:stage|sidecar|--bin openhuman|/login|/conversations|/agents|/mnemonic" README.md docs AGENTS.md`  
  Expected today: fails the audit by finding stale claims.
- `rg --files skills`  
  Expected today: fails with missing directory unless a future local skills tree is restored.
- `cargo build --manifest-path Cargo.toml --bin openhuman`  
  Expected today: likely fails because the current bin is `openhuman-core`; use only to confirm before editing docs.
- `pnpm typecheck`  
  Expected today: not run in this audit; candidate for docs changes that touch app references.
- `cargo test --manifest-path Cargo.toml about_app`  
  Expected today: not run in this audit; candidate for capability-catalog claim changes.

## Non-Goals

- No product code changes.
- No generated data changes.
- No dependency changes.
- No secrets, credentials, external service calls, deploys, uploads, pushes, or PR creation.
- No attempt to verify live release artifacts, Homebrew/apt/npm availability, GitBook pages, or GitHub issues.
- No tracker state changes.

## Unknowns

- Whether public release artifacts still include a separate `openhuman-core` binary alongside the embedded desktop app.
- Whether the npm wrapper's Node >= 18 claim is accurate for released install packages despite app source requiring Node >= 24.
- Whether GitBook product docs have already diverged from local repo docs.
- Whether the current product owner wants the README to emphasize personal AI, communities, crypto communities, or a broader desktop automation platform.
- Whether Google/Notion `ComingSoon` statuses in `about_app` are stale relative to Composio provider code, or whether provider code exists ahead of product exposure.
- Whether any private backend allowlist makes more Composio toolkits live than local code can prove.

