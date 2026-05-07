# Core bridge & helpers (`app/src-tauri`)

This document replaces the old “SessionService / SocketService” split. The Tauri crate **does not** embed a duplicate Socket.io server or Telegram client; instead it focuses on desktop host concerns, the **in-process core lifecycle**, and **HTTP JSON-RPC** to the embedded core server.

## `CoreProcessHandle` (`core_process.rs`)

- Starts the embedded `openhuman_core` HTTP/JSON-RPC server as a Tokio task and exposes its RPC URL (`OPENHUMAN_CORE_RPC_URL`).
- Detects stale standalone `openhuman-core` listeners on the core port and replaces them unless `OPENHUMAN_CORE_REUSE_EXISTING=1` is set for an explicit debug harness.
- Used during app setup in `lib.rs` (`app.manage(core_handle)`).

## `core_rpc` (`core_rpc.rs`)

- HTTP client for the core’s JSON-RPC surface (localhost).
- Used by **`core_rpc_relay`** to forward `method` + `params` from the frontend.

## `commands/core_relay.rs`

- **`core_rpc_relay`** — ensures the core is running through the in-process handle, then calls `core_rpc`.
- **`ensure_service_managed_core_running`** — bootstraps systemd/launchd-style service when RPC is down (platform-specific behavior inside core CLI).

## `commands/openhuman.rs`

- Daemon host JSON config (e.g. tray visibility) under the app data directory.
- Install/start/stop/status/uninstall helpers for the **openhuman** background service.

## `utils/dev_paths.rs`

- Resolves **`src/openhuman/agent/prompts`** for development and bundled resource paths for AI preview.

## `utils/tauriSocket.ts` (frontend)

Not in `src-tauri`, but **pairs** with the shell: the React app listens for Tauri events that mirror socket activity when using the Rust-side client. See `app/src/utils/tauriSocket.ts` and `docs/src/03-services.md`.

---

_Previous: [Commands](./02-commands.md)_
