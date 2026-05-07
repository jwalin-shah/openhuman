# openhuman-sym208-recovery dependency-surface audit

Queue item: `openhuman-sym208-recovery-dependency-surface`
Branch: `codex/goal-openhuman-sym208-recovery-dependency-surface`
Audit date: 2026-05-07
Focus area: dependency surface

## Scope and non-goals

This is a read-only dependency-surface audit. I did not change product code,
generated data, secrets, deploy configuration, external services, or trackers.
The only intended repository mutation is this report.

Non-goals:

- Do not initialize git submodules, install dependencies, fetch package indexes,
  run external services, build installers, upload artifacts, push branches, or
  open PRs.
- Do not repair stale docs or workflows in this slice.
- Do not run heavyweight validation that would require network access, signing
  credentials, GitHub packages, a display server, Appium, or CEF downloads.

## Worker handoff status

Changed file:

- `docs/overnight/openhuman-sym208-recovery-dependency-surface.md`

Commit status:

- No new commit was created. `git commit -m "docs: add openhuman dependency surface audit"`
  failed because the sandbox could not create the worktree git index lock:
  `fatal: Unable to create '/Users/jwalinshah/projects/openhuman/.git/worktrees/openhuman-sym208-recovery-dependency-surface/index.lock': Operation not permitted`.
- Current HEAD remains `f11f217809841cf8e3a7f694d8e80967d8e188b8`.

PR status:

- No PR was created; external pushes and PR creation are out of scope for this
  queue item.

Required validation:

- `git status --short` ran successfully after the report was written and
  returned `?? docs/overnight/`, reflecting this untracked docs-only report.

## Repo purpose and state

OpenHuman is a desktop-first assistant stack with a Rust core, a Tauri v2 shell,
a React/Vite app, JSON-RPC/CLI entrypoints, local workspace state, and multiple
release/package surfaces.

Local state observed:

- `pwd` returned
  `/Users/jwalinshah/projects/agent-stack/.agent-stack-worktrees/2026-05-07-overnight-marathon/openhuman-sym208-recovery-dependency-surface`.
- `git branch --show-current` returned
  `codex/goal-openhuman-sym208-recovery-dependency-surface`.
- `git rev-parse HEAD` returned
  `f11f217809841cf8e3a7f694d8e80967d8e188b8`.
- Initial `git status --short` returned no entries.
- `git clean -ndX` returned no ignored files to remove.
- `du -sh app/src-tauri/vendor target app/node_modules node_modules 2>/dev/null`
  observed `0B app/src-tauri/vendor` and exited non-zero because the other
  local build/install directories are absent.
- `ps`/`pkill` process inspection was blocked by sandbox permissions. The
  initial `llm-tldr tree .` probe produced no output for several polls and only
  completed much later with a very large JSON tree, so targeted `rg`/`rtk`
  probes were used for the audit.

Toolchain observed:

- `node --version`: `v25.9.0`.
- `pnpm --version`: `10.10.0`.
- `cargo --version`: `cargo 1.93.0 (083ac5135 2025-12-15)`.
- `rustc --version`: `rustc 1.93.0 (254b59607 2026-01-19)`.

## Dependency map

### Package managers and locks

- [package.json](../../package.json) pins `packageManager` to `pnpm@10.10.0`
  and delegates nearly all app commands through `pnpm --filter openhuman-app`.
- [pnpm-workspace.yaml](../../pnpm-workspace.yaml) includes only `"app"`.
- [pnpm-lock.yaml](../../pnpm-lock.yaml) is the root workspace lock and includes
  both the root importer and the `app` importer.
- [app/pnpm-lock.yaml](../../app/pnpm-lock.yaml) is a second app-local lockfile.
  It is not the workspace lock used by root CI commands and has visible drift
  from the root lock, for example `@sentry/react` resolves to `10.49.0` there
  while the root lock resolves it to `10.50.0`.
- [remotion/package.json](../../remotion/package.json) and
  [remotion/pnpm-lock.yaml](../../remotion/pnpm-lock.yaml) define a separate
  Remotion project that is not part of the root pnpm workspace.
- [Cargo.toml](../../Cargo.toml) is the root Rust core crate and produces
  `openhuman-core`, `slack-backfill`, and `gmail-backfill-3d`.
- [Cargo.lock](../../Cargo.lock) is present for the root core.
- [app/src-tauri/Cargo.toml](../../app/src-tauri/Cargo.toml) is a separate
  Tauri Cargo package with its own [app/src-tauri/Cargo.lock](../../app/src-tauri/Cargo.lock).

### Rust core dependencies

[Cargo.toml](../../Cargo.toml) has a broad runtime surface:

- HTTP/RPC/server: `axum`, `tower`, `reqwest`, `tokio`, `tokio-tungstenite`,
  `socketioxide`.
- Persistence/data: `rusqlite` with `bundled`, `postgres`, `serde_*`, `toml`,
  `directories`.
- Crypto/secrets: `aes-gcm`, `chacha20poly1305`, `argon2`, `ring`, `rustls`,
  `hmac`, `sha2`.
- Local/desktop hardware: `cpal`, `hound`, `arboard`, `rdev`, `enigo`,
  `starship-battery`, `whisper-rs`.
- Optional feature surfaces: `matrix-sdk`, `fantoccini`, `pdf-extract`,
  `whatsapp-rust`, `landlock`, `rppal`.
- A `[patch.crates-io]` override points `whisper-rs-sys` to
  `https://github.com/tinyhumansai/whisper-rs-sys.git` on branch `main`.

`cargo metadata --locked --no-deps --format-version 1` succeeded for the root
core package. It showed the root package only as the workspace member, which
means the root cargo workspace does not own the Tauri package.

### Tauri shell dependencies

[app/src-tauri/Cargo.toml](../../app/src-tauri/Cargo.toml) makes the desktop
host depend on:

- Tauri 2.10 with `cef`, `devtools`, `tray-icon`, `macos-private-api`,
  `unstable`, and `webview-data-url`.
- Vendored path dependencies:
  `vendor/tauri-cef/crates/tauri-runtime-cef` and
  `vendor/tauri-plugin-notification`.
- `openhuman_core = { path = "../..", package = "openhuman", default-features = false }`,
  so the core is linked in-process.
- Platform-specific dependencies: macOS Objective-C/WebKit/notification crates,
  macOS `rusqlite`, Unix `nix`, and Linux `notify-rust`.
- `[patch.crates-io]` entries patch all Tauri crates to local
  `vendor/tauri-cef` paths plus plugin git revisions for upstream
  `plugins-workspace`.

`git submodule status --recursive` showed both Tauri vendor submodules with a
leading `-`, meaning neither is initialized locally:

- `app/src-tauri/vendor/tauri-cef` at `f1ee9554ffc414524ed6c2013dd286f0fe38907f`.
- `app/src-tauri/vendor/tauri-plugin-notification` at
  `36c4004f3d6cd23c6ee0574d29eea65504a8f3ff`.

`git ls-files -s app/src-tauri/vendor/tauri-cef app/src-tauri/vendor/tauri-plugin-notification`
confirmed both are gitlink entries (`160000`). `app/src-tauri/vendor` is `0B`
in this worktree.

`cargo metadata --manifest-path app/src-tauri/Cargo.toml --locked --no-deps --format-version 1`
succeeded, but because `--no-deps` does not build or resolve path source
contents deeply, this does not prove a Tauri build can run. Local Tauri build,
test, and `cargo tauri` commands should be expected to fail until submodules
are initialized.

### Frontend dependencies

[app/package.json](../../app/package.json) requires Node `>=24.0.0` and defines
the React/Vite/Tauri app commands. Main dependencies include React 19, Redux
Toolkit, React Router 7, Sentry React, Socket.IO client, Remotion player,
Three.js, Radix Dialog, `debug`, and Node polyfills.

Dev dependencies include TypeScript `~5.8.3`, Vite `^8.0.0`, Vitest 4,
Testing Library, WDIO 9, Appium service, ESLint 9, Prettier 3, Tailwind 3,
Knip, and `@tauri-apps/cli` 2.10.0.

Local dependency installation is absent:

- `pnpm --filter openhuman-app exec tsc --version` failed with
  `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "tsc" not found`.
- `pnpm --filter openhuman-app exec vite --version` failed with
  `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "vite" not found`.

Expected cause: `node_modules` and `app/node_modules` are not present in this
worktree, and installing dependencies was out of scope for this audit.

### Remotion side project

[remotion/package.json](../../remotion/package.json) is a separate private
project named `"remotion"` with its own lockfile and scripts for Remotion
studio, bundle, lint, and transparent `.mov` rendering. It is not included in
`pnpm-workspace.yaml`.

The app also imports Remotion at runtime via `app/package.json` and files under
`app/src/features/human/Mascot/`. The standalone `remotion/` directory appears
to be an asset-generation sidecar, not the source of the shipped runtime
components. That split should be documented or folded into workspace tooling.

### Release and distribution surfaces

- [packages/npm/package.json](../../packages/npm/package.json) defines the npm
  package `openhuman`, but its checked-in version is `0.0.0`.
- [packages/npm/install.js](../../packages/npm/install.js) downloads a
  prebuilt `openhuman-core-${VERSION}-${target}` archive from GitHub Releases
  during npm `postinstall`, verifies a SHA-256 checksum fetched from the same
  release channel, and extracts `bin/openhuman-bin`.
- [packages/npm/bin/openhuman.js](../../packages/npm/bin/openhuman.js) shells to
  the downloaded binary.
- [scripts/release/publish-npm.sh](../../scripts/release/publish-npm.sh) stamps
  the npm package version before publishing and sets
  `SKIP_OPENHUMAN_BINARY_DOWNLOAD=1`.
- [scripts/release/verify-version-sync.js](../../scripts/release/verify-version-sync.js)
  checks `app/package.json`, `app/src-tauri/tauri.conf.json`,
  `app/src-tauri/Cargo.toml`, and root `Cargo.toml`; it does not check
  `packages/npm/package.json`.
- `node scripts/release/verify-version-sync.js` passed with
  `[verify-version-sync] OK 0.53.16`.
- [scripts/release/package-cli-tarball.sh](../../scripts/release/package-cli-tarball.sh)
  packages `openhuman-core` tarballs and optionally uploads them with `gh release upload`
  when `GITHUB_TOKEN` is set.
- [scripts/release/render-homebrew-core-formula.sh](../../scripts/release/render-homebrew-core-formula.sh)
  downloads a GitHub source tarball and computes a formula SHA, so it is
  network-dependent and not a local validation command.
- [Dockerfile](../../Dockerfile) builds the root `openhuman-core` binary in a
  multi-stage image and runs it as non-root with `OPENHUMAN_CORE_HOST=0.0.0.0`.
- [e2e/docker-compose.yml](../../e2e/docker-compose.yml) pulls
  `ghcr.io/tinyhumansai/openhuman_ci:latest` and still runs a `yarn workspace`
  command even though the repo is pnpm-based.

### CI dependency surfaces

- [.github/Dockerfile](../../.github/Dockerfile) builds the CI image with Rust
  1.93.0, Node 24.x, pnpm 10.10.0, system GUI dependencies, `sccache`,
  `tauri-driver`, and the vendored CEF-aware `cargo-tauri` compiled from the
  Tauri submodule.
- [.github/workflows/build.yml](../../.github/workflows/build.yml) uses the
  GHCR CI image, checks out submodules recursively, installs pnpm deps from
  the root lockfile, caches `~/.cache/tauri-cef`, and builds a Linux `.deb`.
- [.github/workflows/typecheck.yml](../../.github/workflows/typecheck.yml)
  installs pnpm deps, runs TypeScript compile, Prettier, ESLint, rustfmt, and
  `cargo clippy -p openhuman`.
- [.github/workflows/test.yml](../../.github/workflows/test.yml) runs frontend
  coverage, core Rust tests, and Tauri shell Rust tests. The Linux/macOS E2E
  jobs are commented out.
- [.github/workflows/coverage.yml](../../.github/workflows/coverage.yml)
  enforces diff coverage with Vitest and `cargo-llvm-cov`; it checks out Tauri
  submodules recursively for Rust Tauri coverage.
- [.github/workflows/build-desktop.yml](../../.github/workflows/build-desktop.yml)
  is the reusable desktop release matrix. It installs pnpm, checks out
  submodules, caches CEF downloads, compiles the vendored CEF-aware Tauri CLI,
  validates signing prerequisites, builds Tauri installers, uploads Sentry DIFs,
  and optionally uploads release assets.
- [.github/workflows/build-windows.yml](../../.github/workflows/build-windows.yml)
  still uses Yarn cache and `yarn install --frozen-lockfile` despite no
  `yarn.lock` being present.
- [.github/workflows/release-packages.yml](../../.github/workflows/release-packages.yml)
  says the standalone CLI packaging workflow is disabled except for
  `workflow_dispatch`, but the jobs still include release uploads, npm publish,
  apt repo deployment, and smoke tests.

### Environment variables and local state

The documented env surface is large:

- [.env.example](../../.env.example) covers Rust core, backend URL, core RPC,
  workspace path, model config, browser flags, web search, proxy, local AI
  binary overrides, skills registry overrides, Sentry, logging, and service
  mock state.
- [app/.env.example](../../app/.env.example) covers frontend `VITE_*` values:
  core RPC, backend URL, Telegram bot username, skills repo, Sentry, dev JWT,
  onboarding flags, tool timeout, core RPC timeout, OAuth app-version gate, and
  download URL.
- [app/src/utils/config.ts](../../app/src/utils/config.ts) is the frontend
  config centralization point. It computes defaults for backend URL, core RPC
  timeout, tool timeout, Sentry release, app environment, skills repo, and
  dev-only JWT.
- [src/openhuman/config/schema/load.rs](../../src/openhuman/config/schema/load.rs)
  is the Rust config/env overlay. It resolves default local storage under
  `.openhuman` or `.openhuman-staging`, supports `OPENHUMAN_WORKSPACE`, reads
  `active_user.toml` and `active_workspace.toml`, and writes config atomically.
- `rg -o` over env names found more than 100 `OPENHUMAN_*`, `VITE_*`,
  `SENTRY_*`, `SKILLS_*`, `BACKEND_URL`, `JWT_TOKEN`, and `CEF_PATH` tokens.
  Some are real configuration knobs, some are test fixtures or generated
  catalog content. The env catalog is not currently normalized into one
  machine-readable list.

Ignored local/generated state from [.gitignore](../../.gitignore):

- Secrets and env: `.env`, `.env.local`, `.env.*.local`, `scripts/ci-secrets.json`,
  `scripts/ci-secrets.local.json`, `.secrets`, `.vars`, `tauri.key`,
  `tauri.key.pub`.
- Build/install artifacts: `node_modules`, `dist`, `dist-ssr`, `/target/`,
  `src-tauri/target/`, `.target-codex/`, `target-test-run`.
- Test/debug artifacts: logs, `prompt-dumps/`, `e2e-results/`, `wdio-logs/`,
  `test-results/`, `coverage/`, `.fastembed_cache`,
  `app/src-tauri/runtime-skill-*`.

## Risks and stale assumptions

1. **Local Tauri dependency setup is brittle without submodules.**
   `app/src-tauri/Cargo.toml` patches Tauri crates and depends on
   `vendor/tauri-cef` and `vendor/tauri-plugin-notification`, but this worktree
   has uninitialized gitlinks and `0B app/src-tauri/vendor`. Any local Tauri
   build/test command should first run `git submodule update --init --recursive`.

2. **Several workflows/scripts still assume Yarn or a sidecar-era build.**
   The repo is pnpm-based, `core:stage` is a no-op, and `tauri.conf.json` has no
   `externalBin`, but stale references remain in `scripts/worktree-bootstrap.sh`,
   `app/scripts/e2e-build.sh`, `e2e/docker-compose.yml`,
   `.github/workflows/build-windows.yml`, `scripts/test-ci-local.sh`,
   `docs/src-tauri/README.md`, and `AGENTS.md`.

3. **`app/scripts/e2e-build.sh` references a missing script.**
   The file calls `node "$REPO_ROOT/scripts/stage-core-sidecar.mjs"`, but
   `test -f scripts/stage-core-sidecar.mjs` returned `1`. This is a hard local
   E2E build blocker unless the script is restored or the sidecar step is
   removed.

4. **Npm package version checking is incomplete.**
   `packages/npm/package.json` is checked in as `0.0.0`; release publishing
   stamps the version dynamically, but `verify-version-sync.js` does not include
   the npm package. A human running or packaging from the checked-in npm package
   would target `v0.0.0` release assets.

5. **Multiple lockfiles can drift.**
   The root pnpm workspace lock, app-local pnpm lock, Remotion lock, root
   Cargo lock, and Tauri Cargo lock all exist. At least the app-local lock has
   observable drift from the root lock. CI mostly uses the root pnpm lock, so
   local `cd app && pnpm install` behavior can differ from root CI.

6. **Dependency audit coverage is partial and best-effort.**
   Weekly review runs `cargo-audit` and Knip, but `docs/WEEKLY-CODE-REVIEW.md`
   still says npm audit is out of scope because of Yarn v1, which is stale now
   that the repo uses pnpm. The scheduled report records failures rather than
   failing the workflow.

7. **The npm installer verifies checksums from the same release channel as the
   downloaded binary.**
   `packages/npm/install.js` checks SHA-256, but the checksum and binary both
   come from GitHub Releases. This protects against transfer corruption, not a
   compromised release asset channel. Tauri updater artifacts have a minisign
   pubkey in `tauri.conf.json`; the npm binary channel does not appear to have
   an equivalent signature gate.

8. **CEF is a large implicit local and CI dependency.**
   `.github/Dockerfile`, `.github/workflows/build.yml`, and
   `.github/workflows/build-desktop.yml` cache CEF under platform cache dirs.
   Local `scripts/ensure-tauri-cli.sh` sets `CEF_PATH` under
   `~/Library/Caches/tauri-cef`. Failed or partial CEF downloads can create
   environment-specific build failures that `cargo metadata` will not reveal.

9. **Release package workflow is dispatchable despite being described as
   disabled.**
   `.github/workflows/release-packages.yml` is `workflow_dispatch` only, but if
   manually run it still has jobs that upload release assets, update Homebrew,
   publish npm, build an apt repo, and open an issue. That is an explicit
   external-service surface requiring human confirmation.

10. **Windows build workflow has unresolved stale references.**
    `.github/workflows/build-windows.yml` runs Yarn without a `yarn.lock`, and
    its final upload step references `steps.core-paths.outputs.*` even though
    no `core-paths` step exists in that workflow.

11. **Env documentation is broad but not complete.**
    `.env.example` and `app/.env.example` cover the main knobs, but code search
    found many additional env tokens from scripts, test fixtures, WebView APIs,
    CEF, live tests, and local debug tools. A generated env inventory would
    reduce surprise for local workers.

12. **Debug scripts can touch real local state or real services.**
    E2E scripts write `~/.openhuman/config.toml`, debug scripts load
    `JWT_TOKEN`/`BACKEND_URL`, release scripts use signing and publishing
    secrets, and Docker/CI scripts can pull from GHCR or GitHub Releases. These
    should remain out of automatic worker execution unless the work order
    explicitly authorizes external effects.

## Validation command candidates

Required queue validation:

- `git status --short`
  - Expected after this report is written: one added file under `docs/overnight/`
    unless it has been committed.
  - Expected after committing the report: no output.

Cheap local proof commands:

- `node scripts/release/verify-version-sync.js`
  - Observed pass: `[verify-version-sync] OK 0.53.16`.
  - Limitation: does not check `packages/npm/package.json`.
- `cargo metadata --locked --no-deps --format-version 1`
  - Observed pass for the root core manifest.
  - Limitation: metadata-only, no compile.
- `cargo metadata --manifest-path app/src-tauri/Cargo.toml --locked --no-deps --format-version 1`
  - Observed pass, but it does not prove the uninitialized Tauri submodule paths
    are buildable.
- `git submodule status --recursive`
  - Observed local blocker: both vendor submodules are uninitialized.
- `pnpm --filter openhuman-app exec tsc --version`
  - Observed fail: `Command "tsc" not found` because dependencies are not
    installed locally.
- `pnpm --filter openhuman-app exec vite --version`
  - Observed fail: `Command "vite" not found` for the same reason.

Heavier validation candidates, expected status in this worktree:

- `git submodule update --init --recursive`
  - Expected to be required before Tauri shell builds. Not run because it
    fetches external repositories.
- `pnpm install --frozen-lockfile`
  - Expected to be required before frontend typecheck/test commands. Not run
    because install/fetch was out of scope.
- `pnpm --filter openhuman-app compile`
  - Expected to fail until dependencies are installed.
- `cargo check --manifest-path app/src-tauri/Cargo.toml`
  - Expected to fail until Tauri vendor submodules and CEF-related local state
    are present.
- `bash app/scripts/e2e-build.sh`
  - Expected to fail immediately on missing `scripts/stage-core-sidecar.mjs`
    unless that stale sidecar step is removed or restored.
- `bash scripts/weekly-code-review.sh /tmp/openhuman-weekly-review`
  - Expected to generate a report but skip/fail subchecks if dependencies or
    `cargo-audit` are unavailable. It is best-effort by design.

## Next safe work

### Task 1: Normalize package-manager entrypoints

Acceptance criteria:

- Replace stale Yarn commands in active scripts/workflows with pnpm, or mark
  retired scripts clearly.
- Update `e2e/docker-compose.yml`, `scripts/worktree-bootstrap.sh`,
  `.github/workflows/build-windows.yml`, `scripts/test-ci-local.sh`, and docs
  that still instruct `yarn`.
- Remove or justify `app/pnpm-lock.yaml` if the root workspace lock is the
  authoritative pnpm lock.

Validation:

- `rg -n "\\byarn\\b|cache: yarn|yarn install|yarn workspace" package.json app/package.json scripts app/scripts e2e .github docs -g '!*.lock'`
  should show only intentionally retained historical text.
- `pnpm install --frozen-lockfile --ignore-scripts` from repo root should pass
  in an environment with registry access.

### Task 2: Repair sidecar-era E2E and bootstrap assumptions

Acceptance criteria:

- Remove the missing `scripts/stage-core-sidecar.mjs` call from
  `app/scripts/e2e-build.sh` or restore a documented replacement.
- Align `scripts/worktree-bootstrap.sh`, `docs/src-tauri/README.md`, `AGENTS.md`,
  and `docs/BUILDING.md` with the current in-process core architecture and
  `core:stage` no-op.
- Ensure local E2E setup no longer writes stale sidecar binaries or refers to
  nonexistent `externalBin`.

Validation:

- `test -f scripts/stage-core-sidecar.mjs; echo $?` should either be irrelevant
  because no active script references it, or return `0` if restored.
- `rg -n "stage-core-sidecar|externalBin|core:stage|sidecar removed|openhuman-core" app/scripts scripts docs AGENTS.md app/package.json app/src-tauri/tauri.conf.json`
  should show only current, accurate references.
- `bash app/scripts/e2e-build.sh` should progress past setup in a bootstrapped
  worktree.

### Task 3: Make dependency validation explicit

Acceptance criteria:

- Add a local `pnpm deps:check` or script that verifies submodule initialization,
  root lockfile authority, Node/pnpm/Rust versions, and presence/absence of
  required local install artifacts without mutating the tree.
- Include `packages/npm/package.json` and Remotion version/dependency ownership
  in version/dependency validation, or document why they are deliberately
  excluded.
- Document which validation commands are offline-safe versus network/signing
  dependent.

Validation:

- `node scripts/release/verify-version-sync.js` should still pass and either
  include npm package checks or explicitly report that npm is release-stamped.
- New dependency check command should fail clearly when submodules are
  uninitialized and when `node_modules` is absent, without running install.
- `git status --short` should remain clean after the check.

### Task 4: Add JS dependency audit coverage

Acceptance criteria:

- Update `docs/WEEKLY-CODE-REVIEW.md` and `scripts/weekly-code-review.sh` now
  that the repo uses pnpm, not Yarn v1.
- Add a pnpm audit/dependency-review lane with allowlisted false positives and
  clear severity thresholds.
- Include root workspace and Remotion if Remotion remains a separate package.

Validation:

- `bash scripts/weekly-code-review.sh /tmp/openhuman-weekly-review`
  generates Markdown and JSON with JS dependency audit results.
- Missing pnpm or audit network access is reported explicitly rather than
  silently skipped.

### Task 5: Harden release/package channels

Acceptance criteria:

- Decide whether `release-packages.yml` should remain manually dispatchable,
  be deleted, or be split into disabled archival docs plus active Docker-only
  release steps.
- Add signature verification or provenance notes for npm-downloaded
  `openhuman-core` binaries, not only checksum verification from the same
  GitHub release.
- Extend release version sync to cover package surfaces, including
  `packages/npm/package.json` policy.

Validation:

- `node scripts/release/verify-version-sync.js 0.53.16` catches all intended
  package-version drift.
- `DRY_RUN=true bash scripts/release/publish-npm.sh v0.53.16` runs only in a
  disposable worktree and leaves expected package metadata changes documented.
- `rg -n "workflow_dispatch|npm publish|gh release upload|HOMEBREW_TAP_TOKEN|APT_SIGNING_KEY|NODE_AUTH_TOKEN" .github scripts packages`
  has each external write surface documented.

## Unknowns

- Whether the main developer worktree already has the Tauri submodules and
  node modules initialized; this isolated worktree does not.
- Whether `app/pnpm-lock.yaml` is intentionally retained for `cd app` workflows
  or is stale.
- Whether the `remotion/` project is still actively used to generate shipped
  mascot assets, or only historical/prototype source.
- Whether npm distribution is still supported now that `release-packages.yml`
  says core distribution is Docker-only.
- Whether CEF cache corruption or version mismatch has an existing local
  doctor command; I did not find a dependency-specific offline doctor.
- Whether GitHub dependency review or Dependabot/Renovate exists outside this
  checkout; no local Dependabot/Renovate config was found under `.github`.
- Whether the package-manager migration from Yarn to pnpm is complete or still
  intentionally in progress.

## Command log

Commands run during the audit:

- `llm-tldr tree .` - initially produced no output for several polls, then
  eventually completed with a very large JSON tree.
- `pwd && git status --short --branch`
- `rg --files -g '!*target*' -g '!node_modules' -g '!app/node_modules'`
- `command -v llm-tldr`
- `command -v rtk`
- `rg --files` for manifests, lockfiles, env examples, workflow files, Docker
  files, and Tauri config.
- `git rev-parse --show-toplevel --abbrev-ref HEAD HEAD`
- `rtk read` on root/app Cargo manifests, package manifests, env examples,
  release scripts, Docker files, workflows, config files, and E2E scripts.
- `git submodule status --recursive`
- `du -sh app/src-tauri/vendor target app/node_modules node_modules 2>/dev/null`
- `git clean -ndX`
- `git ls-files -s app/src-tauri/vendor/tauri-cef app/src-tauri/vendor/tauri-plugin-notification`
- `node scripts/release/verify-version-sync.js`
- `node --version`
- `pnpm --version`
- `cargo --version`
- `rustc --version`
- `sed -n '1,80p'` on root/app/remotion pnpm locks and Cargo lock.
- `rg -o` for environment variable token inventory.
- `cargo metadata --locked --no-deps --format-version 1`
- `cargo metadata --manifest-path app/src-tauri/Cargo.toml --locked --no-deps --format-version 1`
- `pnpm --filter openhuman-app exec tsc --version`
- `pnpm --filter openhuman-app exec vite --version`
- `test -f scripts/stage-core-sidecar.mjs; printf '%s\n' $?`
- `rg -n` for Yarn/pnpm/CEF/sidecar/workflow references.
