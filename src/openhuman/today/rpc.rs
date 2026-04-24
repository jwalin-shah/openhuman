//! JSON-RPC handler functions for the Today domain.
//!
//! Endpoint: `openhuman.today_feed_list` — return a unified timeline of
//! recent iMessages, Gmail threads, and upcoming Google Calendar events.

use serde_json::{Map, Value};

use crate::openhuman::config::rpc as config_rpc;
use crate::rpc::RpcOutcome;

use super::types::TodayFeedListParams;

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
