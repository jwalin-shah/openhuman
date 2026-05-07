# OpenHuman SYM85 Risk Register Audit

Queue item: `openhuman-sym85-risk-register`  
Repo: `openhuman-sym85`  
Audit date: 2026-05-07  
Focus area: risk-register  
Worker branch observed at start: `codex/goal-openhuman-sym85-risk-register`  
Starting HEAD observed: `f11f217809841cf8e3a7f694d8e80967d8e188b8`

## Purpose and Scope

OpenHuman is a React + Tauri v2 desktop app with a Rust core server and in-process JSON-RPC surface. The repo also contains packaging, updater, desktop permissions, embedded provider webviews, local AI/voice flows, credentials, config persistence, and automation harnesses.

This audit is read-only for product code. It writes exactly this report and does not touch product source, generated artifacts, secrets, external services, deployments, pushes, PRs, or trackers.

The local queue item referenced `items/openhuman-sym85-risk-register/ISSUE.md`, but that path was missing in this worktree. I used the issue body provided by the runner prompt as the task contract and recorded the missing path as a runner handoff risk, not as product evidence.

## Branch and Dirty State

Command observations:

- `git status --short --branch` returned `## codex/goal-openhuman-sym85-risk-register` with no dirty entries before this report was written.
- `git rev-parse --abbrev-ref HEAD` returned `codex/goal-openhuman-sym85-risk-register`.
- `git rev-parse HEAD` returned `f11f217809841cf8e3a7f694d8e80967d8e188b8`.
- `rtk read items/openhuman-sym85-risk-register/ISSUE.md` failed with `No such file or directory`.

## Evidence Inventory

These are the local files and command observations that shaped the risk register.

1. `llm-tldr tree .` showed a large multi-surface repo with root Rust core code, `app/` Tauri + React code, docs, packaging, tests, vendored dependency paths, and deployment files.
2. `README.md` describes the app as early beta and makes user-facing privacy and local-first claims.
3. `docs/ARCHITECTURE.md` describes the intended boundary between the React/Tauri shell and Rust core, plus credential and memory claims that do not fully match the implementation observed below.
4. `.env.example` exposes staging defaults, core host/port/token settings, logging flags, browser automation flags, registry paths, and debug JWT-related variables.
5. `app/.env.example` exposes frontend `VITE_*` settings, Sentry upload variables, core RPC fallback URL, and a development JWT token.
6. `package.json` and `app/package.json` show root scripts delegating to the app workspace, Node `>=24.0.0`, a no-op `core:stage` script, unit/e2e/rust test scripts, and Tauri CEF dev scripts.
7. `Cargo.toml` includes the root Rust core, CLI/bin targets, networking, Sentry, browser/OS control, voice, Matrix, optional WhatsApp, and a Git patch for `whisper-rs-sys`.
8. `app/src-tauri/Cargo.toml` enables CEF, devtools, unstable Tauri features, updater, path dependencies under `vendor/`, and Git patches for Tauri plugin workspace revisions.
9. `.gitmodules` points `app/src-tauri/vendor/tauri-cef` and `app/src-tauri/vendor/tauri-plugin-notification` at `tinyhumansai/*` repos.
10. `git submodule status` showed both vendor submodules with a leading `-`, meaning they are not initialized in this worktree.
11. `app/src/utils/config.ts` centralizes frontend config, staging/backend defaults, core RPC fallback, timeouts, Sentry release/env settings, and development flags.
12. `app/src/utils/configPersistence.ts` stores a user-provided core RPC URL in localStorage and validates only the URL scheme as `http` or `https`.
13. `app/src/services/coreRpcClient.ts` prefers the stored RPC URL in Tauri before asking the shell for `core_rpc_url`, and attaches the bearer token returned by `core_rpc_token`.
14. `app/src-tauri/src/lib.rs` registers powerful commands including `core_rpc_token`, core process controls, updater commands, provider webview controls, service controls, and screen-share commands.
15. `app/src-tauri/src/core_process.rs` starts the in-process core, generates the core token, kills stale listeners only after a fingerprint check, and has an `OPENHUMAN_CORE_REUSE_EXISTING=1` override.
16. `app/src-tauri/src/core_rpc.rs` injects the current core RPC bearer token into relay requests.
17. `src/core/auth.rs` protects `/rpc` with bearer auth but explicitly exempts public paths including `/`, `/health`, `/schema`, `/events`, `/events/webhooks`, and `/ws/dictation`.
18. `src/core/jsonrpc.rs` builds the HTTP router, sets permissive CORS headers including `Access-Control-Allow-Origin: *`, exposes public SSE/debug/dictation routes, and starts ancillary services at boot.
19. `src/core/jsonrpc_tests.rs` contains useful token rejection tests and public path tests, proving part of the security model is already testable.
20. `src/core/socketio.rs` registers Socket.IO handlers that accept `rpc:request` and chat events without an obvious token check inside the handler.
21. `src/openhuman/voice/streaming.rs` implements the public `/ws/dictation` WebSocket by accepting audio frames and running streaming dictation.
22. `Dockerfile` sets `OPENHUMAN_CORE_HOST=0.0.0.0`, exposes port `7788`, and runs the core server as a non-root user.
23. `app/src-tauri/tauri.conf.json` enables broad CSP allowances such as `'unsafe-inline'`, `https:`, `wss:`, `data:`, `blob:`, loopback wildcard connect targets, updater endpoints, and macOS private APIs.
24. `app/src-tauri/capabilities/default.json` and `app/src-tauri/permissions/allow-core-process.toml` expose broad IPC permissions to the main/overlay windows.
25. `app/src-tauri/capabilities/webview-accounts.json` allows remote account webviews for providers including WhatsApp, Telegram, LinkedIn, Gmail, Slack, Discord, Meet, Zoom, and Browserscan to access the `webview_recipe` permission set.
26. `app/src-tauri/permissions/allow-webview-recipe.toml` allows webview recipe events and screen-share session commands.
27. `app/src-tauri/entitlements.sidecar.plist` grants JIT, unsigned executable memory, disabled library validation, camera, microphone, and network client/server entitlements.
28. `app/src-tauri/src/webview_accounts/mod.rs` injects provider webviews, constrains allowed hosts, handles untrusted recipe events, posts provider surface events, and suppresses native provider deep-link schemes.
29. `app/src-tauri/src/webview_accounts/runtime.js` exposes the recipe runtime, overrides `getDisplayMedia`, falls back to native `getDisplayMedia` on failure, and shims permission queries for display capture/camera/microphone.
30. `app/src-tauri/src/screen_capture/mod.rs` implements macOS screen-share sessions with user activation, rate limiting, account labels, TTLs, and tokenized thumbnail/finalize flows, but uses time/counter/thread-derived tokens rather than a cryptographic RNG.
31. `app/src-tauri/src/webview_apis/server.rs` starts a local WebSocket bridge with no auth in the frame protocol.
32. `app/src-tauri/src/webview_apis/router.rs` currently returns `UnknownMethod` for all methods, reducing current risk but leaving a sensitive future expansion point.
33. `app/src-tauri/src/cef_preflight.rs` detects and removes stale CEF cache locks and suggests process-kill recovery commands.
34. `src/openhuman/credentials/ops.rs` validates sessions, purges pre-login conversations, stores session tokens, exposes session-token retrieval through RPC, and exposes OAuth integration token retrieval through RPC.
35. `src/openhuman/credentials/profiles.rs` persists `auth-profiles.json`, optionally encrypts token fields, and uses a lock file plus temp-file rename.
36. `src/openhuman/security/secrets.rs` implements the file-backed secret store using `.secret_key`, ChaCha20-Poly1305 for current `enc2:` payloads, legacy XOR migration, and an `encrypt = false` mode.
37. `src/openhuman/config/schema/types.rs` includes `Config.api_key` and `SecretsConfig.encrypt`.
38. `src/openhuman/config/schema/load.rs` applies environment overrides and tries to protect config files, but existing world-readable config only emits a warning.
39. `app/src/store/index.ts` persists Redux slices through user-scoped storage and exposes `__OPENHUMAN_STORE__` for E2E.
40. `app/src/store/userScopedStorage.ts` uses localStorage for active-user and persisted UI/app state.
41. `SECURITY.md` claims OS-level credential storage and no plaintext secret storage.
42. `docs/CREDENTIAL-PROXY-SPIKE.md` describes keychain-style storage as future work, which conflicts with the stronger present-tense claims in product/security docs.

## Risk Register

### R1 - Core RPC bearer token can be sent to an arbitrary stored URL

Severity: high  
Area: credentials, local RPC, desktop renderer trust boundary

Evidence:

- `app/src/utils/configPersistence.ts` accepts any `http:` or `https:` URL for `coreRpcUrl`.
- `app/src/services/coreRpcClient.ts` prefers the persisted RPC URL in Tauri before invoking `core_rpc_url`.
- `app/src/services/coreRpcClient.ts` obtains a bearer token through `core_rpc_token` and attaches it to RPC calls.
- `app/src-tauri/src/lib.rs` exposes `core_rpc_token` as a Tauri command.

Risk:

A malicious or stale localStorage value can redirect renderer RPC calls to a non-loopback host and leak the locally generated core bearer token. The token protects the local `/rpc` surface, so exfiltration would undermine the main process-to-core boundary.

Next safe work:

Constrain persisted core RPC URLs in desktop builds to loopback origins, or attach the bearer token only when the resolved URL is the shell-provided loopback URL. Add tests that a remote URL is rejected or receives no Authorization header.

### R2 - Public core endpoints become network-exposed in Docker or non-loopback configs

Severity: high  
Area: network exposure, auth boundaries, voice data

Evidence:

- `src/core/auth.rs` exempts `/schema`, `/events`, `/events/webhooks`, and `/ws/dictation` from bearer auth.
- `src/core/jsonrpc.rs` sets `Access-Control-Allow-Origin: *`.
- `src/openhuman/voice/streaming.rs` accepts public WebSocket audio frames for streaming dictation.
- `Dockerfile` sets `OPENHUMAN_CORE_HOST=0.0.0.0` and exposes `7788`.
- `.env.example` documents `OPENHUMAN_CORE_HOST` and `OPENHUMAN_CORE_TOKEN`.

Risk:

The intended desktop shape is loopback-only, but Docker and explicit host overrides can expose unauthenticated server-sent events, schema, debug event streams, and voice inference endpoints on the network. `/rpc` is protected, but adjacent public surfaces can still leak capability metadata, consume local inference resources, or process sensitive audio.

Next safe work:

Split public localhost-only routes from network deployments. Require bearer auth for `/ws/dictation` and event streams when the bind host is not loopback, or block non-loopback serve mode unless explicitly configured with hardened public-route policy.

### R3 - Socket.IO RPC path needs an explicit auth proof

Severity: high until verified  
Area: realtime transport, RPC bypass risk

Evidence:

- `src/core/socketio.rs` registers `rpc:request` and calls `jsonrpc::invoke_method`.
- The handler code itself did not show an explicit bearer-token check.
- `src/core/jsonrpc.rs` starts the Socket.IO layer by default unless disabled.

Risk:

If the Socket.IO route is not covered by the same Axum auth middleware as `/rpc`, it may provide an alternate unauthenticated path into JSON-RPC controller execution. Even if middleware currently protects it indirectly, the contract is implicit and easy to break.

Next safe work:

Add an integration test that attempts `rpc:request` without a token and with a wrong token. If the current path is protected, preserve that behavior in an explicit test. If it is not protected, require token validation during Socket.IO connect or per-event dispatch.

### R4 - Embedded-provider screen capture can fail open to native `getDisplayMedia`

Severity: high  
Area: embedded third-party webviews, screen privacy

Evidence:

- `app/src-tauri/src/webview_accounts/runtime.js` intercepts `navigator.mediaDevices.getDisplayMedia`.
- The shim attempts a native screen-share session, but falls back to the original `getDisplayMedia` when activation is missing, payloads are malformed, there are no sources, or the IPC path errors.
- `app/src-tauri/src/screen_capture/mod.rs` notes that without a picker, CEF may auto-select the primary display because the permission callback grants desktop capture.
- `app/src-tauri/permissions/allow-webview-recipe.toml` exposes screen-share commands to account webviews.

Risk:

The native screen-share wrapper adds useful controls, but the fallback means provider-controlled pages may still reach the browser's raw capture path. If CEF grants desktop capture without a safe picker, a blocked or malformed mediated flow can degrade into a less controlled capture flow.

Next safe work:

Fail closed for managed account webviews: when the OpenHuman screen-share shim is installed, do not call the original `getDisplayMedia` after native mediation fails. Add a targeted webview-runtime test or manual Browser/CEF regression script that triggers non-activation and malformed-payload paths.

### R5 - Screen-share session tokens are not cryptographically random

Severity: medium  
Area: IPC session authorization

Evidence:

- `app/src-tauri/src/screen_capture/mod.rs` creates session tokens from current time, an atomic counter, and thread ID hash.
- The module comments describe the token as a 128-bit session token and intentionally avoid a new random dependency.
- The same module already depends on sensitive session-scoped authorization for thumbnail and finalize calls.

Risk:

The current token has mitigating controls: account label, allowed source IDs, short TTL, and rate limiting. Still, a token guarding screen-capture thumbnails should not be guessable or derived from low-entropy local process state.

Next safe work:

Use an existing cryptographic RNG dependency already present in the Tauri or Rust dependency graph, or add one intentionally. Add a unit test for token uniqueness/format and keep the TTL/account checks.

### R6 - Credential-storage claims are stronger than the implementation observed

Severity: medium-high  
Area: credentials, documentation accuracy, user trust

Evidence:

- `README.md`, `SECURITY.md`, and `docs/ARCHITECTURE.md` claim OS keychain storage or no plaintext secret storage.
- `src/openhuman/security/secrets.rs` uses a file-backed `.secret_key` and ChaCha20-Poly1305 for current `enc2:` payloads, with legacy XOR migration and `encrypt = false` support.
- `src/openhuman/credentials/profiles.rs` stores profiles in `auth-profiles.json`.
- `docs/CREDENTIAL-PROXY-SPIKE.md` describes keychain work as future or spike work.
- `src/openhuman/config/schema/types.rs` includes `Config.api_key`.

Risk:

The implementation may be acceptable for local beta if documented accurately, but the public docs overstate the protection level. A local file-backed key next to encrypted profiles is materially different from OS keychain storage, and `encrypt = false` creates a plaintext mode.

Next safe work:

Either implement OS keychain-backed profile encryption or revise the docs and security model to state exactly what is stored, where the local key lives, what `encrypt = false` does, and which files must be protected by filesystem permissions.

### R7 - Provider-surface ingest path appears unauthenticated and stores raw payloads

Severity: medium-high  
Area: third-party data, provider webviews, RPC correctness

Evidence:

- `app/src-tauri/src/webview_accounts/mod.rs` posts provider surface events to `openhuman.provider_surfaces_ingest_event`.
- The helper builds an HTTP JSON-RPC request but did not show an Authorization header.
- The same code normalizes provider events while retaining `raw_payload` in the parameters.
- `src/core/auth.rs` requires bearer auth for `/rpc`.

Risk:

The path likely either fails under normal auth or relies on another hidden bypass. If it fails, provider-surface features may be unreliable. If it bypasses auth elsewhere, that is a security issue. Retaining raw provider payloads also increases PII retention risk for chat/email/meeting surfaces.

Next safe work:

Route provider-surface ingest through the authenticated core relay or an explicit native request path, and define a redaction/minimization contract for `raw_payload`. Add a focused test that proves the event reaches core with auth and that raw sensitive fields are not persisted by default.

### R8 - Broad Tauri permissions, CSP, and remote account webviews need a hardening pass

Severity: medium-high  
Area: desktop sandbox, embedded web content, IPC

Evidence:

- `app/src-tauri/tauri.conf.json` allows `'unsafe-inline'`, broad `https:`, `wss:`, `data:`, `blob:`, and loopback wildcard connect sources.
- `app/src-tauri/capabilities/default.json` allows core process, updater, opener, notification, deep-link, and window commands to main/overlay windows.
- `app/src-tauri/capabilities/webview-accounts.json` grants recipe permissions to remote origins across provider surfaces.
- `app/src-tauri/permissions/allow-core-process.toml` grants broad process/service/webview/screen-share commands.
- `app/src-tauri/entitlements.sidecar.plist` allows JIT, unsigned executable memory, disabled library validation, camera, microphone, and network server/client.

Risk:

This may be necessary for a CEF-heavy assistant, but the blast radius is high. Any XSS, provider-page injection, or compromised renderer has more useful IPC and entitlement surface than a narrow desktop shell would normally expose.

Next safe work:

Create an explicit capability threat model and shrink permissions by window label and provider purpose. Add regression checks that account webviews cannot call core-process commands and main windows cannot invoke screen-share recipe commands unless intended.

### R9 - Vendored Tauri/CEF submodules are required but uninitialized here

Severity: medium  
Area: build reproducibility, supply chain, validation

Evidence:

- `.gitmodules` declares `app/src-tauri/vendor/tauri-cef` and `app/src-tauri/vendor/tauri-plugin-notification`.
- `app/src-tauri/Cargo.toml` depends on those path crates.
- `git submodule status` showed both paths with leading `-`, meaning not initialized.
- `rg --files app/src-tauri/vendor` returned no vendored files in this worktree.

Risk:

Tauri validation cannot run in this worktree without initializing submodules. Also, the repo relies on forked Tauri/CEF code, which deserves periodic review because it carries browser, updater, notification, and sandbox implications.

Next safe work:

Add a bootstrap check that fails early with a clear message when submodules are missing. Add a dependency-surface work item to audit the fork deltas and pinned revisions against upstream Tauri/CEF security releases.

### R10 - Environment toggles can weaken safety if they leak outside dev

Severity: medium  
Area: configuration, debug flags, privacy

Evidence:

- `.env.example` includes `OPENHUMAN_BROWSER_ALLOW_ALL`, `OPENHUMAN_LOG_PROMPTS`, `OPENHUMAN_ANALYTICS_ENABLED=true`, `OPENHUMAN_CORE_REUSE_EXISTING`, `JWT_TOKEN`, `SKILLS_REGISTRY_URL`, and `SKILLS_LOCAL_DIR`.
- `app/.env.example` includes `VITE_DEV_JWT_TOKEN`.
- `app/src/utils/config.ts` exposes development toggles such as force onboarding and Sentry/debug settings.

Risk:

The variables are useful for development and testing, but several directly affect privacy, prompt logging, browser behavior, core process reuse, analytics, or auth. If included in packaged builds or copied into real deployments without guardrails, they can weaken user protections.

Next safe work:

Classify env vars into production, development-only, test-only, and dangerous-debug groups. Add release-time checks that reject dangerous-debug vars in packaged builds and update `.env.example` comments accordingly.

### R11 - Destructive process cleanup exists in desktop lifecycle code

Severity: medium  
Area: local process management

Evidence:

- `app/src-tauri/src/lib.rs` performs child-process cleanup and uses process termination on shutdown.
- `app/src-tauri/src/core_process.rs` can terminate stale listeners after fingerprint checks and includes a reuse-existing override.
- `app/src-tauri/src/cef_preflight.rs` recommends `pkill` commands for CEF lock recovery.

Risk:

The current code appears to guard stale listener cleanup with an OpenHuman fingerprint check, which is good. Still, desktop shutdown and CEF recovery behavior can kill the wrong process if labels, PIDs, or lock detection are stale or if future edits remove guardrails.

Next safe work:

Add tests around stale-listener fingerprint handling and document the process-kill safety contract. Keep CEF preflight cleanup messages precise and avoid broad kill suggestions where possible.

### R12 - Updater and signing assumptions need a release audit

Severity: medium  
Area: distribution, updater, release provenance

Evidence:

- `app/src-tauri/tauri.conf.json` enables the updater and points at a GitHub-hosted `latest.json`.
- `app/src-tauri/Cargo.toml` enables the Tauri updater plugin.
- The Tauri config includes updater public-key material.
- Packaging scripts and release workflows were outside the deep-read path for this risk-register item.

Risk:

The updater may be configured correctly, but this audit did not prove the release pipeline signs every published artifact, protects private signing keys, rejects unsigned updates, or aligns updater channels with staging/production app envs.

Next safe work:

Run a focused release/update audit that traces artifact generation, signing, `latest.json`, GitHub release permissions, and updater verification failure modes.

## Stale or Unsupported Assumptions

1. Credential storage is documented as OS keychain or no plaintext secret storage, but the observed implementation is a file-backed encrypted profile store with a local `.secret_key`, a legacy XOR migration path, and a configurable plaintext mode.
2. Architecture docs mention an AI memory system with AES-256-GCM, Argon2id, OpenAI embeddings, and Neo4j REST. The security evidence in this pass centered on the implemented `SecretStore`; the docs need a proof pass before those memory claims are treated as current.
3. The docs and scripts still carry sidecar-era language, while `app/package.json` says `core:stage` is a no-op because the core is linked in-process after PR #1061.
4. Product docs mention Telegram and provider integrations in several places even though project-level guidance says Telegram is not an active provider in the app's current provider chain. The embedded webview provider list still includes Telegram surfaces.
5. The provider-surface ingest code appears to post to `/rpc` without auth while the core auth layer protects `/rpc`; either the feature is currently broken or the real path differs from the code comments.
6. The screen-share token comment says 128-bit token, but token construction is deterministic from process-local inputs rather than a cryptographic RNG.
7. The repo assumes vendored Tauri/CEF path dependencies exist, but this worktree has uninitialized submodules.

## Validation Map

Required queue validation:

| Command | Expected status | Notes |
| --- | --- | --- |
| `git status --short` | Pass | Required by the queue item. Before this report, the worktree was clean. After committing this report, it should be clean again. |

Useful next validation candidates:

| Command | Expected status | What it proves |
| --- | --- | --- |
| `git submodule status` | Attention/fail in this worktree | Current observation has leading `-` on Tauri vendor submodules, so Tauri validation is not ready. |
| `rg --files app/src-tauri/vendor` | Attention/fail in this worktree | Confirms vendored path dependencies are absent until submodules are initialized. |
| `cargo check --manifest-path app/src-tauri/Cargo.toml` | Expected fail/blocker until submodules are initialized | Proves the Tauri shell and vendored dependency surface compile. |
| `cargo test --manifest-path Cargo.toml core::auth core::jsonrpc` | Expected pass if Rust deps are available | Proves bearer-token and public-path tests still compile and run. |
| `cargo test --manifest-path Cargo.toml --test json_rpc_e2e rpc_rejects_wrong_token public_paths_accessible_without_token` | Expected pass if mock/test prerequisites are available | Proves JSON-RPC auth behavior over the real HTTP surface. |
| `pnpm --filter openhuman-app compile` | Expected pass after Node `>=24`, pnpm deps, and generated prerequisites are present | Proves the React/Tauri frontend type surface compiles. |
| `pnpm --filter openhuman-app test -- src/services/coreRpcClient.test.ts` | Expected pass after adding/adjusting tests for R1 | Proves bearer token is not attached to non-loopback or rejected RPC URLs. |
| `rg -n "keyring|keychain" Cargo.toml app/src-tauri/Cargo.toml src docs SECURITY.md README.md` | Expected mismatch until docs or implementation are aligned | Proves current docs/implementation credential-storage claims. |

Validation not run in this audit:

- No network-dependent commands.
- No dependency installation.
- No Tauri build or cargo check, because submodules are absent in this worktree and this queue item is read-only product audit.
- No browser, deploy, updater, or external service checks.

## Independently Grabbable Next Tasks

### Task 1 - Prevent core RPC token egress to non-loopback origins

Acceptance criteria:

- Desktop `coreRpcClient` does not attach the Tauri core bearer token to a persisted RPC URL unless the URL is loopback and matches the shell-approved origin policy.
- Persisted RPC URL validation rejects remote origins in desktop mode or stores them as unauthenticated development-only endpoints.
- Unit tests cover local default URL, loopback override, remote HTTPS override, malformed URL, and localStorage tampering.

Validation command:

- `pnpm --filter openhuman-app test -- src/services/coreRpcClient.test.ts src/utils/configPersistence.test.ts`

### Task 2 - Prove and harden realtime/public core auth boundaries

Acceptance criteria:

- Tests prove unauthorized Socket.IO `rpc:request` cannot invoke controller logic.
- `/ws/dictation`, `/events`, and `/events/webhooks` have an explicit policy for loopback vs non-loopback binds.
- Docker/non-loopback serve mode either requires auth on these routes or fails startup unless a documented public-mode flag is set.

Validation command:

- `cargo test --manifest-path Cargo.toml core::auth core::jsonrpc`
- Add a targeted integration command for Socket.IO once the harness exists.

### Task 3 - Fail closed for embedded webview screen capture

Acceptance criteria:

- Account webview `getDisplayMedia` mediation never falls back to raw native `getDisplayMedia` after missing activation, malformed payload, denied source, or IPC error.
- Session tokens use cryptographic randomness.
- Tests or a reproducible manual script cover no-activation, stale-token, wrong-label, and expired-token cases.

Validation command:

- `cargo test --manifest-path app/src-tauri/Cargo.toml screen_capture`
- Add a focused frontend/runtime test if the project has a JS harness for `runtime.js`.

### Task 4 - Align credential-storage docs with implementation or implement keychain backing

Acceptance criteria:

- A single security doc states where session tokens, integration tokens, config API keys, local encryption keys, and active user IDs are stored.
- Docs no longer claim OS keychain storage unless the implementation uses it.
- Tests or inspection commands prove config/profile file permissions and encrypted/plaintext modes.

Validation command:

- `cargo test --manifest-path Cargo.toml credentials security config`
- `rg -n "OS keychain|keyring|plaintext|auth-profiles|secret_key" README.md SECURITY.md docs src/openhuman`

### Task 5 - Fix provider-surface ingest auth and data minimization

Acceptance criteria:

- Provider surface events use an authenticated core path or a native in-process request path.
- Persisted/evented provider payloads exclude raw provider messages unless a documented debug flag is set.
- Tests prove a sample LinkedIn or Meet event reaches core and does not retain raw sensitive payloads by default.

Validation command:

- `cargo test --manifest-path Cargo.toml provider_surfaces`
- Add the smallest app/Tauri test available for `webview_recipe_event` to ingest path dispatch.

### Task 6 - Add a bootstrap validation for vendored Tauri dependencies

Acceptance criteria:

- A documented command fails fast when `app/src-tauri/vendor/tauri-cef` or `app/src-tauri/vendor/tauri-plugin-notification` is missing.
- The failure message tells developers to initialize submodules and rerun the correct validation.
- CI or preflight catches the missing-submodule state before long cargo output.

Validation command:

- `git submodule status`
- `cargo check --manifest-path app/src-tauri/Cargo.toml`

## Non-Goals

- No product code changes.
- No generated code changes.
- No dependency updates.
- No submodule initialization.
- No secrets inspection.
- No external service calls.
- No deploys, pushes, PR creation, or tracker state changes.
- No claim that unrun validation commands pass.

## Unknowns and Blockers

- The local issue file `items/openhuman-sym85-risk-register/ISSUE.md` is missing.
- Tauri validation is blocked in this worktree until vendor submodules are initialized.
- Socket.IO auth status needs a targeted integration proof. The handler code itself lacks an obvious token check, but route-level middleware may still protect it.
- Updater signing and release workflow were not traced in this risk-register pass.
- Provider-surface persistence behavior needs a deeper read of `provider_surfaces` domain storage before making exact data-retention claims.
- Memory-system encryption and Neo4j/OpenAI embedding claims in docs need their own docs-claims or architecture-map audit.

## Handoff Notes

This report identifies concrete risk areas without changing product code. The highest-leverage follow-up is Task 1, because a localStorage-controlled RPC URL plus bearer-token attachment is a crisp boundary issue with a small expected code and test footprint. Task 2 should follow closely because Docker/non-loopback serve mode changes the practical exposure of public routes.

No PR was created. No external tracker was updated. No external credentials were used.
