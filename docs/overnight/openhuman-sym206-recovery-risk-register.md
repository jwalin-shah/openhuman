# OpenHuman SYM-206 Recovery Risk Register

Queue item: `openhuman-sym206-recovery-risk-register`  
Focus area: `risk-register`  
Audit date: 2026-05-07  
Repo path: `/Users/jwalinshah/projects/agent-stack/.agent-stack-worktrees/2026-05-07-overnight-marathon/openhuman-sym206-recovery-risk-register`  
Branch: `codex/goal-openhuman-sym206-recovery-risk-register`  
Audit-start HEAD: `f11f217809841cf8e3a7f694d8e80967d8e188b8`  
Required validation: `git status --short`

## Scope

This is a read-only risk audit of the OpenHuman desktop repository, with the single allowed write being this report. Product code, generated data, credentials, external services, deploys, pushes, PR creation, and tracker state changes are out of scope.

OpenHuman is a React + Tauri v2 desktop application with a Rust core. The current tree shows the app workspace under `app/`, the Tauri host under `app/src-tauri/`, the root Rust crate under `src/`, release/install automation under `.github/workflows/` and `scripts/`, and product/security docs under `docs/`.

## Dirty State And Commands

- `git status --short --branch` at audit start returned only `## codex/goal-openhuman-sym206-recovery-risk-register`; the branch was clean before this report.
- `git rev-parse --show-toplevel`, `git branch --show-current`, and `git rev-parse HEAD` confirmed the repo root, branch, and audit-start SHA above.
- `llm-tldr tree .` completed but emitted a very large JSON tree that was truncated in tool output, so subsequent traversal used bounded `fd`, `rg`, `rtk read`, and targeted `sed`.
- `fd -t d -d 2 . . | sort` showed the main risk surfaces: `app/`, `app/src-tauri/`, `src/`, `scripts/`, `.github/workflows/`, `docs/`, `gitbooks/`, `packages/`, `remotion/`, and `tests/`.
- `fd -t f . docs/overnight docs/reviews docs/qa docs/agent-workflows` showed `docs/overnight/` was absent before this report; existing review/QA docs included `docs/reviews/2026-04-23-adversarial-fixes.md`, `docs/qa/*`, and `docs/agent-workflows/codex-pr-checklist.md`.
- `rtk grep "OPENHUMAN_.*TOKEN|JWT_TOKEN|SENTRY|..." .` found token, Sentry, proxy, and debug-script surfaces in `.env.example`, `app/.env.example`, `scripts/debug-*`, and CI examples.
- `rtk grep "Command::new|std::process::Command|rm -rf|pkill|taskkill|lsof|netstat" .` found destructive/local process surfaces in `app/scripts/e2e-run-spec.sh`, `app/src-tauri/src/core_process.rs`, and `app/src-tauri/src/lib.rs`.
- `rg -n "curl -fsSL|irm|iex|Keychain|plaintext|localStorage|sidecar|QuickJS" ...` found install and stale-doc claims in `README.md`, `SECURITY.md`, `docs/ARCHITECTURE.md`, `docs/src/02-state-management.md`, and `docs/src-tauri/README.md`.

No test, build, lint, external-service, deploy, or release command was run; the queue item validation is only `git status --short`.

## Evidence Map

- `README.md` advertises curl/PowerShell pipe-to-shell installers and claims workflow data stays on device and encrypted locally.
- `SECURITY.md` claims desktop credentials use OS-level credential storage and are not stored in plaintext.
- `docs/ARCHITECTURE.md` still describes QuickJS runtime isolation, OS keychain credential storage, sidecar architecture, and no localStorage tokens.
- `docs/src-tauri/README.md` says `core:stage` builds/copies an `openhuman` sidecar into Tauri external bins.
- `app/src-tauri/src/core_process.rs` says the core HTTP/JSON-RPC server now runs in-process as a Tokio task and actively terminates stale OpenHuman listeners on the configured port.
- `src/core/auth.rs` documents and implements the bearer-token model, `core.token` fallback, and public unauthenticated routes.
- `src/core/jsonrpc.rs` registers `/`, `/health`, `/schema`, `/events`, `/events/webhooks`, `/rpc`, `/ws/dictation`, `/auth/telegram`, and adds `Access-Control-Allow-Origin: *`.
- `app/src-tauri/tauri.conf.json` has a broad CSP with `unsafe-inline`, `https:`, `wss:`, `data:`, `blob:`, local HTTP/WS, and `frame-src 'self' https: data: blob:`.
- `src/openhuman/credentials/profiles.rs` persists `auth-profiles.json` and encrypts token fields through `SecretStore`.
- `src/openhuman/security/secrets.rs` stores a local `.secret_key` and uses ChaCha20-Poly1305; encryption can be disabled by config.
- `src/openhuman/channels/controllers/ops.rs` logs a Telegram deep link that includes the generated link token.
- `app/scripts/e2e-run-spec.sh` kills OpenHuman processes, removes user app caches/config dirs, and edits `~/.openhuman/config.toml` for E2E.
- `scripts/install.sh` and `scripts/install.ps1` download latest release assets; SHA verification is conditional on release metadata containing a digest.
- `src/openhuman/tools/impl/network/url_guard.rs`, `http_request.rs`, `curl.rs`, and `src/openhuman/skills/ops_install.rs` implement outbound URL guards and document a DNS rebinding gap for skill install.
- `src/openhuman/tools/impl/filesystem/file_write.rs` and `edit_file.rs` perform canonical/symlink checks for workspace writes; `src/openhuman/tools/impl/network/curl.rs` does not mirror the same target symlink/parent canonicalization before `fs::File::create`.
- `src/openhuman/tools/impl/filesystem/git_operations.rs` exposes structured `add`, `commit`, `checkout`, and `stash` operations through autonomy checks and direct `git` subprocesses.
- `Cargo.toml` includes a git patch for `whisper-rs-sys` on branch `main`, plus high-privilege desktop/input/browser/network dependencies.
- `.github/workflows/build-desktop.yml` and `.github/workflows/release-production.yml` handle signing keys, Sentry tokens, updater artifacts, releases, tags, and failure cleanup.

## Risk Register

| ID | Risk | Local Evidence | Impact | Next Safe Work |
| --- | --- | --- | --- | --- |
| R1 | Credential-storage claim drift: docs say OS keychain, code uses local encrypted JSON. | `SECURITY.md`, `docs/ARCHITECTURE.md`, `src/openhuman/credentials/profiles.rs`, `src/openhuman/security/secrets.rs`. | Users/reviewers may believe tokens are isolated by OS credential APIs when they are actually protected by a local key file. Encryption is present by default, but the stated control is different. | Decide whether to implement OS keychain or update docs/security copy to describe `auth-profiles.json` + `.secret_key` accurately. Add a regression test for encrypted token persistence and file modes. |
| R2 | Public local endpoints plus wildcard CORS need tighter threat modeling, especially if the core host is changed from loopback. | `src/core/auth.rs` public paths, `src/core/jsonrpc.rs` CORS `*`, `/events`, `/events/webhooks`, `/ws/dictation`, `.env.example` `OPENHUMAN_CORE_HOST` notes. | A malicious local webpage or LAN peer could probe public endpoints if the core is reachable. `/rpc` is bearer-protected, but schema/SSE/WS exposure may leak metadata or stream data depending on event contents and host binding. | Add origin/host tests for public endpoints, document allowed exposure, and fail closed when binding to non-loopback unless explicitly acknowledged. |
| R3 | Tauri CSP is broad for a desktop app that embeds external account/webview surfaces. | `app/src-tauri/tauri.conf.json`, `app/src-tauri/src/webview_accounts/*`, `app/src-tauri/recipes/*`. | `unsafe-inline`, broad `https:`, `data:`, `blob:`, and broad `frame-src` increase blast radius if UI injection, recipe injection, or third-party content handling is wrong. | Inventory actual origins needed by first-run, account tiles, updater, Sentry, and recipes; replace scheme-wide allowances with origin/path-specific allowances where practical. |
| R4 | E2E runner can mutate real user state despite creating `OPENHUMAN_WORKSPACE`. | `app/scripts/e2e-run-spec.sh`. | The script uses `pkill -f "OpenHuman"`, removes real app caches/config dirs, and edits `~/.openhuman/config.toml`. An interrupted run can leave user config/caches changed. | Make E2E config fully workspace-scoped on macOS or add a mandatory `OPENHUMAN_E2E_ALLOW_HOME_MUTATION=1` guard before touching home state. Add a shell test for cleanup/restore paths. |
| R5 | Pipe-to-shell installers and conditional digest verification leave supply-chain ambiguity. | `README.md`, `scripts/install.sh`, `scripts/install.ps1`, `.github/workflows/release-production.yml`, `app/src-tauri/tauri.conf.json` updater pubkey. | Users are asked to execute remote installer scripts directly. Asset verification is skipped when digest metadata is absent; script authenticity depends on GitHub transport and branch content. Tauri updater has a signing pubkey, but the bootstrap installer path is weaker. | Publish signed installer scripts or pinned version commands, make digest/signature mandatory for release assets, and document trust boundaries between bootstrap installers and Tauri updater signatures. |
| R6 | Outbound network guards block obvious private hosts but do not uniformly pin DNS resolution; skill install documents a DNS-rebinding caveat. | `src/openhuman/tools/impl/network/url_guard.rs`, `src/openhuman/tools/impl/network/http_request.rs`, `src/openhuman/tools/impl/network/curl.rs`, `src/openhuman/skills/ops_install.rs`. | An allowed public hostname that resolves to private infrastructure after validation could bypass intended SSRF protections. `skills.install_from_url` adds a preflight DNS check but says reqwest may resolve differently. | Add a shared resolver strategy that validates and pins socket addresses for all network tools, then add tests with a controllable resolver. |
| R7 | `curl` download target lacks the symlink/canonical write hardening used by file-write tools. | `src/openhuman/tools/impl/network/curl.rs`, `src/openhuman/tools/impl/filesystem/file_write.rs`, `src/openhuman/tools/impl/filesystem/edit_file.rs`. | If `downloads/` or a destination component is a symlink, `fs::File::create` can write outside the intended workspace root. This is narrower than arbitrary path traversal because lexical `..` and absolute paths are blocked, but it is still a workspace escape class. | Port the canonical parent and target-symlink checks from file-write/edit into `CurlTool::execute`; add tests for symlink parent and symlink file targets. |
| R8 | Telegram link token appears in debug logs as part of the full deep link. | `src/openhuman/channels/controllers/ops.rs`. | Link tokens are likely short-lived, but logs are often pasted into tickets or collected by desktop log tooling. Full deep-link logging turns a diagnostic line into a bearer-style secret exposure. | Redact the token in logs; keep `bot_username`, token length, and a short hash if needed for correlation. Add a test around the formatter or move logging behind a helper. |
| R9 | Structured git tool can perform repo writes in supervised/full autonomy without an explicit per-operation approval token, and subprocesses have no timeout. | `src/openhuman/tools/impl/filesystem/git_operations.rs`, `src/openhuman/security/policy.rs`. | A model/tool-call mistake could stage, commit, checkout, or stash user work. Long git commands can hang. Security policy marks many git writes as medium risk, but this tool's direct autonomy check is the effective gate observed here. | Require explicit approval metadata for write operations, add a timeout to `run_git_command`, and keep read-only git status/diff/log exempt from write budgets. |
| R10 | Release workflows carry high-value signing/Sentry secrets and cleanup can delete tags/releases on failure. | `.github/workflows/build-desktop.yml`, `.github/workflows/release-production.yml`, `scripts/ci-secrets.example.json`. | This is expected for release automation, but it raises blast radius for compromised workflow context or mistaken manual dispatch. Cleanup deletes remote tags/releases; staging/production promotion depends on exact tag assumptions. | Audit workflow permissions, environment protection, tag deletion conditions, and secret scoping. Add a dry-run/manual-smoke checklist for release cleanup before broadening automation. |
| R11 | Dependency/supply-chain surface includes branch-based git patch and high-privilege desktop crates. | `Cargo.toml`, `Cargo.lock`, `app/src-tauri/Cargo.lock`, `app/package.json`. | A patch pinned to a moving branch can change outside normal version-review expectations. Desktop automation/input crates and browser/webdriver dependencies deserve tighter review because compromise or misuse has local-machine impact. | Pin git patches to immutable revs, run dependency audit in CI, and document why each privileged crate is required. |
| R12 | Runtime architecture docs are stale enough to mislead future agents and security reviews. | `docs/ARCHITECTURE.md`, `docs/src-tauri/README.md`, `src/openhuman/skills/README.md`, `app/src-tauri/src/core_process.rs`, `app/package.json` `core:stage` script. | Docs still describe sidecar staging, QuickJS runtime execution, OS keychain persistence, and no localStorage token/credential persistence. Future fixes could be scoped against the wrong architecture. | File a docs-only work item to reconcile architecture, security, Tauri, and skills docs with the current in-process core and current skills/runtime split. |

## Stale Assumptions And Unsupported Claims

1. `SECURITY.md` and `docs/ARCHITECTURE.md` claim OS keychain credential storage, but the audited implementation persists encrypted profile JSON through `AuthProfilesStore` and `SecretStore`.
2. `docs/ARCHITECTURE.md` still presents QuickJS skill execution as current. `src/openhuman/skills/README.md` says the skill domain does not own runtime execution internals, and `src/openhuman/skills/types.rs` notes some types remain after QuickJS runtime removal.
3. `docs/src-tauri/README.md` describes sidecar staging through `core:stage`; `app/src-tauri/src/core_process.rs` says the core now runs in-process as a Tokio task. The release workflow still has sidecar/CLI staging paths, so docs should separate production app behavior from standalone artifacts.
4. `docs/src/02-state-management.md` says Redux-Persist/localStorage is the only acceptable localStorage use and describes token/session handling. Current code keeps core state in memory and user-scopes persisted Redux keys through `app/src/store/userScopedStorage.ts`; this reduces risk but should be documented consistently.
5. README/privacy copy says workflow data is encrypted locally and treated as yours. That is directionally supported for some stores, but this audit did not verify every scanner cache, webview profile, generated artifact, or debug log path.

## Next Independently Grabbable Tasks

### Task 1: Reconcile Credential Storage Claims

Acceptance criteria:
- `SECURITY.md`, `docs/ARCHITECTURE.md`, and any user-facing privacy copy accurately describe the current credential store.
- If OS keychain remains a desired claim, create a separate implementation issue instead of leaving the current claim.
- Add or update Rust tests proving token fields are encrypted when `secrets.encrypt=true` and readable after reload.

Validation candidates:
- `cargo test --manifest-path Cargo.toml credentials::profiles`
- `cargo test --manifest-path Cargo.toml openhuman::security`
- `rg -n "Keychain|Credential Manager|Secret Service|plaintext|auth-profiles|\\.secret_key" SECURITY.md docs/ARCHITECTURE.md docs/src docs/src-tauri`

Expected status: docs-only part should pass grep review; Rust tests may need exact module-path adjustment.

### Task 2: Harden Curl Workspace Writes

Acceptance criteria:
- `CurlTool` rejects symlinked destination files and symlinked/canonicalized parent escapes, matching the posture in file-write/edit tools.
- Tests cover normal download path resolution, symlink destination, symlink parent directory, and cleanup after partial download failure.

Validation candidates:
- `cargo test --manifest-path Cargo.toml curl`
- `cargo test --manifest-path Cargo.toml network::curl`

Expected status: currently likely missing symlink-escape coverage; new tests should fail before the fix and pass after.

### Task 3: Threat-Model Public Core Endpoints

Acceptance criteria:
- A short doc or ADR lists each public endpoint, why it is unauthenticated, what data it can expose, and whether non-loopback binding is allowed.
- Tests prove `/rpc` requires bearer auth and public endpoints do not expose user data without an unguessable selector.
- Non-loopback host binding either refuses public streaming endpoints by default or requires an explicit risk acknowledgement.

Validation candidates:
- `cargo test --manifest-path Cargo.toml core::auth`
- `cargo test --manifest-path Cargo.toml jsonrpc`
- `bash scripts/test-rust-with-mock.sh --test json_rpc_e2e`

Expected status: auth unit tests should be cheap; JSON-RPC E2E may require mock backend availability.

### Task 4: Redact Telegram Link Tokens In Logs

Acceptance criteria:
- Telegram login start logs no full `telegram_url` or raw `link_token`.
- UI can still display the full URL returned in the RPC result.
- Tests or a helper make redaction stable.

Validation candidates:
- `cargo test --manifest-path Cargo.toml telegram_login`
- `cargo test --manifest-path Cargo.toml channels`
- `rg -n "deep link|link_token|telegram_url|token" src/openhuman/channels app/src/components/channels`

Expected status: grep should show only redacted log paths after the fix.

### Task 5: Make E2E Home Mutation Explicit

Acceptance criteria:
- `app/scripts/e2e-run-spec.sh` refuses to edit `~/.openhuman` or remove real app caches unless an explicit env var is set, or it uses a fully isolated home/config path.
- Cleanup/restore behavior has a shell-level smoke test or documented manual check.
- E2E docs explain which commands mutate user state and how to run safely.

Validation candidates:
- `bash -n app/scripts/e2e-run-spec.sh`
- `shellcheck app/scripts/e2e-run-spec.sh` if shellcheck is available
- `pnpm test:e2e:build` followed by one targeted spec only after human approval because it launches desktop automation.

Expected status: syntax checks should pass; full E2E remains intentionally gated.

### Task 6: Pin Supply-Chain Exceptions And Review Release Cleanup

Acceptance criteria:
- `Cargo.toml` git patches use immutable revisions, or the exception is documented with owner/review cadence.
- Release workflow permissions and cleanup tag deletion are reviewed and documented.
- Installer bootstrap verification policy is explicit: digest/signature required or a documented fallback.

Validation candidates:
- `cargo metadata --manifest-path Cargo.toml --locked --format-version=1`
- `cargo audit` if available
- `pnpm --dir app audit --audit-level=moderate` if network and registry access are allowed
- `rg -n "git =|branch =|TAURI_SIGNING|deleteRef|deleteRelease|digest|sha256" Cargo.toml .github/workflows scripts/install.*`

Expected status: metadata should pass if lockfiles are coherent; audit commands may require network and are not suitable for this read-only queue item.

## Validation Command Candidates

| Command | Purpose | Expected Status |
| --- | --- | --- |
| `git status --short` | Required queue-item validation. | Passes locally. After committing this report, expected output is empty. |
| `git status --short --branch` | Handoff sanity check for branch and dirty state. | Branch should be `codex/goal-openhuman-sym206-recovery-risk-register`. |
| `cargo test --manifest-path Cargo.toml credentials::profiles` | Credential-store regression target for R1. | Candidate only; not run in this audit. May need exact module path adjustment. |
| `cargo test --manifest-path Cargo.toml curl` | Curl symlink/escape regression target for R7. | Candidate only; not run in this audit. |
| `cargo test --manifest-path Cargo.toml core::auth` | Public/protected endpoint auth behavior for R2. | Candidate only; not run in this audit. |
| `bash -n app/scripts/e2e-run-spec.sh` | Non-mutating shell syntax check for E2E runner hardening. | Candidate only; should pass if Bash is available. |
| `rg -n "Keychain|QuickJS|sidecar|No localStorage|auth-profiles|\\.secret_key" SECURITY.md docs/ARCHITECTURE.md docs/src docs/src-tauri src/openhuman` | Docs drift review loop. | Candidate only; currently expected to find stale claims. |

## Unknowns

- I did not inspect real user workspaces, `~/.openhuman`, CI secrets, GitHub environment protection, release assets, Sentry projects, or external backend configuration.
- I did not run the app, the core server, E2E desktop automation, release workflows, installer scripts, or networked dependency audits.
- I did not verify whether production crash analytics consent defaults match user-facing legal/privacy docs.
- I did not prove exploitability of the curl symlink path or public endpoint exposure; those are evidence-backed risk hypotheses requiring focused tests.
- I did not compare against sibling repos from `repos.json` because this repo is large enough to support a deep local risk audit inside the item cap.

## Final Audit Decision

No product code should be changed from this queue item. The highest-leverage follow-up is a small security/docs reconciliation task for credential storage and runtime architecture, followed by focused hardening tasks for curl destination symlinks, public core endpoint exposure, E2E home mutation, and token redaction.
