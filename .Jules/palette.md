## 2024-04-29 - Icon-only buttons lacking ARIA labels
**Learning:** Found multiple instances where icon-only action buttons in complex components (like ActionableCard) lacked `aria-label` tags, despite having a `title` tag, which is insufficient for accessibility.
**Action:** Always ensure that an `aria-label` is present on all icon-only buttons (`<button>` with only `<svg>` children) to comply with basic accessibility standards, regardless of the presence of a `title` attribute.
