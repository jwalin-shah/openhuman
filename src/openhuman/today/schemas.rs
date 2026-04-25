//! Controller schema definitions and registered handlers for the `today` domain.
//!
//! Follows the exact pattern from `src/openhuman/notifications/schemas.rs`.
//!
//! Registered controllers:
//! - `today.feed_list`  — `openhuman.today_feed_list`
//! - `today.feed_links` — `openhuman.today_feed_links`

use serde_json::{Map, Value};

use crate::core::all::{ControllerFuture, RegisteredController};
use crate::core::{ControllerSchema, FieldSchema, TypeSchema};

// ─────────────────────────────────────────────────────────────────────────────
// Schema registry
// ─────────────────────────────────────────────────────────────────────────────

pub fn all_controller_schemas() -> Vec<ControllerSchema> {
    vec![schema("feed_list"), schema("feed_links")]
}

pub fn all_registered_controllers() -> Vec<RegisteredController> {
    vec![
        RegisteredController {
            schema: schema("feed_list"),
            handler: handle_feed_list_wrap,
        },
        RegisteredController {
            schema: schema("feed_links"),
            handler: handle_feed_links_wrap,
        },
    ]
}

pub fn schema(function: &str) -> ControllerSchema {
    match function {
        "feed_list" => ControllerSchema {
            namespace: "today",
            function: "feed_list",
            description: "Return a unified timeline of recent iMessages, Gmail threads, \
                 and upcoming Google Calendar events.",
            inputs: vec![
                FieldSchema {
                    name: "window_hours",
                    ty: TypeSchema::Option(Box::new(TypeSchema::U64)),
                    comment: "Look-back (and look-forward for calendar) window in hours. \
                              Defaults to 24.",
                    required: false,
                },
                FieldSchema {
                    name: "limit_per_source",
                    ty: TypeSchema::Option(Box::new(TypeSchema::U64)),
                    comment: "Maximum items returned per source (imessage, gmail, calendar). \
                              Defaults to 20.",
                    required: false,
                },
                FieldSchema {
                    name: "source_filter",
                    ty: TypeSchema::Option(Box::new(TypeSchema::String)),
                    comment: "Restrict results to one source: \"imessage\", \"gmail\", or \
                              \"calendar\". Omit to return all sources.",
                    required: false,
                },
            ],
            outputs: vec![
                FieldSchema {
                    name: "items",
                    ty: TypeSchema::Array(Box::new(TypeSchema::Ref("TodayFeedItem"))),
                    comment: "Feed items sorted by timestamp_ms descending.",
                    required: true,
                },
                FieldSchema {
                    name: "source_counts",
                    ty: TypeSchema::Map(Box::new(TypeSchema::U64)),
                    comment: "Map of source name → item count in the final list.",
                    required: true,
                },
                FieldSchema {
                    name: "window_hours",
                    ty: TypeSchema::U64,
                    comment: "Effective window_hours used for this response.",
                    required: true,
                },
                FieldSchema {
                    name: "generated_at_ms",
                    ty: TypeSchema::U64,
                    comment: "Unix epoch milliseconds when this response was assembled.",
                    required: true,
                },
            ],
        },

        "feed_links" => ControllerSchema {
            namespace: "today",
            function: "feed_links",
            description: "Identify semantically-related clusters across Today feed items \
                          (iMessage, Gmail, Calendar) using the local AI model. Degrades \
                          gracefully — returns empty clusters when the model is unavailable.",
            inputs: vec![
                FieldSchema {
                    name: "item_ids",
                    ty: TypeSchema::Array(Box::new(TypeSchema::String)),
                    comment: "IDs of the feed items to cluster. Must match the `id` field \
                              of the corresponding `items` entries.",
                    required: true,
                },
                FieldSchema {
                    name: "items",
                    ty: TypeSchema::Array(Box::new(TypeSchema::Ref("TodayFeedItem"))),
                    comment: "Full feed item objects. Must correspond to `item_ids`.",
                    required: true,
                },
            ],
            outputs: vec![
                FieldSchema {
                    name: "clusters",
                    ty: TypeSchema::Array(Box::new(TypeSchema::Ref("TodayFeedCluster"))),
                    comment: "Groups of related feed items. Empty when no clear relationships \
                              are found or when the model is unavailable.",
                    required: true,
                },
                FieldSchema {
                    name: "from_cache",
                    ty: TypeSchema::Bool,
                    comment: "`true` when the response was served from the in-process cache \
                              (10-minute TTL, keyed by sorted item IDs).",
                    required: true,
                },
            ],
        },

        _other => ControllerSchema {
            namespace: "today",
            function: "unknown",
            description: "Unknown today controller function.",
            inputs: vec![FieldSchema {
                name: "function",
                ty: TypeSchema::String,
                comment: "Unknown function requested.",
                required: true,
            }],
            outputs: vec![FieldSchema {
                name: "error",
                ty: TypeSchema::String,
                comment: "Lookup error details.",
                required: true,
            }],
        },
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler wrappers (delegate to rpc.rs)
// ─────────────────────────────────────────────────────────────────────────────

fn handle_feed_list_wrap(params: Map<String, Value>) -> ControllerFuture {
    Box::pin(async move { super::rpc::handle_feed_list(params).await })
}

fn handle_feed_links_wrap(params: Map<String, Value>) -> ControllerFuture {
    Box::pin(async move { super::rpc::handle_feed_links(params).await })
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_controller_schemas_has_feed_list() {
        let schemas = all_controller_schemas();
        assert_eq!(schemas.len(), 2);
        assert!(schemas.iter().any(|s| s.function == "feed_list"));
        assert_eq!(schemas[0].namespace, "today");
    }

    #[test]
    fn all_controller_schemas_has_feed_links() {
        let schemas = all_controller_schemas();
        assert!(
            schemas.iter().any(|s| s.function == "feed_links"),
            "feed_links must appear in controller schemas"
        );
    }

    #[test]
    fn all_registered_controllers_has_two_entries() {
        let controllers = all_registered_controllers();
        assert_eq!(controllers.len(), 2);
        let fns: Vec<_> = controllers.iter().map(|c| c.schema.function).collect();
        assert!(fns.contains(&"feed_list"));
        assert!(fns.contains(&"feed_links"));
    }

    #[test]
    fn schema_feed_list_all_inputs_optional() {
        let s = schema("feed_list");
        assert!(s.inputs.iter().all(|f| !f.required));
    }

    #[test]
    fn schema_feed_list_outputs_include_items_and_counts() {
        let s = schema("feed_list");
        let out_names: Vec<_> = s.outputs.iter().map(|f| f.name).collect();
        assert!(out_names.contains(&"items"));
        assert!(out_names.contains(&"source_counts"));
        assert!(out_names.contains(&"window_hours"));
        assert!(out_names.contains(&"generated_at_ms"));
    }

    #[test]
    fn schema_feed_links_inputs_require_item_ids_and_items() {
        let s = schema("feed_links");
        let in_names: Vec<_> = s.inputs.iter().map(|f| f.name).collect();
        assert!(in_names.contains(&"item_ids"), "must have item_ids input");
        assert!(in_names.contains(&"items"), "must have items input");
        // Both are required
        assert!(
            s.inputs.iter().all(|f| f.required),
            "all feed_links inputs must be required"
        );
    }

    #[test]
    fn schema_unknown_returns_placeholder() {
        let s = schema("does-not-exist");
        assert_eq!(s.function, "unknown");
    }
}
