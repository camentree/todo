# todo, final design

One app for one person. Tasks is the home screen; Today and Backlog are its
two sections.
Habits reset each day, one-offs carry over. The runner and the journal come
from the habit app; the backlog, dated one-offs, Postgres and the look come
from main. The agent queue leaves the app. Mockups:
https://claude.ai/artifact/6PBTb4n79UMN6PeSz87j5p (Aesthetics page is current;
Structure page is earlier thinking, right on behaviour, wrong on skin).

## Screens

Three tabs in the top bar, Tasks, Journal, Notebook, plus a floating `+` that
follows the tab. The date line under the tab words stays on every tab. Runner,
composer and comment editor are full-screen overlays.

**Tasks**
- Two sections, Today and Backlog, each a large Title Case heading that folds
  by tapping the heading itself, with no chevron. Folded, the count of tasks
  inside sits right after the heading in small dim text. Today holds every
  group whose tasks are due today or in the past; Backlog holds the rest,
  future dates included, and a definition shows once at its earliest coming
  instance. A group appears in both sections when it has tasks in both.
- Groups in fixed order (habits, exercise, personal, then any `/name`, then
  `ungrouped` last), each a label with a fold chevron that stays visible in
  both states and turns smoothly between them. A task with no group is
  `ungrouped`; the model and the composer default to no group. No buttons on
  headers. Generous space between groups.
- Row: one line reading tick circle, then `{time} {title} {target}` — the
  time or coming date in dim first, the title in text colour, the target hint
  in dim after it (`30 min`, `500 ml`, `8`, `3 / 8`; a count is its number
  alone, there is no `×` anywhere) — and at the far right a cluster,
  `{n} comment-glyph {m} parts-glyph ›`, whose width is reserved on every row
  even when it is empty, so every title wraps at the same place. Under the
  title, only when there is something to say: an overdue date as `sept 12` in
  dim, and the mono chip for a group-level attribute. Nothing else.
- The two glyphs answer to whether the row is open. Closed (chevron `›`),
  neither is in the accent: they are dim counts, and tapping one does nothing,
  except the comment glyph, which opens the row with only the comments
  showing. Opening with the chevron shows the parts, the note and the
  subtasks, so the parts glyph turns accent; comments do not show by default.
  With the row open, tapping the comment glyph toggles the comments, accent
  while they show, and tapping the parts glyph toggles the parts. The
  exception is a newest comment written by `agent` and unseen: the comment
  glyph carries a small dot in the warn colour at its top right, open or
  closed, until the thread is opened and marked seen, and the chevron then
  opens comments and parts together, so both glyphs are accent. Closing the
  row drops both glyphs back to dim. An accent glyph is colour alone, with no
  background. Comments come first, then the note and the parts. Everything
  that opens rolls into view slowly; nothing pops. The note and the parts
  start where the title text starts, not at the tick.
- Tap the title to edit, tap the tick to complete. Hold anywhere on the row,
  tick or title, to enter select mode.
- A part is a TaskRow: same look, same tick, same swipes, same hold, indented
  under its parent.
- One-offs due today or earlier appear in their group with the habits. Overdue
  shows `sept 12` in muted text, never red.
- **Backlog**: collapsed by default, and every group inside it starts folded
  too. Everything not due today or past: future one-offs, the next instance of
  each coming definition, and every undated, unfinished one-off, grouped the
  same way. Tick works in place.
- Every fold on the screen, the two sections and each group in each section,
  is remembered by its key in localStorage and comes back on the next visit.
  A store that refuses to be read or written just leaves the defaults.
- Finished rows stay struck through until the day rolls over.

**Journal**: a view over the one `journal.md` Parallax already splits on H2.
Each H2 is an entry: its section title, a metadata block under it holding the
timestamp and the tags, then the body, which may carry its own deeper
subheadings. A new entry is titled `YYYY-MM-DD - HH:MM` in 24-hour time until
it is renamed. Entries newest first: the title on its own line in text
colour, shown only once it has been renamed so the moment is never printed
twice, then timestamp, the tags and the word count in the meta style, then
the first three lines of body as plain text. Filters
are plain words above the list, every tag in use in alphabetical order after
`all`, each with its count in dim, the active one in text colour; the
filtered tag is not repeated on its entries, and an entry's task name is kept
in the data but never shown. CodeMirror markdown with markers hidden
off the caret line, except heading marks, which stay visible so the level
reads; the `## title` line sits at the top and editing it renames the
section. An entry may name a task; a task named Journal auto-completes when
an entry exists for the day.

**Notebook**: the same screen over `notebook.md`. Journal is introspection,
Notebook is things. The editor's heading is Journal or Notebook, so the
entry's meta line does not repeat it. In the editor bold and italic render in
a colour of their own as well as their weight and fenced code blocks render
in mono on the raised colour; the list is plain text throughout. The editor
opens in read mode with no caret; tapping puts the caret where you tapped,
snapped to the end of the nearest word when you tap past the end of a line.
CodeMirror draws the caret itself and the browser's own is hidden, so there
is never more than one. Escape leaves the editor, asking whether to save when
the text changed; cmd+enter saves and leaves.

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
  The preview is its own section on the ground colour and the text field is a
  raised sheet under it, with no line between them; nothing shows a scrollbar
  while you edit.
- Grammar: first line is the task; `- ` lines are parts; indented lines are
  notes. Tokens: `/group`, `#every 2d|1w|mo,we,fr`, `#timer 30s`, `#count 10`,
  `#rest 60s`, `#text`, `×3` on a part to repeat it as three parts with the
  rest between. Dates for one-offs: `tomorrow`, `fri`, `sep 20`,
  `2026-09-20`, `3pm` or `15:00`; the round-trip writes `15:00`. No `#every`
  and no date means backlog. `=` sets the current value.
- Every token the grammar knows is in the accent colour as you type, and the
  `- ` of a part is faint. Anything it does not know, a `#word` included, is
  title text in the text colour, never an error. The highlighter reads the
  spans from the parser, so the colours cannot say one thing and the preview
  another.
- Tap a title to edit; the same text round-trips with progress kept, a blank
  line standing between the title, the note and the parts.
- What is added ends up visible: the section and the group it lands in unfold,
  the row scrolls slowly into view, and its parts start unfolded.
- Escape leaves the composer, asking whether to save when the text changed
  since it opened; cmd+enter saves and leaves. Enter keeps its own meaning: it
  adds from the single line and makes a new line in the block.
- Delete lives at the bottom of the composer, with the "today / every day"
  distinction for scheduled things.

**Comments**: notes for next time, attached by definition id or name so they
follow a habit across days. Agents post them too, through the HTTP API.
- Authors are `user` (Camen) and `agent`. A thread reads like messages:
  oldest at the top, newest at the bottom, the user's on the left in the
  raised colour, the agent's on the right in a tinted accent, each with its
  date in faint; the side it sits on already says who wrote it. The
  `Add a comment` field is pinned under the
  thread. A thread opens scrolled to the first unseen comment, or to the
  bottom when all are seen; scrolling up reveals older ones. Cards swipe
  left to delete. The same thread component on Today and in the runner.
- The field opens the comment editor: full screen, heading `comment`, the
  task and part under it, a plain text field, cancel and save. Escape
  cancels, cmd+enter saves.
- A newest comment from the agent that nobody has seen puts the warn dot on
  the row's comment glyph, and pulls the task onto Today in its group.
  Opening the thread marks them seen.

**Select mode**: hold anywhere on a row, or hold a group title to start with
the whole group. Nothing changes at the top. Every row becomes: drag handle, square
select, title, with the squares exactly where the ticks were. Group headers
get a square in line with the task squares, left of the title. Bottom right:
a small raised `×` cancels, and play, larger and round in the accent, runs
the selection in order, a selected subtask running the task it sits in.
Nothing else appears.
- Tapping a title selects that row too; nothing opens the editor and there is
  no tick to hit, so completing is a keyboard key. Holding a subtask selects
  that subtask alone, never its parent. Deselecting the last row leaves
  select mode.
- Drag a handle: the row lifts, one accent line shows the target, dragging
  right nests it under the row above. Dragging a row that is not selected
  adds it to the selection first, so the bundle moves together. A bundle
  drags the same way as one row, with the count as its title. A subtask
  drags to reorder inside its parent, or out to become a task of its own.
  Hold over a folded task and it unfolds. What
  lands takes the attributes of where it lands: the group, today's date in
  the Today section and no date at all in Backlog, parenthood if it went
  inside a task.
- No move button, no delete button, no picker.

**Swipes**: right on a backlog row is today; left on any row or comment is
delete with confirm. Only the row itself moves: tick, title, hint and meta
line; whatever is open under it (comments, note, parts) stays put. A part
swipes as its own row. Nothing else swipes.

**Motion**: any intentional movement is slow: folds roll open and closed,
chevrons turn, threads and notes slide into view. Nothing pops in, and
nothing that should stay still ever shifts: no layout jump when a scrollbar
appears, no glyph that nudges when its neighbour changes. Desktop reserves
the scrollbar gutter so screens never shift sideways. While an overlay is up
the screen behind it is held: the overlay opens at its own top however far
that screen was scrolled, wheel and touch move only the overlay, and closing
puts the screen back exactly where it was.

**Settings**: none on screen. Theme follows the system, `autoStartTimers`
stays a localStorage flag until it needs more.

**Keyboard**: desktop only, and never while typing. A faint ring moves down
and up the list with `j` and `k`; `f` folds and unfolds whatever it is on,
row, group or section, rolling as slowly as a tap does. The rest act on the
ring: select, complete (in select mode too), edit, delete, today, comments,
new task, and `?` for the list. Escape closes whatever is open, then clears
the ring; a tap anywhere clears it as well.

## Build order

1. Today from schedules, backlog, folding, the one-line composer that grows,
   tick, the two swipes.
2. Select mode with play, and the runner with timers and counts.
3. Comments: mark, unfold, cards, editor, unseen pulls onto Today.
4. Journal and Notebook.
5. Drag in select mode.

Each slice is usable alone and later slices add nothing to earlier screens
but a mark or a handle.

## Not in this version

Search, archive, stages, the Changes feed and bell, who, tags, undo history,
the settings screen, amounts, bulk delete. Each comes back only when its
absence hurts.

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
reach Parallax" when there was none; it dismisses on tap. The sprite is red,
with delete and the unseen dot.

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
`+`, done and play in the accent, arrows and `×` in raised; every round
button is the same size, and play's triangle sits a little left of centre so
it looks centred. On a pointer that hovers, everything clickable answers by
colour alone: dim goes to text, faint to dim, a tick's border to dim; nothing
moves and nothing gains a background. The phone sees none of it. Cards
(comments) are raised with a 0.7rem radius, the only cards in the app. The
ring is 250px, 3px, raised track with an accent arc. Red only for delete, the
swipe and every `delete` action, and the unseen dot on the comment glyph.
Phone first; desktop only widens the column. Light must survive sun.
Everything the app writes is lowercase (`since sept 12`, `wednesday,
september 16`, `15:00`, `done`, `add a comment`); the exceptions are group
labels, which stay UPPERCASE, and the tab names and the two section
headings, which stay Title Case; task titles and journal text are whatever
was typed. One format everywhere the app writes a date: short month and day,
`sept 16`; time in 24 hours, `15:00`; the two together, `sept 16, 15:00`.
`shared/format.ts` owns it. Two exceptions: the top bar's
`wednesday, september 16`, and the dim slot leading a task row, which says
`tomorrow` for the day after today and writes the clock in 12 hours,
`9:00 pm`, `7:30 am`.
