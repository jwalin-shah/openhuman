## 2024-04-29 - Missing pagination indices on SQLite table

**Learning:** When adding pagination (`LIMIT` / `OFFSET`) and an `ORDER BY` to SQLite tables with potentially unbounded growth (like `integration_notifications`), the default `ORDER BY` becomes a bottleneck as SQLite performs a full O(N log N) file sort, especially for API feeds that are constantly accessed by the UI.
**Action:** Always create a compound index covering `(filter_fields..., sort_field DESC)` to support UI list endpoints, ensuring they remain O(K) where K = OFFSET + LIMIT. I applied this by adding `idx_integration_notifications_received_at` and `idx_integration_notifications_provider_received_at`.
