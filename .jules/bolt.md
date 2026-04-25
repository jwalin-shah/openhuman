## 2024-05-18 - First run
**Learning:** Checking for React performance opportunities.
**Action:** Let's look for missing memoizations or excessive renders.
## 2024-05-18 - App render performance in Conversations
**Learning:** Found excessive filters during renders `const visibleMessages = messages.filter(msg => !msg.extraMetadata?.hidden);`
**Action:** Let's look for components using useMemo where the array derivation is expensive or where many children re-render.
## 2024-05-18 - App render performance in Conversations II
**Learning:** Found an opportunity in `app/src/pages/Conversations.tsx`. It uses `visibleMessages = messages.filter(...)` and derived variables (`hasVisibleMessages`, `latestVisibleMessage`, `latestVisibleAgentMessage`) which are recalculated on every render. Given this is the chat interface, these arrays are likely updated frequently or long.
**Action:** Let's memoize `visibleMessages` and its dependent values using `useMemo` in `app/src/pages/Conversations.tsx` to prevent unnecessary recalculations on each render.
