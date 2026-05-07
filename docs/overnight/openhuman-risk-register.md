# OpenHuman Risk Register Audit

Queue item: `openhuman-risk-register`  
Audit date: 2026-05-07  
Repo path: `/Users/jwalinshah/projects/agent-stack/.agent-stack-worktrees/2026-05-07-overnight-marathon/openhuman-risk-register`  
Focus area: risk register

## Scope

This was a read-only audit of security, credentials, data, deployment,
destructive-command, tool-permission, and external-service risks. The only
workspace mutation intended by this queue item is this report file.

Non-goals:

- No product code changes.
- No generated data changes.
- No secrets, credentials, external services, deploys, pushes, merges, or PRs.
- No dependency upgrades or vulnerability database lookups.
- No attempt to validate every claim by running the desktop app.

## Repo Purpose And State

OpenHuman is a desktop-first assistant for communities. The repo combines:

- React/Vite UI in `app/src/`.
- Tauri v2 desktop shell in `app/src-tauri/`.
- Rust core library and CLI in root `src/`.
- Core JSON-RPC, agent/tool runtime, credentials, memory, channels, skills, and
  backend integration clients in `src/openhuman/`.

Observed state:

- `git branch --show-current`: `codex/goal-openhuman-risk-register`
- `git rev-parse --short HEAD`: `f11f2178`
- Initial `git status --short`: clean, no output.
- Final required validation `git status --short`: `?? docs/overnight/`.
- Required issue file observation: `rtk read items/openhuman-risk-register/ISSUE.md`
  failed with `No such file or directory`; this report uses the issue text from
  the queue prompt as the work order.
- `llm-tldr tree .` showed the expected multi-surface repo: `app/`, root
  `src/`, `tests/`, `docs/`, `.github/workflows/`, `Cargo.toml`, and
  package manifests.

## Commands Run

- `git branch --show-current`
- `git rev-parse --short HEAD`
- `git status --short`
- `llm-tldr tree .`
- `rtk read items/openhuman-risk-register/ISSUE.md`
- `rtk read package.json`
- `rtk read app/package.json`
- `rtk read .env.example`
- `rtk read app/.env.example`
- `rtk read SECURITY.md`
- `rtk read README.md`
- `rtk read Dockerfile`
- `rtk read app/src-tauri/tauri.conf.json`
- `fd . app/src-tauri/capabilities app/src-tauri/permissions -t f`
- `rtk read app/src-tauri/capabilities/default.json`
- `rtk read app/src-tauri/capabilities/webview-accounts.json`
- `rtk read app/src-tauri/permissions/allow-core-process.toml`
- `rtk read app/src-tauri/permissions/allow-webview-recipe.toml`
- `rtk read app/src-tauri/permissions/allow-app-update.toml`
- `rg -n "OPENHUMAN_CORE_TOKEN|Authorization|Bearer|core_rpc_token|..." .`
- `rg -n "JWT_TOKEN|VITE_DEV_JWT_TOKEN|localStorage|encrypt|decrypt" .`
- `rg -n "rm -rf|remove_dir|kill|pkill|sudo|curl .*| bash|iex" .`
- `rtk read src/core/auth.rs`
- `rtk read src/core/jsonrpc.rs`
- `rtk read app/src-tauri/src/core_process.rs`
- `rtk read app/src-tauri/src/core_rpc.rs`
- `rtk read app/src-tauri/src/webview_apis/mod.rs`
- `rtk read app/src-tauri/src/webview_apis/server.rs`
- `rtk read app/src-tauri/src/webview_apis/router.rs`
- `rtk read src/openhuman/credentials/ops.rs`
- `rtk read src/openhuman/credentials/core.rs`
- `rtk read src/openhuman/credentials/profiles.rs`
- `rtk read src/openhuman/security/secrets.rs`
- `rtk read src/openhuman/config/schema/tools.rs`
- `rtk read src/openhuman/config/schema/types.rs`
- `rtk read src/openhuman/config/schema/load.rs`
- `rtk read app/src/services/coreRpcClient.ts`
- `rtk read app/src/utils/configPersistence.ts`
- `rtk read app/src/services/apiClient.ts`
- `rtk read app/src/store/index.ts`
- `rtk read app/src/store/userScopedStorage.ts`
- `rtk read app/src/utils/sanitize.ts`
- `rtk read src/openhuman/skills/README.md`
- `rtk read src/openhuman/skills/schemas.rs`
- `rtk read src/openhuman/skills/ops_install.rs`
- `rtk read src/openhuman/skills/ops_discover.rs`
- `rtk read src/openhuman/skills/ops_types.rs`
- `rtk read src/openhuman/skills/inject.rs`
- `rtk read src/openhuman/security/policy.rs`
- `rtk read src/openhuman/tools/traits.rs`
- `rtk read src/openhuman/tools/ops.rs`
- `rtk read src/openhuman/tools/impl/system/node_exec.rs`
- `rtk read src/openhuman/tools/impl/system/npm_exec.rs`
- `rtk read src/openhuman/tools/impl/network/http_request.rs`
- `rtk read src/openhuman/tools/impl/network/curl.rs`
- `rtk read src/openhuman/tools/impl/network/url_guard.rs`
- `rtk read app/scripts/e2e-run-spec.sh`
- `rtk read app/src-tauri/src/screen_capture/mod.rs`
- `rtk read app/src-tauri/src/cef_profile.rs`
- `fd . .github/workflows -t f`
- `rtk read .github/workflows/coverage.yml`
- `rtk read .github/workflows/pr-quality.yml`

## Evidence Map

The audit did not stop at top-level docs. These are the main local evidence
points that support the register below:

| Evidence | Observation |
| --- | --- |
| `package.json` | Root scripts delegate build, lint, typecheck, Rust tests, coverage, mock API, debug runners, and review commands. |
| `app/package.json` | App workspace requires Node `>=24.0.0`; `core:stage` now says sidecar removed and core is linked in-process. |
| `.env.example` | Defaults include staging backend URL, optional `JWT_TOKEN`, core RPC host/port/token, workspace override, web search, proxy, Sentry, and local AI binary knobs. |
| `app/.env.example` | Frontend core RPC URL fallback is localhost, but runtime precedence allows stored login-screen URL before Tauri-provided URL. |
| `SECURITY.md` | Claims OS-level credential storage and no plaintext secrets, which does not match the inspected `SecretStore` file-key implementation. |
| `README.md` | Claims local encrypted workflow data, local KB, local model, and curl/powershell install pipes. Several claims need tighter wording against current code. |
| `Dockerfile` | Runtime sets `OPENHUMAN_CORE_HOST=0.0.0.0`, exposes `7788`, and healthchecks `/health`. |
| `src/core/auth.rs` | Bearer auth is generated or taken from `OPENHUMAN_CORE_TOKEN`, but public paths include `/`, `/health`, `/schema`, `/events`, `/events/webhooks`, and `/ws/dictation`. |
| `src/core/jsonrpc.rs` | CORS allows `*`; JSON-RPC auth middleware bypasses public paths; `/ws/dictation` and `/events` are exposed routes. |
| `app/src-tauri/tauri.conf.json` | CSP allows `'unsafe-inline'`, `https:`, `wss:`, broad localhost, `data:`, `blob:`, and updater metadata. |
| `app/src-tauri/capabilities/webview-accounts.json` | Account webviews allow many remote origins, including messaging and identity providers, under a constrained but sensitive permission set. |
| `app/src-tauri/permissions/allow-core-process.toml` | Main app permissions cover core RPC/token commands, service management, webview account operations, screen share, and Gmail/LinkedIn CDP helpers. |
| `app/src/utils/configPersistence.ts` | Stored RPC URL accepts any `http:` or `https:` URL, not just loopback. |
| `app/src/services/coreRpcClient.ts` | Stored RPC URL is preferred before Tauri `core_rpc_url`; the Tauri `core_rpc_token` is attached as a bearer token to whichever URL is selected. |
| `app/src/services/apiClient.ts` | The API client logs request URL, headers, body, and method; headers include `Authorization` when a token exists. |
| `app/src/utils/sanitize.ts` | Sanitizers for auth/token/password-like keys exist, but `apiClient` does not use them for request logging. |
| `src/openhuman/security/secrets.rs` | Secrets use ChaCha20-Poly1305 with a local `.secret_key` file, Unix 0600 when possible, and optional plaintext mode if encryption is disabled. |
| `src/openhuman/credentials/profiles.rs` | Auth profiles encrypt token fields before writing `auth-profiles.json`; the profile file mode itself is not visibly pinned the way `.secret_key` is. |
| `src/openhuman/skills/ops_install.rs` | Remote skill install validates public HTTPS/Markdown/size, but comments document a DNS rebinding gap and global installs land under user OpenHuman skills. |
| `src/openhuman/skills/inject.rs` | Matched SKILL.md bodies are injected into the user turn, capped at 8 KiB. |
| `src/openhuman/tools/traits.rs` | `Tool::permission_level` defaults to `ReadOnly`; comments say channel caps reject tools above the configured max. |
| `src/openhuman/tools/impl/system/node_exec.rs` | Executes JavaScript through Node, can download/extract a managed Node runtime, and has no explicit `permission_level` override. |
| `src/openhuman/tools/impl/system/npm_exec.rs` | Executes npm subcommands with some blocked registry/auth verbs, and has no explicit `permission_level` override. |
| `src/openhuman/tools/impl/network/http_request.rs` | Supports GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS and has no explicit `permission_level` override. |
| `src/openhuman/tools/impl/network/url_guard.rs` | Blocks literal private/local hosts and requires allowlist domains, but does not resolve DNS before dispatch. |
| `app/src-tauri/src/webview_apis/mod.rs` | Local WebSocket bridge is explicitly permissive for loopback; current router returns unknown method for all methods. |
| `app/src-tauri/src/screen_capture/mod.rs` | Screen share flow has explicit session gating, user activation, account-webview label checks, 30s TTL, and rate limiting. |
| `app/src-tauri/src/cef_profile.rs` | CEF profile purge has path validation and tests that retain malicious queued paths rather than deleting them. |
| `app/scripts/e2e-run-spec.sh` | E2E runner kills OpenHuman and removes app support/cache directories; useful for isolation, risky if run outside test context. |
| `.github/workflows/coverage.yml` | CI coverage gate enforces diff coverage >=80% across Vitest, Rust core, and Tauri coverage. |
| `.github/workflows/pr-quality.yml` | Checklist, coverage matrix, and link check are currently soft `continue-on-error` jobs. |

## Risk Register

### R1: Frontend request logging can expose bearer tokens and request bodies

Risk: `app/src/services/apiClient.ts` logs the full `headers` and `body` object
for every request. When `authToken` is present, `headers.Authorization` contains
`Bearer <token>`. Bodies may also contain profile, channel, integration, or user
content.

Evidence:

- `app/src/services/apiClient.ts` builds `Authorization` and then logs `{ url,
  headers, body, method }`.
- `app/src/utils/sanitize.ts` has sanitizers for sensitive fields, but the API
  client does not use them.
- `src/main.rs` has Sentry scrubbing patterns, but console/devtool logging is a
  separate sink.

Impact: Tokens and private payloads can appear in browser devtools, captured
logs, remote support screenshots, or diagnostics. This undermines the privacy
claims in `README.md` and `SECURITY.md`.

Next safe work:

- Remove the log or gate it behind explicit dev-only debug logging.
- Redact `authorization`, `token`, `secret`, `password`, cookies, and request
  bodies by default.
- Add a Vitest that spies on `console.log` and proves Authorization is never
  emitted.

Validation candidate: `pnpm --filter openhuman-app test -- src/services` after
adding a targeted test. Expected status after fix: pass.

### R2: Persisted core RPC URL can redirect desktop bearer token to a non-local server

Risk: The renderer accepts a stored RPC URL with any `http:` or `https:` scheme.
In Tauri mode, `coreRpcClient` chooses that stored URL before asking Tauri for
the actual local core URL, then attaches the Tauri-provided core RPC bearer token
to the selected URL.

Evidence:

- `app/src/utils/configPersistence.ts` validates only URL scheme and stores
  `openhuman_core_rpc_url` in `localStorage`.
- `app/src/services/coreRpcClient.ts` checks `getStoredRpcUrl()` before
  `invoke('core_rpc_url')`.
- `app/src/services/coreRpcClient.ts` retrieves `core_rpc_token` from Tauri and
  sends it as `Authorization: Bearer ...`.
- `app/src-tauri/permissions/allow-core-process.toml` permits `core_rpc_token`
  to the main app window.

Impact: Any XSS, malicious extension, debugging script, or corrupted local
storage entry that changes the stored RPC URL can cause future RPC calls to send
the local core token and RPC payloads to an attacker-controlled endpoint.

Next safe work:

- In Tauri builds, prefer the Tauri `core_rpc_url` over stored values or reject
  stored non-loopback RPC URLs.
- Never attach the local core token to a remote/non-loopback URL.
- Add a regression test for the URL precedence and token attachment behavior.

Validation candidate: `pnpm --filter openhuman-app test -- src/services/coreRpcClient.test.ts src/utils/configPersistence.test.ts`.
Expected status after fix: pass, with test names proving non-loopback stored
URLs are rejected or tokenless.

### R3: Docker binds core to 0.0.0.0 while several routes are public

Risk: The Docker image exposes the core server on all interfaces. Auth protects
most JSON-RPC routes, but public paths include schema, events, webhook events,
and dictation WebSocket routes.

Evidence:

- `Dockerfile` sets `OPENHUMAN_CORE_HOST=0.0.0.0` and `EXPOSE 7788`.
- `src/core/auth.rs` defines public paths including `/schema`, `/events`,
  `/events/webhooks`, and `/ws/dictation`.
- `src/core/jsonrpc.rs` serves those routes and uses `Access-Control-Allow-Origin: *`.
- `src/core/jsonrpc.rs` only defaults host to `127.0.0.1` when the env override
  is absent.

Impact: A container deployed with default networking or port publishing can
expose unauthenticated metadata and streaming endpoints outside the local
desktop threat model. `/schema` leaks available controller names and parameter
shapes; `/ws/dictation` is particularly sensitive if voice streaming becomes
usable without additional gates.

Next safe work:

- Gate non-health public routes when `OPENHUMAN_CORE_HOST` is non-loopback
  unless an explicit development flag is set.
- Split public-health behavior from local-desktop convenience behavior.
- Add integration tests for public route auth behavior under loopback and
  non-loopback host settings.

Validation candidate: `cargo test --manifest-path Cargo.toml core::auth jsonrpc`.
Expected status after fix: pass. Current exact filter may need adjustment to
the module names used by the test suite.

### R4: Tauri CSP and account-webview permissions are broad for a security-sensitive desktop app

Risk: The main Tauri CSP permits inline script, broad `https:`/`wss:`, data/blob,
and localhost origins. Account webviews intentionally load remote messaging and
identity providers and receive recipe/screen-share permissions.

Evidence:

- `app/src-tauri/tauri.conf.json` uses a broad CSP with `'unsafe-inline'`,
  `https:`, `wss:`, `data:`, `blob:`, and wildcard localhost ports.
- `app/src-tauri/capabilities/webview-accounts.json` allows remote account
  origins for WhatsApp, Telegram, LinkedIn, Gmail, Slack, Discord, Meet,
  Google accounts, and browserscan.
- `app/src-tauri/permissions/allow-webview-recipe.toml` grants
  `webview_recipe_event` and screen-share commands.
- `app/src-tauri/src/screen_capture/mod.rs` shows previous drive-by thumbnail
  enumeration was recognized and mitigated with session gating.

Impact: The app has real remote-content and local-bridge surfaces. The current
screen-share code has strong gating, but the broad CSP and account-webview
allowlist increase the blast radius of any injection in the main renderer,
remote account page, recipe shim, or future bridge method.

Next safe work:

- Produce a window-by-window capability/CSP threat model.
- Narrow the main CSP where possible and document each remaining allowance.
- Add tests or static checks that account-webview capabilities do not gain
  unrelated main-window permissions.

Validation candidate: `cargo test --manifest-path app/src-tauri/Cargo.toml screen_capture cef_profile`.
Expected status after targeted additions: pass.

### R5: Remote SKILL.md install is a prompt-injection and provenance surface

Risk: Remote skills are not code-executed in the inspected module, but their
Markdown bodies are installed and later injected into model context. The
installer has useful URL, size, and path guards, but provenance and DNS-rebinding
mitigations are incomplete.

Evidence:

- `src/openhuman/skills/ops_install.rs` accepts public HTTPS Markdown URLs,
  normalizes GitHub blob URLs, limits content size, rejects private resolved
  IPs, and writes `SKILL.md` under the user's OpenHuman skills directory.
- The same file documents a DNS rebinding gap because `reqwest` performs its
  own lookup after the preflight lookup.
- `src/openhuman/skills/inject.rs` matches skills and injects up to 8 KiB of
  skill body into the user turn.
- `src/openhuman/skills/ops_types.rs` makes project skills require a trust
  marker, but global user skills remain broadly available once installed.

Impact: A malicious or compromised remote skill can persist prompt instructions
that shape future agent behavior. The direct code-execution risk is lower than a
plugin runtime, but prompt-injection persistence is still a security boundary
for an agentic desktop app.

Next safe work:

- Require explicit user confirmation that distinguishes global prompt skills
  from project-trusted skills.
- Store origin/provenance metadata and show it in skill list output.
- Replace preflight DNS checks with a pinned resolver/client path or remove
  claims that private IPs are fully blocked against rebinding.

Validation candidate: `cargo test --manifest-path Cargo.toml skills::`.
Expected status after targeted tests: pass.

### R6: Tool permission metadata is stale for process and network action tools

Risk: Several tools rely on the default `ReadOnly` permission metadata despite
performing process execution or non-read network actions. Even if current
execution paths are additionally gated by `SecurityPolicy`, the metadata is
load-bearing for tool visibility, documentation, and future channel caps.

Evidence:

- `src/openhuman/tools/traits.rs` defaults `Tool::permission_level()` to
  `PermissionLevel::ReadOnly` and comments say channels with a lower maximum
  permission level reject higher-permission tools.
- `src/openhuman/tools/impl/system/node_exec.rs` executes Node/inline JS and
  has no explicit `permission_level` override.
- `src/openhuman/tools/impl/system/npm_exec.rs` executes npm subcommands and
  has no explicit `permission_level` override.
- `src/openhuman/tools/impl/network/http_request.rs` supports POST, PUT,
  DELETE, PATCH, HEAD, and OPTIONS and has no explicit `permission_level`
  override.
- `src/openhuman/tools/impl/network/curl.rs` explicitly returns `Write`,
  showing the local pattern for overriding.

Impact: UIs, agent definitions, or future channel permission checks can treat
execution and mutating network tools as read-only. That is especially risky for
read-only agents and external chat channels.

Next safe work:

- Set `node_exec` and `npm_exec` to `Execute`.
- Split `http_request` into read-only GET/HEAD and write-level mutating methods
  or conservatively mark it `Write`.
- Add metadata tests next to each tool.

Validation candidate: `cargo test --manifest-path Cargo.toml node_exec npm_exec http_request`.
Expected status after fix: pass with explicit permission-level assertions.

### R7: Network URL guard blocks literal private hosts but not DNS-to-private resolution

Risk: Network tools validate host strings against local/private literal hosts
and allowed domains, but do not resolve the final target IP before request
dispatch. A public-looking allowlisted domain can resolve to private network
addresses.

Evidence:

- `src/openhuman/tools/impl/network/url_guard.rs` validates scheme, userinfo,
  IPv6 literal shape, local/private literal hosts, and allowlist membership.
- The URL guard tests cover alternate literal notations and local/private IP
  literals.
- `src/openhuman/tools/impl/network/http_request.rs` builds a regular reqwest
  client after URL validation.
- `src/openhuman/tools/impl/network/curl.rs` shares the same URL guard.
- `src/openhuman/skills/ops_install.rs` separately performs DNS/IP checks and
  documents the rebinding caveat, which highlights that network tools do not
  have equivalent protection.

Impact: When `http_request.allowed_domains` is configured for a domain under
attacker control or a compromised domain, tools can SSRF local services, cloud
metadata, or internal infrastructure that resolves behind the name.

Next safe work:

- Reuse or extract a DNS-to-IP guard for all outbound network tools.
- Consider HTTPS-only by default for tools that send headers or bodies.
- Add tests with a fake resolver that returns private IPs for allowed public
  hostnames.

Validation candidate: `cargo test --manifest-path Cargo.toml url_guard http_request curl`.
Expected status after fix: pass.

### R8: Local webview API bridge is unauthenticated by design and currently empty

Risk: The local WebSocket bridge accepts loopback connections without auth. The
current router returns unknown method for all methods, so there is no active
method-level exploit in the inspected code, but this is a future footgun.

Evidence:

- `app/src-tauri/src/webview_apis/mod.rs` says the server is permissive,
  accepts any loopback connection, and does not authenticate.
- `app/src-tauri/src/webview_apis/server.rs` binds to `127.0.0.1` on an
  ephemeral or configured port.
- `app/src-tauri/src/webview_apis/router.rs` currently returns
  `unknown webview_apis method`.

Impact: If future methods are added without per-session tokens, origin binding,
or capability checks, any local process or browser page able to reach loopback
can call them.

Next safe work:

- Add an auth/session token before registering any mutating bridge methods.
- Add a compile-time or unit-test guard that fails when methods are added
  without documenting auth.
- Keep the port ephemeral and do not expose it through broad UI surfaces.

Validation candidate: `cargo test --manifest-path app/src-tauri/Cargo.toml webview_apis`.
Expected status after adding tests: pass.

### R9: Documentation claims are stronger than current credential and skills evidence

Risk: User-facing and agent-facing docs make claims that do not align with the
current implementation.

Evidence:

- `SECURITY.md` says desktop uses OS-level credential storage and no plaintext
  secrets.
- `src/openhuman/security/secrets.rs` uses a local `.secret_key` file and can
  return plaintext if `secrets.encrypt = false`.
- `README.md` claims workflow data is encrypted locally and the app has a local
  AI model and local KB; code supports local storage, but some defaults point to
  staging backend and backend-proxied integrations.
- Project `AGENTS.md` mentions QuickJS runtime files like `qjs_skill_instance.rs`
  and `qjs_engine.rs`, but `src/openhuman/skills/` currently describes SKILL.md
  discovery/injection and no such files were present in that directory.
- `app/package.json` says sidecar removed and core is linked in-process, while
  several docs still talk in sidecar terms.

Impact: Over-strong claims increase security-review risk and can cause agents to
implement against stale architecture assumptions.

Next safe work:

- Update `SECURITY.md` to accurately describe local file-key encryption,
  optional plaintext mode, and platform-specific limitations.
- Update skills/runtime docs to separate prompt skills from executable runtime
  components.
- Update sidecar/in-process wording where it affects operational setup.

Validation candidate: `pnpm --filter openhuman-app format:check` plus markdown
link check if docs are edited. Expected status: pass; `.github/workflows/pr-quality.yml`
currently treats link check as soft.

### R10: E2E cleanup scripts are intentionally destructive outside the workspace

Risk: Test scripts clean app state from user home directories and kill running
OpenHuman instances. This is useful for deterministic E2E runs, but dangerous
outside a dedicated test profile.

Evidence:

- `app/scripts/e2e-run-spec.sh` calls `pkill -f "OpenHuman"` on macOS.
- The same script removes `~/Library/WebKit/com.openhuman.app`,
  `~/Library/Caches/com.openhuman.app`, `~/Library/Application Support/com.openhuman.app`,
  and Linux app data/cache/config paths.
- The script writes and restores `~/.openhuman/config.toml` to force mock API
  URL because Appium-launched apps do not inherit environment variables.
- `app/src-tauri/src/cef_profile.rs` has stronger purge validation for queued
  CEF profile deletion, showing a safer pattern.

Impact: Running E2E commands on a developer's real profile can destroy local
app state or interrupt a running production-like app session.

Next safe work:

- Add an explicit `OPENHUMAN_E2E_CONFIRM_DESTRUCTIVE=1` gate or a dry-run mode
  before deleting home-directory state.
- Prefer test-specific app IDs or profile paths where possible.
- Document the destructive cleanup in `docs/E2E-TESTING.md`.

Validation candidate: `bash -n app/scripts/e2e-run-spec.sh` and one E2E dry-run
if implemented. Expected status: pass.

### R11: User/workspace isolation is sophisticated but fragile

Risk: User-scoped storage, active-user workspace selection, pre-login cleanup,
and CEF profile isolation rely on multiple components staying aligned.

Evidence:

- `src/openhuman/config/schema/load.rs` lets `OPENHUMAN_WORKSPACE` redirect the
  root, then resolves active-user and active-workspace markers.
- `src/openhuman/credentials/ops.rs` activates a user-scoped directory and
  purges pre-login conversations on first activation.
- `app/src/store/userScopedStorage.ts` blocks persisted Redux reads/writes until
  the active user is primed and migrates legacy `persist:*` keys to a first
  active user.
- `app/src/providers/CoreStateProvider.tsx` coordinates identity flips,
  storage reconfiguration, socket disconnects, session token storage, and memory
  token sync.
- `app/src-tauri/src/cef_profile.rs` isolates CEF cache under
  `users/<id>/cef` and purges stale pre-login CEF state.

Impact: A missed transition can leak Redux state, CEF cookies, conversations,
or tokens between the pre-login profile and a real user, or between users.

Next safe work:

- Add E2E coverage for identity switching and sign-out/sign-in with two users.
- Add a unit/integration test that verifies no legacy `persist:*` keys are read
  while signed out.
- Keep active-user markers and frontend storage key behavior documented in one
  architecture note.

Validation candidate: targeted Vitest for `userScopedStorage` plus one E2E
identity-switch spec. Expected status after tests: pass.

### R12: Auth profile encryption has key protection but file-mode details need verification

Risk: Token fields are encrypted before `auth-profiles.json` is written, but the
profile file's permissions are not visibly pinned the same way the `.secret_key`
file is. On platforms or filesystems with permissive defaults, encrypted token
metadata and ciphertext may be broadly readable.

Evidence:

- `src/openhuman/security/secrets.rs` sets Unix mode `0600` for `.secret_key`
  and attempts Windows ACL tightening.
- `src/openhuman/credentials/profiles.rs` writes `auth-profiles.json` through a
  temp file and rename path after encrypting token fields.
- The inspected profile store code did not show an explicit `0600` mode or
  equivalent ACL call for `auth-profiles.json`.

Impact: The strongest secret remains the key file, but world/group-readable
profile ciphertext and metadata can still leak account identifiers, provider
names, and encrypted token blobs. If key permissions fail, the profile file is
the paired artifact an attacker needs.

Next safe work:

- Add file-permission hardening for `auth-profiles.json` and temp files.
- Add Unix tests for mode `0600` and Windows ACL smoke tests where practical.
- Document what metadata remains unencrypted.

Validation candidate: `cargo test --manifest-path Cargo.toml credentials::profiles security::secrets`.
Expected status after tests: pass.

## Validation Map

Required queue validation:

- Command: `git status --short`
- Expected status: command succeeds.
- Observed output after this report was written: `?? docs/overnight/`, because
  the new `docs/overnight/` directory is untracked and contains this report.

Additional validation candidates for future implementation tasks:

| Candidate | Scope | Expected status |
| --- | --- | --- |
| `pnpm --filter openhuman-app test -- src/services` | Frontend API client and core RPC tests after redaction/RPC URL changes | Pass after tests are added or updated |
| `pnpm --filter openhuman-app compile` | TypeScript compile after frontend security changes | Pass |
| `cargo test --manifest-path Cargo.toml node_exec npm_exec http_request` | Tool permission metadata and tool behavior tests | Pass after targeted tests exist |
| `cargo test --manifest-path Cargo.toml url_guard http_request curl` | SSRF/DNS guard changes | Pass after fake resolver tests exist |
| `cargo test --manifest-path Cargo.toml skills::` | Remote skill install/injection trust changes | Pass after targeted tests exist |
| `cargo test --manifest-path app/src-tauri/Cargo.toml screen_capture cef_profile` | Tauri screen-share and profile purge regressions | Pass in a Rust/Tauri-ready environment |
| `pnpm test:coverage` | Full frontend changed-line coverage gate | Expected pass before merging product changes; not run for this read-only audit |
| `pnpm test:rust` | Full Rust core/Tauri test path through mock backend | Expected pass before merging Rust changes; not run for this read-only audit |

Known validation gaps:

- Full tests were intentionally not run for this audit because the queue item
  validation is `git status --short` and product behavior was not changed.
- No external dependency advisory or CVE check was run because network and
  external services are out of scope.
- No desktop app session was launched, so runtime-only behavior remains inferred
  from code paths and tests.

## Next Independently Grabbable Tasks

### Task 1: Stop leaking backend tokens through frontend request logging

Files likely touched:

- `app/src/services/apiClient.ts`
- `app/src/utils/sanitize.ts`
- New or existing tests under `app/src/services/` or `app/src/test/`

Acceptance criteria:

- API client logging never emits `Authorization`, bearer tokens, cookies,
  password/token/secret-like fields, or raw request bodies.
- Any remaining debug output is dev-only and namespaced.
- Regression test spies on console/debug output and proves sensitive headers are
  redacted.

Validation:

- `pnpm --filter openhuman-app test -- src/services`
- `pnpm --filter openhuman-app compile`

### Task 2: Prevent core RPC token exfiltration through stored RPC URL override

Files likely touched:

- `app/src/services/coreRpcClient.ts`
- `app/src/utils/configPersistence.ts`
- Tests under `app/src/services/` and `app/src/utils/`

Acceptance criteria:

- Tauri builds reject or ignore stored non-loopback RPC URLs.
- The local core RPC bearer token is never attached to a remote URL.
- Web/dev behavior is documented separately from desktop token behavior.

Validation:

- `pnpm --filter openhuman-app test -- src/services/coreRpcClient.test.ts src/utils/configPersistence.test.ts`
- `pnpm --filter openhuman-app compile`

### Task 3: Fix tool permission metadata for execution and mutating network tools

Files likely touched:

- `src/openhuman/tools/impl/system/node_exec.rs`
- `src/openhuman/tools/impl/system/npm_exec.rs`
- `src/openhuman/tools/impl/network/http_request.rs`
- Existing or new tool tests beside those modules

Acceptance criteria:

- `node_exec` and `npm_exec` report `PermissionLevel::Execute`.
- `http_request` is either split by method or conservatively reports
  `PermissionLevel::Write`.
- Tests pin permission metadata so future tools cannot inherit `ReadOnly`
  accidentally.

Validation:

- `cargo test --manifest-path Cargo.toml node_exec npm_exec http_request`

### Task 4: Harden public core endpoints for non-loopback binds

Files likely touched:

- `src/core/auth.rs`
- `src/core/jsonrpc.rs`
- `Dockerfile` or docs if defaults change
- Core JSON-RPC/auth tests

Acceptance criteria:

- `/health` remains usable for container health checks.
- `/schema`, `/events`, `/events/webhooks`, and `/ws/dictation` are not public
  when the server is bound to non-loopback unless a deliberate dev flag enables
  them.
- Tests cover loopback and non-loopback host configurations.

Validation:

- `cargo test --manifest-path Cargo.toml core::auth jsonrpc`

### Task 5: Add DNS-to-private guard for network tools

Files likely touched:

- `src/openhuman/tools/impl/network/url_guard.rs`
- `src/openhuman/tools/impl/network/http_request.rs`
- `src/openhuman/tools/impl/network/curl.rs`
- Potential shared resolver helper under `src/openhuman/tools/impl/network/`

Acceptance criteria:

- Allowed public hostnames resolving to loopback, RFC1918, link-local, metadata,
  multicast, or otherwise non-global addresses are rejected at dispatch time.
- Redirect behavior remains disabled.
- Tests use a fake resolver or injectable resolver path.

Validation:

- `cargo test --manifest-path Cargo.toml url_guard http_request curl`

### Task 6: Bring security and architecture docs back in line with code

Files likely touched:

- `SECURITY.md`
- `README.md`
- `AGENTS.md`
- Relevant docs under `docs/`
- `src/openhuman/skills/README.md` if needed

Acceptance criteria:

- Credential storage claims match the file-key `SecretStore` implementation and
  optional plaintext mode.
- Skills docs clearly distinguish SKILL.md prompt injection from executable
  runtime capabilities.
- Sidecar/in-process wording is consistent with current `app/package.json`
  scripts and architecture.

Validation:

- `pnpm --filter openhuman-app format:check`
- Markdown link check or `lychee` workflow equivalent if available locally.

## Unknowns And Blockers

- `items/openhuman-risk-register/ISSUE.md` is missing in this worktree. The
  queue prompt supplied the issue body, so this did not block the report, but it
  is a handoff gap for agents that rely on local issue files.
- No PR was created by design; this queue item is a local audit report.
- No external tracker was updated or marked Done.
- No external dependency freshness or vulnerability advisory review was
  performed.
- No runtime app launch was performed, so webview/desktop behavior is inferred
  from source and existing tests.
- The exact best cargo test filters for some future tasks may need adjustment
  after implementation because Rust module names and test names do not always
  match file names one-to-one.
