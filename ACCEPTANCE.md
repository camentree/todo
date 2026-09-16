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
- The top bar is the three words Today, Journal, Notes with the active one in
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
- Every undated unfinished one-off shows under Backlog, folded by default,
  grouped the same way as Today.
- Tapping a tick completes the task: the title strikes through and the row
  dims, and stays where it is; tapping again uncompletes it.
- A completed habit is absent from Today the next day; a completed one-off is
  absent from Today and Backlog the next day.
- An unticked habit from yesterday does not appear today; an unticked one-off
  dated yesterday appears today and says since yesterday.
- A task with parts or a note shows a chevron at the far right of its title; a
  task with neither shows nothing there.
- Tapping the chevron unfolds the note (dim text) and then the parts (small
  rows with their own ticks) under the title with visible air between title,
  note and parts; tapping again folds them; reloading keeps the fold state.
- Ticking every part completes the parent; ticking the parent completes every
  part.
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
- In the editor, a dash line makes a part; a timer token on it gives the part
  a countdown, a count token gives it a target; an indented line under a part
  becomes that part's note; the preview shows the parts and the note.
- A repeat marker on a part makes that many numbered copies of it.
- A rest token on the task sets the rest between parts and the preview shows
  it.
- Tapping a title opens the editor prefilled with the same text; saving without
  changes leaves the task identical; changing the title renames it; adding a
  dash line adds a part; removing one removes it and keeps the other parts'
  progress.
- A part with progress round-trips as a value assignment in the text and keeps
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
- For a group run, a second block lists the current task's parts in an
  indented column, current in accent, a few lines tall, scrolling the current
  part into view and fading at the bottom instead of cutting off.
- The centre is a ring with a thin track; the part name is centred inside and
  wraps rather than overflowing for long names.
- A timer part shows minutes and seconds counting down; the ring empties as it
  runs; tapping inside starts, pauses and resumes; at zero the part is done.
- A count part shows the number and the target; the ring fills; tapping inside
  adds one; holding inside takes one away; reaching the target marks the part
  done.
- A boolean part shows a slide-to-complete inside the ring; sliding nearly the
  whole way completes it, less springs back.
- Between parts with a rest set, a rest countdown shows with the next part's
  name and a skip; it advances by itself at zero; with no rest the next part
  shows immediately.
- Between tasks, the last part's screen stays as it ended (timer at zero,
  count at its number) until done or next is tapped.
- The bottom row is a round raised previous arrow, a round accent done tick,
  and a round raised next arrow; they never move when content above changes.
- Done marks the current part complete and advances; next advances without
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
- Parts and comments never show under a task at the same time; unfolding one
  folds the other.
- In the runner, the newest comment shows as a card under the ring with "more"
  and a count in faint under it when there are more, or "add a comment" when
  there are none.
- Tapping "more" shows the older cards above the newest, scrolling up into
  view, and the "Add a comment" field below; the bottom buttons do not move.
- Tapping "Add a comment" anywhere opens a full-screen editor: heading
  "Comment", the task and part name under it, a markdown editor, cancel and
  save; save posts the comment and returns to where you were with the new card
  visible.
- Swiping a card left works exactly like swiping a row left: same distance,
  same red, same confirm.
- A comment on a habit is attached to its definition and shows on tomorrow's
  instance too.

## Slice 4: Journal and Notes

- Journal and Notes are the second and third words in the top bar; tapping
  switches; the + follows the tab.
- Journal lists the entries of journal.md newest first; each shows the
  timestamp and tag in meta style and the first few lines of body; Notes does
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
  row; releasing makes the dragged task a part of it; dragging back left
  un-nests it before release.
- Pausing over a folded task unfolds it so the line can go inside.
- Dropping into a different group changes the row's group; dropping into a
  group on Today gives a Backlog row today's date; dropping into Backlog
  removes the date.
- With several rows selected, dragging any handle drags them all as one lifted
  row titled with the count, and they land together in order.
- Dragging a part out to the left edge makes it a top-level task.
- Nothing moves until the handle is used; dragging elsewhere on the row scrolls.
