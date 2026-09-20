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
follows the tab. The date line under the tab words stays on every tab. Runner
and entry editor are full-screen overlays. The composer is a screen of its own
on a phone — the preview, then the text field, and nothing else: it takes the
top bar's place rather than sitting under it, and holds nothing behind it. Where
there is a mouse and room it is a sheet sliding over the list instead. Comments
are neither: they are written in place, under the thread.

**Routes**: the address bar says which tab is up — `/tasks`, `/journals`,
`/notebooks`, with `/` landing on `/tasks`. A tap on a tab word pushes history,
so back and forward walk the tabs. `/tasks/{task id}` runs that one task over
the Tasks screen, `/tasks/{task id}?edit` opens that task in the composer and
`/tasks?edit` opens an empty one, and `/journals/{at}` and `/notebooks/{at}`
open that entry's editor over its list; the id is the entry's `at`,
url-encoded. Running and editing are the same slot, so `?run` and `?edit`
never appear together: an address carrying both keeps the run and drops the
edit. Opening the
runner or an entry from the app writes the same address, so the × and the
browser's back both close the overlay and leave the list where it was, and an
address nobody recognises simply shows the list. Deep links load: the built
index answers every one of these paths.

**Tasks**
- Two lists, today and backlog, chosen by a filter row under the dateline in
  the same shape as the journal's tag filters: `today (8)  backlog (24)`,
  the active word in text colour, the other dim. One list shows at a time,
  today by default. Today holds every group whose tasks are due today or in
  the past; backlog holds the rest, future dates included, and a definition
  shows once at its earliest coming instance. `[` and `]` flip between them.
- Groups in fixed order (habits, exercise, personal, then any `/name`, then
  `ungrouped` last), each a label with a fold chevron that stays visible in
  both states and turns smoothly between them. A task with no group is
  `ungrouped`; the model and the composer default to no group. No buttons on
  headers. Generous space between groups.
- Row: tick circle, then `{title} {target} {when} {group}` — the title in
  text colour, the target hint in dim after it (`30 min`, `500 ml`, `8`,
  `3 / 8`; a count is its number alone, there is no `×` anywhere), then the
  date and the time in dim, `friday, 9:00 pm`, `tomorrow, 9:00 pm`, a past
  `yesterday`, `saturday` or `sep 05`, or just `9:00 pm` when the date is
  today or there is none, then in Backlog the group name in the same dim
  style — and at the far right a cluster, `{n} comment-glyph {m} subtasks-glyph
  ›`, the subtask count being the total, whose width is reserved on every row
  even when it is empty, so every title wraps at the same place. On desktop
  that is one line. On the phone the date, time and group sit on a second
  line under the title, starting where the title text starts; the target
  stays on the title line. A subtask row has no cluster but its chevron, so its
  title runs to the chevron.
- The two glyphs answer to whether the row is open. Closed (chevron `›`),
  neither is in the accent: they are dim counts, and tapping one does nothing,
  except the comment glyph, which opens the row with only the comments
  showing. Opening with the chevron shows the note and the
  subtasks, so the subtasks glyph turns accent; comments do not show by default.
  With the row open, tapping the comment glyph toggles the comments, accent
  while they show, and tapping the subtasks glyph toggles the subtasks. The
  exception is a newest comment written by `agent` and unseen: the comment
  glyph carries a small dot in the warn colour at its top right, open or
  closed, until the thread is opened and marked seen, and the chevron then
  opens comments and subtasks together, so both glyphs are accent. Closing the
  row drops both glyphs back to dim. An accent glyph is colour alone, with no
  background. Comments come first, then the note and the subtasks. Everything
  that opens rolls into view slowly; nothing pops. The note and the subtasks
  start where the title text starts, not at the tick.
- Tap the row to edit: anywhere on it that is not one of its own controls,
  the tick, the handle and square in select mode, the two glyphs and the
  chevron, so the title, the target hint, the date and time and the chip all
  open the editor. Tap the tick to complete. Hold anywhere on the row to
  enter select mode. The hover lift covers exactly the area a tap would open;
  the controls answer hover themselves and leave the row flat.
- A subtask is a TaskRow: same look, same tick, same swipes, same hold, indented
  under its parent.
- One-offs due today or earlier appear in their group with the habits. Overdue
  ends its line with `yesterday`, `saturday` or `sep 05` in the dim slot,
  never red.
- **Backlog**: everything not due today or past: future one-offs, the next
  instance of each coming definition, and every undated, unfinished one-off,
  as one flat list, dated rows first by date then the rest by sort, each row
  naming its group among its attributes. Dragging inside backlog only
  reorders; moving between the lists is a swipe, since only one list is on
  screen. Tick works in place.
- Every group fold is remembered by its key in localStorage and comes back on
  the next visit.
  A store that refuses to be read or written just leaves the defaults.
- Finished rows stay struck through until the day rolls over.

**Journal**: a view over the one `journal.md` Parallax already splits on H2.
Each H2 is an entry: its section title, the moment it was written as
`YYYY-MM-DDTHH:MM:SS`, and under it a blank line, plain `key: value` lines,
`at` and the metadata, `tag` repeated or as a comma list and `author`, then a
blank line and the body, which may carry its own deeper subheadings. The
entry has no id; `at` is what identifies it. A new entry has no display
title, so its H2 is the section title; once it has one the H2 is the display
title instead, and the title an entry shows anywhere is the display title
when there is one and the section title otherwise. Entries newest first, and
every one shows its title: the title on its own line at the task-title size
and weight in text colour, a raw timestamp reading `2026-09-15 07:40` with
the seconds dropped for the eye only, then the attribute line, the date, the
time as `9:05 pm`, the tags as a comma list and last the word count, parts
separated by a middle dot in the meta size, the word count in dim and the
rest in text colour, then at most three lines of body in dim, ending in an
ellipsis, with its markdown rendered: bullets and numbers and heading marks
kept, bold and italic in their weight and style but the same dim colour,
inline code in mono. No metadata line ever appears in the preview. Filters
are plain words above the list, every tag in use in alphabetical order after
`all`; each carries its count in parentheses in its own colour, `all`
included, and the active one is in text colour. The filtered tag is not
repeated on its entries. Rows carry the same padding, radius and slow
background fade as a task row. CodeMirror markdown with markers hidden off
the caret line, except heading marks, which stay visible so the level reads;
the `## title` line sits at the top, and editing it writes the display title
and leaves the section title alone, while typing it back to the section
title clears it. A task named Journal auto-completes when an entry exists
for the day.

**Notebook**: the same screen over `notebook.md`. Journal is introspection,
Notebook is things. The editor's heading is Journal or Notebook, so the
entry's meta line does not repeat it. In the editor bold and italic render in
a colour of their own as well as their weight and fenced code blocks render
in mono on the raised colour; the list is plain text throughout. The editor
opens in read mode with no caret; tapping puts the caret where you tapped,
snapped to the end of the nearest word when you tap past the end of a line.
CodeMirror draws the caret itself and the browser's own is hidden, so there
is never more than one. Escape leaves the editor, asking whether to save when
the text changed; cmd+enter saves and leaves. The `×` at the top answers
hover like every other clickable, and so does save. `delete`, in the warn
colour, sits at the bottom left, opposite cancel and save, and asks first.

**Runner**
- Top: the scope name (task or group) as the heading, a round `×` button.
  Under it the queue across one line, current in accent, others faint,
  scrolling sideways behind a fade to keep the current one in view. For a
  group run a second block lists the current task's subtasks in a short indented
  column, same colours, scrolling the same way.
- Middle: a ring. Timer counts down and the ring empties; count shows the
  number, `of 10`, and the ring fills; tap anywhere inside to add one, hold to
  take one away. Subtask name centred inside the ring, wrapping if long.
  Boolean is slide-to-complete inside the ring.
- Under the ring: the newest comment as a card, then `▾ N more` in faint, or
  `add a comment` when there are none. Tapping opens the rest: older cards
  above, scrolling up into view, and the `add a comment` field below. Cards
  swipe left to delete.
- Bottom: previous and next as round raised arrows, done as the round accent
  tick between them. These never move.
- Between subtasks: the rest timer if there is one, auto-advancing; otherwise
  straight on. Between tasks: the last subtask's screen stays as it ended, timer
  at zero, count at the number you stopped on, until done or next. At the end
  of the queue a screen that says done. Wake lock throughout. Amounts are
  dropped; water is `#count 8`.

**Composer**: one text field, one grammar, used for adding and editing.
- Opens as a single line above the keyboard. Enter adds. Typing a newline (or
  the `more` button) grows it into the block editor with the live preview.
  The preview is its own section on the ground colour and the text field is a
  raised sheet under it, with no line between them; nothing shows a scrollbar
  while you edit.
- Grammar: first line is the task; `- ` lines are subtasks; indented lines are
  notes. Tokens: `/group`, `#every 2d|1w|mo,we,fr`, `#timer 30s`, `#count 10`,
  `#rest 60s`, `#text`, `×3` on a subtask to repeat it as three subtasks with the
  rest between. Dates for one-offs: `tomorrow`, `fri`, `sep 20`,
  `2026-09-20`, `3pm` or `15:00`; the round-trip writes `15:00`. No `#every`
  and no date means backlog. `=` sets the current value.
- Every token the grammar knows is in the accent colour as you type, and the
  `- ` of a subtask is faint. Anything it does not know, a `#word` included, is
  title text in the text colour, never an error. The highlighter reads the
  spans from the parser, so the colours cannot say one thing and the preview
  another.
- Tap a title to edit; the same text round-trips with progress kept, a blank
  line standing between the title, the note and the subtasks.
- What is added ends up visible: the section and the group it lands in unfold,
  the row scrolls slowly into view, and its subtasks start unfolded.
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
  `add a comment` field is pinned under the
  thread. A thread opens scrolled to the first unseen comment, or to the
  bottom when all are seen; scrolling up reveals older ones. Cards swipe
  left to delete. The same thread component on Today and in the runner.
- The field takes the comment in place, so the task and the rest of the
  thread stay in view while you type. It is a plain field on the raised
  colour with no lines around it, one line to start, growing with the text,
  and a small `add` in the accent that fades in beside it once there is
  something to add. Enter adds on a keyboard and shift+enter makes a new
  line; cmd+enter adds too; escape clears the field and leaves it. There is
  no comment screen.
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
- Tapping the row selects it too; nothing opens the editor and there is
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
line; whatever is open under it (comments, note, subtasks) stays put. A subtask
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

- `schedules`: id, title, group, type (boolean, timer_seconds, count, amount,
  text), target (required for the numeric types, null for boolean and text),
  rest seconds, subtasks (ordered template: title, type, target, rest seconds,
  note, sort order), due time, and the recurrence rule: frequency (daily,
  weekly, monthly), repeat every, weekdays (Monday is 0), day of month, starts
  on, ended on. Created at is read-only.
- `tasks`: one row per instance and per subtask. id, parent id (a subtask is a
  child row), schedule id (nullable for one-offs), due date (nullable for
  backlog), due time, title, group, type, target, numerical value (progress on
  the numeric types), string value (text tasks only), rest seconds, finalized
  at (done means finalized and not skipped), is skipped, assignee, note, sort
  order, created at (read-only). On the wire a task carries its subtasks and
  comments nested; a write with a `subtasks` array replaces the children and
  ignores `comments`. Shape violations are 400.
- `comments`: id, task id, body, author, written at, seen at, created at.
  Reading a schedule instance's comments aggregates across every instance of
  its schedule.
- Journal and notes are the two markdown files Parallax already indexes; the
  app reads and appends through Parallax's `/api/journal` and `/api/notebook`
  endpoints.

The composer's `#every` token is client syntax only: it compiles to the
recurrence rule and serialises back for editing. For dev and testing,
`server/standin.ts` serves the same contract over a data directory; `DEV.md`
lists the endpoints, how to run, seed, isolate and reset.

The client loads schedules, every task and both journals once at start and
holds them in memory; every screen renders from memory.
A write changes memory first and the screen moves at once, then the request
goes to the API. If the request fails, memory is reverted to what it was and
an error sprite appears with the message from the response, or "could not
reach Parallax" when there was none; it dismisses on tap. The sprite is red,
with delete and the unseen dot.

Rules the server owns:
- Opening a date instantiates every schedule due that day, once.
- A habit's instance from a previous day is never carried; it stays as history.
- A one-off with a date earlier than today shows on Today until done.
- Done is derived: manual tick, else journal rule, else target reached, else
  non-empty text. Parents derive from subtasks.
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
0.06em, dim. Attributes after a title are all the meta size in dim; nothing
is a pill.
Top bar is the three words at 1.6rem bold, active in text colour, others
faint; the date sits under it in the meta size. Round buttons are 3.25rem:
`+`, done and play in the accent, arrows and `×` in raised; every round
button is the same size, and play's triangle sits a little left of centre so
it looks centred. On a pointer that hovers, everything clickable answers by
colour alone: dim goes to text, faint to dim, a tick's border to dim, accent
and warn to a stronger shade of themselves; nothing moves. Only a whole row,
a task row or a journal entry, gains a background, the raised colour under
the area a tap would open. The phone sees none of it. Cards
(comments) are raised with a 0.7rem radius, the only cards in the app. The
ring is 250px, 3px, raised track with an accent arc. Red only for delete, the
swipe and every `delete` action, and the unseen dot on the comment glyph.
Phone first; desktop only widens the column. Light must survive sun.
Everything the app writes is lowercase (`since sept 12`, `wednesday,
september 16`, `15:00`, `done`, `add a comment`); the exceptions are group
labels, which stay UPPERCASE, and the tab names and the two section
headings, which stay Title Case; task titles and journal text are whatever
was typed. One format everywhere the app writes a date: three-letter month
and two-digit day, `sep 16`; time in 12 hours, `3:00 pm`; the two together,
`sep 16, 3:00 pm`. `shared/format.ts` owns it. Two exceptions: the top bar's
`wednesday, september 16`, and the dim slot on a task row, which says
`yesterday`, `today`, `tomorrow`, the weekday name within a week either way,
and the short date beyond that.
