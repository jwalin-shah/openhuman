//! Google Calendar sync helpers — event extraction and field accessors.
//!
//! The Composio response envelope shape for Google Calendar varies
//! slightly depending on backend version and action used. These helpers
//! try multiple JSON pointer paths so the provider remains robust across
//! envelope shapes without brittle assumptions.

use serde_json::Value;

/// Walk the Composio response envelope and pull out event objects.
///
/// Tries multiple paths because the upstream envelope is not fully
/// stable — backend proxy versions differ in where they nest `items`.
pub(crate) fn extract_events(data: &Value) -> Vec<Value> {
    let candidates = [
        data.pointer("/data/items"),
        data.pointer("/items"),
        data.pointer("/data/events"),
        data.pointer("/events"),
        data.pointer("/data/data/items"),
    ];
    for cand in candidates.into_iter().flatten() {
        if let Some(arr) = cand.as_array() {
            if !arr.is_empty() {
                return arr.clone();
            }
        }
    }
    // Last resort: if the top-level value is itself an array (some proxy
    // versions unwrap the envelope entirely).
    if let Some(arr) = data.as_array() {
        return arr.clone();
    }
    Vec::new()
}

/// Extract the event's unique identifier.
///
/// Tries multiple paths to handle different envelope nesting levels.
pub(crate) fn event_id(event: &Value) -> Option<String> {
    let candidates = [
        event.pointer("/id"),
        event.pointer("/data/id"),
        event.pointer("/eventId"),
        event.pointer("/data/eventId"),
    ];
    for cand in candidates.into_iter().flatten() {
        if let Some(s) = cand.as_str() {
            let trimmed = s.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

/// Extract the event summary (title), defaulting to `"(no title)"`.
pub(crate) fn event_summary(event: &Value) -> String {
    let candidates = [event.pointer("/summary"), event.pointer("/data/summary")];
    for cand in candidates.into_iter().flatten() {
        if let Some(s) = cand.as_str() {
            let trimmed = s.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }
    "(no title)".to_string()
}

/// Extract the event start time as an ISO 8601 string.
///
/// Google Calendar events may use `dateTime` (for timed events) or
/// `date` (for all-day events). Returns `None` if neither is present.
pub(crate) fn event_start_iso(event: &Value) -> Option<String> {
    let candidates = [
        event.pointer("/start/dateTime"),
        event.pointer("/start/date"),
        event.pointer("/data/start/dateTime"),
        event.pointer("/data/start/date"),
    ];
    for cand in candidates.into_iter().flatten() {
        if let Some(s) = cand.as_str() {
            let trimmed = s.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

/// Extract the event's last-updated timestamp as an ISO 8601 string.
///
/// Used as the sync cursor watermark — the provider advances the cursor
/// to the most recent `updated` value seen in a sync pass.
pub(crate) fn event_update_time(event: &Value) -> Option<String> {
    let candidates = [event.pointer("/updated"), event.pointer("/data/updated")];
    for cand in candidates.into_iter().flatten() {
        if let Some(s) = cand.as_str() {
            let trimmed = s.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

/// Current time as milliseconds since the Unix epoch.
pub(crate) fn now_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Format an ISO 8601 timestamp offset by `days` days from now.
///
/// Returns an RFC 3339 / ISO 8601 string suitable for the Google Calendar
/// `timeMin` / `timeMax` query parameters.
pub(crate) fn iso_offset_days(days: i64) -> String {
    use chrono::{Duration, Utc};
    let dt = Utc::now() + Duration::days(days);
    dt.format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // ── extract_events ─────────────────────────────────────────────────

    #[test]
    fn extract_events_from_data_items() {
        let data = json!({ "data": { "items": [{"id": "evt1"}, {"id": "evt2"}] } });
        let events = extract_events(&data);
        assert_eq!(events.len(), 2);
    }

    #[test]
    fn extract_events_from_top_level_items() {
        let data = json!({ "items": [{"id": "evt1"}] });
        let events = extract_events(&data);
        assert_eq!(events.len(), 1);
    }

    #[test]
    fn extract_events_from_data_events() {
        let data = json!({ "data": { "events": [{"id": "a"}, {"id": "b"}, {"id": "c"}] } });
        let events = extract_events(&data);
        assert_eq!(events.len(), 3);
    }

    #[test]
    fn extract_events_from_top_level_events() {
        let data = json!({ "events": [{"id": "x"}] });
        let events = extract_events(&data);
        assert_eq!(events.len(), 1);
    }

    #[test]
    fn extract_events_from_data_data_items() {
        let data = json!({ "data": { "data": { "items": [{"id": "nested"}] } } });
        let events = extract_events(&data);
        assert_eq!(events.len(), 1);
    }

    #[test]
    fn extract_events_empty_when_no_match() {
        let data = json!({ "foo": "bar" });
        assert!(extract_events(&data).is_empty());
    }

    #[test]
    fn extract_events_skips_empty_arrays() {
        // An empty `/data/items` should fall through to `/items`.
        let data = json!({ "data": { "items": [] }, "items": [{"id": "fallback"}] });
        let events = extract_events(&data);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0]["id"], "fallback");
    }

    // ── event_id ───────────────────────────────────────────────────────

    #[test]
    fn event_id_from_top_level() {
        let evt = json!({ "id": "event123" });
        assert_eq!(event_id(&evt), Some("event123".to_string()));
    }

    #[test]
    fn event_id_from_data_nested() {
        let evt = json!({ "data": { "id": "nested_id" } });
        assert_eq!(event_id(&evt), Some("nested_id".to_string()));
    }

    #[test]
    fn event_id_from_event_id_key() {
        let evt = json!({ "eventId": "eid_abc" });
        assert_eq!(event_id(&evt), Some("eid_abc".to_string()));
    }

    #[test]
    fn event_id_from_data_event_id_key() {
        let evt = json!({ "data": { "eventId": "data_eid" } });
        assert_eq!(event_id(&evt), Some("data_eid".to_string()));
    }

    #[test]
    fn event_id_none_when_missing() {
        let evt = json!({ "summary": "No ID here" });
        assert!(event_id(&evt).is_none());
    }

    #[test]
    fn event_id_none_when_whitespace_only() {
        let evt = json!({ "id": "   " });
        assert!(event_id(&evt).is_none());
    }

    // ── event_summary ──────────────────────────────────────────────────

    #[test]
    fn event_summary_from_top_level() {
        let evt = json!({ "summary": "Team standup" });
        assert_eq!(event_summary(&evt), "Team standup");
    }

    #[test]
    fn event_summary_from_data_nested() {
        let evt = json!({ "data": { "summary": "Nested title" } });
        assert_eq!(event_summary(&evt), "Nested title");
    }

    #[test]
    fn event_summary_defaults_to_no_title() {
        let evt = json!({ "id": "no-summary-here" });
        assert_eq!(event_summary(&evt), "(no title)");
    }

    #[test]
    fn event_summary_defaults_when_whitespace_only() {
        let evt = json!({ "summary": "   " });
        assert_eq!(event_summary(&evt), "(no title)");
    }

    // ── event_start_iso ────────────────────────────────────────────────

    #[test]
    fn event_start_iso_from_date_time() {
        let evt = json!({ "start": { "dateTime": "2026-04-24T10:00:00Z" } });
        assert_eq!(
            event_start_iso(&evt),
            Some("2026-04-24T10:00:00Z".to_string())
        );
    }

    #[test]
    fn event_start_iso_from_date_all_day() {
        let evt = json!({ "start": { "date": "2026-04-25" } });
        assert_eq!(event_start_iso(&evt), Some("2026-04-25".to_string()));
    }

    #[test]
    fn event_start_iso_from_data_nested() {
        let evt = json!({ "data": { "start": { "dateTime": "2026-04-24T09:00:00+02:00" } } });
        assert_eq!(
            event_start_iso(&evt),
            Some("2026-04-24T09:00:00+02:00".to_string())
        );
    }

    #[test]
    fn event_start_iso_none_when_missing() {
        let evt = json!({ "id": "no-start" });
        assert!(event_start_iso(&evt).is_none());
    }

    // ── event_update_time ──────────────────────────────────────────────

    #[test]
    fn event_update_time_from_top_level() {
        let evt = json!({ "updated": "2026-04-24T08:30:00Z" });
        assert_eq!(
            event_update_time(&evt),
            Some("2026-04-24T08:30:00Z".to_string())
        );
    }

    #[test]
    fn event_update_time_from_data_nested() {
        let evt = json!({ "data": { "updated": "2026-04-23T15:00:00Z" } });
        assert_eq!(
            event_update_time(&evt),
            Some("2026-04-23T15:00:00Z".to_string())
        );
    }

    #[test]
    fn event_update_time_none_when_missing() {
        let evt = json!({ "id": "no-updated-field" });
        assert!(event_update_time(&evt).is_none());
    }

    #[test]
    fn event_update_time_none_when_whitespace_only() {
        let evt = json!({ "updated": "  " });
        assert!(event_update_time(&evt).is_none());
    }

    // ── now_ms / iso_offset_days ───────────────────────────────────────

    #[test]
    fn now_ms_returns_nonzero() {
        assert!(now_ms() > 0);
    }

    #[test]
    fn iso_offset_days_zero_looks_like_now() {
        let s = iso_offset_days(0);
        // Should start with the current year (2026 as of writing, but
        // we just check the format is ISO 8601-ish).
        assert!(s.contains('T'), "expected ISO 8601 datetime: {s}");
        assert!(s.ends_with('Z'), "expected UTC 'Z' suffix: {s}");
    }

    #[test]
    fn iso_offset_days_seven_is_after_now() {
        let now = iso_offset_days(0);
        let week = iso_offset_days(7);
        assert!(week > now, "7-day future should sort after now");
    }
}
