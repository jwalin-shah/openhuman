## 2025-05-02 - Fix Shell Injection Vulnerability in Screenshot Tool
**Vulnerability:** Shell injection vulnerability in `src/openhuman/tools/impl/browser/screenshot.rs` via the `output_path` parameter.
**Learning:** `format!()` used inside `sh -c` is dangerous if the variables being interpolated are user-controllable. While the filename itself was sanitized, the workspace directory could theoretically introduce malicious characters. By placing `$1` in the script text and supplying the variable via `sh -c '...' sh <var>`, we safely escape the parameter in bash without having to guess which characters to strip.
**Prevention:** Pass variables as positional arguments when running inline shell scripts with `sh -c` instead of directly interpolating strings.
