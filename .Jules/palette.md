## 2024-05-19 - Accessible Close Buttons in Modals
**Learning:** Found a common pattern where icon-only `<button>` close elements in setup modals (`VoiceSetupModal`, `ScreenIntelligenceSetupModal`, `AutocompleteSetupModal`) were missing an `aria-label`. This pattern is recurring and hurts accessibility for screen readers.
**Action:** When implementing new UI or reviewing existing codebase, always check that any interactive component with only visual icons as children has a proper descriptive `aria-label` (e.g., `aria-label="Close"`).
