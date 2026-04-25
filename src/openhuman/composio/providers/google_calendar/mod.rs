//! Google Calendar provider — incremental event sync with per-item persistence.
//!
//! Fetches events from the user's primary calendar (and all calendars when
//! no cursor exists) via the Composio `GOOGLECALENDAR_EVENTS_LIST` action,
//! persisting each event as its own memory document so agent recall can
//! surface individual calendar items.

mod provider;
mod sync;
pub mod tools;

pub use provider::GoogleCalendarProvider;
pub use tools::GOOGLE_CALENDAR_CURATED;
