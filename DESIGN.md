# todo, final design

One app for one person. Today is the home screen; a backlog sits under it.
Habits reset each day, one-offs carry over. The runner and the journal come
from the habit app; the backlog, dated one-offs, Postgres and the look come
from main. The agent queue leaves the app. Mockups:
https://claude.ai/artifact/6PBTb4n79UMN6PeSz87j5p (Aesthetics page is current;
Structure page is earlier thinking, right on behaviour, wrong on skin).

## Screens

Three tabs in the top bar, Today, Journal, Notes, plus a floating `+` that
follows the tab. Runner, composer and comment editor are full-screen overlays.

**Today**
- Groups in fixed order (habits, exercise, personal, then any `/name`), each
  a label with a fold. No buttons on headers.
- Row: tick circle on the left, title, `›` at the far right when the task has
  parts or a note. Under the title a meta line: kind hint (`30 min`, `3
  parts`), date or time, comment mark with count, mono chip for a group-level
  attribute. Tap the title to edit, tap the tick to complete, tap `›` to
  unfold: the note first (dim text), then the parts (small rows with their
  own ticks), with air between title, note and parts so it never crowds;
  fold state is remembered per task. Tap the comment mark to unfold the
  comments under the task; tap again to fold. Parts and comments never show
  together.
- One-offs due today or earlier appear in their group with the habits. Overdue
  shows `since sep 12` in muted text, never red.
- **This week**: definitions due in the next six days and one-offs dated within
  the week. Tap brings it forward to today.
- **Backlog**: collapsed by default. Every undated, unfinished one-off, grouped
  the same way. Tick works in place.
- Finished rows stay struck through until the day rolls over.

**Journal**: a view over the one `journal.md` Parallax already splits on H2.
Each H2 is an entry: a timestamp heading, a metadata block under it holding
tags, then the body. Entries newest first: timestamp and tag in the meta
style, first three lines of body. Filters are plain words above the list,
the active one in text colour. CodeMirror markdown with markers hidden off
the caret line; a new entry writes a new H2 with the timestamp and a tag
line. An entry may name a task; a task named Journal auto-completes when an
entry exists for the day.

**Notes**: the same screen over `notebook.md`. Journal is introspection,
Notes is things.

**Runner**
- Top: the scope name (task or group) as the heading, a round `×` button.
  Under it the queue across one line, current in accent, others faint,
  scrolling sideways behind a fade to keep the current one in view. For a
  group run a second block lists the current task's parts in a short indented
  column, same colours, scrolling the same way.
- Middle: a ring. Timer counts down and the ring empties; count shows the
  number, `of 10`, and the ring fills; tap anywhere inside to add one, hold to
  take one away. Part name centred inside the ring, wrapping if long.
  Boolean is slide-to-complete inside the ring.
- Under the ring: the newest comment as a card, then `▾ N more` in faint, or
  `add a comment` when there are none. Tapping opens the rest: older cards
  above, scrolling up into view, and the `Add a comment` field below. Cards
  swipe left to delete. The field opens the comment editor.
- Bottom: previous and next as round raised arrows, done as the round accent
  tick between them. These never move.
- Between parts: the rest timer if there is one, auto-advancing; otherwise
  straight on. Between tasks: the last part's screen stays as it ended, timer
  at zero, count at the number you stopped on, until done or next. At the end
  of the queue a screen that says done. Wake lock throughout. Amounts are
  dropped; water is `#count 8`.

**Composer**: one text field, one grammar, used for adding and editing.
- Opens as a single line above the keyboard. Enter adds. Typing a newline (or
  the `more` button) grows it into the block editor with the live preview.
- Grammar: first line is the task; `- ` lines are parts; indented lines are
  notes. Tokens: `/group`, `#every 2d|1w|mo,we,fr`, `#timer 30s`, `#count 10`,
  `#rest 60s`, `#text`, `×3` on a part to repeat it as three parts with the
  rest between. Dates for one-offs: `tomorrow`, `fri`, `sep 20`,
  `2026-09-20`, `3pm`. No `#every` and no date means backlog. `=` sets the
  current value.
- Tap a title to edit; the same text round-trips with progress kept.
- Delete lives at the bottom of the composer, with the "today / every day"
  distinction for scheduled things.

**Comments**: notes for next time, attached by definition id or name so they
follow a habit across days. Agents post them too, through the HTTP API.
- One card component everywhere: body, then date in faint. Swipe left to
  delete. One `Add a comment` field everywhere, opening the comment editor:
  full screen, heading `Comment`, the task and part under it, the journal's
  markdown editor, cancel and save.
- An unseen comment from anyone else shows the row mark in the accent colour
  and pulls the task onto Today in its group. Unfolding marks them seen.

**Select mode**: hold a tick, or hold a group title to start with the whole
group. Nothing changes at the top. Every row becomes: drag handle, square
select, title, with the squares exactly where the ticks were. Group headers
get a square in line with the task squares, left of the title. Bottom right:
a small raised `×` cancels, and play, larger and round in the accent, runs
the selection in order. Nothing else appears.
- Drag a handle: the row lifts, one accent line shows the target, dragging
  right nests it under the row above. A bundle drags the same way as one row,
  with the count as its title. Hold over a folded task and it unfolds. What
  lands takes the attributes of where it lands: the group, the date if the
  group is on Today, parenthood if it went inside a task.
- No move button, no delete button, no picker.

**Swipes**: right on a backlog row is today; left on any row or comment is
delete with confirm. Nothing else swipes.

**Settings**: none on screen. Theme follows the system, `autoStartTimers`
stays a localStorage flag until it needs more.

## Build order

1. Today from schedules, backlog, folding, the one-line composer that grows,
   tick, the two swipes.
2. Select mode with play, and the runner with timers and counts.
3. Comments: mark, unfold, cards, editor, unseen pulls onto Today.
4. Journal and Notes.
5. Drag in select mode.

Each slice is usable alone and later slices add nothing to earlier screens
but a mark or a handle.

## Not in this version

Search, archive, stages, the Changes feed and bell, who, tags, keyboard
shortcuts, undo history, the settings screen, amounts, bulk delete. Each
comes back only when its absence hurts.

## Data

Postgres, in the Parallax database, one schema. Parallax's HTTP server owns the
tables and the app talks only to Parallax. Agents use the same HTTP API.

- `definitions`: id, name, group, kind, target, timer, rest, every (interval or
  weekday list), anchor date, parts (jsonb, ordered: name, kind, target, note),
  note, sort, created, ended.
- `tasks`: one row per instance. id, definition id (nullable for one-offs),
  date (nullable for backlog), name, group, kind, target, current, value, done
  at, parts (jsonb with per-part current/value/done), note, sort, created.
- `comments`: id, definition id (nullable), task name, body, author, written
  at, seen at.
- Journal and notes are the two markdown files Parallax already indexes; the
  app reads and appends through Parallax's journal endpoints.

Until Parallax has these endpoints, `server/main.ts` stands in over a data
directory; `DEV.md` lists the endpoints, how to run, seed, isolate and reset.

The client loads definitions, every task, every comment and both journals
once at start and holds them in memory; every screen renders from memory.
A write changes memory first and the screen moves at once, then the request
goes to the API. If the request fails, memory is reverted to what it was and
an error sprite appears with the message from the response, or "could not
reach Parallax" when there was none; it dismisses on tap. The sprite is the
only red thing besides the delete swipe.

Rules the server owns:
- Opening a date instantiates every definition due that day, once.
- A habit's instance from a previous day is never carried; it stays as history.
- A one-off with a date earlier than today shows on Today until done.
- Done is derived: manual tick, else journal rule, else target reached, else
  non-empty text. Parents derive from parts.
- Delete removes the row. Nothing hides.

Migration from main: rows in `tasks` with `recurring_task_id` become
definitions plus today's instance; the rest become one-offs with their date
kept; `note` carries over; lists become groups; comments carry over by task
name; tags, who, stage, events and archived rows are dropped.

## Agent queue

Out of the app. Claude Code on the phone with remote control is the queue and
the alert. If a task ever needs a place to live, it is a one-off in the
`programming` group with a comment, created through the same HTTP API.

## Style

Main's look on the new structure. Seravek (the three self-hosted woff2
files), main's palette in both themes: warm-dark ground `#1c1a1e`, raised
`#26242a`, text `#ddd8d3`, dim `#857f7a`, faint `#605b58`, accent `#7fb996`;
light ground `#f5f8f6`, text `#1b2120`, accent `#356b52`. Ticks are circles
on the left, 1.3rem, 1.5px border. Rows are two lines: title at 1.02rem,
then the meta line at 0.86rem in dim. Group labels 0.76rem, 600, uppercase,
0.06em, dim. Chips are mono, 0.65rem, accent on a translucent accent ground.
Top bar is the three words at 1.6rem bold, active in text colour, others
faint; the date sits under it in the meta size. Round buttons are 3.25rem:
`+` and done in the accent, arrows and `×` in raised; play is 4rem. Cards
(comments) are raised with a 0.7rem radius, the only cards in the app. The
ring is 250px, 3px, raised track with an accent arc. Red only for the delete
swipe. Phone first; desktop only widens the column. Light must survive sun.
