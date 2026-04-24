//! Curated catalog of Google Calendar Composio actions exposed to the agent.
//!
//! Re-exports the canonical `GOOGLECALENDAR_CURATED` slice from
//! `catalogs.rs` under the provider-local name `GOOGLE_CALENDAR_CURATED`
//! so the `mod.rs` pub-use statement and the `ComposioProvider`
//! implementation share a single source of truth.

use crate::openhuman::composio::providers::tool_scope::CuratedTool;

/// Curated Google Calendar actions visible to the agent.
///
/// This is an alias for [`crate::openhuman::composio::providers::catalogs::GOOGLECALENDAR_CURATED`].
pub const GOOGLE_CALENDAR_CURATED: &[CuratedTool] =
    crate::openhuman::composio::providers::catalogs::GOOGLECALENDAR_CURATED;
