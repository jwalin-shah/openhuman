//! Shared types for the Today domain.
//!
//! These types define the RPC contract for `openhuman.today_feed_list`.
//! All fields match the wire format exactly — do not rename without bumping
//! the API version.

use serde::{Deserialize, Serialize};

/// Source kind discriminator for today feed items.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TodaySource {
    Imessage,
    Gmail,
    Calendar,
}

impl TodaySource {
    pub fn as_str(&self) -> &'static str {
        match self {
            TodaySource::Imessage => "imessage",
            TodaySource::Gmail => "gmail",
            TodaySource::Calendar => "calendar",
        }
    }
}

/// A single item in the Today feed.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodayFeedItem {
    pub id: String,
    pub source: TodaySource,
    pub title: String,
    pub preview: String,
    pub timestamp_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sender: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,
    pub is_unread: bool,
    pub source_id: String,
    pub action_hint: String,
    #[serde(default)]
    pub metadata: serde_json::Value,
}

/// Request parameters for `openhuman.today_feed_list`.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct TodayFeedListParams {
    pub window_hours: Option<u64>,
    pub limit_per_source: Option<u64>,
    pub source_filter: Option<String>,
}

/// Response envelope for `openhuman.today_feed_list`.
#[derive(Debug, Clone, Serialize)]
pub struct TodayFeedListResponse {
    pub items: Vec<TodayFeedItem>,
    pub source_counts: std::collections::HashMap<String, usize>,
    pub window_hours: u64,
    pub generated_at_ms: u64,
}

// ─────────────────────────────────────────────────────────────────────────────
// today_feed_links types
// ─────────────────────────────────────────────────────────────────────────────

/// Request parameters for `openhuman.today_feed_links`.
#[derive(Debug, Clone, Deserialize)]
pub struct TodayFeedLinksParams {
    pub item_ids: Vec<String>,
    pub items: Vec<TodayFeedItem>,
}

/// A single cluster of semantically-related feed items.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodayFeedCluster {
    /// Deterministic identifier derived from sorted member IDs (SHA-256 hex).
    pub cluster_id: String,
    /// IDs of items that belong to this cluster.
    pub item_ids: Vec<String>,
    /// Short human-readable reason explaining why these items are linked.
    pub reason: String,
}

/// Response envelope for `openhuman.today_feed_links`.
#[derive(Debug, Clone, Serialize)]
pub struct TodayFeedLinksResponse {
    pub clusters: Vec<TodayFeedCluster>,
    /// `true` when the response was served from the in-process cache.
    pub from_cache: bool,
}
