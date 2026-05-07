# Tauri IPC commands (`app/src-tauri`)

All commands are registered in **`app/src-tauri/src/lib.rs`** inside `tauri::generate_handler![...]` (desktop build). Names below are the **Rust** command names (camelCase in JS via serde where applicable).

## Core JSON-RPC connection

| Command                | Purpose                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `core_rpc_url`         | Return the localhost HTTP JSON-RPC URL for the embedded core server.                    |
| `core_rpc_token`       | Return the per-process bearer token that frontend RPC calls must send.                  |
| `restart_core_process` | Restart the embedded core server through `CoreProcessHandle`.                           |
| `overlay_parent_rpc_url` | Return the parent RPC URL for overlay windows when `OPENHUMAN_CORE_RPC_URL` is set.   |

Use **`app/src/services/coreRpcClient.ts`** (`callCoreRpc`) from the frontend. It calls `core_rpc_url` and `core_rpc_token`, then sends authenticated HTTP JSON-RPC directly with `fetch`.

## Window management

From **`lib.rs`** (see `generate_handler!` for the authoritative list):

| Command                | Purpose                                      |
| ---------------------- | -------------------------------------------- |
| `activate_main_window` | Focus the main window from overlays/notifications |
| `mascot_window_show`   | Show the mascot/native window                |
| `mascot_window_hide`   | Hide the mascot/native window                |

## Screen share picker (CEF / macOS)

From **`screen_capture/mod.rs`**. Backs the in-page `getDisplayMedia` shim in `webview_accounts/runtime.js`. Session-gated: the shim must open a session with a live user gesture before enumeration / thumbnail captures succeed. See issue #713 (picker UX) + #812 (session gating).

| Command                           | Purpose                                                                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `screen_share_begin_session`      | Open a 30s session from an account webview, after a `navigator.userActivation.isActive` gesture. Returns `{ token, sources }`. Rate-limited to 10/minute per account. |
| `screen_share_thumbnail`          | Capture a single source's thumbnail as base64 PNG. Requires a live token and an `id` that the session was issued for. macOS only; other platforms return an error.    |
| `screen_share_finalize_session`   | Close the session. Called by the shim on Share or Cancel; safe to call with an unknown/expired token (no-op).                                                         |

## Removed / not present

The following **do not** exist in the current `generate_handler!` list: `exchange_token`, `get_auth_state`, `socket_connect`, `start_telegram_login`. Authentication and sockets are handled in the **React** app and **core** process, not via these IPC names.

## Example: core RPC

```typescript
import { callCoreRpc } from "../services/coreRpcClient";

const result = await callCoreRpc<MyType>({
  method: "your.rpc.method",
  params: { foo: "bar" },
});
```

---

_See `app/src-tauri/src/lib.rs` for the authoritative list._
