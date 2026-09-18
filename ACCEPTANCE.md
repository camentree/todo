# Acceptance

Each slice is done when every line under it holds. A line is checked by
driving the app in the iOS Simulator at phone width and in a desktop browser
at a wide width, or with curl against the API, whichever the line implies.
Check every line of every earlier slice again before calling a later slice
done. Reference for the look: https://claude.ai/artifact/6PBTb4n79UMN6PeSz87j5p
(Aesthetics page). Reference for behaviour: DESIGN.md.

## Slice 1: Today, backlog, folding, composer, tick, swipes

Look
- Text renders in Seravek; the fallback face is never visible after load.
- Dark and light match the canvas frames; the theme follows the device and
  switching the device theme switches the app without a reload.
- The top bar is the three words Today, Journal, Notebook with the active one in
  text colour and the others faint, and the date under them in the meta style.
- A task row is a circle tick on the left, the title, and a dim meta line under
  the title; rows are separated by whitespace only, no rules, no cards.
- Group labels are small uppercase dim text.
- A round accent + floats bottom right; the last row can be scrolled fully
  clear of it.
- On a wide screen the column is centred at a readable width; nothing else
  differs from the phone.
- Nothing on Today is red except the delete swipe.

Today
- Opening the app shows today's date and every definition due today as a row
  in its group, groups in the order habits, exercise, personal, then any other
  group alphabetically.
- A one-off dated today or earlier shows in its group; when its date is before
  today the meta line says since when.
- A one-off dated within the coming week shows under This week, folded by
  default; tapping its row moves it onto Today.
- Every undated unfinished one-off shows in the backlog list, reached by the
  filter word under the dateline, as one flat list naming each row's group.
- Tapping a tick completes the task: the title strikes through and the row
  dims, and stays where it is; tapping again uncompletes it.
- A completed habit is absent from Today the next day; a completed one-off is
  absent from Today and Backlog the next day.
- An unticked habit from yesterday does not appear today; an unticked one-off
  dated yesterday appears today and says since yesterday.
- A task with subtasks or a note shows a chevron at the far right of its title; a
  task with neither shows nothing there.
- Tapping the chevron unfolds the note (dim text) and then the subtasks (small
  rows with their own ticks) under the title with visible air between title,
  note and subtasks; tapping again folds them; reloading keeps the fold state.
- Ticking every subtask completes the parent; ticking the parent completes every
  subtask.
- Tapping a group label folds its rows and shows a count; tapping again
  unfolds; reloading keeps the state.
- Every tap target on a row can be hit with a thumb without hitting its
  neighbour.

Composer
- Tapping + opens a single-line field directly above the keyboard, with the
  list dimmed behind it; the keyboard never covers the field on iOS.
- Typing a title and pressing Enter adds the task to Backlog and closes the
  field.
- Typing a title with a group token and a weekly repeat adds a definition in
  that group due today and again a week later.
- Typing a title with a weekday name dates the one-off to the coming such day;
  a month and day, or a full date, sets that date; a time sets the time and it
  shows in the meta line.
- Pressing Shift+Enter, or tapping "more", grows the field into a multi-line
  editor with a live preview above it rendered as task rows.
- In the editor, a dash line makes a subtask; a timer token on it gives the subtask
  a countdown, a count token gives it a target; an indented line under a subtask
  becomes that subtask's note; the preview shows the subtasks and the note.
- A repeat marker on a subtask makes that many numbered copies of it.
- A rest token on the task sets the rest between subtasks and the preview shows
  it.
- Tapping a title opens the editor prefilled with the same text; saving without
  changes leaves the task identical; changing the title renames it; adding a
  dash line adds a subtask; removing one removes it and keeps the other subtasks'
  progress.
- A subtask with progress round-trips as a value assignment in the text and keeps
  that progress on save.
- The editor's bottom row shows delete; for a definition, delete asks whether
  today only or every day and does what was chosen; for a one-off it confirms
  once.
- Cancel closes the editor without saving.

Swipes
- Swiping a Backlog row right shows "today" on an accent background; released
  short of the threshold the row springs back; released past it the row moves
  onto Today in its group with today's date.
- Swiping any row left shows "delete" on a red background; released past the
  threshold it asks to confirm; confirming removes the row; cancelling
  restores it.
- The threshold is far enough that a scroll or a hesitant swipe never triggers
  either action, and is the same distance for both directions and on every row.
- A swipe that drifts vertically cancels and the row springs back.
- Nothing else swipes.

Data
- Requesting the tasks from the API creates instances from due definitions
  for today and the coming week the first time and not again.
- The client fetches everything once at start; opening a tab or unfolding a
  group makes no request.
- Every change made in the UI shows on screen before the request completes,
  is visible in the API promptly, and survives a reload.
- With the API set to fail writes, ticking a task shows the tick, then the
  tick reverts and an error sprite appears with the server's message; tapping
  the sprite dismisses it; the task is unchanged after a reload.
- With the server stopped, the same happens with a message saying Parallax
  could not be reached.
- A one-off posted by an agent through the API appears on Today or Backlog on
  the next load.

## Slice 2: select mode, play, runner

Select mode
- Holding a tick enters select mode with that row selected; a tap does not; a
  hold that drifts becomes a scroll instead.
- Holding a group label enters select mode with every row in the group
  selected.
- In select mode every row shows a drag handle at the far left, then a square
  select exactly where the tick was, then the title; group labels show a
  square in line with the task squares, left of the label; the top bar is
  unchanged.
- Tapping a square toggles that row; tapping a group square toggles every row
  in the group; a group square shows on only when all its rows are on.
- Bottom right shows a small raised × and a larger round accent play; nothing
  else appears anywhere.
- Tapping × leaves select mode and restores ticks; play opens the runner with
  the selected rows in list order.
- Selection is lost on leaving select mode.

Runner
- The runner is a full-screen overlay; the heading is the task name for one
  task or the group name for several; a round raised × top right returns to
  Today exactly as it was, keeping any progress made.
- Under the heading the queue runs across one line; the current item is in
  accent, others faint; when the current item would be out of view the row
  scrolls it into view, fading at the edge instead of cutting off.
- For a group run, a second block lists the current task's subtasks in an
  indented column, current in accent, a few lines tall, scrolling the current
  subtask into view and fading at the bottom instead of cutting off.
- The centre is a ring with a thin track; the subtask name is centred inside and
  wraps rather than overflowing for long names.
- A timer subtask shows minutes and seconds counting down; the ring empties as it
  runs; tapping inside starts, pauses and resumes; at zero the subtask is done.
- A count subtask shows the number and the target; the ring fills; tapping inside
  adds one; holding inside takes one away; reaching the target marks the subtask
  done.
- A boolean subtask shows a slide-to-complete inside the ring; sliding nearly the
  whole way completes it, less springs back.
- Between subtasks with a rest set, a rest countdown shows with the next subtask's
  name and a skip; it advances by itself at zero; with no rest the next subtask
  shows immediately.
- Between tasks, the last subtask's screen stays as it ended (timer at zero,
  count at its number) until done or next is tapped.
- The bottom row is a round raised previous arrow, a round accent done tick,
  and a round raised next arrow; they never move when content above changes.
- Done marks the current subtask complete and advances; next advances without
  marking; previous goes back one.
- After the last item a screen says done; its only control returns to Today.
- The screen does not sleep while the runner is open.
- Progress made in the runner is visible on Today's rows on return.

## Slice 3: comments

- A row with comments shows a speech mark and count in the meta line; a row
  with none shows nothing.
- A comment posted through the API by another author shows the mark in accent
  and the task appears on Today in its group even if it was in Backlog.
- Tapping the mark unfolds the comments under the task, newest first, each as
  a raised card with the body and the date in faint, then an "Add a comment"
  field; tapping the mark again folds them; the mark returns to dim once
  unfolded.
- Subtasks and comments never show under a task at the same time; unfolding one
  folds the other.
- In the runner, the newest comment shows as a card under the ring with "more"
  and a count in faint under it when there are more, or "add a comment" when
  there are none.
- Tapping "more" shows the older cards above the newest, scrolling up into
  view, and the "Add a comment" field below; the bottom buttons do not move.
- Tapping "Add a comment" anywhere opens a full-screen editor: heading
  "Comment", the task and subtask name under it, a markdown editor, cancel and
  save; save posts the comment and returns to where you were with the new card
  visible.
- Swiping a card left works exactly like swiping a row left: same distance,
  same red, same confirm.
- A comment on a habit is attached to its definition and shows on tomorrow's
  instance too.

## Slice 4: Journal and Notebook

- Journal and Notebook are the second and third words in the top bar; tapping
  switches; the + follows the tab.
- Journal lists the entries of journal.md newest first; each shows the
  timestamp and tag in meta style and the first few lines of body; Notebook does
  the same for notebook.md.
- A row of tag words sits above the list, "all" first, one per tag in use; the
  active word is in text colour; tapping one filters the list.
- Tapping + opens the full-screen editor with heading "Entry" or "Note"; save
  appends a new entry with the timestamp and a tag line to the right file; the
  new entry appears at the top of the list.
- Markdown markers are hidden on every line except the one with the caret.
- Tapping an entry opens it in the editor; saving updates that entry only.
- An entry created from a task carries the task name in its meta.
- A task named Journal is complete on any day that has a journal entry.

## Slice 5: drag

- In select mode, pressing a handle and moving lifts the row (raised, with a
  shadow) and shows one accent line where it would land; the line moves with
  the finger.
- Releasing drops the row at the line; the list reorders and the order
  survives a reload.
- Dragging clearly to the right while over a row nests the line under that
  row; releasing makes the dragged task a subtask of it; dragging back left
  un-nests it before release.
- Pausing over a folded task unfolds it so the line can go inside.
- Dropping into a different group changes the row's group. A drag stays in
  the list that is showing; swiping is how a row moves between today and
  backlog.
- With several rows selected, dragging any handle drags them all as one lifted
  row titled with the count, and they land together in order.
- Dragging a subtask out to the left edge makes it a top-level task.
- Nothing moves until the handle is used; dragging elsewhere on the row scrolls.

## Round 2: review of the first build

Motion and stillness
- Switching between Journal and Notebook, or between two filters, or between
  any two screens, moves nothing sideways, whether or not the content is tall
  enough to scroll, on desktop and on the phone.
- Folding or unfolding a group, a task's subtasks, or a thread rolls the content
  open or closed slowly enough to follow with the eye; it never pops.
- The fold chevron on a group label and on a task turns smoothly between its
  two positions and is visible in both.
- The comment mark, the tick, the title and the hint do not shift or shake
  when anything under the row opens or closes.
- Nothing on any screen makes a small movement that was not asked for.

Rows
- A task with a duration, count, reps or amount shows it in dim right after
  the title on the same line, in the form `30 min`, `2 times`, `8 ×`,
  `500 ml`, or `3 / 8` when partly done.
- A task with subtasks shows the subtask count in dim immediately left of its fold
  chevron at the far right; no "N subtasks" appears in the meta line.
- The meta line lists the mono chip first when there is one, then the date as
  a full weekday name or full date, then the time, then the comment mark.
- Dates never show a weekday abbreviation anywhere.
- Groups have visibly more space between them than rows have between each
  other.
- Holding anywhere on a row, tick or title, enters select mode with that row
  selected; a tap on the title still edits and a tap on the tick still ticks.
- A subtask row looks and behaves exactly like a task row: same tick, same
  title, same hint, swipes left to delete, holds to select, indented under
  its parent.
- Tapping the title of a row under This week opens the editor and the row
  stays where it is; ticking it brings it onto Today completed.

Under a row
- Opening the thread shows it directly under the row's meta line; opening the
  chevron shows the note and then the subtasks under whatever is already open;
  both can be open at once and each closes on its own.
- A swipe on a task moves only the tick, title, hint and meta line; anything
  open under it stays still and stays open.

Comments
- A thread reads oldest at the top and newest at the bottom, the user's
  comments on the left in the raised colour and the agent's on the right in
  a tinted accent, each with author and date in faint.
- The "Add a comment" field stays pinned under the thread.
- A thread opens scrolled to the first unseen comment when there is one,
  otherwise to the bottom; scrolling up reveals older ones.

Journal and Notebook
- The third word in the top bar reads Notebook everywhere it is named.
- The editor's heading reads Journal or Notebook, and the entry's meta line
  does not repeat that word.
- Bold and italic text render in a distinct colour as well as their weight or
  slant, in the editor and in the list preview.
- A fenced code block renders in mono on the raised colour in the editor.
- A new entry opens with no caret; tapping in the text places one caret where
  tapped, and tapping past the end of a line places it at the end of that
  line's last word.
- Typing a character and deleting it leaves exactly one caret.

Select mode
- The play button sits centred on the same vertical line as the + it
  replaces; its glyph is larger and its corners rounded.
- Selecting two habit instances and dragging them into another group moves
  both once; no duplicate rows appear on Today, in This week, or after a
  reload; their definitions now carry the new group and tomorrow's instances
  appear there.

Casing
- Every word the app writes is lowercase: hints, meta lines, the since text,
  This week and Backlog rows' text, and action words such as done, cancel,
  save, more, add a comment; only group labels (uppercase) and the three tab
  names (Title Case) differ, and task titles and journal text keep what was
  typed.

Colour
- Every colour token matches main's stylesheet verbatim in both themes, and
  the page ground, the raised surfaces and the text read the same as main's
  app side by side; nothing paints a background over the ground in a
  different colour.

Touch
- Every interactive element on every screen can be hit with a thumb without
  landing on a neighbour; nothing interactive sits under the floating button
  or the home indicator; the composer and the editor sit fully above the
  keyboard.

Keyboard
- On a desktop keyboard, and never while typing in a field: Escape closes
  whatever is open (composer, editor, runner, select mode, an open thread)
  and otherwise blurs; j / k and ctrl-n / ctrl-p move a focus ring down and
  up the list including subtasks and across groups; h / l fold and unfold the
  focused task's subtasks, and l unfolds a group when its label is focused;
  Space toggles the focused row's selection, entering select mode on first
  use; Enter completes it; i edits it; d deletes it with the same confirm as
  the swipe; t marks it today or takes today off it; c opens its thread; n
  opens the composer; ? shows a sheet listing these.
- The focus ring is a faint outline on the row, appears only after a key has
  been pressed, and never shifts the layout.
