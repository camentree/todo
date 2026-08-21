# Features

What the app does today, and the rules behind each part. `design.md` is the
original intent; this is the built behaviour, and where the two disagree this
one is right.

## What it is

A todo list for Camen that is also a work queue a background Claude Code agent
reads from and writes to. Both live in the same lists, on the same screens. It
is a web app added to the phone's home screen, reachable publicly behind
Cloudflare Access, running on the same machine and Postgres server as Parallax.

## The rules that shape everything

- **Nothing is red, ever.** No colour means "you are late". The accent colour
  means one thing: something is asking for you.
- **Numbers only point at more content.** A group count says how many rows are
  inside it. Nothing counts what is overdue, unfinished, or owed. No streaks.
- **A finished task stays where it is** until the next day, struck through, so
  ticking something never makes the list jump under your finger.
- **Empty states state a fact.** "Nothing today." No congratulation.
- **Nothing is ever deleted.** Archive is the only removal.

## Screens

Four scopes, one screen component, chosen from a menu that drops out of the
title:

| Scope | Shows |
|---|---|
| Today | anything due today or earlier, plus anything with an unread comment |
| To Do | everything open, whatever its date |
| A list | one list, everything open |
| Archive | everything archived |

The title itself opens that menu. Beside it sit the date, a control for
grouping and sorting, and a bell. Each of those three opens a small menu
anchored under the bar rather than a full screen.

## A task

A title, and optionally: a list, tags, a person, a due date, a due time, a
stage, a note, subtasks, comments.

**Lists, tags and people are free text with no table behind them.** A list
exists because some task names it, and stops existing when none do. The same
for tags and for who a task belongs to. Every field with known values offers
them as you type.

**Subtasks are tasks** with a parent. A subtask cannot have subtasks of its
own. Nothing else distinguishes them, so promoting a checklist line into a real
task is just clearing its parent.

**Done-ness and stage are separate things.** Whether a task is finished is one
field, with values To Do, Complete, Missed, Skipped and Hidden. Where a piece of
work sits in a pipeline is a second, optional field with fixed values: To Do,
In Progress, In Review, Blocked, Complete. Most tasks never have a stage; the
programming ones do. Ticking a staged task moves it to the Complete stage, and
unticking it returns it to To Do.

## Adding

The button at the bottom right opens a new row at the end of the list, styled
exactly like every other row: an empty circle and a place to type. Return saves
it and leaves the row open for the next one. Leaving it empty closes it.

**What you type is parsed as you type it.** Recognised parts are lifted out of
the title and shown as chips under the row; tapping a chip puts those words back
into the title.

| You type | It becomes |
|---|---|
| `#health` | a tag |
| `@claude` | who it belongs to |
| `/programming` | the list |
| `!blocked` | the stage |
| `tomorrow`, `3pm`, `mon`, `aug 20`, `in 3 days` | a due date and time |
| `daily`, `every mon`, `every 2 weeks` | a repeating schedule |

Sigils are exact and always applied. Dates are guesses, so they are always shown
as chips you can reject. There is no escape syntax.

A task added from Today, where no list is implied, goes to the list you last
added to.

## Editing

**Tap a title to edit it in place.** While a row is being edited, an info button
appears at its right, which opens the full detail sheet and hands focus back so
the keyboard goes away. So renaming is one tap and everything else is two. No
outline or box appears around the text — the blinking caret is the only signal
that you are editing.

**A rename reparses sigils but not date words.** Typing `#health` or `@claude`
into a title sets the tag or the person and takes those words out of the title;
tags add to what is already there rather than replacing them. Words like
"tomorrow" or "weekly" stay in the title verbatim, because half the titles worth
editing contain one and fixing a typo should not silently move a due date. Any
field you do not mention keeps its value.

The detail sheet holds the list, the stage, tags, repetition, the date and time,
the note, subtasks, and comments. Tags there are chips you tap to remove, plus a
field that suggests the other tags already used in that same list and accepts new
ones.

**A section opens on its own when it holds something.** Timing — repetition, the
date and the time — subtasks, notes and comments are each collapsible, and each
starts open if the task already has one and collapsed if it does not. So a bare
task is four headings, and a task with a date, a note and comments shows all
three without a tap.

The note grows to fit what is in it rather than scrolling inside a fixed box, and
Tab indents the lines you have selected by two spaces, Shift-Tab takes them back
out. Single-line fields ignore Tab as usual.

**Closing the sheet** by dragging: pulling down on the grab handle at its top
always closes it; pulling down anywhere else closes it once the sheet is scrolled
to the top; dragging inside the note, the comments, or the subtasks scrolls those
as usual. Tapping outside also closes it.

## Grouping, sorting, ordering

Tasks can be grouped by list, stage, tag, due date, or who they belong to, and
sorted by hand, due date, title, or creation date. **A group heading does not
repeat itself in its rows** — group by stage and the rows stop showing their
stage.

Groups collapse by tapping their heading.

**Manual order is one sequence per list, and grouping is a view onto it.**
Reordering inside a group only reshuffles the positions those tasks already
occupied, so everything else keeps its place. Dragging anything switches the
view to manual order.

**Dragging across a group boundary changes the task.** Drag into another list's
group and it changes list; into the Complete stage and it is marked done.

## Repetition

A repeating task is a schedule that generates ordinary tasks with due dates. The
schedule is anchored to the calendar, never counted from when you last finished.

In the detail sheet, ticking Repeats turns the task you are looking at into the
repeating one — it does not create a copy alongside it. Then: how often (every N
days, weeks, or months), which weekdays for a weekly schedule, and the date and
time it starts. So "every two weeks on Tuesday and Thursday" is expressible.
While a task repeats, its date and time fields edit the schedule rather than the
one instance.

- Only one instance is open at a time. When the next is generated and the last
  is still open, that one becomes Missed.
- Skip does the same transition now instead of waiting.
- Missed instances leave Today but stay visible in list views.
- Unticking Repeats pauses the schedule and keeps every past instance.
- Generation depends only on the schedule and the date, so it can run from a
  page load, a cron, or a backfill and give the same answer.

## Swipes and gestures

| Gesture | Does |
|---|---|
| Swipe a row left | archive it, or unarchive if already archived |
| Swipe a row right | skip it if it repeats or is due today, otherwise hide it |
| Long-press and drag | reorder, including across groups |
| Tap the circle | tick it off |
| Tap the title | rename it |

A swipe takes effect once the row has travelled 40% of its own width, and the
coloured backing is exactly that wide, so where the colour ends is where the
action fires. It fades as the row crosses the middle, making the commit point
visible rather than guessed.

**Archived tasks cannot be skipped** — only unarchived — and they show no due
date, since the date of something already filed away is noise.

## Hiding

Hiding takes a task off Today without finishing or archiving it — for things you
have decided not to think about right now. Hidden tasks sort to the bottom of
list views and can be unhidden by swiping the same way again.

## Comments and changes

Comments are an append-only log; the note is an editable description. They are
separate on purpose.

**A comment from the agent means it needs you.** There are no status-update
comments. A task with an unread comment appears in Today whatever its date, and
carries a dot for as long as the most recent comment is not yours — so replying
clears it, and reading without replying does not. Opening its comments marks them
read and releases it from Today.

The bell opens a list of what changed while you were away — what the agent
added, moved, or asked about. Swiping one marks it seen. It carries a dot when
there is something unread, never a number.

## The agent loop

A scheduled Claude Code routine picks up the oldest task in the To Do stage. A
tag names the repository; the routine's own config maps that to a path.

Stage is how it reports:

- Picking it up → In Progress
- Finished → In Review, branch pushed, draft pull request opened. It never
  merges and never touches the main branch.
- Pull request merged or closed → Complete
- Needs something → Blocked, with a comment saying what. Answering and moving it
  back to To Do is the signal to resume.

## The look

Minimal and mobile-first: little detail at a glance, more on opening.

| | Dark | Light |
|---|---|---|
| Ground | `#1c1a1e` | `#eef1f0` |
| Text | `#ddd8d3` | `#1f2624` |
| Muted | `#857f7a` | `#77817e` |
| Accent | `#86c9c0` | `#2f7d74` |

The accent carries group headings, tags, and the add button in both themes — one
design on two grounds. A clean sans for task text, a mono for tags and metadata.

## Not built yet

- **The MCP server**, so claude.ai and Claude Code can read and write these
  tasks directly. Planned as a route on this same API over the same operations,
  so nothing is defined twice.
- **The agent routine itself.** The stages and comments it will use exist; the
  scheduled job does not.
- **Notifications** over Web Push, for a task reaching its time and for a task
  becoming blocked. Needs a service worker, a manifest, a key pair, and a
  subscriptions table. On the phone it only works once the app is on the home
  screen.
- **Selecting several tasks** to archive or skip in one go.
- **Search.** The parser that would drive it already exists and is tested; there
  is no search field on any screen.
- **A field for who a task belongs to.** Tags are editable in the sheet; the
  person is only settable by typing `@name` into a title.
- **Editing a schedule's interval beyond the sheet's controls**, such as "the
  last Friday of the month".
- **Workout and physio plans**, the next kind of task. A session would be a task
  whose subtasks are exercises. That needs two nullable columns — what kind of
  task it is, and what that kind carries, such as three sets of ten — plus a
  third for what was actually done, since "two of three sets" is not a yes or
  no. None of them are worth adding before a second kind exists.
