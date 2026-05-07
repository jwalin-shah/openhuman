# Tauri shell architecture (`app/src-tauri/`)

## Overview

The **`app/src-tauri`** crate (Rust package **`OpenHuman`**, binary **`OpenHuman`**) is a **desktop-only** host. It embeds the React UI, registers plugins (deep link, opener, OS, notifications, autostart, updater), manages the main window and tray, links `openhuman_core`, and starts the core HTTP/JSON-RPC server in-process.

Non-desktop targets fail at compile time (`compile_error!` in `lib.rs`).

## Directory layout (actual)

```
app/src-tauri/src/
├── lib.rs                 # `run()`, tray/menu actions, plugins, `generate_handler!`, core startup
├── main.rs                # Binary entry
├── core_process.rs        # CoreProcessHandle, start/monitor embedded core server
├── core_rpc.rs            # Shared core RPC URL/auth helpers for Tauri-side callers
├── webview_accounts/      # Account webview windows, permissions, notifications
├── screen_capture/        # Screen-share sessions and thumbnail capture
├── notification_settings/ # Notification preferences
└── utils/
    ├── mod.rs
    └── dev_paths.rs       # Resolve bundled AI prompts paths
```

There is **no** `src-tauri/src/services/session_service.rs` in this tree; session semantics are handled in the web layer + backend + core as applicable.

## Data flow: UI → core

```
React coreRpcClient
    → invoke("core_rpc_url") + invoke("core_rpc_token")
    → fetch(OPENHUMAN_CORE_RPC_URL, Authorization: Bearer <token>)
        → embedded openhuman_core server (core::jsonrpc)
```

`CoreProcessHandle` in `core_process.rs` starts the embedded core server, generates the per-process bearer token, and waits for its localhost RPC port to become ready. If a standalone `openhuman-core run` harness is already bound to the port, the default policy treats it as stale unless `OPENHUMAN_CORE_REUSE_EXISTING=1` is set for explicit debugging.

## Window and tray behavior

- The shell creates a tray icon at startup and wires actions to open the main window or quit.
- In daemon mode (`daemon` / `--daemon`), the main window is hidden on launch and can be reopened from tray actions.
- On macOS `RunEvent::Reopen` also restores and focuses the main window.
- Windows and Linux use the same tray actions (`Open OpenHuman`, `Quit`), with desktop-environment-specific tray rendering differences on some Linux setups.

## Bundled resources

`tauri.conf.json` bundles **`../../src/openhuman/agent/prompts`** and recipe resources so prompt markdown and desktop recipes ship with the app.

## Related

- IPC surface: [Commands](./02-commands.md)
- HTTP bridge: [Core bridge](./03-services.md)
- Rust domains (implementation): repo root `src/openhuman/`, `src/core_server/`
