//! Today domain — unified daily feed aggregating iMessage, Gmail, and Calendar.
//!
//! Exposes two RPC methods:
//! - `openhuman.today_feed_list`  — merged timeline
//! - `openhuman.today_feed_links` — semantic clustering via local AI
//!
//! ## Module layout
//!
//! - [`links`]   — LLM-backed cross-source clustering: `compute_feed_links`
//! - [`ops`]     — core fan-out, merge, sort, and filter logic
//! - [`rpc`]     — async RPC handlers: `handle_feed_list`, `handle_feed_links`
//! - [`schemas`] — controller schema definitions and registered handler wrappers
//! - [`types`]   — shared types: `TodayFeedItem`, `TodayFeedListParams`, etc.

pub mod links;
mod ops;
mod rpc;
mod schemas;
mod types;

pub use links::compute_feed_links;
pub use schemas::{
    all_controller_schemas as all_today_controller_schemas,
    all_registered_controllers as all_today_registered_controllers,
};
pub use types::*;
