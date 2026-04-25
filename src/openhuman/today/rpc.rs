//! JSON-RPC handler functions for the Today domain.
//!
//! Endpoints:
//! - `openhuman.today_feed_list`  — unified timeline of iMessage, Gmail, Calendar
//! - `openhuman.today_feed_links` — LLM-backed semantic clustering of feed items

use serde_json::{Map, Value};

use crate::openhuman::config::rpc as config_rpc;
use crate::rpc::RpcOutcome;

use super::types::{TodayFeedLinksParams, TodayFeedListParams};

/// Handle the `openhuman.today_feed_list` RPC call.
///
/// Accepts optional `window_hours`, `limit_per_source`, and `source_filter`
/// parameters. Unknown parameters are ignored — `unwrap_or_default` ensures
/// a missing / empty params object always returns an empty-but-valid feed.
pub async fn handle_feed_list(params: Map<String, Value>) -> Result<Value, String> {
    log::debug!(
        "[today] handle_feed_list entry params_keys={:?}",
        params.keys().collect::<Vec<_>>()
    );

    let config = config_rpc::load_config_with_timeout().await?;

    let req: TodayFeedListParams =
        serde_json::from_value(Value::Object(params)).unwrap_or_default();

    let response = super::ops::list_feed(&config, req).await?;

    log::debug!(
        "[today] handle_feed_list done item_count={} window_hours={}",
        response.items.len(),
        response.window_hours,
    );

    let outcome = RpcOutcome::new(
        serde_json::to_value(&response).map_err(|e| e.to_string())?,
        vec![],
    );
    outcome.into_cli_compatible_json()
}

/// Handle the `openhuman.today_feed_links` RPC call.
///
/// Accepts `item_ids` (Vec<String>) and `items` (Vec<TodayFeedItem>). Returns
/// semantic clusters as identified by the local AI model. Always succeeds —
/// returns empty clusters when the model is unavailable or output is unparseable.
pub async fn handle_feed_links(params: Map<String, Value>) -> Result<Value, String> {
    log::debug!(
        "[today:links] handle_feed_links entry params_keys={:?}",
        params.keys().collect::<Vec<_>>()
    );

    let config = config_rpc::load_config_with_timeout().await?;

    let req: TodayFeedLinksParams = serde_json::from_value(Value::Object(params))
        .map_err(|e| format!("invalid params: {e}"))?;

    log::debug!(
        "[today:links] handle_feed_links item_count={}",
        req.items.len()
    );

    let response = super::compute_feed_links(&config, req).await?;

    log::debug!(
        "[today:links] handle_feed_links done cluster_count={} from_cache={}",
        response.clusters.len(),
        response.from_cache,
    );

    let outcome = RpcOutcome::new(
        serde_json::to_value(&response).map_err(|e| e.to_string())?,
        vec![],
    );
    outcome.into_cli_compatible_json()
}
