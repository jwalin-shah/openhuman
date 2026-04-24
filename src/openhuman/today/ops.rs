//! Business logic for the Today domain.
//!
//! `list_feed` fans out to three sources (iMessage, Gmail, Calendar), applies
//! graceful degradation (source failures return empty slices, not errors),
//! merges the results, and sorts by recency.

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::openhuman::config::Config;

use super::types::{TodayFeedItem, TodayFeedListParams, TodayFeedListResponse, TodaySource};

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────────

/// Build the unified Today feed from all configured sources.
///
/// Graceful degradation: any source that fails logs a `warn!` and contributes
/// zero items; the overall call never returns an error due to a single source.
pub async fn list_feed(
    config: &Config,
    params: TodayFeedListParams,
) -> Result<TodayFeedListResponse, String> {
    let window_hours = params.window_hours.unwrap_or(24);
    let limit_per_source = params.limit_per_source.unwrap_or(20) as usize;

    log::debug!(
        "[today] list_feed start window_hours={} limit_per_source={} source_filter={:?}",
        window_hours,
        limit_per_source,
        params.source_filter,
    );

    // Fan out concurrently — source failures are swallowed into empty vecs.
    let (imessage_items, gmail_items, calendar_items) = tokio::join!(
        fetch_imessage(config, window_hours, limit_per_source),
        fetch_gmail(config, window_hours, limit_per_source),
        fetch_calendar(config, window_hours, limit_per_source),
    );

    log::debug!(
        "[today] raw counts: imessage={} gmail={} calendar={}",
        imessage_items.len(),
        gmail_items.len(),
        calendar_items.len(),
    );

    let merged = merge_and_sort(
        imessage_items,
        gmail_items,
        calendar_items,
        params.source_filter.as_deref(),
        limit_per_source,
    );

    let source_counts = build_source_counts(&merged);

    let generated_at_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    log::debug!(
        "[today] list_feed done total={} generated_at_ms={}",
        merged.len(),
        generated_at_ms,
    );

    Ok(TodayFeedListResponse {
        items: merged,
        source_counts,
        window_hours,
        generated_at_ms,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure merge / sort / filter / cap helper (unit-testable with no I/O)
// ─────────────────────────────────────────────────────────────────────────────

/// Merge three source slices, optionally filter by source, cap each source,
/// then sort the merged result by `timestamp_ms` descending.
///
/// This is a pure function — extracted so unit tests can drive it without any
/// database or memory client.
pub fn merge_and_sort(
    imessage: Vec<TodayFeedItem>,
    gmail: Vec<TodayFeedItem>,
    calendar: Vec<TodayFeedItem>,
    source_filter: Option<&str>,
    limit_per_source: usize,
) -> Vec<TodayFeedItem> {
    let filter_matches = |item: &TodayFeedItem| -> bool {
        match source_filter {
            Some(f) => item.source.as_str() == f.to_lowercase().as_str(),
            None => true,
        }
    };

    let cap = |mut v: Vec<TodayFeedItem>| -> Vec<TodayFeedItem> {
        v.truncate(limit_per_source);
        v
    };

    let imessage_capped: Vec<_> = cap(imessage.into_iter().filter(&filter_matches).collect());
    let gmail_capped: Vec<_> = cap(gmail.into_iter().filter(&filter_matches).collect());
    let calendar_capped: Vec<_> = cap(calendar.into_iter().filter(&filter_matches).collect());

    let mut merged: Vec<TodayFeedItem> = [imessage_capped, gmail_capped, calendar_capped].concat();
    merged.sort_by(|a, b| b.timestamp_ms.cmp(&a.timestamp_ms));
    merged
}

/// Build a `source → count` map from the final merged item slice.
pub fn build_source_counts(items: &[TodayFeedItem]) -> HashMap<String, usize> {
    let mut counts: HashMap<String, usize> = HashMap::new();
    for item in items {
        *counts.entry(item.source.as_str().to_string()).or_insert(0) += 1;
    }
    counts
}

// ─────────────────────────────────────────────────────────────────────────────
// iMessage source
// ─────────────────────────────────────────────────────────────────────────────

async fn fetch_imessage(config: &Config, window_hours: u64, limit: usize) -> Vec<TodayFeedItem> {
    // Only available on macOS.
    if std::env::consts::OS != "macos" {
        log::debug!("[today:imessage] skipping — not macOS");
        return vec![];
    }

    // Skip if iMessage channel is not configured.
    if config.channels_config.imessage.is_none() {
        log::debug!("[today:imessage] skipping — imessage not configured");
        return vec![];
    }

    match fetch_imessage_inner(window_hours, limit).await {
        Ok(items) => {
            log::debug!("[today:imessage] fetched {} items", items.len());
            items
        }
        Err(e) => {
            log::warn!("[today:imessage] fetch failed, skipping source: {}", e);
            vec![]
        }
    }
}

async fn fetch_imessage_inner(
    window_hours: u64,
    limit: usize,
) -> Result<Vec<TodayFeedItem>, String> {
    use directories::UserDirs;
    use rusqlite::{Connection, OpenFlags};

    let db_path = UserDirs::new()
        .map(|u| u.home_dir().join("Library/Messages/chat.db"))
        .ok_or_else(|| "[today:imessage] cannot find home directory".to_string())?;

    if !db_path.exists() {
        return Err(format!(
            "[today:imessage] chat.db not found at {}",
            db_path.display()
        ));
    }

    let path = db_path.clone();
    let now_unix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    // Apple Core Data epoch is 2001-01-01 00:00:00 UTC = unix 978307200
    // message.date column is nanoseconds since the Apple epoch.
    let apple_epoch_offset: u64 = 978_307_200;
    let threshold_ns: i64 = ((now_unix.saturating_sub(window_hours * 3600))
        .saturating_sub(apple_epoch_offset) as i64)
        * 1_000_000_000;
    let limit_i64 = limit as i64;

    let rows =
        tokio::task::spawn_blocking(move || -> Result<Vec<(i64, String, String, i64)>, String> {
            let conn = Connection::open_with_flags(
                &path,
                OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
            )
            .map_err(|e| format!("[today:imessage] open db: {e}"))?;

            let mut stmt = conn
                .prepare(
                    "SELECT m.ROWID, h.id, m.text, \
                 m.date / 1000000000 + 978307200 AS unix_ts \
                 FROM message m \
                 JOIN handle h ON m.handle_id = h.ROWID \
                 WHERE m.is_from_me = 0 \
                   AND m.text IS NOT NULL \
                   AND m.date > ?1 \
                 ORDER BY m.date DESC \
                 LIMIT ?2",
                )
                .map_err(|e| format!("[today:imessage] prepare: {e}"))?;

            let rows = stmt
                .query_map([threshold_ns, limit_i64], |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, i64>(3)?,
                    ))
                })
                .map_err(|e| format!("[today:imessage] query: {e}"))?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("[today:imessage] row: {e}"))?;

            Ok(rows)
        })
        .await
        .map_err(|e| format!("[today:imessage] spawn_blocking join: {e}"))??;

    let items = rows
        .into_iter()
        .map(|(rowid, handle, text, unix_ts)| {
            let source_id = rowid.to_string();
            let preview: String = text.chars().take(200).collect();
            TodayFeedItem {
                id: format!("imessage::{}", source_id),
                source: TodaySource::Imessage,
                title: handle.clone(),
                preview,
                timestamp_ms: (unix_ts.max(0) as u64) * 1000,
                sender: Some(handle),
                avatar_url: None,
                is_unread: true,
                source_id,
                action_hint: "reply".to_string(),
                metadata: serde_json::Value::Null,
            }
        })
        .collect();

    Ok(items)
}

// ─────────────────────────────────────────────────────────────────────────────
// Gmail source
// ─────────────────────────────────────────────────────────────────────────────

async fn fetch_gmail(_config: &Config, window_hours: u64, limit: usize) -> Vec<TodayFeedItem> {
    let client = match crate::openhuman::memory::global::client_if_ready() {
        Some(c) => c,
        None => {
            log::debug!("[today:gmail] skipping — memory client not ready");
            return vec![];
        }
    };

    match fetch_gmail_inner(client, window_hours, limit).await {
        Ok(items) => {
            log::debug!("[today:gmail] fetched {} items", items.len());
            items
        }
        Err(e) => {
            log::warn!("[today:gmail] fetch failed, skipping source: {}", e);
            vec![]
        }
    }
}

async fn fetch_gmail_inner(
    client: crate::openhuman::memory::MemoryClientRef,
    window_hours: u64,
    limit: usize,
) -> Result<Vec<TodayFeedItem>, String> {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let cutoff_ms = now_ms.saturating_sub(window_hours * 3600 * 1000);

    // Find all Gmail connection IDs stored in the composio-sync-state namespace.
    let kv_entries = client
        .kv_list_namespace("composio-sync-state")
        .await
        .unwrap_or_default();

    let connection_ids: Vec<String> = kv_entries
        .iter()
        .filter_map(|v| v.get("key").and_then(|k| k.as_str()).map(str::to_string))
        .filter(|k| k.starts_with("gmail:"))
        .map(|k| k["gmail:".len()..].to_string())
        .collect();

    log::debug!(
        "[today:gmail] found {} gmail connections",
        connection_ids.len()
    );

    let mut items: Vec<TodayFeedItem> = Vec::new();

    for conn_id in &connection_ids {
        let namespace = format!("skill:gmail:{}", conn_id);
        let docs_value = match client.list_documents(Some(&namespace)).await {
            Ok(v) => v,
            Err(e) => {
                log::warn!(
                    "[today:gmail] list_documents failed conn={} err={}",
                    conn_id,
                    e
                );
                continue;
            }
        };

        let docs = docs_value
            .get("documents")
            .and_then(|d| d.as_array())
            .cloned()
            .unwrap_or_default();

        log::debug!("[today:gmail] conn={} doc_count={}", conn_id, docs.len());

        for doc in &docs {
            let content_str = match doc.get("content").and_then(|c| c.as_str()) {
                Some(s) => s,
                None => continue,
            };

            let msg: serde_json::Value = match serde_json::from_str(content_str) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let internal_date_ms: u64 = msg
                .get("internalDate")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0);

            if internal_date_ms < cutoff_ms {
                continue;
            }

            let subject = msg
                .get("subject")
                .and_then(|v| v.as_str())
                .unwrap_or("(no subject)")
                .to_string();
            let from = msg
                .get("from")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let snippet = msg
                .get("snippet")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let msg_id = msg
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let thread_id = msg
                .get("threadId")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let is_unread = msg
                .get("labelIds")
                .and_then(|v| v.as_array())
                .map(|labels| labels.iter().any(|l| l.as_str() == Some("UNREAD")))
                .unwrap_or(false);

            let source_id = if msg_id.is_empty() {
                format!("{}:{}", conn_id, internal_date_ms)
            } else {
                msg_id.clone()
            };

            items.push(TodayFeedItem {
                id: format!("gmail::{}", source_id),
                source: TodaySource::Gmail,
                title: subject,
                preview: snippet,
                timestamp_ms: internal_date_ms,
                sender: if from.is_empty() { None } else { Some(from) },
                avatar_url: None,
                is_unread,
                source_id,
                action_hint: "reply".to_string(),
                metadata: serde_json::json!({ "thread_id": thread_id }),
            });

            if items.len() >= limit {
                break;
            }
        }

        if items.len() >= limit {
            break;
        }
    }

    Ok(items)
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar source
// ─────────────────────────────────────────────────────────────────────────────

async fn fetch_calendar(_config: &Config, window_hours: u64, limit: usize) -> Vec<TodayFeedItem> {
    let client = match crate::openhuman::memory::global::client_if_ready() {
        Some(c) => c,
        None => {
            log::debug!("[today:calendar] skipping — memory client not ready");
            return vec![];
        }
    };

    match fetch_calendar_inner(client, window_hours, limit).await {
        Ok(items) => {
            log::debug!("[today:calendar] fetched {} items", items.len());
            items
        }
        Err(e) => {
            log::warn!("[today:calendar] fetch failed, skipping source: {}", e);
            vec![]
        }
    }
}

async fn fetch_calendar_inner(
    client: crate::openhuman::memory::MemoryClientRef,
    window_hours: u64,
    limit: usize,
) -> Result<Vec<TodayFeedItem>, String> {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let window_end_ms = now_ms + window_hours * 3600 * 1000;

    // Find all Google Calendar connection IDs.
    let kv_entries = client
        .kv_list_namespace("composio-sync-state")
        .await
        .unwrap_or_default();

    let connection_ids: Vec<String> = kv_entries
        .iter()
        .filter_map(|v| v.get("key").and_then(|k| k.as_str()).map(str::to_string))
        .filter(|k| k.starts_with("googlecalendar:"))
        .map(|k| k["googlecalendar:".len()..].to_string())
        .collect();

    log::debug!(
        "[today:calendar] found {} googlecalendar connections",
        connection_ids.len()
    );

    let mut items: Vec<TodayFeedItem> = Vec::new();

    for conn_id in &connection_ids {
        let namespace = format!("skill:googlecalendar:{}", conn_id);
        let docs_value = match client.list_documents(Some(&namespace)).await {
            Ok(v) => v,
            Err(e) => {
                log::warn!(
                    "[today:calendar] list_documents failed conn={} err={}",
                    conn_id,
                    e
                );
                continue;
            }
        };

        let docs = docs_value
            .get("documents")
            .and_then(|d| d.as_array())
            .cloned()
            .unwrap_or_default();

        log::debug!("[today:calendar] conn={} doc_count={}", conn_id, docs.len());

        for doc in &docs {
            let content_str = match doc.get("content").and_then(|c| c.as_str()) {
                Some(s) => s,
                None => continue,
            };

            let event: serde_json::Value = match serde_json::from_str(content_str) {
                Ok(v) => v,
                Err(_) => continue,
            };

            // Parse event start — may be under "start.dateTime" or "start.date".
            let start_ms = parse_event_datetime(&event, "start");
            let end_ms = parse_event_datetime(&event, "end");

            if start_ms == 0 {
                continue;
            }

            // Calendar window: events that start NOW..now+window_hours.
            if start_ms < now_ms || start_ms >= window_end_ms {
                continue;
            }

            let summary = event
                .get("summary")
                .and_then(|v| v.as_str())
                .unwrap_or("(no title)")
                .to_string();

            let organizer_email = event
                .get("organizer")
                .and_then(|o| o.get("email"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let location = event
                .get("location")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let event_id = event
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let preview = build_calendar_preview(start_ms, end_ms, &location);

            let source_id = if event_id.is_empty() {
                format!("{}:{}", conn_id, start_ms)
            } else {
                event_id.clone()
            };

            items.push(TodayFeedItem {
                id: format!("calendar::{}", source_id),
                source: TodaySource::Calendar,
                title: summary,
                preview,
                timestamp_ms: start_ms,
                sender: if organizer_email.is_empty() {
                    None
                } else {
                    Some(organizer_email)
                },
                avatar_url: None,
                is_unread: false,
                source_id,
                action_hint: "view".to_string(),
                metadata: serde_json::json!({
                    "start": start_ms,
                    "end": end_ms,
                    "location": location,
                }),
            });

            if items.len() >= limit {
                break;
            }
        }

        if items.len() >= limit {
            break;
        }
    }

    Ok(items)
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Parse a calendar event's "start" or "end" object into epoch milliseconds.
fn parse_event_datetime(event: &serde_json::Value, field: &str) -> u64 {
    let obj = match event.get(field) {
        Some(v) => v,
        None => return 0,
    };

    // Prefer dateTime (RFC3339) over date (YYYY-MM-DD).
    if let Some(dt_str) = obj.get("dateTime").and_then(|v| v.as_str()) {
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(dt_str) {
            return dt.timestamp_millis() as u64;
        }
    }

    if let Some(date_str) = obj.get("date").and_then(|v| v.as_str()) {
        // Parse YYYY-MM-DD as midnight UTC.
        if let Ok(nd) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
            use chrono::NaiveTime;
            let ndt = nd.and_time(NaiveTime::from_hms_opt(0, 0, 0).unwrap_or_default());
            return (ndt.and_utc().timestamp_millis()) as u64;
        }
    }

    0
}

/// Build a human-readable preview string for a calendar event.
fn build_calendar_preview(start_ms: u64, end_ms: u64, location: &str) -> String {
    let fmt_time = |ms: u64| -> String {
        use chrono::{TimeZone, Utc};
        let dt = Utc.timestamp_millis_opt(ms as i64).single();
        match dt {
            Some(d) => d.format("%-I:%M %p").to_string(),
            None => "?".to_string(),
        }
    };

    let time_range = if end_ms > 0 && end_ms > start_ms {
        format!("{} \u{2013} {}", fmt_time(start_ms), fmt_time(end_ms))
    } else {
        fmt_time(start_ms)
    };

    if location.is_empty() {
        time_range
    } else {
        format!("{} \u{2022} {}", time_range, location)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn make_item(source: TodaySource, source_id: &str, timestamp_ms: u64) -> TodayFeedItem {
        TodayFeedItem {
            id: format!("{}::{}", source.as_str(), source_id),
            source,
            title: format!("Title {}", source_id),
            preview: "preview".to_string(),
            timestamp_ms,
            sender: None,
            avatar_url: None,
            is_unread: true,
            source_id: source_id.to_string(),
            action_hint: match source {
                TodaySource::Calendar => "view".to_string(),
                _ => "reply".to_string(),
            },
            metadata: serde_json::Value::Null,
        }
    }

    #[test]
    fn list_feed_returns_empty_when_no_sources_configured() {
        let imessage = vec![];
        let gmail = vec![];
        let calendar = vec![];
        let result = merge_and_sort(imessage, gmail, calendar, None, 20);
        assert!(result.is_empty(), "expected empty when no items");
    }

    #[test]
    fn list_feed_respects_limit_per_source() {
        let imessage: Vec<_> = (0..10)
            .map(|i| make_item(TodaySource::Imessage, &i.to_string(), 1000 + i))
            .collect();
        let gmail: Vec<_> = (0..10)
            .map(|i| make_item(TodaySource::Gmail, &i.to_string(), 2000 + i))
            .collect();
        let calendar: Vec<_> = (0..10)
            .map(|i| make_item(TodaySource::Calendar, &i.to_string(), 3000 + i))
            .collect();

        let result = merge_and_sort(imessage, gmail, calendar, None, 3);

        // Each source capped at 3 → max 9 total.
        assert!(
            result.len() <= 9,
            "expected at most 9 items, got {}",
            result.len()
        );

        let imessage_count = result
            .iter()
            .filter(|i| i.source == TodaySource::Imessage)
            .count();
        let gmail_count = result
            .iter()
            .filter(|i| i.source == TodaySource::Gmail)
            .count();
        let calendar_count = result
            .iter()
            .filter(|i| i.source == TodaySource::Calendar)
            .count();

        assert!(imessage_count <= 3, "imessage over cap: {}", imessage_count);
        assert!(gmail_count <= 3, "gmail over cap: {}", gmail_count);
        assert!(calendar_count <= 3, "calendar over cap: {}", calendar_count);
    }

    #[test]
    fn list_feed_sorts_by_timestamp_descending() {
        let imessage = vec![
            make_item(TodaySource::Imessage, "old", 1000),
            make_item(TodaySource::Imessage, "new", 5000),
        ];
        let gmail = vec![make_item(TodaySource::Gmail, "mid", 3000)];
        let calendar = vec![];

        let result = merge_and_sort(imessage, gmail, calendar, None, 20);

        assert_eq!(result.len(), 3);
        assert_eq!(result[0].timestamp_ms, 5000, "first should be newest");
        assert_eq!(result[1].timestamp_ms, 3000);
        assert_eq!(result[2].timestamp_ms, 1000, "last should be oldest");
    }

    #[test]
    fn list_feed_filters_by_source() {
        let imessage = vec![make_item(TodaySource::Imessage, "i1", 1000)];
        let gmail = vec![make_item(TodaySource::Gmail, "g1", 2000)];
        let calendar = vec![make_item(TodaySource::Calendar, "c1", 3000)];

        let result = merge_and_sort(imessage, gmail, calendar, Some("gmail"), 20);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].source, TodaySource::Gmail);
    }

    #[test]
    fn list_feed_builds_source_counts() {
        let items = vec![
            make_item(TodaySource::Imessage, "i1", 100),
            make_item(TodaySource::Imessage, "i2", 200),
            make_item(TodaySource::Gmail, "g1", 300),
        ];
        let counts = build_source_counts(&items);

        assert_eq!(counts.get("imessage"), Some(&2));
        assert_eq!(counts.get("gmail"), Some(&1));
        assert_eq!(counts.get("calendar"), None);
    }

    #[test]
    fn item_id_format_matches_contract() {
        let item = make_item(TodaySource::Gmail, "abc123", 999);
        assert_eq!(item.id, "gmail::abc123");

        let item2 = make_item(TodaySource::Calendar, "evt-1", 0);
        assert_eq!(item2.id, "calendar::evt-1");
    }

    #[test]
    fn filter_case_insensitive_lowercase() {
        let imessage = vec![make_item(TodaySource::Imessage, "i1", 1000)];
        // filter_matches does item.source.as_str() == f.to_lowercase().as_str()
        // "IMESSAGE".to_lowercase() == "imessage" == TodaySource::Imessage.as_str()
        let result = merge_and_sort(imessage, vec![], vec![], Some("IMESSAGE"), 20);
        assert_eq!(result.len(), 1, "uppercase filter should match");
    }
}
