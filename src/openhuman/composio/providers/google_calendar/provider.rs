//! Google Calendar provider — incremental event sync with per-item persistence.
//!
//! On each sync pass:
//!
//!   1. Load persistent [`SyncState`] from the KV store.
//!   2. Check the daily request budget — bail early if exhausted.
//!   3. Fetch a page of upcoming events via `GOOGLECALENDAR_EVENTS_LIST`
//!      using the cursor as `timeMin` when available, so only new/updated
//!      events are returned.
//!   4. Deduplicate against `synced_ids` in the state.
//!   5. Persist each **new** event as its own memory document so agent
//!      recall can surface individual calendar entries.
//!   6. Advance the cursor to the most recently updated event timestamp.
//!   7. Save state.
//!
//! Daily budget (`DEFAULT_DAILY_REQUEST_LIMIT`, default 500) caps the
//! number of `execute_tool` calls per calendar day, preventing runaway
//! API usage during large initial backfills.

use async_trait::async_trait;
use serde_json::{json, Value};

use super::sync;
use crate::openhuman::composio::providers::sync_state::{persist_single_item, SyncState};
use crate::openhuman::composio::providers::{
    pick_str, ComposioProvider, CuratedTool, ProviderContext, ProviderUserProfile, SyncOutcome,
    SyncReason,
};

const ACTION_LIST_CALENDARS: &str = "GOOGLECALENDAR_LIST_CALENDARS";
const ACTION_EVENTS_LIST: &str = "GOOGLECALENDAR_EVENTS_LIST";

/// Maximum results to fetch per API call.
const MAX_RESULTS: u32 = 50;

/// Number of days ahead to include in the event window.
const LOOKAHEAD_DAYS: i64 = 7;

pub struct GoogleCalendarProvider;

impl GoogleCalendarProvider {
    pub fn new() -> Self {
        Self
    }
}

impl Default for GoogleCalendarProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ComposioProvider for GoogleCalendarProvider {
    fn toolkit_slug(&self) -> &'static str {
        "googlecalendar"
    }

    fn curated_tools(&self) -> Option<&'static [CuratedTool]> {
        Some(super::tools::GOOGLE_CALENDAR_CURATED)
    }

    fn sync_interval_secs(&self) -> Option<u64> {
        Some(15 * 60)
    }

    async fn fetch_user_profile(
        &self,
        ctx: &ProviderContext,
    ) -> Result<ProviderUserProfile, String> {
        log::debug!(
            "[composio:googlecalendar] fetch_user_profile entry \
             connection_id={:?} action={ACTION_LIST_CALENDARS}",
            ctx.connection_id
        );

        let resp = ctx
            .client
            .execute_tool(ACTION_LIST_CALENDARS, Some(json!({})))
            .await
            .map_err(|e| {
                format!("[composio:googlecalendar] {ACTION_LIST_CALENDARS} failed: {e:#}")
            })?;

        if !resp.successful {
            let err = resp
                .error
                .clone()
                .unwrap_or_else(|| "provider reported failure".to_string());
            return Err(format!(
                "[composio:googlecalendar] {ACTION_LIST_CALENDARS}: {err}"
            ));
        }

        let data = &resp.data;

        // The response is a list of calendar objects. Find the primary one.
        let calendars = sync::extract_events(data);

        log::debug!(
            "[composio:googlecalendar] fetch_user_profile: received {} calendars",
            calendars.len()
        );

        // Look for the calendar that has "primary": true.
        let primary = calendars.iter().find(|cal| {
            cal.get("primary")
                .and_then(|v| v.as_bool())
                .unwrap_or(false)
        });

        // `id` on the primary calendar is the user's email address.
        let email = primary
            .and_then(|c| c.get("id"))
            .and_then(|v| v.as_str())
            .filter(|s| !s.trim().is_empty())
            .map(|s| s.trim().to_string())
            // Fallback: try top-level paths in the raw response.
            .or_else(|| pick_str(data, &["data.id", "id", "data.email", "email"]));

        let display_name = primary
            .and_then(|c| c.get("summary"))
            .and_then(|v| v.as_str())
            .filter(|s| !s.trim().is_empty())
            .map(|s| s.trim().to_string())
            .or_else(|| email.clone());

        let has_email = email.is_some();
        let email_domain = email
            .as_deref()
            .and_then(|e| e.split('@').nth(1))
            .map(|d| d.to_string());

        log::info!(
            "[composio:googlecalendar] fetch_user_profile: has_email={} email_domain={:?}",
            has_email,
            email_domain
        );

        Ok(ProviderUserProfile {
            toolkit: "googlecalendar".to_string(),
            connection_id: ctx.connection_id.clone(),
            display_name,
            email,
            username: None,
            avatar_url: None,
            profile_url: None,
            extras: data.clone(),
        })
    }

    async fn sync(&self, ctx: &ProviderContext, reason: SyncReason) -> Result<SyncOutcome, String> {
        let started_at_ms = sync::now_ms();
        let connection_id = ctx
            .connection_id
            .clone()
            .unwrap_or_else(|| "default".to_string());

        log::info!(
            "[composio:googlecalendar] incremental sync starting \
             connection_id={connection_id} reason={}",
            reason.as_str()
        );

        // ── Step 1: load persistent sync state ──────────────────────────
        let Some(memory) = ctx.memory_client() else {
            return Err("[composio:googlecalendar] memory client not ready".to_string());
        };
        let mut state = SyncState::load(&memory, "googlecalendar", &connection_id).await?;

        log::debug!(
            "[composio:googlecalendar] sync state loaded: cursor={:?} synced_ids={} budget_remaining={}",
            state.cursor,
            state.synced_ids.len(),
            state.budget_remaining()
        );

        // ── Step 2: check daily budget ───────────────────────────────────
        if state.budget_exhausted() {
            log::info!(
                "[composio:googlecalendar] daily request budget exhausted, skipping sync \
                 connection_id={connection_id}"
            );
            return Ok(SyncOutcome {
                toolkit: "googlecalendar".to_string(),
                connection_id: Some(connection_id),
                reason: reason.as_str().to_string(),
                items_ingested: 0,
                started_at_ms,
                finished_at_ms: sync::now_ms(),
                summary: "googlecalendar sync skipped: daily budget exhausted".to_string(),
                details: json!({ "budget_exhausted": true }),
            });
        }

        // ── Step 3: build time window ────────────────────────────────────
        // Use the cursor (last-updated ISO timestamp from the previous pass)
        // as timeMin so we only re-fetch events that changed since then.
        // On first sync, use now so we get upcoming events only.
        let time_min = state
            .cursor
            .clone()
            .unwrap_or_else(|| sync::iso_offset_days(0));
        let time_max = sync::iso_offset_days(LOOKAHEAD_DAYS);

        log::debug!(
            "[composio:googlecalendar] fetching events time_min={time_min} time_max={time_max}"
        );

        let args = json!({
            "timeMin": time_min,
            "timeMax": time_max,
            "maxResults": MAX_RESULTS,
            "singleEvents": true,
            "orderBy": "startTime"
        });

        // ── Step 4: call Composio ────────────────────────────────────────
        let resp = ctx
            .client
            .execute_tool(ACTION_EVENTS_LIST, Some(args))
            .await
            .map_err(|e| format!("[composio:googlecalendar] {ACTION_EVENTS_LIST} failed: {e:#}"))?;

        state.record_requests(1);

        if !resp.successful {
            let err = resp
                .error
                .clone()
                .unwrap_or_else(|| "provider reported failure".to_string());
            // Save budget accounting even on API error.
            let _ = state.save(&memory).await;
            return Err(format!(
                "[composio:googlecalendar] {ACTION_EVENTS_LIST}: {err}"
            ));
        }

        let events = sync::extract_events(&resp.data);

        log::debug!(
            "[composio:googlecalendar] {ACTION_EVENTS_LIST} returned {} events",
            events.len()
        );

        // ── Step 5: deduplicate and persist per-item ─────────────────────
        let mut total_persisted: usize = 0;
        let mut newest_updated: Option<String> = None;

        for event in &events {
            let Some(event_id) = sync::event_id(event) else {
                log::debug!("[composio:googlecalendar] event missing ID, skipping");
                continue;
            };

            // Track the newest updated time for cursor advancement.
            if let Some(updated) = sync::event_update_time(event) {
                if newest_updated
                    .as_ref()
                    .is_none_or(|existing| updated > *existing)
                {
                    newest_updated = Some(updated);
                }
            }

            if state.is_synced(&event_id) {
                log::debug!(
                    "[composio:googlecalendar] event already synced, skipping event_id={event_id}"
                );
                continue;
            }

            let summary = sync::event_summary(event);
            let doc_id = format!("composio-gcal-event-{event_id}");
            let title = format!("Calendar: {summary}");

            log::debug!(
                "[composio:googlecalendar] persisting event event_id={event_id} title={title:?}"
            );

            match persist_single_item(
                &memory,
                "googlecalendar",
                &doc_id,
                &title,
                event,
                "googlecalendar",
                ctx.connection_id.as_deref(),
            )
            .await
            {
                Ok(_) => {
                    state.mark_synced(&event_id);
                    total_persisted += 1;
                    log::debug!("[composio:googlecalendar] persisted event event_id={event_id}");
                }
                Err(e) => {
                    log::warn!(
                        "[composio:googlecalendar] failed to persist event event_id={event_id} \
                         error={e} (continuing)"
                    );
                }
            }
        }

        // ── Step 6: advance cursor and save state ────────────────────────
        if let Some(new_cursor) = newest_updated {
            log::debug!("[composio:googlecalendar] advancing cursor to {new_cursor}");
            state.advance_cursor(&new_cursor);
        }
        state.save(&memory).await?;

        let finished_at_ms = sync::now_ms();
        let summary = format!(
            "googlecalendar sync ({reason}): fetched {total_fetched}, persisted {total_persisted} new, \
             budget remaining {remaining}",
            reason = reason.as_str(),
            total_fetched = events.len(),
            remaining = state.budget_remaining()
        );

        log::info!(
            "[composio:googlecalendar] incremental sync complete \
             connection_id={connection_id} elapsed_ms={} total_fetched={} total_persisted={} \
             budget_remaining={}",
            finished_at_ms.saturating_sub(started_at_ms),
            events.len(),
            total_persisted,
            state.budget_remaining()
        );

        Ok(SyncOutcome {
            toolkit: "googlecalendar".to_string(),
            connection_id: Some(connection_id),
            reason: reason.as_str().to_string(),
            items_ingested: total_persisted,
            started_at_ms,
            finished_at_ms,
            summary,
            details: json!({
                "events_fetched": events.len(),
                "events_persisted": total_persisted,
                "budget_remaining": state.budget_remaining(),
                "cursor": state.cursor,
                "synced_ids_total": state.synced_ids.len(),
            }),
        })
    }

    async fn on_trigger(
        &self,
        ctx: &ProviderContext,
        trigger: &str,
        payload: &Value,
    ) -> Result<(), String> {
        log::debug!(
            "[composio:googlecalendar] on_trigger: trigger={trigger} connection_id={:?} \
             payload_bytes={}",
            ctx.connection_id,
            payload.to_string().len()
        );
        // Default no-op — Google Calendar triggers are informational;
        // we rely on the periodic sync for data freshness.
        Ok(())
    }
}
