# Activity Timeline & Proactive Nudges

Spec for two UX surfaces that ride on top of the existing event bus, inspired
by AirJelly's "living timeline" and "proactive next step" patterns but kept
inside OpenHuman's existing primitives.

Branch: `claude/review-vllm-mlx-SnnU4`.

---

## Goals

1. **Activity Timeline** — a single chronological, queryable view of everything
   the agent / system did or observed (skill syncs, cron deliveries, webhook
   deliveries, channel inbound, conscious-loop runs, memory writes, tool calls,
   user actions). Already half-built — events flow through
   `src/core/event_bus/` but nothing renders them.
2. **Proactive Nudges** — a subsystem that turns specific event combinations
   into a small, user-visible "suggested next step" surfaced via the existing
   webview notification path (`webview-notification:fired`). Nudges are
   user-dismissable, rate-limited, and persisted so we can audit them.

Non-goals: replacing chat, building a calendar UI, adding screen capture.

---

## Architecture (no new infra)

```
DomainEvent (already published by every domain)
        │
        ├──► TimelineSubscriber  ─► append to timeline store ─► Tauri event ─► Redux ─► UI
        │
        └──► NudgeSubscriber     ─► nudge rules ─► (debounce / dedupe) ─►
                                                  publish ProactiveNudge   ─► webview-notification:fired
                                                  ↳ also written to timeline as a nudge entry
```

Everything below piggybacks on what already exists. No new transport, no new
process, no new dependency.

---

## Rust changes

### 1. New domain: `src/openhuman/timeline/`

Follow the module-folder rule from CLAUDE.md.

```
src/openhuman/timeline/
├── mod.rs           # light re-exports
├── types.rs         # TimelineEntry { id, ts, domain, kind, summary, payload, refs }
├── store.rs         # append, query (since, domain filter, kind filter, limit)
├── bus.rs           # TimelineSubscriber : EventHandler — converts DomainEvent → TimelineEntry
├── schemas.rs       # ControllerSchema for timeline.list / timeline.get / timeline.clear
├── rpc.rs           # thin handlers
└── ops.rs           # the conversion + storage logic
```

`TimelineEntry` shape:

```rust
pub struct TimelineEntry {
    pub id: Uuid,
    pub ts: DateTime<Utc>,
    pub domain: &'static str,   // "cron" | "skill" | "channel" | "webhook" | "memory" | "tool" | "nudge" | "system"
    pub kind: String,            // e.g. "skill.sync.completed", "cron.delivery.requested"
    pub summary: String,         // one-line human description
    pub payload: serde_json::Value, // original event payload (compact)
    pub refs: TimelineRefs,      // optional { thread_id, job_id, channel_id, skill_id, integration_id }
}
```

`TimelineSubscriber` subscribes to **all** domains (no `domains()` filter), maps
each `DomainEvent` variant to one `TimelineEntry`, and writes through `store`.
A small allowlist in `ops.rs::should_record(event)` keeps high-frequency events
out (e.g. raw socket pings).

Storage: same SQLite that backs the rest of the core (`src/openhuman/storage/`),
new `timeline_entries` table, retention default 30 days configurable via
`OPENHUMAN_TIMELINE_RETENTION_DAYS`.

Tauri event emission (so frontend sees the entries live):
- event name: **`timeline:entry_appended`** (matches existing `conscious_loop:*` /
  `webview-notification:fired` convention)
- payload: serialized `TimelineEntry`

Wire startup in `src/core/all.rs`:

```rust
pub use crate::openhuman::timeline::{
    all_timeline_controller_schemas,
    all_timeline_registered_controllers,
};
```

And register the subscriber where cron/health/channels register theirs.

### 2. New domain: `src/openhuman/nudges/`

Same skeleton:

```
src/openhuman/nudges/
├── mod.rs
├── types.rs       # Nudge, NudgeRule, NudgeKind
├── rules.rs       # built-in rules (see below)
├── bus.rs         # NudgeSubscriber : EventHandler, plus emits ProactiveNudge events
├── store.rs       # dedupe + rate-limit state
├── schemas.rs     # controllers: nudges.list / nudges.dismiss / nudges.snooze
├── rpc.rs
└── ops.rs
```

New `DomainEvent` variants in `src/core/event_bus/events.rs`:

```rust
ProactiveNudgeIssued { nudge_id: Uuid, kind: String, title: String, body: String, action: NudgeAction, refs: TimelineRefs },
ProactiveNudgeDismissed { nudge_id: Uuid, reason: DismissReason },
```

`NudgeAction` is a small enum mapped to existing app routes:
`OpenThread(ThreadId)`, `OpenCronJob(JobId)`, `OpenSkill(SkillId)`,
`OpenSettings(panel)`, `RunTool(name, args)`.

Initial built-in rules (v1, kept tiny on purpose):
1. **Unanswered inbound** — `ChannelInboundReceived` not followed by an agent
   response within N minutes → "Reply to <channel>".
2. **Failed sync** — three `SkillSyncFailed` events for the same `{skill_id,
   integration_id}` within 24h → "Reconnect <skill>".
3. **Cron miss** — `CronJobMissed` → "Cron job <name> didn't run; review schedule".
4. **End-of-day summary** — at user-local 18:00, publish a synthetic
   `EndOfDayRequested` event; the rule generates a nudge that opens a
   `timeline.summary` view filtered to today.

Rules are pure functions over a rolling window stored in `store.rs`. Easy to
add more.

Rate limit: max 3 active nudges, max 8/day, per-rule cooldown table in
`rules.rs`. Snoozed nudges are kept in store with `snoozed_until`.

Frontend delivery: existing `webview-notification:fired` path — emit a
`WebviewNotificationEvent` whose `payload` carries the nudge. No new Tauri
event needed.

### 3. Capability catalog update

In `src/openhuman/about_app/catalog.rs`, add:

```rust
Capability { id: "automation.activity_timeline", ..., category: CapabilityCategory::Automation, status: Beta },
Capability { id: "automation.proactive_nudges",  ..., category: CapabilityCategory::Automation, status: Beta },
```

Both belong under `Automation` (already exists). Per CLAUDE.md this update is
mandatory in the same PR.

### 4. JSON-RPC surface

Controllers exposed via the registry — no custom branches in
`src/core/jsonrpc.rs` or `src/core/cli.rs`.

| Method                          | Returns                  |
| ------------------------------- | ------------------------ |
| `openhuman.timeline_list`       | `Vec<TimelineEntry>` (with filters) |
| `openhuman.timeline_summary`    | `{ since, until, counts_by_domain, highlights }` |
| `openhuman.timeline_clear`      | `()` (retention/admin) |
| `openhuman.nudges_list`         | `Vec<Nudge>` (active + recent) |
| `openhuman.nudges_dismiss`      | `()` |
| `openhuman.nudges_snooze`       | `()` |

---

## Frontend changes

### 1. Redux slices

`app/src/store/timelineSlice.ts`:

```ts
{
  entries: TimelineEntry[],   // capped buffer (last 500), full list via RPC
  filters: { domains: string[], kinds: string[], since?: string },
  loading: boolean,
  error?: string,
}
```

`app/src/store/nudgesSlice.ts`:

```ts
{
  active: Nudge[],
  history: Nudge[],       // dismissed/expired, capped
  loading: boolean,
}
```

Register both in `app/src/store/index.ts` (neither persisted — both reflect
live core state).

### 2. Provider / listener

`app/src/providers/TimelineProvider.tsx` — subscribes to Tauri event
`timeline:entry_appended` and dispatches `timelineSlice.entryAppended`. Inserted
into the provider chain after `AIProvider`.

Nudges go through the existing webview-notification listener
(`app/src/lib/webviewNotifications/service.ts`); we add a branch that, when
`payload.kind === 'nudge'`, dispatches `nudgesSlice.received` in addition to
the existing in-app toast.

### 3. UI

Two new surfaces, both reusing existing primitives:

**Timeline view** — `app/src/pages/Timeline.tsx`, route `/timeline`, linked
from `Home.tsx` (replacing or sitting next to the existing "Message OpenHuman"
CTA).
- Day-grouped list of entries (sticky day headers).
- Filter pills: All / Channels / Skills / Cron / Webhooks / Memory / Nudges.
- Click an entry → navigates to the underlying `refs` target
  (`thread_id` → conversation, `job_id` → cron job detail, etc.).
- Empty state copy: "Quiet so far. As your skills run and channels chat, you'll
  see it here."

**Nudges strip** — small card cluster on `Home.tsx` above the existing
welcome card, showing up to 3 active nudges with "Do it" / "Snooze" / "Dismiss"
buttons. Hidden entirely when empty.

**Settings panel** — `app/src/components/settings/panels/AutomationPanel.tsx`
under `/settings/automation` (Automation category already exists). Two toggles:
- "Activity Timeline" — enable/disable recording.
- "Proactive Nudges" — master toggle + per-rule toggles + quiet hours.

Mirror `ConnectionsPanel.tsx` for structure.

### 4. Config

- Root `.env.example`: `OPENHUMAN_TIMELINE_RETENTION_DAYS=30`,
  `OPENHUMAN_NUDGES_ENABLED=true`, `OPENHUMAN_NUDGES_DAILY_CAP=8`.
- `app/.env.example`: `VITE_TIMELINE_PAGE_SIZE=100`.
- Surface in `app/src/utils/config.ts`.

### 5. Debug logging

Per CLAUDE.md's debug-logging rule:
- Rust: `tracing::debug!(target: "timeline", kind = %entry.kind, "appended")`,
  `tracing::debug!(target: "nudges", rule = %rule.id, "fired")`, plus
  `trace!` on rule evaluation no-ops so the eval path is auditable.
- Frontend: `debug('openhuman:timeline')`, `debug('openhuman:nudges')` with
  per-entry IDs.

---

## Tests

### Rust (unit + integration)

`src/openhuman/timeline/ops.rs`:
- `event_to_entry` round-trips each currently-recorded `DomainEvent` variant.
- `should_record` excludes the high-frequency events we don't want.
- `store::query` filters and pagination.

`src/openhuman/nudges/rules.rs`:
- Each rule has a fixture-driven test: feed a sequence of events, assert
  exactly one nudge fires (or none), and the dedupe/cooldown holds on replay.

`tests/json_rpc_e2e.rs`:
- `openhuman.timeline_list` returns entries published during the test.
- `openhuman.nudges_list` reflects a nudge issued by a synthetic event sequence.

### App (Vitest)

- `timelineSlice` reducer: `entryAppended` caps the buffer.
- `nudgesSlice` reducer: `dismissed` moves item to history.
- `TimelineProvider` listener wiring (Tauri event mock).
- `AutomationPanel` toggles dispatch correct RPC calls (mock `coreRpcClient`).

### E2E (WDIO)

`app/test/e2e/specs/timeline.spec.ts`:
- Build a fresh workspace, trigger a synthetic cron job, assert the entry
  appears in the Timeline page.

`app/test/e2e/specs/nudges.spec.ts`:
- Inject three `SkillSyncFailed` events via the mock backend → assert a
  nudge appears on Home → click "Snooze" → assert it disappears and is in the
  recent-dismissed RPC list.

---

## Rollout

Phase 1 (smallest shippable): Rust timeline domain + `timeline:entry_appended`
event + Timeline page reading via RPC + capability-catalog entry. No nudges
yet. Validates plumbing end-to-end with one feature.

Phase 2: Nudges domain + 2 simplest rules (`unanswered_inbound`,
`failed_sync`) + Home strip + AutomationPanel.

Phase 3: Cron-miss rule + end-of-day summary rule + quiet hours + per-rule
toggles.

Each phase ships behind a feature toggle in `AutomationPanel` (default off
until QA passes), then defaults flip to on in a follow-up.

---

## Why this is cheap

- Every event the timeline shows is **already being published** by existing
  domains (`cron/scheduler.rs`, `channels/bus.rs`, `webhooks/bus.rs`,
  `composio/bus.rs`, `memory/conversations/bus.rs`, conscious-loop).
- Nudges are the same event stream + a rules layer; no new sources of truth.
- Tauri event names follow existing convention; nudge delivery reuses the
  webview-notification pipe.
- Capability category and one settings route already exist.

The "AirJelly-style" experience is largely a renderer over plumbing OpenHuman
already has — this spec is mostly about plumbing the render and adding a small
rules engine, not about new infrastructure.

---

_Inspired by AirJelly's living-timeline + proactive-agent pattern; built on
OpenHuman's existing event bus, controller registry, and settings system._
