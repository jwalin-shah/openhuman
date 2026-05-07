# openhuman-sym85 dependency-surface audit

Queue item: `openhuman-sym85-dependency-surface`

Date: 2026-05-07

## Scope

This was a read-only dependency-surface audit except for this report. I did not
edit product code, generated data, secrets, external services, deploys, pushes,
or PRs.

Repository purpose, from local evidence: OpenHuman is a desktop app and core
runtime split across a root Rust crate, a Tauri shell, and a React/Vite app:

- `Cargo.toml` defines the root `openhuman` crate, `openhuman_core` library, and
  `openhuman-core` binary.
- `app/package.json` defines the `openhuman-app` Vite/Tauri workspace.
- `app/src-tauri/Cargo.toml` links the root crate as `openhuman_core` and
  patches Tauri to a vendored CEF fork.
- `pnpm-workspace.yaml` includes only `app`, not `remotion` or `packages/npm`.
- `remotion/package.json` is a standalone package with its own lockfile.
- `packages/npm/package.json` is a separate CLI distribution package surface.

## Branch and dirty state

- Current branch: `codex/goal-openhuman-sym85-dependency-surface`.
- Current HEAD before this report: `f11f217809841cf8e3a7f694d8e80967d8e188b8`.
- Initial `git status --short --branch`: clean branch output only.
- Initial `git status --short`: no output.
- `git submodule status` showed both Tauri vendor submodules with leading `-`,
  meaning they are recorded but not initialized locally:
  - `app/src-tauri/vendor/tauri-cef`
  - `app/src-tauri/vendor/tauri-plugin-notification`
- `du -sh target app/node_modules node_modules app/src-tauri/vendor app/src-tauri/target remotion/node_modules remotion/out app/dist app/coverage .fastembed_cache`
  found only `0B app/src-tauri/vendor`; the command exited non-zero because the
  other probed local artifact paths were absent.
- `git status --short --ignored` produced no output before the report existed,
  so this worktree had no visible ignored build artifacts or dependency
  directories.

## Commands run

- `llm-tldr tree .` - completed, produced a large JSON tree. Key local surfaces:
  `app/`, `src/`, `tests/`, root manifests, and docs.
- `rg --files -g 'package.json' -g 'pnpm-lock.yaml' -g 'Cargo.toml' ...` -
  found root, app, Tauri, Remotion, Docker, workflow, env, and lockfile surfaces.
- `rtk read package.json`, `rtk read app/package.json`,
  `rtk read remotion/package.json`, `rtk read Cargo.toml`,
  `rtk read app/src-tauri/Cargo.toml` - read dependency and script definitions.
- `rtk read .env.example`, `rtk read app/.env.example`,
  `rtk read scripts/load-dotenv.sh`, `rtk read app/src/utils/config.ts`,
  `rtk read src/openhuman/config/schema/load.rs` - read env contract surfaces.
- `git submodule status` - confirmed missing local vendor submodule checkouts.
- `cargo check --manifest-path app/src-tauri/Cargo.toml --locked` - failed
  before compilation because the vendored Tauri CEF path dependency is absent.
- `node --version`, `pnpm --version`, `rustc --version`, `cargo --version` -
  local tools are `node v25.9.0`, `pnpm 10.10.0`, `rustc 1.93.0`, and
  `cargo 1.93.0`.

## Dependency surfaces

### JavaScript and TypeScript

- `package.json` is private, pins `packageManager` to pnpm 10.10.0, uses a root
  `resolutions` entry forcing `@tauri-apps/api` to `2.10.1`, and delegates most
  scripts to `openhuman-app`.
- `pnpm-workspace.yaml` contains only `packages: ["app"]`. That makes
  `app/package.json` part of the root workspace but leaves `remotion/` and
  `packages/npm/` outside the workspace.
- `app/package.json` requires Node `>=24.0.0`, has 34 runtime dependencies, 40
  dev dependencies, and 49 scripts by local `node -e` count. It includes React
  19, Tauri v2 packages, Sentry, Remotion player packages, WDIO/Appium E2E
  tooling, Vitest, ESLint, Prettier, Tailwind, and `knip`.
- `app/package.json` script `core:stage` is now a no-op saying the core is
  linked in-process and the sidecar was removed in PR #1061.
- `remotion/package.json` is standalone, private, and not in
  `pnpm-workspace.yaml`. It has its own `remotion/pnpm-lock.yaml`, React
  19.2.3, Tailwind 4.0.0, and render scripts under `remotion/scripts/`.
- `packages/npm/package.json` publishes a CLI wrapper named `openhuman`, with
  `postinstall: node install.js`, but the checked-in package version is
  `0.0.0`.
- `packages/npm/install.js` downloads release assets from
  `https://github.com/tinyhumansai/openhuman/releases/download/v${VERSION}` and
  verifies a `.sha256` file before extracting to `bin/openhuman-bin`.

Important drift: there are three pnpm locks: `pnpm-lock.yaml`,
`app/pnpm-lock.yaml`, and `remotion/pnpm-lock.yaml`. The root lock is the one CI
uses for the app workspace, while `app/pnpm-lock.yaml` is a second app-level
lock. They already differ: root `pnpm-lock.yaml` resolves `@sentry/react` to
10.50.0 for `app`, while `app/pnpm-lock.yaml` resolves it to 10.49.0. That is a
stale-install risk for agents who run commands from `app/` and trust the local
lockfile.

### Rust

- `rust-toolchain.toml` pins Rust to `1.93.0` with `rustfmt` and `clippy`.
- Root `Cargo.toml` defines three binaries: `openhuman-core`, `slack-backfill`,
  and `gmail-backfill-3d`.
- Root `Cargo.toml` has high-risk native/runtime dependencies: `reqwest` with
  `rustls-tls`, `native-tls`, `http2`, `multipart`, and `socks`; `rusqlite`
  with bundled SQLite; `whisper-rs`; `cpal`; `rdev`; `enigo`; `arboard`;
  `postgres`; `socketioxide`; Sentry; OpenTelemetry; and optional Matrix,
  browser-native, PDF, WhatsApp, Linux Landlock, and Raspberry Pi features.
- Root `Cargo.toml` patches `whisper-rs-sys` from
  `https://github.com/tinyhumansai/whisper-rs-sys.git` on branch `main`, not a
  fixed commit in the manifest. `Cargo.lock` pins the resolved revision, but a
  fresh resolution without lock discipline can drift.
- `app/src-tauri/Cargo.toml` depends on `openhuman_core` by path `../..`, so the
  desktop shell and core dependency graph are coupled locally.
- `app/src-tauri/Cargo.toml` patches Tauri crates to path dependencies under
  `app/src-tauri/vendor/tauri-cef` and patches selected Tauri plugins to fixed
  git revisions.
- `app/src-tauri/Cargo.toml` also depends on
  `app/src-tauri/vendor/tauri-plugin-notification`.
- `cargo metadata --no-deps --manifest-path Cargo.toml --format-version 1`
  succeeded and reported `target_directory` as
  `/Users/jwalinshah/.cargo-target-shared`, outside this repo.
- `cargo metadata --no-deps --manifest-path app/src-tauri/Cargo.toml` also
  succeeded, but `cargo check --manifest-path app/src-tauri/Cargo.toml --locked`
  failed because the missing submodule path has no `Cargo.toml`.

### Docker and CI images

- Root `Dockerfile` builds only the root Rust core binary and explicitly
  ignores the app through `.dockerignore`.
- `.dockerignore` excludes `app/`, `docs/`, `scripts/`, `.github/`, `tests/`,
  `target/`, `node_modules/`, `.env*`, and includes `Cargo.lock`. This makes
  the Docker image a headless core build context, not a desktop app build.
- `.github/Dockerfile` builds the CI image with Rust 1.93.0, Node 24.x, pnpm
  10.10.0, sccache, tauri-driver, CEF runtime libs, and a vendored
  `cargo-tauri` built from `app/src-tauri/vendor/tauri-cef`.
- `.github/workflows/docker-ci-image.yml` builds and pushes
  `ghcr.io/tinyhumansai/openhuman_ci:latest` and
  `ghcr.io/tinyhumansai/openhuman_ci:rust-1.93.0`.
- `e2e/docker-compose.yml` runs the GHCR CI image and bind-mounts the repo at
  `/app`, with named volumes for Cargo registry/git caches.
- `e2e/Dockerfile` is marked deprecated and still describes an older local E2E
  image path.

### External downloads and local-only state

- `src/openhuman/node_runtime/bootstrap.rs` resolves managed Node installs to
  an explicit config cache dir, otherwise OS user cache
  `dirs::cache_dir()/openhuman/node-runtime`, otherwise
  `{workspace}/node-runtime` as a last resort.
- `src/openhuman/node_runtime/downloader.rs` fetches Node distributions from
  `https://nodejs.org/dist`, downloads `SHASUMS256.txt`, streams the archive,
  verifies SHA-256, and removes partial or tampered files.
- `src/openhuman/local_ai/paths.rs` stores shared local AI assets under the
  root OpenHuman directory, not the repo: `~/.openhuman` or
  `~/.openhuman-staging` depending on env, with `bin/ollama` and
  `models/local-ai`.
- `src/openhuman/config/schema/local_ai.rs` defaults STT and TTS download URLs
  to Hugging Face assets and defaults provider/model IDs for Ollama-backed
  local AI.
- `src/openhuman/local_ai/install.rs` downloads Ollama from `ollama.com` using
  platform-specific shell or PowerShell scripts and writes into the configured
  OpenHuman install dir.
- `src/openhuman/skills/ops_install.rs` installs fetched `SKILL.md` files into
  `~/.openhuman/skills/<slug>/SKILL.md`, not the repo. It enforces HTTPS,
  length, private-address rejection, a 1 MiB body cap, frontmatter validation,
  and atomic write, but its own comment notes DNS rebinding is not fully closed.
- `app/src-tauri/tauri.conf.json` bundles prompt resources from
  `../../src/openhuman/agent/prompts` and `recipes/**/*`, and it exposes updater
  metadata pointing at GitHub Releases.
- `scripts/ensure-tauri-cli.sh` writes/uses `CEF_PATH`, defaulting to
  `$HOME/Library/Caches/tauri-cef`, and installs `cargo-tauri` from the
  vendored CEF fork when present.

### Environment contract

- Root `.env.example` documents core, Tauri, backend, logging, proxy, storage,
  skills, local AI, and Sentry variables. It contains `OPENHUMAN_APP_ENV=staging`
  twice.
- `app/.env.example` documents browser-exposed `VITE_*` variables and states
  that only `VITE_` variables are exposed to the browser.
- `scripts/load-dotenv.sh` parses `.env` manually and exports key/value pairs.
  It strips comments and simple quotes, but does not implement full dotenv
  grammar.
- `app/src/utils/config.ts` centralizes frontend `VITE_*` reads. Local evidence
  includes `VITE_OPENHUMAN_CORE_RPC_URL`, `VITE_TOOL_TIMEOUT_SECS`,
  `VITE_CORE_RPC_TIMEOUT_MS`, `VITE_CONSUMER_FIRST_SESSION`,
  `VITE_SKILLS_GITHUB_REPO`, `VITE_SENTRY_DSN`, `VITE_BACKEND_URL`,
  `VITE_DEV_JWT_TOKEN`, `VITE_MINIMUM_SUPPORTED_APP_VERSION`,
  `VITE_LATEST_APP_DOWNLOAD_URL`, and `VITE_SENTRY_SMOKE_TEST`.
- `src/openhuman/config/schema/load.rs` applies many runtime env overrides,
  including `OPENHUMAN_WORKSPACE`, proxy settings, local AI tier, Node runtime,
  Sentry, learning, memory-tree, update, dictation, and context settings.
- A local `rg -o` env inventory found a much larger set of env names than the
  examples document, including test/live flags and release-only variables:
  `OPENHUMAN_CORE_REUSE_EXISTING`, `OPENHUMAN_DISABLE_CHANNEL_LISTENERS`,
  `OPENHUMAN_NODE_CACHE_DIR`, `OPENHUMAN_OLLAMA_BASE_URL`,
  `OPENHUMAN_SCREEN_INTELLIGENCE_MOCK_VISION_JSON`, `SENTRY_AUTH_TOKEN`,
  `SENTRY_PROJECT_TAURI`, and others.
- `.github/workflows/build-desktop.yml` depends on repo secrets/vars for Tauri
  signing, Apple notarization, Sentry source maps/DIFs, updater signing, and
  backend URL injection.

## Risks and stale assumptions

1. Missing Tauri submodules block local desktop validation.
   - Evidence: `git submodule status` showed both vendor submodules uninitialized.
   - Evidence: `cargo check --manifest-path app/src-tauri/Cargo.toml --locked`
     failed with missing
     `app/src-tauri/vendor/tauri-cef/crates/tauri/Cargo.toml`.
   - Impact: any worker trying Tauri shell checks in this worktree will fail
     before reaching code-level validation.

2. Sidecar documentation and scripts are internally inconsistent.
   - Evidence: `app/package.json` says `core:stage` is a no-op because the core
     is linked in-process.
   - Evidence: `app/scripts/e2e-build.sh` still calls
     `node "$REPO_ROOT/scripts/stage-core-sidecar.mjs"`.
   - Evidence: `scripts/stage-core-sidecar.mjs` is missing.
   - Evidence: `AGENTS.md`, `CLAUDE.md`, `docs/BUILDING.md`, and
     `docs/src-tauri/README.md` still tell agents to stage a sidecar through
     `scripts/stage-core-sidecar.mjs`.
   - Impact: future workers will follow stale validation instructions and stop
     on a missing file.

3. Duplicate frontend lockfiles can produce dependency drift.
   - Evidence: root `pnpm-lock.yaml` and `app/pnpm-lock.yaml` both define app
     dependencies.
   - Evidence: root lock resolves `@sentry/react` to 10.50.0 while app lock
     resolves 10.49.0.
   - Impact: agents running from the root and agents running from `app/` may
     install different transitive graphs.

4. Release/package surfaces are partly disabled but still runnable.
   - Evidence: `.github/workflows/release-packages.yml` says release packages
     are disabled while core distribution is Docker-only, but it still exposes
     `workflow_dispatch` and jobs that build/publish npm, apt, and Homebrew
     package channels.
   - Evidence: `packages/npm/package.json` version is `0.0.0`, while
     `packages/npm/install.js` downloads release artifacts for that version.
   - Impact: manual workflow dispatch or local package testing can publish or
     test against non-product artifact assumptions unless guarded elsewhere.

5. External downloaders write outside the repo.
   - Evidence: managed Node runtime writes to user cache or workspace fallback.
   - Evidence: local AI writes Ollama and model files under the shared
     OpenHuman root directory.
   - Evidence: skill install writes to `~/.openhuman/skills`.
   - Impact: audit or validation commands that exercise these paths can mutate
     user-local state, use network, and leave large artifacts outside git.

6. Env documentation is not complete enough to be a contract.
   - Evidence: the env inventory found many names not present in `.env.example`
     or `app/.env.example`.
   - Impact: hidden env knobs can change behavior in CI, tests, local
     validation, and release builds without a single reviewed index.

7. Native and GUI dependencies make cheap validation environment-sensitive.
   - Evidence: root Rust deps include audio/input/clipboard/browser/native
     packages; Tauri deps require CEF, GTK/WebKit, Apple notarization secrets,
     Sentry, and updater signing for full release paths.
   - Impact: "just run all checks" is not cheap or portable; validation needs
     preflighted lanes.

## Validation candidates

Required queue validation:

- `git status --short`
  - Observed after this report: exits 0 and shows only `?? docs/overnight/`
    because the report directory is new and untracked.

Cheap dependency-surface probes:

- `git submodule status`
  - Current observed status: exits 0, but both vendor submodules have leading
    `-`, so desktop validation is blocked until checkout.
- `pnpm --version && node --version`
  - Current observed status: pnpm 10.10.0 and Node v25.9.0 satisfy
    `app/package.json` `node >=24.0.0`.
- `cargo metadata --no-deps --manifest-path Cargo.toml --format-version 1`
  - Current observed status: passes, root metadata readable.
- `cargo metadata --no-deps --manifest-path app/src-tauri/Cargo.toml --format-version 1`
  - Current observed status: passes metadata-only, despite missing path deps.
- `cargo check --manifest-path app/src-tauri/Cargo.toml --locked`
  - Current observed status: fails before compilation due missing
    `app/src-tauri/vendor/tauri-cef/crates/tauri/Cargo.toml`.
- `pnpm install --frozen-lockfile`
  - Expected status: not run in this audit because it would populate
    dependency directories. It should be the root install command once a worker
    is allowed to create local dependency state.
- `pnpm --filter openhuman-app compile`
  - Expected status: blocked until dependencies are installed from the root
    lockfile.
- `pnpm --filter openhuman-app rust:check`
  - Expected status: fails until submodules are initialized, then becomes the
    focused Tauri shell check.

## Next safe work

1. Reconcile sidecar/in-process docs and scripts.
   - Files likely touched: `AGENTS.md`, `CLAUDE.md`, `docs/BUILDING.md`,
     `docs/src-tauri/README.md`, `app/scripts/e2e-build.sh`, and any still-live
     references found by `rg -n "stage-core-sidecar|core:stage|sidecar removed"`.
   - Acceptance criteria: no live command points at missing
     `scripts/stage-core-sidecar.mjs`; docs distinguish standalone
     `openhuman-core` harnesses from the in-process Tauri core; E2E build
     script either stops staging or calls an existing script.
   - Validation: `rg -n "stage-core-sidecar|core:stage|sidecar removed" .`,
     `bash app/scripts/e2e-build.sh --help` if a help/dry-run mode exists, and
     `git status --short`.

2. Decide the authoritative frontend lockfile boundary.
   - Files likely touched: `pnpm-lock.yaml`, `app/pnpm-lock.yaml`,
     `pnpm-workspace.yaml`, `app/package.json`, and developer docs.
   - Acceptance criteria: one documented install path for the app; duplicate
     app lockfile either removed or explicitly made authoritative for commands
     run from `app/`; CI and docs use the same lockfile.
   - Validation: `pnpm install --frozen-lockfile`,
     `pnpm --filter openhuman-app compile`, `pnpm --filter openhuman-app lint`.

3. Add a dependency preflight for Tauri vendor state.
   - Files likely touched: `scripts/worktree-bootstrap.sh`,
     `scripts/ensure-tauri-cli.sh`, `app/package.json`, and docs.
   - Acceptance criteria: a worker can run one cheap command and get a clear
     pass/fail for submodules, vendored `cargo-tauri`, CEF cache expectations,
     and Rust/Node versions before starting a long build.
   - Validation: run the preflight in this worktree and confirm it reports the
     missing submodules without starting a build; after submodule init, confirm
     it passes.

4. Build an env-contract inventory check.
   - Files likely touched: a new script under `scripts/`, `.env.example`,
     `app/.env.example`, and possibly docs.
   - Acceptance criteria: code-discovered env names are compared against the
     examples with allowlists for test-only and CI-only variables; duplicate
     `OPENHUMAN_APP_ENV` is resolved; deprecated vars are labelled.
   - Validation: `node scripts/check-env-contract.mjs`,
     `pnpm --filter openhuman-app compile`.

5. Audit external downloader guardrails as a separate risk-register slice.
   - Files likely touched: tests/docs around `packages/npm/install.js`,
     `src/openhuman/node_runtime/*`, `src/openhuman/local_ai/*`, and
     `src/openhuman/skills/ops_install.rs`.
   - Acceptance criteria: each downloader has documented source URL, checksum
     or trust model, max size, destination path, cleanup behavior, network
     opt-out, and a non-network unit test for failure modes.
   - Validation: focused Rust tests for node runtime, skills install validation,
     local AI installer command construction, and a Node test for
     `packages/npm/install.js`.

## Non-goals

- No dependency upgrades.
- No lockfile regeneration.
- No `pnpm install`, `cargo build`, E2E build, or submodule checkout.
- No external network calls.
- No mutation of `~/.openhuman`, Cargo registry/cache, Node modules, CEF cache,
  Ollama install dirs, Sentry, GitHub Releases, npm, Homebrew, apt, or GHCR.
- No PR creation or push.

## Unknowns

- Whether `app/pnpm-lock.yaml` is intentionally retained for app-only workflows
  or is stale.
- Whether `release-packages.yml` should remain manually dispatchable while the
  package distribution path is marked disabled.
- Whether `remotion/` is intentionally outside the pnpm workspace or should be
  linked for shared dependency governance.
- Whether future agents should initialize submodules in every worktree by
  default or only when Tauri validation is in scope.
- Whether all external downloader destinations are acceptable for sandboxed
  automation, given several write outside the repo.

## Handoff

- Changed files: `docs/overnight/openhuman-sym85-dependency-surface.md`.
- Commit SHA: no commit created; current HEAD remains
  `f11f217809841cf8e3a7f694d8e80967d8e188b8`.
- Required validation: `git status --short` exited 0 and reported only
  `?? docs/overnight/`.
- PR URL: none; PR creation is out of scope for this Goal Pack item.
- Blockers: Tauri shell validation is blocked until vendor submodules are
  initialized; dependency install/build commands were intentionally not run
  because this item is an audit-only slice.
