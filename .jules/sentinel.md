## 2024-05-18 - Shell Injection via interpolation into sh -c string
**Vulnerability:** Constructing a shell script string by directly interpolating a user-controlled value into it before passing it to `sh -c` is a command injection risk. In `ScreenshotTool` and other places, shell scripts were created with `format!("... {path} ...")`.
**Learning:** `sh -c` executes the script string using a shell parser. An attacker can use shell metacharacters like `'` or `;` to break out of single quotes, unless the value is strictly validated or escaped.
**Prevention:** Pass user-controlled variables as positional arguments to the shell script instead of interpolating them. e.g., `sh -c 'gnome-screenshot -f "$1"' sh "$PATH"`.
