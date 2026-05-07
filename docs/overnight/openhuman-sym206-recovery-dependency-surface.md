# OpenHuman SYM-206 Recovery Dependency Surface Audit

Queue item: `openhuman-sym206-recovery-dependency-surface`
Repo: `openhuman-sym206-recovery`
Focus area: `dependency-surface`
Audit date: 2026-05-07

## Scope

This is a read-only dependency-surface audit. The only repository mutation made for this queue item is this report file.

Non-goals:

- No product code changes.
- No generated data changes.
- No dependency installs.
- No submodule initialization.
- No external service calls, deploys, pushes, PR creation, or tracker updates.
- No attempt to fix stale scripts or docs during the audit.

## Repo Purpose And State

OpenHuman is a mixed desktop application and core runtime repository. The repo contains a React/Vite frontend in `app/`, a Tauri v2 desktop host in `app/src-tauri/`, a Rust core crate and CLI at repo root under `src/`, Remotion video assets under `remotion/`, and npm package publishing scaffolding under `packages/npm/`.

Observed state:

- `git status --short --branch` at audit start: `## codex/goal-openhuman-sym206-recovery-dependency-surface`
- Initial dirty state: clean.
- `git rev-parse HEAD`: `f11f217809841cf8e3a7f694d8e80967d8e188b8`
- `llm-tldr tree .`: completed and returned a large tree with `app/`, `src/`, `tests/`, `remotion/`, `packages/`, `.github/`, `scripts/`, and `docs/`.
- `du -sh . app app/src-tauri`: `41M .`, `16M app`, `1.7M app/src-tauri`; this worktree is small because dependency installs, build outputs, and Tauri vendor submodule contents are absent.

## Commands Run

Discovery commands were local and read-only unless explicitly noted.

| Command | Observation |
| --- | --- |
| `git status --short --branch` | Clean branch at start: `## codex/goal-openhuman-sym206-recovery-dependency-surface`. |
| `git rev-parse HEAD` | Start SHA: `f11f217809841cf8e3a7f694d8e80967d8e188b8`. |
| `llm-tldr tree .` | Large mixed Rust, React/Tauri, scripts, tests, packaging, Remotion, and CI repo. |
| `rg --files -g 'package.json' -g 'Cargo.toml' -g '*lock*' -g '.env.example' -g 'Dockerfile' -g 'docker-compose.yml'` | Found root/app/remotion/package manifests, multiple pnpm locks, two Cargo locks, Docker surfaces, and env examples. |
| `pnpm --version` | `10.10.0`, matching root `packageManager`. |
| `node --version` | `v25.9.0`; satisfies app `>=24.0.0` but differs from CI Node 24.x. |
| `rustc --version` | `rustc 1.93.0 (254b59607 2026-01-19)`, matching `rust-toolchain.toml`. |
| `git submodule status --recursive` | Both Tauri vendor submodules were uninitialized, shown by leading `-` markers. |
| `fd -H -t d '^node_modules$|^target$|^dist$|^coverage$|^out$|^debug-logs$' .` | No installed JS deps or local build/cache outputs found in this worktree. |
| `cargo metadata --manifest-path Cargo.toml --no-deps` | Succeeded; root build and target directory are `/Users/jwalinshah/.cargo-target-shared`. |
| `cargo metadata --manifest-path app/src-tauri/Cargo.toml --no-deps` | Succeeded; app Tauri build and target directory are also `/Users/jwalinshah/.cargo-target-shared`. |
| `rg -o 'OPENHUMAN_[A-Z0-9_]+' ... | sort -u | wc -l` | Found 130 distinct `OPENHUMAN_*` references across repo/docs/scripts/env examples. |
| `rg -o 'VITE_[A-Z0-9_]+' ... | sort -u | wc -l` | Found 22 distinct `VITE_*` references across repo/docs/scripts/env examples. |

## Dependency Surface Map

### JavaScript And Workspace Dependencies

Evidence:

- `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `app/package.json`
- `app/pnpm-lock.yaml`
- `remotion/package.json`
- `remotion/pnpm-lock.yaml`
- `packages/npm/package.json`

Observed shape:

- Root `package.json` pins `packageManager` to `pnpm@10.10.0+sha512...`.
- Root `package.json` contains 24 scripts and mostly delegates app work through `pnpm --dir app ...` or `pnpm --filter openhuman-app ...`.
- Root dependency counts from `jq`: one dependency, one devDependency, 24 scripts.
- `pnpm-workspace.yaml` includes only `app`.
- `app/package.json` has 34 dependencies, 40 devDependencies, 49 scripts, and requires Node `>=24.0.0`.
- `remotion/package.json` is independent of the root workspace. It has 8 dependencies, 6 devDependencies, and 6 scripts.
- `packages/npm/package.json` is also outside the root workspace. It has no dependencies, no devDependencies, and a `postinstall` script that runs `node install.js`.

Important surface area:

- There are three pnpm lockfiles: `pnpm-lock.yaml`, `app/pnpm-lock.yaml`, and `remotion/pnpm-lock.yaml`.
- Root `pnpm-lock.yaml` has importers for `.` and `app`.
- `app/pnpm-lock.yaml` has an importer only for `.`.
- `remotion/pnpm-lock.yaml` has an importer only for `.`.
- Root lock and `app/pnpm-lock.yaml` are not perfectly aligned. One concrete observed drift: root lock's app importer resolved `@sentry/react` to `10.50.0`, while `app/pnpm-lock.yaml` had `10.49.0`.
- `remotion/` and `packages/npm/` are not covered by the root workspace, so root validation can miss those dependency surfaces.

Risk:

Agents or contributors running `pnpm install` from different directories can resolve different app trees. Root-only CI may not protect `remotion/` or `packages/npm/` dependency health.

### Package Manager Drift

Evidence:

- `package.json`
- `app/package.json`
- `scripts/worktree-bootstrap.sh`
- `scripts/setup-dev-codesign.sh`
- `app/scripts/e2e-build.sh`
- `.github/workflows/typecheck.yml`
- `.github/workflows/test.yml`

Observed shape:

- Active manifests and CI use pnpm.
- Some local scripts and docs still reference Yarn commands, for example `scripts/worktree-bootstrap.sh` and `scripts/setup-dev-codesign.sh`.
- No `yarn.lock` was observed in the manifest inventory.

Risk:

Yarn references can keep stale bootstrap paths alive after pnpm migration. These paths are especially risky because they appear in local setup and E2E setup scripts, not just old prose.

### Rust Core Dependencies

Evidence:

- `Cargo.toml`
- `Cargo.lock`
- `rust-toolchain.toml`
- `src/main.rs`
- `src/lib.rs`
- `src/openhuman/`
- `tests/json_rpc_e2e.rs`

Observed shape:

- Root crate package name is `openhuman`, version `0.53.16`.
- Root binaries include `openhuman-core` from `src/main.rs`, plus `slack-backfill` and `gmail-backfill-3d`.
- Root library is `openhuman_core`.
- Root `Cargo.lock` contains roughly 851 crate packages.
- `rust-toolchain.toml` pins Rust `1.93.0` and includes `rustfmt` and `clippy`.
- `rust-toolchain.toml` includes a local rationale that Rust is pinned below `1.94` because of a `matrix-sdk` recursion overflow.
- Root dependencies include broad runtime surfaces: `tokio`, `axum`, `reqwest`, `rusqlite`, `sentry`, `opentelemetry`, `socketioxide`, `rquickjs`, `whisper-rs`, `cpal`, `arboard`, `rdev`, `image`, and many protocol/API crates.
- Optional features include `channel-matrix`, `browser-native`, `rag-pdf`, `whatsapp-web`, `sandbox-landlock`, and `sandbox-bubblewrap`.
- Root `[patch.crates-io]` points `whisper-rs-sys` at `https://github.com/tinyhumansai/whisper-rs-sys.git` on branch `main`.

Risk:

The git branch patch for `whisper-rs-sys` is a dependency drift point. `Cargo.lock` pins the resolved state today, but regenerating or updating the lock can pull a new upstream branch head unless the patch is revised to a fixed rev or vendored source.

### Tauri Host And Vendored Dependencies

Evidence:

- `app/src-tauri/Cargo.toml`
- `app/src-tauri/Cargo.lock`
- `app/src-tauri/tauri.conf.json`
- `.gitmodules`
- `scripts/ensure-tauri-cli.sh`
- `.github/Dockerfile`
- `.github/workflows/build-desktop.yml`

Observed shape:

- Tauri package is `OpenHuman`, version `0.53.16`.
- The Tauri app links `openhuman_core` from the repo root path dependency with `default-features = false`.
- Default Tauri features are CEF-focused and include Tauri `cef`, `devtools`, `tray-icon`, `macos-private-api`, `unstable`, and `webview-data-url`.
- Tauri manifest patches many Tauri crates to `app/src-tauri/vendor/tauri-cef/crates/...`.
- Tauri manifest patches `tauri-plugin-notification` to `app/src-tauri/vendor/tauri-plugin-notification`.
- `.gitmodules` declares:
  - `app/src-tauri/vendor/tauri-cef` from `https://github.com/tinyhumansai/tauri-cef.git`, branch `feat/cef`
  - `app/src-tauri/vendor/tauri-plugin-notification` from `https://github.com/tinyhumansai/tauri-plugin-notification.git`
- `git submodule status --recursive` showed both submodules uninitialized:
  - `-f1ee9554ffc414524ed6c2013dd286f0fe38907f app/src-tauri/vendor/tauri-cef`
  - `-36c4004f3d6cd23c6ee0574d29eea65504a8f3ff app/src-tauri/vendor/tauri-plugin-notification`
- `fd -H -t f . app/src-tauri/vendor -d 3` returned no files.
- `scripts/ensure-tauri-cli.sh` explicitly requires `app/src-tauri/vendor/tauri-cef/crates/tauri-cli/Cargo.toml` and exits with a submodule-init instruction if it is missing.
- `.github/Dockerfile` copies the vendored CEF tree and installs the vendored CEF-aware Tauri CLI, so CI image builds also require submodule contents.

Risk:

The Tauri app cannot be compiled or packaged from this worktree until submodules are initialized. This is expected for an audit worktree, but it is a high-friction dependency surface for any implementation worker who starts from a shallow or non-recursive checkout.

### Sidecar To In-Process Core Transition Surface

Evidence:

- `app/package.json`
- `app/scripts/e2e-build.sh`
- `app/src-tauri/src/core_process.rs`
- `scripts/worktree-bootstrap.sh`
- `scripts/setup-dev-codesign.sh`
- `docs/BUILDING.md`
- `AGENTS.md`
- `CLAUDE.md`
- `tests/linux_cef_deb_runtime_e2e.rs`
- `app/src-tauri/tauri.conf.json`

Observed shape:

- `app/package.json` script `core:stage` is now a no-op: `echo '[core:stage] no-op - core is linked in-process; sidecar removed (PR #1061)'`.
- `app/src-tauri/src/core_process.rs` starts with in-process core lifecycle language and embeds the core server task inside the Tauri host.
- `app/scripts/e2e-build.sh` still runs `node "$REPO_ROOT/scripts/stage-core-sidecar.mjs"` before building.
- `rg --files scripts | rg 'stage|sidecar|core'` found no `scripts/stage-core-sidecar.mjs`; the script referenced by `app/scripts/e2e-build.sh` is absent.
- `scripts/worktree-bootstrap.sh` still says it builds and stages a core sidecar.
- `scripts/setup-dev-codesign.sh` still describes code-signing the `openhuman-core` sidecar.
- `docs/BUILDING.md` still says to build `--bin openhuman` and run `pnpm core:stage` to stage a sidecar. The actual root binary name is `openhuman-core`, and `core:stage` is a no-op.
- `AGENTS.md` and `CLAUDE.md` still contain sidecar references from the previous architecture.

Risk:

The in-process core migration is not complete across dependency scripts and docs. The most concrete blocker is `app/scripts/e2e-build.sh`: it calls a missing `scripts/stage-core-sidecar.mjs`, so `pnpm test:e2e:build` is expected to fail before reaching a meaningful Tauri build.

### Environment Variables And Config

Evidence:

- `.env.example`
- `app/.env.example`
- `app/vite.config.ts`
- `app/src/utils/config.ts`
- `scripts/load-dotenv.sh`
- `src/openhuman/config/schema/load.rs`
- `src/openhuman/config/schema/types.rs`
- `Dockerfile`

Observed shape:

- Root `.env.example` documents Rust core, backend, storage, proxy, web search, local AI, skills, Sentry, and desktop behavior.
- App `app/.env.example` documents Vite-facing frontend values including `VITE_OPENHUMAN_CORE_RPC_URL`, `VITE_BACKEND_URL`, `VITE_SKILLS_GITHUB_REPO`, Sentry, development auth, tool timeout, core RPC timeout, and OAuth version gates.
- `app/vite.config.ts` sets `envDir` to the repo root, so Vite reads root `.env` instead of only `app/`.
- `app/src/utils/config.ts` centralizes Vite config and defaults core RPC to `http://127.0.0.1:7788/rpc`.
- `scripts/load-dotenv.sh` requires a repo-root `.env` and exits if it is missing.
- `src/openhuman/config/schema/load.rs` defaults local state to `~/.openhuman-staging` when `OPENHUMAN_APP_ENV=staging`, otherwise `~/.openhuman`, unless `OPENHUMAN_WORKSPACE` is set.
- Distinct env var scan found 130 `OPENHUMAN_*` references but only 34 distinct `OPENHUMAN_*` names documented in `.env.example` and `app/.env.example`.
- Distinct env var scan found 22 `VITE_*` references but only 15 distinct `VITE_*` names documented in `.env.example` and `app/.env.example`.
- `.env.example` includes `OPENHUMAN_APP_ENV=staging` twice.
- `.env.example` includes `OPENHUMAN_CORE_RUN_MODE=child`, but active app code indicates the core is now linked in-process.

Risk:

The env contract is too wide to infer safely from examples. Some variables are real runtime knobs, some appear stale, and some are test-only. The sidecar/in-process transition increases the chance that a stale env example steers local setup toward a removed execution mode.

### Runtime Downloads And External Artifacts

Evidence:

- `src/openhuman/config/schema/node.rs`
- `src/openhuman/node_runtime/bootstrap.rs`
- `src/openhuman/config/schema/local_ai.rs`
- `src/openhuman/local_ai/service/bootstrap.rs`
- `src/openhuman/skills/ops_install.rs`
- `src/openhuman/skills/ops_discover.rs`
- `scripts/ensure-tauri-cli.sh`
- `.github/workflows/build-desktop.yml`
- `packages/npm/install.js`

Observed shape:

- Managed Node runtime defaults to version `v22.11.0`.
- `src/openhuman/node_runtime/bootstrap.rs` reuses system Node only when the major version matches target. Local Node was `v25.9.0`, so runtime code would prefer a managed Node download if that path is exercised.
- Managed Node downloads from `nodejs.org`, verifies checksums, and installs atomically under a cache root, defaulting to OS cache dirs under `openhuman/node-runtime`.
- Local AI defaults include Ollama, Whisper, Piper, embedding, STT, and TTS model IDs/URLs. Bootstrap disables local AI unless explicit opt-in is confirmed.
- Local AI model defaults reference Hugging Face URLs for STT/TTS artifacts.
- Skills install fetches public HTTPS `.md` files, normalizes GitHub blob URLs, limits size to 1 MiB, rejects private/loopback hosts, and writes user-scope skills under `~/.openhuman/skills`.
- Skills discovery scans user roots `~/.openhuman/skills` and `~/.agents/skills`; project roots are gated by a workspace trust marker except for legacy `<workspace>/skills`.
- Tauri CEF support depends on a vendored CEF-aware CLI and a CEF cache such as `~/Library/Caches/tauri-cef` or `~/.cache/tauri-cef`.
- `packages/npm/install.js` downloads release assets from GitHub named `openhuman-core-${VERSION}-${target}` and verifies SHA256. Since `packages/npm/package.json` currently says version `0.0.0`, an actual install would target release `v0.0.0` unless packaging rewrites the version before publish.

Risk:

The repo has several legitimate runtime download surfaces: Node, CEF, local AI tools/models, GitHub release assets, and skills. These need separate validation and threat models. They should not be treated as ordinary package manager installs.

### Generated Artifacts, Caches, And Local State

Evidence:

- `.gitignore`
- `scripts/debug/lib.sh`
- `app/scripts/e2e-run-spec.sh`
- `src/openhuman/config/schema/load.rs`
- `src/openhuman/config/schema/types.rs`
- `Dockerfile`
- `e2e/docker-compose.yml`
- `.github/Dockerfile`

Observed shape:

- `.gitignore` excludes `node_modules`, `dist`, `.env`, `.env.local`, `prompt-dumps/`, `scripts/ci-secrets.json`, `.secrets`, `.vars`, `.actrc`, `.github/act-event.json`, `app/src-tauri/runtime-skill-*`, `e2e-results/`, `wdio-logs/`, `test-results/`, `coverage/`, `tauri.key`, `/target/`, `src-tauri/target/`, `.target-codex/`, `.fastembed_cache`, and `target-test-run`.
- `scripts/debug/lib.sh` writes debug logs to `target/debug-logs`.
- `app/scripts/e2e-run-spec.sh` creates a temp `OPENHUMAN_WORKSPACE` when unset and removes it on exit.
- `app/scripts/e2e-run-spec.sh` also removes platform app state:
  - macOS: `~/Library/WebKit/com.openhuman.app`, `~/Library/Caches/com.openhuman.app`, Application Support, Saved State
  - Linux: `~/.local/share/com.openhuman.app`, `~/.cache/com.openhuman.app`, `~/.config/com.openhuman.app`
- `app/scripts/e2e-run-spec.sh` backs up and edits `~/.openhuman/config.toml` to force the mock API URL, then restores or removes the file on exit.
- Root config defaults put user data under `~/.openhuman` or `~/.openhuman-staging` unless `OPENHUMAN_WORKSPACE` is supplied.
- Root Dockerfile sets `OPENHUMAN_WORKSPACE=/home/openhuman/.openhuman` and exposes core port 7788.
- `e2e/docker-compose.yml` bind-mounts the repo into `/app`, uses `ghcr.io/tinyhumansai/openhuman_ci:latest`, and mounts cargo cache volumes.

Risk:

E2E scripts have deliberate local-state cleanup behavior and can modify `~/.openhuman/config.toml`. That is acceptable inside the harness but should be explicitly documented for agents before they run E2E on a developer machine.

### Security And Desktop Surface

Evidence:

- `SECURITY.md`
- `scripts/setup-chromium-safe-storage.sh`
- `app/src-tauri/tauri.conf.json`
- `src/openhuman/skills/ops_install.rs`
- `src/openhuman/skills/ops_discover.rs`

Observed shape:

- `SECURITY.md` includes credential storage, skills sandbox, dependency chain, and update infrastructure in scope.
- `scripts/setup-chromium-safe-storage.sh` writes or updates `Chromium Safe Storage` in the macOS login keychain and grants permissive access to avoid password prompts.
- Tauri CSP in `app/src-tauri/tauri.conf.json` is broad. It includes `'unsafe-inline'`, `https:`, `wss:`, localhost, data/blob/ipc, and local IP ranges for connect/frame/media/image/script/style contexts.
- Skills install has public-host and size checks, but still writes persistent user-scope executable skill content.
- Skills discovery has a workspace trust gate for `.openhuman/skills` and `.agents/skills`, but legacy `<workspace>/skills` is always scanned.

Risk:

The desktop dependency surface mixes local credentials, webview CSP, runtime downloads, and persistent user-installed skills. Changes in this area should be reviewed as security work, not just dependency maintenance.

### CI And Validation Surfaces

Evidence:

- `.github/workflows/typecheck.yml`
- `.github/workflows/test.yml`
- `.github/workflows/coverage.yml`
- `.github/workflows/build-desktop.yml`
- `.github/Dockerfile`
- `scripts/debug/README.md`
- `scripts/debug/cli.sh`

Observed shape:

- CI uses Rust 1.93 and Node 24.x, while the local node in this worktree was v25.9.0.
- Typecheck workflow runs pnpm install, app compile, format check, lint, Rust fmt, and clippy.
- Rust core and Tauri test workflows use recursive submodules.
- Coverage workflow combines frontend Vitest and Rust `cargo-llvm-cov`, then enforces 80 percent changed-line coverage with `diff-cover`.
- Desktop build workflow uses recursive submodules, CEF cache management, vendored Tauri CLI installation, Sentry symbol upload, and signing/notarization conditionals.
- E2E Linux/macOS jobs are commented out in `.github/workflows/test.yml`; their comments still include older sidecar/Yarn assumptions.
- Debug wrappers under `scripts/debug/` are intended to keep output compact and tee full logs to `target/debug-logs`.

Risk:

CI has stronger setup than a local worktree because many jobs checkout submodules recursively and use the prepared CI image. Local workers need an explicit preflight to avoid confusing missing-submodule failures with product failures.

## Stale Assumptions And Risks

1. Tauri vendor submodules are mandatory but absent in this worktree. `app/src-tauri/Cargo.toml`, `scripts/ensure-tauri-cli.sh`, `.github/Dockerfile`, and `build-desktop.yml` all depend on `app/src-tauri/vendor/tauri-cef` and `app/src-tauri/vendor/tauri-plugin-notification`; `git submodule status --recursive` shows both uninitialized.

2. The sidecar-to-in-process migration is incomplete in scripts and docs. `app/package.json` says `core:stage` is a no-op, but `app/scripts/e2e-build.sh` still calls a missing `scripts/stage-core-sidecar.mjs`.

3. Multiple JS lockfiles create install ambiguity. Root workspace includes only `app`, but `app/pnpm-lock.yaml` and `remotion/pnpm-lock.yaml` also exist. Root and app locks already show at least one version drift for `@sentry/react`.

4. Active package-manager guidance is split between pnpm and older Yarn references. This matters because the stale references are in bootstrap scripts, not only documentation.

5. The env contract is incomplete. Local scan found 130 distinct `OPENHUMAN_*` references and 22 distinct `VITE_*` references, while examples document far fewer and contain stale/duplicated values.

6. `OPENHUMAN_CORE_RUN_MODE=child` is documented in `.env.example` even though the app now links core in-process. This can send implementation workers down a removed sidecar path.

7. Runtime downloads are spread across Node, CEF, local AI, npm package install, and skills install flows. These use different trust and verification models and need separate review.

8. E2E scripts intentionally delete desktop app state and modify `~/.openhuman/config.toml`. This is useful for deterministic tests but risky if run casually on a developer machine.

9. The npm package wrapper in `packages/npm/` appears release-sensitive. With `version: 0.0.0`, `install.js` would look for a GitHub release `v0.0.0` unless release automation rewrites it.

10. `CONTRIBUTING.md` is stale relative to actual submodules and branch policy. It references an `openhuman-skills` submodule and `develop`, while `.gitmodules` has CEF/notification submodules and project instructions say PRs target `main`.

## Validation Candidates

These are candidate proof commands for future implementation work. Only the required queue validation was run for this report.

| Command | Expected Status Now | Notes |
| --- | --- | --- |
| `git status --short` | Pass | Required queue validation. After this report is created it should show only this report unless committed. |
| `git submodule status --recursive` | Pass command, fail preflight | Command runs, but current output has leading `-` for both Tauri vendor submodules. |
| `test -f app/src-tauri/vendor/tauri-cef/crates/tauri-cli/Cargo.toml` | Fail | Expected to fail until submodules are initialized. |
| `pnpm --version` | Pass | Observed `10.10.0`. |
| `node --version` | Pass | Observed `v25.9.0`; app permits `>=24`, CI uses Node 24.x. |
| `rustc --version` | Pass | Observed Rust `1.93.0`, matching `rust-toolchain.toml`. |
| `pnpm --filter openhuman-app compile` | Blocked until install | No `node_modules` in this worktree; command would require local dependency install. |
| `pnpm test:e2e:build` | Expected fail before real build | `app/scripts/e2e-build.sh` calls missing `scripts/stage-core-sidecar.mjs` and Tauri submodules are absent. |
| `cargo check --manifest-path Cargo.toml` | Not run; likely heavy | Root metadata succeeds and does not need Tauri submodules, but full check may be expensive. |
| `cargo check --manifest-path app/src-tauri/Cargo.toml` | Expected fail until submodules initialized | Tauri manifest has path dependencies into absent vendor submodules. |
| `pnpm --dir remotion lint` | Blocked until install | Remotion has independent lock and dependency tree outside the root workspace. |
| `node packages/npm/install.js --help` | Do not run directly | Install script is not a harmless help command; it is designed to download a release asset unless env-gated. |

## Independently Grabbable Next Tasks

### Task 1: Reconcile in-process core scripts and sidecar documentation

Problem:

`app/package.json` and `app/src-tauri/src/core_process.rs` indicate the core is in-process, but active scripts and docs still reference sidecar staging. `app/scripts/e2e-build.sh` currently references a missing `scripts/stage-core-sidecar.mjs`.

Proposed scope:

- Update `app/scripts/e2e-build.sh` to stop calling the removed sidecar staging script or replace it with the correct in-process preflight.
- Update `docs/BUILDING.md`, `scripts/worktree-bootstrap.sh`, and `scripts/setup-dev-codesign.sh` to describe the current in-process core model.
- Audit `AGENTS.md`, `CLAUDE.md`, and test comments for stale sidecar instructions, keeping historical references only where clearly marked.

Acceptance criteria:

- `rg 'stage-core-sidecar|core:stage|sidecar' app/scripts scripts docs AGENTS.md CLAUDE.md` returns only current, intentional references.
- `pnpm test:e2e:build` no longer fails because of missing `scripts/stage-core-sidecar.mjs`; if it fails, the next failure should be the expected submodule/build dependency.
- Docs name the actual root binary `openhuman-core` where standalone core build is still relevant.

Validation commands:

- `rg 'scripts/stage-core-sidecar.mjs' .`
- `pnpm test:e2e:build`
- `git status --short`

### Task 2: Normalize JS workspace and lockfile ownership

Problem:

The repo has root, app, and remotion pnpm locks. The root workspace includes only `app`, and app/root lock drift is already visible.

Proposed scope:

- Decide and document whether `app/pnpm-lock.yaml` is authoritative, stale, or should be removed.
- Decide whether `remotion/` should join `pnpm-workspace.yaml` or remain intentionally isolated.
- Add a short dependency ownership note to a repo docs file so future agents know which directory to run pnpm from.
- Remove or update active Yarn references after confirming no supported Yarn workflow remains.

Acceptance criteria:

- A single source of truth is documented for app dependency installs.
- Root/app lock drift is either removed or explicitly justified.
- Remotion validation is either included in root workspace commands or documented as an independent package.
- Active setup scripts no longer instruct Yarn unless the repo intentionally supports it.

Validation commands:

- `pnpm install --frozen-lockfile`
- `pnpm --filter openhuman-app compile`
- `cd remotion && pnpm install --frozen-lockfile && pnpm lint`
- `rg 'yarn ' scripts docs .github app/scripts`

### Task 3: Add a local dependency preflight for implementation workers

Problem:

Many validation failures are setup failures: absent submodules, absent node_modules, absent CEF cache, and stale sidecar scripts. Workers need a cheap command that classifies dependency setup before running expensive tests.

Proposed scope:

- Add a script such as `scripts/check-local-dependency-surface.sh`.
- Check pnpm version, Node major, Rust version, submodule initialization, required vendor files, CEF cache hints, and lockfile ownership.
- Keep the script read-only and fast.
- Document when to run it in the existing Codex PR checklist or debug README.

Acceptance criteria:

- The script exits nonzero with clear messages when Tauri submodules are absent.
- The script does not install dependencies, fetch submodules, call external services, or modify local state.
- The script identifies whether root/app/remotion dependency installs are present or missing.

Validation commands:

- `bash scripts/check-local-dependency-surface.sh`
- `git submodule status --recursive`
- `git status --short`

### Task 4: Generate an environment-variable contract report

Problem:

The repo references many more `OPENHUMAN_*` and `VITE_*` variables than the examples document, and some documented variables are stale.

Proposed scope:

- Build a script or checked-in report that compares env var references against `.env.example` and `app/.env.example`.
- Categorize variables as user config, CI-only, test-only, deprecated, or internal.
- Remove duplicated `.env.example` entries and mark stale sidecar variables.

Acceptance criteria:

- Every referenced env var is either documented or explicitly ignored with a reason.
- `.env.example` contains no duplicate `OPENHUMAN_APP_ENV`.
- Sidecar-only variables such as `OPENHUMAN_CORE_RUN_MODE=child` are either removed or marked legacy if still needed.

Validation commands:

- `rg -o 'OPENHUMAN_[A-Z0-9_]+' src app scripts docs .env.example app/.env.example | sort -u`
- `rg -o 'VITE_[A-Z0-9_]+' src app scripts docs .env.example app/.env.example | sort -u`
- `git status --short`

### Task 5: Audit npm wrapper release assumptions

Problem:

`packages/npm/install.js` downloads versioned GitHub release assets, but `packages/npm/package.json` currently says version `0.0.0`.

Proposed scope:

- Trace the release workflow that rewrites or publishes `packages/npm`.
- Confirm the expected release asset naming for macOS, Linux, and Windows.
- Add a safe dry-run mode or test around target detection and checksum lookup without downloading external artifacts.

Acceptance criteria:

- Release flow documents how `0.0.0` becomes the published version.
- `install.js` can be tested without network access.
- Missing asset/checksum errors are clear and actionable.

Validation commands:

- `node --check packages/npm/install.js`
- `OPENHUMAN_NPM_INSTALL_DRY_RUN=1 node packages/npm/install.js`
- `git status --short`

## Unknowns

- Whether current maintainers want root-only pnpm lock ownership or intentionally separate root/app/remotion locks.
- Whether `OPENHUMAN_CORE_RUN_MODE` still has a supported non-app use case after the in-process migration.
- Whether package release automation rewrites `packages/npm/package.json` before npm publish.
- Whether the stale sidecar references in tests are intentionally historical or active blockers.
- Whether CEF cache bootstrap is expected to be manual for all local workers or hidden behind a maintained setup script.
- Whether legacy `<workspace>/skills` should remain always-scanned or move behind the same trust marker as `.openhuman/skills` and `.agents/skills`.
- Whether the broad Tauri CSP is a temporary development posture or a deliberate production requirement.

## Decisions Made During Audit

- Did not run dependency installs because the queue item is read-only and product/generated dependency state is out of scope.
- Did not initialize submodules because that would mutate checkout state outside the single report.
- Did not run Tauri, app, or E2E validations because their expected failures are dependency setup failures already evidenced by missing submodules, missing installs, and stale sidecar script references.
- Did not call external services or package download scripts.

## Handoff Notes

The safest immediate work is dependency-surface reconciliation, not feature implementation. Start with the missing sidecar script reference and submodule preflight, then normalize lockfile ownership. Those fixes are independently reviewable and will reduce false-negative validation failures for later product work.

Required validation for this queue item:

```bash
git status --short
```
