//! Cross-source clustering for the Today feed.
//!
//! Exposes [`compute_feed_links`] which calls the local AI model to group
//! semantically-related items (e.g., an iMessage, Gmail thread, and Calendar
//! event about the same meeting). All failure paths return empty clusters —
//! the feature degrades invisibly when the model is unavailable.

use std::collections::{HashMap, HashSet};
use std::time::{Duration, Instant};

use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::sync::RwLock;

use crate::openhuman::config::Config;
use crate::openhuman::local_ai;

use super::types::{TodayFeedCluster, TodayFeedItem, TodayFeedLinksParams, TodayFeedLinksResponse};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/// Maximum feed items passed to the model.
const ITEM_CAP: usize = 30;

/// How long a cached response is considered fresh.
const CACHE_TTL: Duration = Duration::from_secs(10 * 60);

// ─────────────────────────────────────────────────────────────────────────────
// In-process cache
// ─────────────────────────────────────────────────────────────────────────────

/// `(inserted_at, response)` keyed by SHA-256 of sorted item IDs.
static LINKS_CACHE: Lazy<RwLock<HashMap<String, (Instant, TodayFeedLinksResponse)>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));

// ─────────────────────────────────────────────────────────────────────────────
// Prompt template
// ─────────────────────────────────────────────────────────────────────────────

const PROMPT_TEMPLATE: &str = r#"You identify clusters of related items in a daily feed from multiple sources (iMessage, Gmail, Calendar).

RULES:
- Only cluster items that CLEARLY belong together (same person + same topic, or same event across sources).
- A cluster must have 2 or more items.
- Each item can appear in at most one cluster.
- If no items are clearly related, return an empty clusters array.
- Do NOT hallucinate relationships. When in doubt, leave items unclustered.
- The "reason" field must be a short phrase (under 60 chars) explaining the connection.

INPUT (JSON array of feed items):
{items_json}

OUTPUT: Return ONLY a valid JSON object with this exact schema:
{"clusters": [{"item_ids": ["id1", "id2"], "reason": "short explanation"}]}

EXAMPLE:
Input:
[
  {"id": "imessage::101", "source": "imessage", "title": "Sarah Chen", "preview": "Still on for 3?", "sender": null, "timestamp_ms": 1714000000000},
  {"id": "gmail::202", "source": "gmail", "title": "RE: Design review agenda", "preview": "Attached the deck for the 3pm review", "sender": "sarah.chen@acme.com", "timestamp_ms": 1713970000000},
  {"id": "calendar::303", "source": "calendar", "title": "Design review", "preview": "3:00 PM - 3:30 PM", "sender": null, "timestamp_ms": 1714003200000},
  {"id": "gmail::404", "source": "gmail", "title": "AWS billing alert", "preview": "Your bill exceeded $50", "sender": "no-reply@aws.com", "timestamp_ms": 1713960000000}
]

Output:
{"clusters": [{"item_ids": ["imessage::101", "gmail::202", "calendar::303"], "reason": "Design review at 3pm with Sarah"}]}"#;

// ─────────────────────────────────────────────────────────────────────────────
// Minimal serialisation struct (drops avatar_url, is_unread, source_id, etc.)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct FeedItemForPrompt<'a> {
    id: &'a str,
    source: &'a str,
    title: &'a str,
    preview: &'a str,
    sender: Option<&'a str>,
    timestamp_ms: u64,
}

impl<'a> From<&'a TodayFeedItem> for FeedItemForPrompt<'a> {
    fn from(item: &'a TodayFeedItem) -> Self {
        Self {
            id: &item.id,
            source: item.source.as_str(),
            title: &item.title,
            preview: &item.preview,
            sender: item.sender.as_deref(),
            timestamp_ms: item.timestamp_ms,
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal parse type (before conversion to the wire type)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub(crate) struct ParsedCluster {
    item_ids: Vec<String>,
    reason: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ParsedResponse {
    clusters: Vec<ParsedCluster>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────────

/// Compute semantic clusters for a Today feed.
///
/// **Always returns `Ok`**. On any failure path (model not ready, parse error,
/// cache poisoning, etc.) the response contains `clusters: []` and
/// `from_cache: false`. The calling RPC layer propagates this response as-is.
pub async fn compute_feed_links(
    config: &Config,
    params: TodayFeedLinksParams,
) -> Result<TodayFeedLinksResponse, String> {
    log::debug!(
        "[today:links] compute_feed_links entry item_count={}",
        params.items.len()
    );

    let empty = || TodayFeedLinksResponse {
        clusters: vec![],
        from_cache: false,
    };

    // ── 1. Early-exit on empty input ─────────────────────────────────────────
    if params.items.is_empty() {
        log::debug!("[today:links] no items supplied, returning empty");
        return Ok(empty());
    }

    // ── 2. Cap to ITEM_CAP items ─────────────────────────────────────────────
    let items: Vec<&TodayFeedItem> = params.items.iter().take(ITEM_CAP).collect();
    let item_ids: Vec<&str> = items.iter().map(|i| i.id.as_str()).collect();

    log::debug!(
        "[today:links] using {} items (cap={})",
        items.len(),
        ITEM_CAP
    );

    // ── 3. Cache lookup ──────────────────────────────────────────────────────
    let key = cache_key(&item_ids.iter().map(|s| s.to_string()).collect::<Vec<_>>());
    {
        let cache = LINKS_CACHE.read().await;
        if let Some((inserted_at, cached)) = cache.get(&key) {
            if inserted_at.elapsed() < CACHE_TTL {
                log::debug!("[today:links] cache hit key={}", &key[..16]);
                return Ok(TodayFeedLinksResponse {
                    clusters: cached.clusters.clone(),
                    from_cache: true,
                });
            }
            log::debug!("[today:links] cache expired key={}", &key[..16]);
        }
    }

    // ── 4. Model readiness check ─────────────────────────────────────────────
    let service = local_ai::global(config);
    let status = service.status();
    if status.state.as_str() != "ready" {
        log::debug!(
            "[today:links] local model not ready state={}, returning empty (not cached)",
            status.state
        );
        return Ok(empty());
    }

    // ── 5. Build prompt ──────────────────────────────────────────────────────
    let prompt = match build_prompt(&items) {
        Ok(p) => p,
        Err(e) => {
            log::warn!("[today:links] failed to build prompt: {e}");
            return Ok(empty());
        }
    };

    log::debug!(
        "[today:links] calling local model prompt_len={}",
        prompt.len()
    );

    // ── 6. Inference ─────────────────────────────────────────────────────────
    let raw = match service.prompt(config, &prompt, Some(256), true).await {
        Ok(r) => r,
        Err(e) => {
            log::warn!("[today:links] inference error: {e}");
            return Ok(empty());
        }
    };

    log::debug!(
        "[today:links] model response len={} preview={:?}",
        raw.len(),
        &raw[..raw.len().min(80)]
    );

    // ── 7. Parse output ──────────────────────────────────────────────────────
    let parsed = match parse_model_output(&raw) {
        Some(p) => p,
        None => {
            log::warn!(
                "[today:links] failed to parse model output (first 200 chars): {:?}",
                &raw[..raw.len().min(200)]
            );
            return Ok(empty());
        }
    };

    // ── 8. Validate clusters ─────────────────────────────────────────────────
    let valid_ids: HashSet<&str> = item_ids.iter().copied().collect();
    let clusters = validate_clusters(parsed.clusters, &valid_ids);

    log::debug!("[today:links] validated cluster_count={}", clusters.len());

    // ── 9. Write to cache ────────────────────────────────────────────────────
    let response = TodayFeedLinksResponse {
        clusters,
        from_cache: false,
    };
    {
        let mut cache = LINKS_CACHE.write().await;
        cache.insert(key.clone(), (Instant::now(), response.clone()));
        log::debug!("[today:links] stored in cache key={}", &key[..16]);
    }

    Ok(response)
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (pub(crate) for unit tests)
// ─────────────────────────────────────────────────────────────────────────────

/// Compute a deterministic cache key from a list of item IDs.
///
/// Sorts the IDs, joins them with newlines, and returns a hex-encoded SHA-256
/// digest. Deterministic regardless of input ordering.
pub(crate) fn cache_key(item_ids: &[String]) -> String {
    let mut sorted = item_ids.to_vec();
    sorted.sort();
    let joined = sorted.join("\n");
    let mut hasher = Sha256::new();
    hasher.update(joined.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Build the prompt string from the capped item list.
pub(crate) fn build_prompt(items: &[&TodayFeedItem]) -> Result<String, String> {
    let for_prompt: Vec<FeedItemForPrompt> =
        items.iter().map(|i| FeedItemForPrompt::from(*i)).collect();
    let items_json =
        serde_json::to_string_pretty(&for_prompt).map_err(|e| format!("serialize items: {e}"))?;
    Ok(PROMPT_TEMPLATE.replace("{items_json}", &items_json))
}

/// Try to parse the model output into a [`ParsedResponse`].
///
/// Attempts a direct parse first; falls back to regex extraction of the last
/// JSON object found in the text.
pub(crate) fn parse_model_output(raw: &str) -> Option<ParsedResponse> {
    let trimmed = raw.trim();

    // Direct parse
    if let Ok(parsed) = serde_json::from_str::<ParsedResponse>(trimmed) {
        return Some(parsed);
    }

    // Regex fallback — extract last `{...}` block
    static JSON_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"\{[\s\S]*\}").expect("valid regex"));

    let last_match = JSON_RE.find_iter(trimmed).last()?;
    serde_json::from_str::<ParsedResponse>(last_match.as_str()).ok()
}

/// Validate and normalise raw parsed clusters:
///
/// 1. Drop clusters with fewer than 2 items.
/// 2. Drop clusters referencing IDs not in the input set.
/// 3. Deduplicate items across clusters (first-cluster-wins).
/// 4. Truncate `reason` to 120 chars.
/// 5. Generate a deterministic `cluster_id` from sorted member IDs.
pub(crate) fn validate_clusters(
    raw: Vec<ParsedCluster>,
    valid_ids: &HashSet<&str>,
) -> Vec<TodayFeedCluster> {
    let mut seen: HashSet<String> = HashSet::new();
    let mut result = Vec::new();

    for cluster in raw {
        // Filter to valid, unseen IDs
        let members: Vec<String> = cluster
            .item_ids
            .into_iter()
            .filter(|id| valid_ids.contains(id.as_str()) && !seen.contains(id))
            .collect();

        // Must still have at least 2 members after filtering
        if members.len() < 2 {
            log::debug!(
                "[today:links] dropping cluster with {} members after filtering",
                members.len()
            );
            continue;
        }

        // Mark as seen
        for id in &members {
            seen.insert(id.clone());
        }

        // Truncate reason
        let reason = truncate_utf8(&cluster.reason, 120);

        // Deterministic cluster_id from sorted member IDs
        let cluster_id = cluster_id_from_members(&members);

        result.push(TodayFeedCluster {
            cluster_id,
            item_ids: members,
            reason,
        });
    }

    result
}

/// Generate a deterministic `cluster_id` by hex-encoding the SHA-256 of
/// the sorted, newline-joined member IDs.
pub(crate) fn cluster_id_from_members(members: &[String]) -> String {
    let mut sorted = members.to_vec();
    sorted.sort();
    let joined = sorted.join("\n");
    let mut hasher = Sha256::new();
    hasher.update(joined.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Truncate a string at a UTF-8 character boundary to at most `max_chars`
/// Unicode scalar values.
fn truncate_utf8(s: &str, max_chars: usize) -> String {
    s.chars().take(max_chars).collect()
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::openhuman::today::types::TodaySource;

    fn make_item(id: &str, source: TodaySource, title: &str, preview: &str) -> TodayFeedItem {
        TodayFeedItem {
            id: id.to_string(),
            source,
            title: title.to_string(),
            preview: preview.to_string(),
            timestamp_ms: 1_714_000_000_000,
            sender: None,
            avatar_url: None,
            is_unread: false,
            source_id: id.to_string(),
            action_hint: String::new(),
            metadata: serde_json::Value::Null,
        }
    }

    // ── cache_key tests ──────────────────────────────────────────────────────

    #[test]
    fn cache_key_is_deterministic_across_orderings() {
        let ids_a = vec!["b".to_string(), "a".to_string(), "c".to_string()];
        let ids_b = vec!["a".to_string(), "c".to_string(), "b".to_string()];
        assert_eq!(cache_key(&ids_a), cache_key(&ids_b));
    }

    #[test]
    fn cache_key_differs_when_ids_change() {
        let ids_a = vec!["a".to_string(), "b".to_string()];
        let ids_b = vec!["a".to_string(), "x".to_string()];
        assert_ne!(cache_key(&ids_a), cache_key(&ids_b));
    }

    // ── build_prompt tests ───────────────────────────────────────────────────

    #[test]
    fn build_prompt_includes_all_items_and_json_serializable_fields() {
        let item1 = make_item("imessage::1", TodaySource::Imessage, "Alice", "Still on?");
        let item2 = make_item(
            "gmail::2",
            TodaySource::Gmail,
            "RE: Meeting",
            "See you then",
        );
        let items: Vec<&TodayFeedItem> = vec![&item1, &item2];

        let prompt = build_prompt(&items).expect("build_prompt should not fail");

        // Check that the prompt body contains the expected content
        assert!(prompt.contains("imessage::1"), "prompt must contain id");
        assert!(prompt.contains("gmail::2"), "prompt must contain id");
        assert!(prompt.contains("imessage"), "prompt must contain source");
        assert!(prompt.contains("Still on?"), "prompt must contain preview");
        assert!(prompt.contains("timestamp_ms"), "prompt must contain field");

        // Verify the helper structs are JSON-serializable with only the required fields.
        // Build the same JSON as build_prompt() does and confirm it round-trips.
        let for_prompt: Vec<FeedItemForPrompt> =
            items.iter().map(|i| FeedItemForPrompt::from(*i)).collect();
        let items_json =
            serde_json::to_string_pretty(&for_prompt).expect("helper structs must serialize");
        let parsed: serde_json::Value =
            serde_json::from_str(&items_json).expect("items_json must be valid JSON");
        assert!(parsed.is_array());
        let arr = parsed.as_array().unwrap();
        assert_eq!(arr.len(), 2);

        // Only the 6 allowed fields should be present (no avatar_url, is_unread, etc.)
        let obj = arr[0].as_object().unwrap();
        let expected_keys = ["id", "source", "title", "preview", "sender", "timestamp_ms"];
        for key in &expected_keys {
            assert!(obj.contains_key(*key), "missing expected key: {key}");
        }
        let disallowed = [
            "avatar_url",
            "is_unread",
            "source_id",
            "action_hint",
            "metadata",
        ];
        for key in &disallowed {
            assert!(!obj.contains_key(*key), "disallowed key present: {key}");
        }
    }

    // ── parse_model_output tests ─────────────────────────────────────────────

    #[test]
    fn parse_valid_json_returns_clusters() {
        let raw = r#"{"clusters": [{"item_ids": ["a", "b"], "reason": "same meeting"}]}"#;
        let parsed = parse_model_output(raw).expect("should parse");
        assert_eq!(parsed.clusters.len(), 1);
        assert_eq!(parsed.clusters[0].item_ids, vec!["a", "b"]);
        assert_eq!(parsed.clusters[0].reason, "same meeting");
    }

    #[test]
    fn parse_invalid_json_returns_empty() {
        let raw = "not json at all";
        assert!(parse_model_output(raw).is_none());
    }

    #[test]
    fn parse_json_with_surrounding_text_via_regex() {
        let raw = r#"Sure! Here is the output:
{"clusters": [{"item_ids": ["x", "y"], "reason": "both about shipping"}]}
Hope that helps!"#;
        let parsed = parse_model_output(raw).expect("regex fallback should find JSON");
        assert_eq!(parsed.clusters.len(), 1);
        assert_eq!(parsed.clusters[0].item_ids, vec!["x", "y"]);
    }

    // ── validate_clusters tests ──────────────────────────────────────────────

    #[test]
    fn validate_filters_single_item_clusters() {
        let valid: HashSet<&str> = ["a", "b", "c"].iter().copied().collect();
        let raw = vec![
            ParsedCluster {
                item_ids: vec!["a".to_string()],
                reason: "only one".to_string(),
            },
            ParsedCluster {
                item_ids: vec!["b".to_string(), "c".to_string()],
                reason: "two items".to_string(),
            },
        ];
        let clusters = validate_clusters(raw, &valid);
        assert_eq!(clusters.len(), 1, "single-item cluster must be dropped");
        assert_eq!(clusters[0].item_ids, vec!["b", "c"]);
    }

    #[test]
    fn validate_filters_phantom_ids() {
        let valid: HashSet<&str> = ["a", "b"].iter().copied().collect();
        let raw = vec![ParsedCluster {
            item_ids: vec!["a".to_string(), "PHANTOM_ID".to_string()],
            reason: "phantom".to_string(),
        }];
        // After filtering the phantom, only 1 valid member remains → cluster dropped
        let clusters = validate_clusters(raw, &valid);
        assert!(clusters.is_empty(), "phantom-only cluster must be dropped");
    }

    #[test]
    fn validate_dedupes_items_across_clusters_first_wins() {
        let valid: HashSet<&str> = ["a", "b", "c"].iter().copied().collect();
        let raw = vec![
            ParsedCluster {
                item_ids: vec!["a".to_string(), "b".to_string()],
                reason: "first".to_string(),
            },
            ParsedCluster {
                item_ids: vec!["b".to_string(), "c".to_string()],
                reason: "second, b already claimed".to_string(),
            },
        ];
        let clusters = validate_clusters(raw, &valid);
        // Second cluster loses "b"; only "c" remains → dropped for < 2 members
        assert_eq!(clusters.len(), 1, "second cluster must be dropped");
        assert_eq!(clusters[0].item_ids, vec!["a", "b"]);
    }

    #[test]
    fn validate_truncates_reason_to_120_chars() {
        let long_reason = "x".repeat(200);
        let valid: HashSet<&str> = ["a", "b"].iter().copied().collect();
        let raw = vec![ParsedCluster {
            item_ids: vec!["a".to_string(), "b".to_string()],
            reason: long_reason,
        }];
        let clusters = validate_clusters(raw, &valid);
        assert_eq!(clusters[0].reason.chars().count(), 120);
    }

    #[test]
    fn cluster_id_deterministic_from_sorted_ids() {
        let members_a = vec!["b".to_string(), "a".to_string()];
        let members_b = vec!["a".to_string(), "b".to_string()];
        assert_eq!(
            cluster_id_from_members(&members_a),
            cluster_id_from_members(&members_b),
            "cluster_id must be order-independent"
        );

        let members_c = vec!["a".to_string(), "c".to_string()];
        assert_ne!(
            cluster_id_from_members(&members_b),
            cluster_id_from_members(&members_c),
            "cluster_id must differ for different members"
        );
    }
}
