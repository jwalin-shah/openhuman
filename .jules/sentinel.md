## 2024-05-24 - [Fix] Command injection vulnerability in Screenshot tool
**Vulnerability:** Command injection in Linux `sh -c` invocation within the `ScreenshotTool`.
**Learning:** `sh -c` was called with a string containing the user-provided filename directly interpolated. Although there was a character filter (`SHELL_UNSAFE`), passing interpolated strings into the shell via format is unsafe.
**Prevention:** Pass user inputs as positional arguments to `sh -c` (e.g., using `"$1"` inside the script string, and passing the argument after `--`).
