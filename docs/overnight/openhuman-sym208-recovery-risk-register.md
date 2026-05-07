# openhuman-sym208-recovery Risk Register Audit

Queue item: `openhuman-sym208-recovery-risk-register`  
Focus area: `risk-register`  
Repo path: `/Users/jwalinshah/projects/agent-stack/.agent-stack-worktrees/2026-05-07-overnight-marathon/openhuman-sym208-recovery-risk-register`  
Branch: `codex/goal-openhuman-sym208-recovery-risk-register`  
HEAD at audit time: `f11f217809841cf8e3a7f694d8e80967d8e188b8`

## Purpose and State

OpenHuman is a React + Tauri v2 desktop app backed by a Rust core sidecar / in-process server. The core owns business logic, JSON-RPC, persistence, credentials, skills, tools, channels, and release-facing binaries. The app workspace owns the desktop UX, Tauri host commands, webviews, and frontend state.

Initial repo state was clean:

- `git status --short --branch` -> `## codex/goal-openhuman-sym208-recovery-risk-register`
- `git rev-parse --abbrev-ref HEAD` -> `codex/goal-openhuman-sym208-recovery-risk-register`
- `git rev-parse HEAD` -> `f11f217809841cf8e3a7f694d8e80967d8e188b8`
- `git submodule status --recursive` showed two uninitialized submodules: `app/src-tauri/vendor/tauri-cef` and `app/src-tauri/vendor/tauri-plugin-notification`

This audit intentionally changed no product code. It writes this report only.

## Commands and Evidence Read

- `llm-tldr tree .` for repository shape; the repo contains `src/` Rust core, `app/` React/Tauri shell, `.github/workflows/`, `scripts/`, `docs/`, `tests/`, and release packaging.
- `rg --files .github scripts app/src-tauri app/test docs src tests` for high-risk surfaces and validation entrypoints.
- `git log --oneline -5` showed the current HEAD is a security fix: `f11f2178` "Fix shell injection vulnerability in browser screenshot tool".
- `.gitignore:21-24`, `.gitignore:32-34`, and `.gitignore:65-69` ignore `.env*`, `scripts/ci-secrets*.json`, `tauri.key*`, and build outputs.
- `package.json:8-32` delegates build, test, lint, typecheck, debug, and review scripts to the app workspace or scripts.
- `app/package.json:10-55` declares the main development, Tauri, test, e2e, Rust, lint, and formatting commands; `app/package.json:95-97` requires Node `>=24.0.0`.
- `Cargo.toml:29-163` defines the Rust core dependencies and optional features; `Cargo.toml:169-170` patches `whisper-rs-sys` from a git branch.
- `app/src-tauri/Cargo.toml:36-53` enables CEF, devtools, private macOS APIs, updater, opener, notification, deep-link, and global shortcut plugins.
- `app/src-tauri/tauri.conf.json:26-28` has a broad CSP including `unsafe-inline`, `data:`, `blob:`, `https:`, localhost HTTP/WS, and `macOSPrivateApi: true`.
- `.github/workflows/test.yml` has Linux and macOS E2E jobs commented out from line 133 onward.
- `.github/workflows/coverage.yml:136-193` enforces changed-line coverage through `diff-cover`.
- `.github/workflows/pr-quality.yml:13-49` marks PR quality jobs as soft with `continue-on-error: true`.

## Risk Register

| Risk | Evidence | Impact | Next safe work |
| --- | --- | --- | --- |
| Public local core routes are broader than a desktop-only mental model. | `src/core/auth.rs:19-29` and `src/core/auth.rs:49-57` bypass auth for `/`, `/health`, `/auth/telegram`, `/schema`, `/events`, `/events/webhooks`, and `/ws/dictation`. `src/core/jsonrpc.rs:442-470` sets permissive CORS. `Dockerfile:68-79` runs the core server on `0.0.0.0:7788`. | In desktop mode this may be local-only, but the Docker image exposes unauthenticated discovery and event/websocket surfaces on all interfaces unless the runtime is isolated. | Add explicit auth/bind-mode tests for public routes and document which unauthenticated endpoints are intentional in desktop vs container mode. |
| Tauri command permissions expose powerful host operations to app windows. | `app/src-tauri/capabilities/default.json:7-25` grants core-process, updater, notification, opener, deep-link, and window permissions to `main` and `overlay`. `app/src-tauri/permissions/allow-core-process.toml:6-55` includes `core_rpc_token`, `restart_app`, service install/start/stop/uninstall, Gmail CDP send/trash/label commands, webview account controls, and screen-share commands. | A compromised trusted window has a large command surface, including core bearer-token access and account actions. This may be intended, but it needs focused regression tests and a reviewed permission boundary. | Create Tauri permission tests or WDIO smoke tests proving remote account webviews cannot invoke privileged default-window commands. |
| Remote account webviews have a narrow but sensitive bridge. | `app/src-tauri/capabilities/webview-accounts.json:3-21` grants third-party origins such as Google, Slack, WhatsApp, Discord, Telegram, LinkedIn, and Meet the `allow-webview-recipe` permission. `app/src-tauri/permissions/allow-webview-recipe.toml:1-11` allows recipe events and screen-share thumbnail/session commands. | The stated session gate may be correct, but this is still an intentional bridge from third-party web content into desktop commands. A bypass would turn remote content into a local data-exfil path. | Add adversarial recipe-bridge tests for drive-by invocation, stale session reuse, wrong origin, hidden webview, and token-less events. |
| Credential-storage docs do not match observed implementation. | `SECURITY.md:49` says desktop uses OS-level credential storage and does not store secrets in plain text. `docs/ARCHITECTURE.md:276-281` says credentials live in OS keychain and no localStorage for credentials/tokens. Current code uses file-backed encrypted stores: `src/openhuman/security/secrets.rs:35-50` creates `.secret_key`; `src/openhuman/credentials/profiles.rs:311-357` encrypts token fields into `auth-profiles.json`; `src/openhuman/credentials/ops.rs:138-150` persists user metadata including `user_json`. | Users, support, and reviewers may rely on a stronger guarantee than the current file-backed design provides. Metadata may still contain sensitive account details even when token fields are encrypted. | Decide whether to update docs to the file-backed design or migrate to OS keychain; add tests for metadata redaction and file permissions. |
| Secret encryption has a sharp opt-out and legacy migration surface. | `src/openhuman/config/schema/tools.rs:267-277` defaults `secrets.encrypt` to true, but `src/openhuman/security/secrets.rs:56-59` allows plaintext storage when disabled. `src/openhuman/security/secrets.rs:78-120` supports legacy `enc:` XOR migration. | A support/debug config could silently create plaintext secrets; legacy migration code must remain covered because it handles token material. | Add a focused test matrix for encrypted, disabled, malformed, and legacy secret formats; document the operational consequences of `secrets.encrypt=false`. |
| Release workflow may report Docker success without publishing an image. | `.github/workflows/release-production.yml:356-379` defines `build-docker` but the observed block only checks out, sets up Buildx, and logs into GHCR. `publish-release` later depends on `build-docker` success. | A release can appear to have passed the Docker phase even if no image was built or pushed, creating false confidence and broken downstream installs. | Add an assertion step that builds/pushes or explicitly marks Docker publish skipped with a required output consumed by `publish-release`. |
| Installer integrity is conditional. | `scripts/install.sh:155-190` resolves release metadata and downloads assets. `scripts/install.sh:362-380` verifies SHA256 only if a digest is present; otherwise it warns and continues. The script is intended for `curl | bash` use at `scripts/install.sh:3-5` and `scripts/install.sh:50-51`. | A missing checksum in release metadata degrades install integrity from fail-closed to warn-and-install. This is a supply-chain footgun for a desktop binary. | Make checksum/signature absence fatal for production assets, or publish a documented insecure-dev path with explicit opt-in. |
| CI does not continuously exercise desktop E2E flows. | `.github/workflows/test.yml:133+` comments out Linux and macOS E2E jobs. `docs/TEST-COVERAGE-MATRIX.md:49-52`, `docs/TEST-COVERAGE-MATRIX.md:71-91`, `docs/TEST-COVERAGE-MATRIX.md:110-113`, and `docs/TEST-COVERAGE-MATRIX.md:320-364` still list important missing or thin auth/update/permission coverage. | Security-sensitive desktop flows can regress while unit and coverage gates stay green. The coverage matrix also contains stale "this PR" phrasing that can mislead reviewers. | Re-enable a minimal smoke E2E lane or explicitly downgrade coverage claims; keep the matrix tied to concrete workflow names and specs. |
| PR quality gates are soft. | `.github/workflows/pr-quality.yml:13-49` uses `continue-on-error: true` for checklist, coverage matrix, markdown link checks, and stale workflow detection. | Documentation and process drift are detected but not enforced. This matters because release/security docs already diverge from code in this audit. | Decide which quality checks are required for release/security PRs, then make those jobs blocking or add a required manual attestation. |
| Local debug scripts can touch live services and echo token fragments. | `scripts/ci-secrets.example.json` documents `JWT_TOKEN`, GitHub, Apple, Tauri signing, and Sentry secrets. `scripts/debug-notion-live.sh` prints the first 20 characters of `JWT_TOKEN` and calls a backend with Authorization. `scripts/test-ci-local.sh:63-75` converts local secrets JSON into dotenv, and `scripts/test-ci-local.sh:111-116` uses `eval` to export Vite vars. | Token prefixes and dotenv expansion can leak into local logs or shell history. Live debug scripts can mutate real backend state if run casually. | Add a debug-script safety pass: redact all token fragments, remove `eval`, require `--live` for live backend calls, and document local-only fixtures. |
| Tool execution policy is custom and must stay adversarially tested. | `src/openhuman/tools/impl/system/shell.rs:96-135` validates commands, clears env, and restores safe vars only. `src/openhuman/security/policy.rs:405-540` classifies high/medium risk commands and supervised approvals. `src/openhuman/security/policy.rs:551-633` parses shell segments and blocks redirects/subshells. `src/openhuman/tools/impl/browser/browser.rs` blocks `file://` and private hosts but allows `OPENHUMAN_BROWSER_ALLOW_ALL=1`. | The policy is intentionally defensive, but recent HEAD is a shell-injection fix, so this surface deserves ongoing regression tests. Env toggles can weaken browser constraints. | Add malicious command/browser URL fixture tests for quoting, redirection, semicolons, unicode whitespace, localhost bypasses, and allow-all behavior. |
| In-process core listener takeover can kill local processes. | `app/src-tauri/src/core_process.rs:7-20` documents stale listener takeover. `app/src-tauri/src/core_process.rs:101-108` can attach to an existing listener when `OPENHUMAN_CORE_REUSE_EXISTING=1`. `app/src-tauri/src/core_process.rs:186-260` finds and kills a stale OpenHuman listener after PID/process-name revalidation. | Intended developer recovery can become surprising if multiple app versions or worktrees are running. The attach mode also relies on the correctness of local token/listener discovery. | Add local multi-instance tests or a documented runbook covering reuse, stale takeover, port conflicts, and user-visible recovery messaging. |
| Dependency and build supply chain has moving pieces. | `Cargo.toml:169-170` and `app/src-tauri/Cargo.toml:150` patch `whisper-rs-sys` from a git branch. `.github/Dockerfile:46-69` uses remote shell/script style installers for Rust, NodeSource, and sccache. `app/src-tauri/Cargo.toml:162-175` patches Tauri crates to vendored paths and git revisions. `packages/npm/package.json:3` is still `0.0.0`. | Reproducibility and provenance are harder to review. Some dependencies are pinned, but branch patches and remote installers are higher-risk than vendored checksums. | Pin git patches to immutable revisions where possible, document CEF/Tauri provenance, and add a release checklist item for npm package version consistency. |

## Stale Assumptions and Claim Drift

- Credential docs claim OS keychain persistence, while the current implementation uses an app-managed `.secret_key` and encrypted JSON profiles.
- `app/src/services/coreRpcClient.ts` still comments that the bearer token is written to `~/.openhuman/core.token`, but the in-process Tauri path generally injects `OPENHUMAN_CORE_TOKEN` into the embedded server instead.
- `docs/AUTO_UPDATE.md` references a release workflow shape that appears older than the current `release-production.yml` / `build-desktop.yml` split.
- `scripts/test-ci-local.sh` still references `yarn`, `skills`, and `vezuresdotxyz/openhuman-frontend-runner`, which conflicts with the current pnpm workspace and `tinyhumansai/openhuman` project conventions.
- `docs/TEST-COVERAGE-MATRIX.md` mixes live coverage claims with "this PR" wording and missing security-flow rows; morning review should treat it as a map, not a guarantee.

## Independently Grabbable Next Tasks

1. **Clarify and harden credential storage.**
   - Acceptance criteria: `SECURITY.md` and `docs/ARCHITECTURE.md` accurately describe the actual credential store, or the implementation migrates token persistence to OS keychain; metadata fields that may include PII are either redacted or documented.
   - Validation candidates: `cargo test -p openhuman credentials`, `cargo test -p openhuman security::secrets`, and a focused test that inspects persisted `auth-profiles.json` shape without real tokens.

2. **Lock down and test public core endpoints.**
   - Acceptance criteria: each unauthenticated core route has an explicit desktop/container justification; Docker bind behavior is documented; regression tests prove protected JSON-RPC calls reject missing/wrong bearer tokens while intentional public endpoints expose only safe data.
   - Validation candidates: `cargo test -p openhuman core::auth`, `cargo test -p openhuman core::jsonrpc`, plus one local HTTP smoke test against a temp workspace.

3. **Add WebView permission regression coverage.**
   - Acceptance criteria: account webviews can invoke only recipe-bridge commands; account origins cannot call `core_rpc_token`, service management, app update, or Gmail CDP commands; screen-share session gates fail closed for missing/stale sessions.
   - Validation candidates: targeted Tauri permission tests, `cargo test --manifest-path app/src-tauri/Cargo.toml`, and one WDIO spec under `app/test/e2e/specs/`.

4. **Repair release Docker signaling.**
   - Acceptance criteria: `release-production.yml` either builds and pushes a Docker image with a digest output, or explicitly disables Docker release with a blocking/visible skip reason; `publish-release` consumes that output rather than raw job success.
   - Validation candidates: `actionlint .github/workflows/release-production.yml`, a workflow dry-run if available, and a small shell test for any helper script added.

5. **Make installer integrity fail closed.**
   - Acceptance criteria: production install refuses assets without a checksum/signature; insecure local/dev install requires an explicit flag; the script reports the exact missing integrity artifact.
   - Validation candidates: shellcheck if available, a temp fake-release fixture test, and `bash scripts/install.sh --help` or a new `--dry-run` path.

6. **Redact live debug scripts.**
   - Acceptance criteria: no debug script prints token prefixes or expands dotenv through `eval`; live backend mutation requires an explicit `--live` flag and logs the target backend URL without secrets.
   - Validation candidates: `rg 'JWT_TOKEN:0|eval |Authorization: Bearer' scripts`, shellcheck, and one dry-run per touched script.

## Validation Command Candidates

Required for this queue item:

- `git status --short` -> expected to exit 0 and show this report as the only dirty change.

Useful follow-up validations not run for this read-only queue item:

- `pnpm format:check` -> expected to validate app formatting; may require installed workspace dependencies.
- `pnpm lint` -> expected to validate app lint rules; may be slower but appropriate before PRs touching app code.
- `pnpm typecheck` -> expected to validate TypeScript; appropriate for Tauri/app permission changes.
- `cargo test -p openhuman` -> expected to validate Rust core logic; appropriate for auth, credential, and policy changes.
- `cargo test --manifest-path app/src-tauri/Cargo.toml` -> expected to validate Tauri shell logic; may need vendored CEF/Tauri submodules initialized.
- `pnpm test:coverage` -> expected CI-style frontend coverage; not needed for this report.
- `actionlint .github/workflows/release-production.yml` -> expected to catch workflow syntax/action issues if `actionlint` is installed.

## Non-Goals

- No product code edits.
- No generated artifact changes.
- No external service calls, deploys, pushes, PR creation, or release actions.
- No secret discovery or credential validation beyond reading checked-in examples and scripts.
- No attempt to run full test, lint, build, E2E, or release workflows.
- No tracker state changes.

## Unknowns

- Whether current GitHub Actions runs are green on `main`.
- Whether release assets currently include all checksum/signature files expected by installers.
- Whether production Docker image publishing is intentionally paused elsewhere outside this repo.
- Whether the uninitialized vendored submodules are expected in this isolated worktree.
- Whether any enterprise/OS keychain integration exists outside the inspected code paths.
- Whether account webview session gates have manual QA coverage not represented in this repo.

## Handoff Notes

This report is the only intended artifact for the queue item. The repo was clean at the start; after writing the report, the expected dirty state is the new `docs/overnight/openhuman-sym208-recovery-risk-register.md` file. No PR was created and no external tracker was updated.
