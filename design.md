# Parallax Frontend

A todo app that is also a work queue for a background Claude Code agent. One
side is Camen's life, the other a programming queue Claude reads from and writes
to. Later: PT plans, state check-ins, and an audit surface over Parallax's
memory.

Reasoning and screen sketches: `~/Documents/notes/concepts/todo-app.html`.

## Shape

Own repo, own backend, own Postgres schema. Deployed onto the same machine as
Parallax and behind the same Cloudflare tunnel and Access policy, so it inherits
the hosting and database server without inheriting Parallax's codebase.

All TypeScript. React, thin API, hand-written SQL, no ORM. A web app, added to
the home screen on the phone.

- **Auth** is Cloudflare Access. No login screen, no sessions, no tokens.
- **Parallax** reads this schema through a read-only Postgres role.
- **MCP** is a route on the same API. The tools and the HTTP routes are both
  thin adapters over one operations module — every operation defined once.

## Rule of thumb

Anything the code branches on is a fixed enum. Anything only a human reads is
derived from the data, not modelled. State is an enum. Tags and `who` are
derived.

## Data

**List** — a name, a position, and `has_stages`. That one boolean decides
which states the picker offers, whether the polling routine looks here, whether
`who` and repo tags mean anything, and whether the detail screen shows comments.
Programming is an ordinary list with the flag on.

**Task** — title, list, state, tags, `who`, note, comments, `parent_id`,
`completed_at`, created and updated timestamps. Position is the priority; there
is no priority field.

A due date is a specific day with an optional time, stored as separate date and
time columns.

**Subtasks are tasks** with a `parent_id`. One rule: a task with a parent can't
have children. The detail screen chooses not to show dates or owners on them,
which is a display choice rather than a schema constraint — so promoting a
checklist line into a real job is setting `parent_id` to null.

**Recurring task** — its own object: a schedule with an optional time,
generating tasks with due dates. Calendar-anchored, never counted from the last
completion. Can be paused. It can carry subtasks, and generation copies them
down onto each instance.

- A generated instance behaves exactly like a one-off. It keeps its own due date
  and stays in Today until resolved, sorting to the top once that date passes.
- When the schedule generates the next instance and the previous is still open,
  the previous becomes Missed.
- Skip is a button that applies that same transition now instead of waiting.
  Not a separate state.
- Generation is a pure function of the schedule and the current time, so it runs
  from the read path, a cron, or a backfill unchanged.
- A recurring task's history is its instances. There is no occurrence table.

**States** — To Do, In Progress, In Review, Needs Input, Blocked, Complete,
Missed, Skipped. The last three are terminal, and that fact is defined once so
no query hardcodes it. Lists without `has_stages` offer only the non-agent
ones. Missed is set automatically when a successor instance is generated;
Skipped is that same transition fired by the skip button. Missed tasks drop out
of Today, Skipped ones stay struck through and labelled.

**Manual order** is one sequence per list, held in a single integer per task.
Grouping is a view onto that sequence, so reordering inside a group only
reshuffles the slots those items already occupied and leaves every other task's
position alone. Dragging anything switches the view to manual order.

**Tags and `who`** are strings on the task with no table behind them. A list's
tags are the distinct values across that list's tasks, which is what scopes them
per list. Every field with known values autocompletes from that same query.

## Capture and search

One parser, two interpreters. On capture the tokens assign fields; in search
they filter.

| Token | Means | Autocompletes from |
|---|---|---|
| `#parallax` | tag | that list's tags, plus an explicit "create" |
| `@claude` | `who` | known values |
| `/programming` | list | your lists |
| `!blocked` | state | that list's states |
| `tomorrow`, `3pm`, `mon`, `aug 20`, `in 3 days` | due date and time | — |
| `daily`, `every mon`, `every 2 weeks` | makes it recurring | — |

Parsing is visible and reversible: what got extracted shows as chips under the
field, and tapping one puts the words back in the title. No escape syntax.
Sigils are exact; dates are guesses, so they are always shown.

Search adds `overdue`, `no date`, and quoted phrases. Bare words match title and
note.

## Screens

**One list component**, rendered from a query. Everything below is a preset of
it, so a change to how a row looks lands everywhere.

| Preset | Query |
|---|---|
| Today | every list, open states, due on or before today, plus anything in Needs Input |
| A list | one list, open states, no date bound |
| Search | whatever was typed |
| Archive | terminal states |
| A recurring task's history | its instances, every state |

The component takes one **break up by** setting — state, tag, due date, or
`who` — and renders it as columns when wide and stacked sections when narrow.
Plus a sort. There is no separate grouping control.

Today has three parts. Everything due today shows, however many there are.
Anything from before today, and anything Missed, folds behind "and N more".
Needs Input starts collapsed with a faint count beside it. Nothing turns red,
nothing is written back to a task for being late, and ticking something off
leaves it in place, struck through, until tomorrow.

Missed tasks do appear in ordinary list views — keeping only one open instance
per recurring task is what stops them piling up.

**Numbers** only ever point at more content: "and 8 more", the faint Needs Input
count. Never a tally of what you're behind on. The bell gets a dot, never a
number, and there are no per-list counts anywhere.

**Selecting several** to archive or skip in one go: on a computer, click a
task's whitespace and shift-click to extend; on a phone, long-press one and then
tap to add more.

**Empty states** state a fact — "Nothing today." No congratulation.

The other screens are task detail, the capture bar, and settings. Archive only,
no delete.

**Notifications** are the app's own, over Web Push. Two things push: a task with
a time when that time arrives, and a task landing in Needs Input. Web Push needs
a service worker, a manifest, a VAPID key pair, and a subscriptions table. On
the phone it works only once the app is on the home screen, and the subscription
is lost if that icon is deleted. macOS Safari needs no install. There is no
silent push.

## The agent loop

A scheduled Claude Code routine on launchd polls for the oldest To Do task on an
`has_stages` list. A tag names the repo; the routine's config maps it to a
path.

State is how it communicates:

- Picking up → In Progress
- Finished → In Review, branch pushed, draft PR opened. Never merges, never
  touches main.
- PR merged or closed → Complete
- Needs something → Needs Input, with a comment saying what. You answering and
  moving it back to To Do is the signal to resume.

Comments only ever mean it needs you. No status-update comments.

## Look

Minimal, mobile-first, low detail at a glance and more on opening. Colour means
one thing: something is asking for you.

| | Dark | Light |
|---|---|---|
| Ground | `#1c1a1e` | `#eef1f0` |
| Text | `#ddd8d3` | `#1f2624` |
| Muted | `#857f7a` | `#77817e` |
| Accent | `#86c9c0` | `#2f7d74` |

The accent carries the section label, the tag, and the add button in both — one
design in two grounds. Clean sans for task text, mono for tags and metadata.

## Build order

1. **The app.** Lists, tasks, subtasks, due dates, recurring tasks and their
   history, the list component and its presets, capture, search, archive, the
   look. In daily use before anything else starts.
2. **The MCP server.** The tool surface over the same operations module, so
   claude.ai and Claude Code can both read and write.
3. **Agent orchestration.** The agent's states, comments, `who`, repo tags, the
   polling routine, and the PR flow.

Web Push slots in wherever it earns its place; nothing depends on it.

## Growing later

Workout and PT plans are the next kind of task, and a session is a task whose
subtasks are exercises. Subtasks being tasks is what keeps that from being a
refactor.

When that second kind exists it takes two nullable columns — `kind`, and JSON
for what that kind carries (`{sets: 3, reps: 10, hold_seconds: 30}`) — plus a
third for what was actually done, since "2 of 3 sets" isn't a boolean. None of
them are worth adding before there is a second kind.

Then: state check-in and data entry, the Parallax frontend proper, the memory
audit surface.

## Decided without asking

- The routine moves In Review to Complete on seeing the PR merged.
- Capture parsing is sigils and dates, no model call.
- Repo tags map to paths in the routine's config, not in the app.
- Lists and tags stay separate models: a task has exactly one list, and a list
  carries settings a derived tag can't.
- Note and comments stay separate: one is an editable description, the other an
  append-only log.
