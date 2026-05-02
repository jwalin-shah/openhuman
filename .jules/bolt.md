
## 2024-05-18 - [Memoizing Markdown parsers to prevent O(n^2) rendering performance penalties]
**Learning:** Wrap computationally expensive React components, such as react-markdown parsers in chat interfaces (e.g., AgentMessageBubble), with React.memo(). This prevents O(n^2) rendering performance penalties when parent components re-render continuously while receiving streaming tokens.
**Action:** Always verify memoization on frequently updated chat interface components to avoid heavy re-renders.
