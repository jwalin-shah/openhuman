## 2025-02-14 - Fix Shell Injection via string interpolation in sh -c
**Vulnerability:** Shell Command Injection via user-controlled data being directly interpolated into an `sh -c` string argument.
**Learning:** Even with an initial validation loop rejecting specific shell characters, string interpolation into `sh -c` is a fundamentally weak pattern (defense-in-depth is good, but root-cause elimination is better). Positional arguments (`$1`) via `sh -c '...' -- "$1"` eliminate the need for error-prone character filtering, keeping user input strictly as a variable and out of the evaluated shell syntax.
**Prevention:** When passing variables to `sh -c` or similar shells, always pass user input as explicit positional arguments (`-- "$1" "$2"`) rather than interpolating strings dynamically.
