//! Today domain — unified daily feed aggregating iMessage, Gmail, and Calendar.
//!
//! Exposes a single RPC method: `openhuman.today_feed_list`.
//!
//! ## Module layout
//!
//! - [`ops`]     — core fan-out, merge, sort, and filter logic
//! - [`rpc`]     — async RPC handler: `handle_feed_list`
//! - [`schemas`] — controller schema definitions and registered handler wrappers
//! - [`types`]   — shared types: `TodayFeedItem`, `TodayFeedListParams`, etc.

mod ops;
mod rpc;
mod schemas;
mod types;

pub use schemas::{
    all_controller_schemas as all_today_controller_schemas,
    all_registered_controllers as all_today_registered_controllers,
};
pub use types::*;
