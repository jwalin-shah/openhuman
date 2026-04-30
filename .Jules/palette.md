## 2026-04-30 - Switch Toggles A11y
**Learning:** Custom switch toggles (using `role="switch"`) were sometimes missing `aria-label` attributes, leaving screen readers without context of what they toggle.
**Action:** Ensure all custom `role="switch"` buttons have an `aria-label` associated with them.
