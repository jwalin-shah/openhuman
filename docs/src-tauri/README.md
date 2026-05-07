# Tauri shell documentation (`app/src-tauri/`)

This folder is the **desktop host** for OpenHuman: Tauri v2 + WebView, IPC commands, window management, and bridging to the Rust core JSON-RPC server embedded **in-process**. It does **not** duplicate the full domain stack — that lives in the repo-root Rust crate (`openhuman_core`, `src/main.rs` for the standalone `openhuman-core` harness).

## Quick reference

| Document                             | Description                                |
| ------------------------------------ | ------------------------------------------ |
| [Architecture](./01-architecture.md) | Modules and in-process core lifecycle      |
| [IPC commands](./02-commands.md)     | `invoke` commands registered in `lib.rs`   |
| [Core bridge](./03-services.md)      | `core_process`, `core_rpc`, daemon helpers |

## Responsibilities

1. **Web UI** — Load the Vite build from `app/dist` (or dev server on port 1420).
2. **IPC** — Expose a small, explicit set of Tauri commands (see `02-commands.md`).
3. **Core lifecycle** — Ensure the embedded core server is running, expose `core_rpc_url` / `core_rpc_token`, and let `coreRpcClient` perform authenticated HTTP JSON-RPC.
4. **AI prompts on disk** — Resolve bundled `src/openhuman/agent/prompts` from resources / dev cwd for `ai_get_config` / `write_ai_config_file`.
5. **Window + tray** — Desktop window behavior and system tray (see `lib.rs`).

## Core runtime

The current desktop app links `openhuman_core` directly and starts its HTTP/JSON-RPC server as a Tokio task inside the Tauri host. `app/package.json` keeps **`core:stage`** as a compatibility no-op for legacy scripts; it does not stage a binary for the current desktop workflow.

Build the standalone binary only for CLI, debug, service, or release harnesses:

```bash
cargo build --manifest-path Cargo.toml --bin openhuman-core
```

## Related

- Full stack narrative: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
- Frontend: [`../src/README.md`](../src/README.md)
