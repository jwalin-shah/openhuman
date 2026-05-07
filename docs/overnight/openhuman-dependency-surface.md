# OpenHuman Dependency-Surface Audit

Queue item: `openhuman-dependency-surface`  
Focus: dependencies, scripts, environment variables, generated artifacts, caches, and local-only state.  
Date: 2026-05-07

## Handoff Snapshot

- Repo purpose: OpenHuman is a mixed Rust + React + Tauri desktop app. The root Rust crate owns core business logic, JSON-RPC, CLI binaries, storage, local AI, channels, skills/tool runtime, and HTTP/socket surfaces. `app/` owns the Vite/React UI and the Tauri desktop host.
- Branch: `codex/goal-openhuman-dependency-surface`.
- HEAD at audit start: `f11f217809841cf8e3a7f694d8e80967d8e188b8`.
- Remotes observed: `origin` and `jwalin-ssh` point to `jwalin-shah/openhuman`; `upstream` points to `tinyhumansai/openhuman`.
- Dirty state at start: `git status --short --branch` printed only `## codex/goal-openhuman-dependency-surface`.
- Local generated/dependency dirs at audit time: `node_modules`, `app/node_modules`, `remotion/node_modules`, `target`, `app/dist`, `app/src-tauri/target`, `app/src-tauri/binaries`, `coverage`, `e2e-results`, `wdio-logs`, and `test-results` were all missing. `app/src-tauri/vendor/tauri-cef` and `app/src-tauri/vendor/tauri-plugin-notification` existed but were empty `0B` gitlink directories.
- Required report written: `docs/overnight/openhuman-dependency-surface.md`.
- PR: not created. Product code, generated data, external services, deploys, pushes, and PR creation were out of scope.

## Commands Run

- `llm-tldr tree .` produced a large JSON tree confirming the repo has root Rust sources under `src/`, the `app/` workspace, `tests/`, `scripts/`, `packages/`, `remotion/`, root `Cargo.toml`, root `package.json`, `pnpm-lock.yaml`, and Tauri config under `app/src-tauri/`.
- `git status --short --branch` showed a clean starting branch.
- `git rev-parse --abbrev-ref HEAD && git rev-parse HEAD && git remote -v` captured branch, SHA, and remotes.
- `rg --files -g ...` found dependency/config surfaces including `package.json`, `app/package.json`, `Cargo.toml`, `app/src-tauri/Cargo.toml`, `pnpm-lock.yaml`, `app/pnpm-lock.yaml`, `remotion/pnpm-lock.yaml`, `.env.example`, `app/.env.example`, Dockerfiles, and Tauri/Vite configs.
- `cargo metadata --no-deps --format-version 1 --manifest-path Cargo.toml` reported the root package has 97 normal deps, 10 optional deps/features, and targets including `openhuman-core`, `slack-backfill`, `gmail-backfill-3d`, and the integration test binaries.
- `cargo metadata --no-deps --format-version 1 --manifest-path app/src-tauri/Cargo.toml` reported the Tauri package has 39 normal deps, 2 build deps, 2 dev deps, and path deps on the root crate plus `app/src-tauri/vendor/tauri-cef/...` and `app/src-tauri/vendor/tauri-plugin-notification`.
- `git submodule status --recursive` showed both vendored Tauri submodules with a leading `-`, meaning not initialized: `app/src-tauri/vendor/tauri-cef` at `f1ee955...` and `app/src-tauri/vendor/tauri-plugin-notification` at `36c400...`.
- `node --version && pnpm --version && rustc --version && cargo --version` returned Node `v25.9.0`, pnpm `10.10.0`, rustc `1.93.0`, and cargo `1.93.0`.

## Dependency Map

### JavaScript and Node

- Root `package.json` is private, pins `packageManager` to pnpm `10.10.0`, has 24 scripts, and delegates most work to `openhuman-app` with `pnpm --filter openhuman-app ...`.
- `pnpm-workspace.yaml` includes only `app`. This means `packages/npm` and `remotion` are local sibling package surfaces, not root workspace members.
- `app/package.json` declares `engines.node >=24.0.0`, 34 runtime dependencies, 40 dev dependencies, and 49 scripts. Major frontend/build deps include React 19, Vite 8, Vitest 4, WDIO/Appium 9, Sentry, Remotion, Three.js, Redux Toolkit, Radix Dialog, Tauri JS plugins, and node polyfills.
- Root `pnpm-lock.yaml` is the workspace lock and includes an `app` importer. It resolves Vite to `8.0.10`, `@vitejs/plugin-react` to `6.0.1`, React to `19.2.5`, and `@tauri-apps/api` to `2.10.1`.
- `app/pnpm-lock.yaml` is a second lockfile with drift: its root importer resolves Vite to `7.3.2`, `@vitejs/plugin-react` to `4.7.0`, `vite-plugin-node-polyfills` to `0.25.0`, and it lacks several current `app/package.json` deps visible in the root lock such as `@radix-ui/react-dialog`, `@remotion/player`, `@remotion/zod-types`, `cmdk`, `react-joyride`, `remotion`, `zod`, and `@testing-library/user-event`.
- `remotion/package.json` is private and separate, with React `19.2.3`, TypeScript `5.9.3`, Tailwind `4.0.0`, Remotion `4.0.454`, and its own `remotion/pnpm-lock.yaml`. Root installs do not cover it.
- `packages/npm/package.json` is a publish wrapper for the CLI binary. Source version is `0.0.0`; `scripts/release/publish-npm.sh` stamps the real release version before publishing. Direct local install from this folder would otherwise make `packages/npm/install.js` look for `v0.0.0` release assets.

### Rust and Tauri

- Root `Cargo.toml` package `openhuman` is `0.53.16`, `edition = "2021"`, with library `openhuman_core` and binaries `openhuman-core`, `slack-backfill`, and `gmail-backfill-3d`. Documentation in several places still says `cargo build --bin openhuman`, but the actual bin name in `Cargo.toml` is `openhuman-core`.
- Root Rust deps include networking/TLS (`reqwest`, `tokio`, `rustls`, `tokio-tungstenite`, `axum`, `socketioxide`), persistence (`rusqlite` bundled, `postgres`), crypto (`aes-gcm`, `chacha20poly1305`, `argon2`, `ring`), observability (`sentry`, OpenTelemetry), media/desktop integrations (`whisper-rs`, `cpal`, `rdev`, `enigo`, `arboard`), and optional channel/tool deps (`matrix-sdk`, `fantoccini`, `pdf-extract`, `whatsapp-rust`, `landlock`, `rppal`).
- Root `Cargo.toml` patches `whisper-rs-sys` from `https://github.com/tinyhumansai/whisper-rs-sys.git` on branch `main`, so reproducible Rust resolution depends on `Cargo.lock` and that git source.
- `app/src-tauri/Cargo.toml` links `openhuman_core = { path = "../..", package = "openhuman", default-features = false }`, so the core is embedded in-process for the Tauri host. Its comments say this avoids orphan sidecar processes after PR `#1061`.
- Tauri runtime is not stock Tauri. `app/src-tauri/Cargo.toml` patches `tauri`, `tauri-build`, `tauri-utils`, `tauri-macros`, `tauri-runtime`, `tauri-runtime-wry`, and `tauri-plugin` to paths under `app/src-tauri/vendor/tauri-cef`. It also uses a path dep for `tauri-runtime-cef` and a vendored notification plugin.
- The vendored submodules are required but empty in this worktree. Any Tauri build, test, or `scripts/ensure-tauri-cli.sh` run that needs `app/src-tauri/vendor/tauri-cef/crates/tauri-cli/Cargo.toml` will fail until `git submodule update --init --recursive` succeeds.

### Environment and Runtime State

- Root `.env.example` contains shared Rust/Tauri/frontend settings: backend URLs, core port/RPC URL, `OPENHUMAN_WORKSPACE`, model defaults, proxy settings, local AI binary overrides, skills registry overrides, Sentry, analytics, and logging.
- `app/.env.example` documents browser-exposed `VITE_*` settings, including core RPC timeout, tool timeout, skills repo, Sentry, OAuth minimum app version, and latest download URL.
- `scripts/load-dotenv.sh` loads root `.env` by stripping comments/quotes and emitting `export KEY=value` lines. It fails if the target file is missing. This matters because `app/package.json` `dev:app` sources it unconditionally.
- Only `.env.example` and `app/.env.example` were present. `rg --files -uu` found no local `.env` or `.env.local` files in this worktree.
- `.gitignore` excludes `.env`, `.env.local`, `.env.*.local`, `scripts/ci-secrets*.json`, `.secrets`, `.vars`, `tauri.key`, `tauri.key.pub`, `target/`, `node_modules`, `dist`, `coverage`, E2E outputs, `target/debug-logs`, `.fastembed_cache`, and other local caches.
- `src/openhuman/config/schema/load.rs` consumes many runtime env vars not present in `.env.example`, including `OPENHUMAN_NODE_ENABLED`, `OPENHUMAN_NODE_VERSION`, `OPENHUMAN_NODE_CACHE_DIR`, `OPENHUMAN_MEMORY_*`, `OPENHUMAN_LEARNING_*`, `OPENHUMAN_AUTO_UPDATE_*`, `OPENHUMAN_DICTATION_*`, and `OPENHUMAN_CONTEXT_*`. Some are test/dev-only, but several are first-class config overlays.
- `src/openhuman/config/schema/node.rs` enables managed Node by default, pins `v22.11.0`, and prefers system Node only when the major version matches. The local shell has Node `v25.9.0`, so the core would not reuse it for managed skills; it would try to download/extract Node 22 unless configured otherwise.
- `src/openhuman/node_runtime/downloader.rs` downloads official Node archives from `https://nodejs.org/dist` and verifies `SHASUMS256.txt`. This is a large runtime dependency surface outside pnpm.
- `src/openhuman/local_ai/README.md` documents on-device assets under `~/.openhuman/local-ai/` for Ollama, whisper.cpp, Piper, model artifacts, and Tenor-backed GIF search. Those assets are not represented by pnpm or Cargo lockfiles.

### Scripts, Build, and CI

- Root scripts are mostly wrappers. The debug wrappers under `scripts/debug/` write full logs to `target/debug-logs/` and summarize Vitest, WDIO, or Rust test output.
- `scripts/test-rust-with-mock.sh` starts `scripts/mock-api-server.mjs` on `127.0.0.1:${MOCK_API_PORT:-18505}`, exports `BACKEND_URL` and `VITE_BACKEND_URL` to that mock URL, then runs `cargo test --manifest-path Cargo.toml --workspace`.
- `app/scripts/e2e-run-spec.sh` creates a temp `OPENHUMAN_WORKSPACE` by default, but it also writes or rewrites `$HOME/.openhuman/config.toml` so Appium-launched macOS apps see the mock backend URL. It backs up/restores the file, but this is still a real home-directory mutation surface.
- `app/scripts/e2e-build.sh` still runs `node "$REPO_ROOT/scripts/stage-core-sidecar.mjs"`. That file is missing, while `app/package.json` now has `"core:stage": "echo '[core:stage] no-op - core is linked in-process; sidecar removed (PR #1061)'"`. This makes the E2E build script stale relative to the current in-process core model.
- `docs/BUILDING.md`, `AGENTS.md`, `CLAUDE.md`, and `docs/src-tauri/README.md` still describe staging a sidecar via `scripts/stage-core-sidecar.mjs` and `app/src-tauri/binaries/`. That contradicts `app/package.json` and `app/src-tauri/Cargo.toml`.
- `.github/workflows/build.yml`, `test.yml`, and `coverage.yml` use pnpm and the GHCR CI image `ghcr.io/tinyhumansai/openhuman_ci:rust-1.93.0`. They require recursive submodules for Rust/Tauri work.
- `.github/workflows/build-windows.yml` still uses `cache: yarn` and `yarn install --frozen-lockfile` despite the repo-level pnpm `packageManager`. The same workflow uploads a `windows-cli` artifact from `steps.core-paths.outputs.*`, but no `core-paths` step was observed in that file.
- `e2e/docker-compose.yml` defaults to `yarn workspace openhuman-app test:e2e:all`; `e2e/Dockerfile` is marked deprecated but also installs Yarn. This is another stale package-manager surface next to the pnpm workflow.

## Risks and Stale Assumptions

1. Missing vendored submodules block Tauri validation locally. `app/src-tauri/vendor/tauri-cef` and `app/src-tauri/vendor/tauri-plugin-notification` are gitlinks but empty. The manifests and scripts assume real source trees under those paths.
2. Sidecar/in-process migration is only partially reflected. `app/src-tauri/Cargo.toml` and `app/package.json` say the core is linked in-process, but E2E scripts and multiple docs still require a removed `scripts/stage-core-sidecar.mjs`.
3. Lockfile ownership is unclear. The root `pnpm-lock.yaml` is consistent with the workspace and current app deps, while `app/pnpm-lock.yaml` is stale and resolves a different Vite/plugin graph. Agents running from `app/` could install a different dependency graph than CI/root commands.
4. Package-manager drift remains in CI and E2E docs. The repo declares pnpm, but Windows build and commented E2E paths still use Yarn. This can hide broken commands until platform-specific CI runs.
5. Environment docs understate runtime knobs. `.env.example` covers the common path, but first-class overlays in `config/schema/load.rs` for managed Node, memory-tree LLM routes, learning, dictation, context, and auto-update are absent.
6. Runtime dependency downloads are outside normal install proof. Managed Node downloads from nodejs.org; CEF downloads into `~/Library/Caches/tauri-cef` or CI caches; local AI downloads model/runtime assets; npm CLI postinstall downloads GitHub release tarballs. These surfaces need explicit validation and failure-mode docs separate from `pnpm install`.
7. E2E scripts mutate user-local app state. `app/scripts/e2e-run-spec.sh` deletes CEF/WebKit caches and edits `$HOME/.openhuman/config.toml`; safe enough for isolated test machines, but risky for developer machines without clear preflight warnings.
8. Release/package metadata has placeholder surfaces. `packages/npm/package.json` is `0.0.0` until publish-time stamping. That is intentional in `publish-npm.sh`, but not obvious to local auditors and can produce bogus release download attempts outside the release script.

## Next Safe Work

1. Normalize the sidecar-to-in-process migration.
   - Acceptance: `app/scripts/e2e-build.sh`, `docs/BUILDING.md`, `AGENTS.md`, `CLAUDE.md`, and `docs/src-tauri/README.md` no longer mention `scripts/stage-core-sidecar.mjs` or required sidecar staging unless they explicitly describe legacy behavior.
   - Validation: `test -f scripts/stage-core-sidecar.mjs || ! rg -n 'stage-core-sidecar|core:stage.*Stage|app/src-tauri/binaries' app/scripts docs AGENTS.md CLAUDE.md`; `pnpm --filter openhuman-app test:e2e:build` after dependencies/submodules are available.

2. Declare one authoritative JS lockfile policy.
   - Acceptance: repo docs state whether root `pnpm-lock.yaml` is authoritative, and either remove/refresh `app/pnpm-lock.yaml` or add a guard that fails when it drifts from `app/package.json`.
   - Validation: `pnpm install --frozen-lockfile`; `pnpm --filter openhuman-app compile`; a small script or `pnpm dedupe --check`-style guard if adopted.

3. Add a local dependency bootstrap/check command.
   - Acceptance: one command reports Node/pnpm/Rust versions, initialized submodule status, missing `node_modules`, missing CEF cache, and whether vendored `cargo-tauri` is installed, without performing network writes by default.
   - Validation: `pnpm run doctor:deps` or equivalent exits nonzero in this current worktree because submodules and node_modules are missing, and exits zero after setup.

4. Document runtime env overlays beyond `.env.example`.
   - Acceptance: either `.env.example` or a dedicated docs page covers `OPENHUMAN_NODE_*`, memory-tree LLM/env knobs, learning, auto-update, dictation, and context settings, with defaults and whether each is dev/test/production supported.
   - Validation: `rg -o '"OPENHUMAN_[A-Z0-9_]+"' src/openhuman/config/schema/load.rs | sort -u` compared against the documented table.

5. Make E2E home-directory mutation explicit and safer.
   - Acceptance: `app/scripts/e2e-run-spec.sh` prints a clear warning before touching `$HOME/.openhuman/config.toml`, supports an opt-in override to force all state under `OPENHUMAN_WORKSPACE`, or documents why Appium cannot inherit env and why backup/restore is sufficient.
   - Validation: targeted shell test or dry-run mode proving config backup/restore behavior; `pnpm debug e2e <one spec>` on a machine with dependencies.

6. Clean CI package-manager drift.
   - Acceptance: `.github/workflows/build-windows.yml`, commented E2E examples, and `e2e/docker-compose.yml` consistently use pnpm or clearly explain why Yarn is intentionally required by the selected image.
   - Validation: `rg -n 'yarn install|yarn workspace|cache: yarn' .github e2e app/scripts scripts docs` only returns intentional compatibility notes.

## Validation Candidates

- Required queue validation: `git status --short`. Expected after this report: one added file, `?? docs/overnight/openhuman-dependency-surface.md`, until the report is committed or otherwise collected.
- Dependency presence check: `git submodule status --recursive`. Expected now: fail/precondition warning because both Tauri vendor submodules have leading `-`. Expected after setup: no leading `-`.
- JS install: `pnpm install --frozen-lockfile`. Expected now: may need network/cache; not run for this read-only audit. Required before frontend validation because `node_modules` is absent.
- Frontend typecheck: `pnpm --filter openhuman-app compile`. Expected now: fail if deps are not installed. Expected after `pnpm install`: pass or reveal TypeScript issues unrelated to this report.
- Root Rust check: `cargo check --manifest-path Cargo.toml`. Expected to be the cheapest Rust core proof if cargo cache is warm; does not require Tauri submodules.
- Tauri Rust check: `cargo check --manifest-path app/src-tauri/Cargo.toml`. Expected now: fail because vendored path deps are empty. Expected after submodule init and CEF prerequisites: pass or reveal platform-specific CEF issues.
- Unit tests: `pnpm debug unit`. Expected now: fail without `app/node_modules`; expected after install to run Vitest with bounded output and logs under `target/debug-logs/`.
- Rust tests with mock backend: `pnpm debug rust` or `bash scripts/test-rust-with-mock.sh`. Expected to start the mock backend and run cargo tests; may be expensive.
- E2E build: `pnpm --filter openhuman-app test:e2e:build`. Expected now: fail on missing `scripts/stage-core-sidecar.mjs`, missing JS deps, and/or missing submodules. This is the sharpest proof for the stale sidecar script after basic deps are available.

## Non-Goals

- No product code was edited.
- No generated dependency directories were created intentionally.
- No dependency upgrades, lockfile rewrites, package installs, submodule initialization, CEF downloads, Node runtime downloads, local AI downloads, or cargo builds were performed.
- No secrets, local `.env` values, external services, release assets, deploys, pushes, PRs, or tracker state were touched.
- No attempt was made to validate public release availability or npm/GitHub asset contents.

## Unknowns

- Whether CI images already include a valid vendored `cargo-tauri` and CEF cache for all release platforms; local worktree evidence only proves the isolated submodules are empty.
- Whether `app/pnpm-lock.yaml` is intentionally retained for standalone `app/` installs or simply stale. Current root workspace setup points to root `pnpm-lock.yaml` as authoritative.
- Whether the missing `scripts/stage-core-sidecar.mjs` is intentionally removed everywhere except stale scripts/docs, or whether an E2E-compatible replacement is planned.
- Whether Windows workflow Yarn usage is legacy drift or required by a separate release environment.
- Whether every `OPENHUMAN_*` env var discovered by grep is intended for public documentation; several are tests/dev/live-debug toggles and should be classified before expanding `.env.example`.
