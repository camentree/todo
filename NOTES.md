# Rebuild notes

Built top to bottom from DESIGN.md, the component rules now in
`src/shared/ui/CLAUDE.md`, and the Aesthetics page of
the canvas, with nobody to ask. Every judgment call is here, so are the
acceptance passes and anything that does not hold.

Checks were driven in the iOS Simulator (iPhone 17 Pro, Safari, real taps and
swipes through AXe) and in Chrome at 1400px, plus curl against the API. Vite
ran on 5174 because 5173 was already taken on this machine by another
checkout.

## Judgment calls

- **Fold state and "parts or comments"**: a task remembers one of `parts`,
  `comments` or nothing under `fold:task:<id>` in localStorage. Opening one
  closes the other, so Foldable (uncontrolled, persisted) is used by Group,
  This week and Backlog, and TaskRow uses the same `remember` helpers with its
  own three-way state.
- **This week** shows each definition once, at its earliest coming
  instance, plus every dated one-off. The server instantiates every due
  definition for the coming six days, which would put forty rows there. Tap
  on a This week title brings that instance forward (date = today); the tick
  still ticks in place.
- **Chip**: the mono chip is the group name, shown only where a row is
  outside its group header (This week). Backlog nests real group headers,
  drawn in the faint colour so the hierarchy reads.
- **Count hint**: `8 ×` when nothing is done, `3 / 8` while partial.
  Timer: `30 min`. Parts: `4 parts`. Text: the value once written, else
  `text`.
- **Confirm**: a raised bottom sheet with plain text buttons (cancel, and
  the choices in accent) for the delete swipe, the comment delete and the
  composer's delete. Nothing in the design fit a two-way
  choice ("today only" / "every day").
- **Delete in the composer** is dim text, not red; red stays on the swipe
  and the sprite.
- **Keyboard**: `interactive-widget=resizes-content` does not take on this
  Safari (innerHeight stayed 714 with the keyboard up, visualViewport 412),
  so Overlay listens to `visualViewport` resize and scroll and, only when
  more than 120px is covered, sets its own `top` and `height` to the visual
  viewport, once per animation frame and only on change. The composer and
  both editor screens then sit above the keyboard. Verified with the real
  keyboard in the simulator.
- **Editing a habit instance**: the composer serialises it without a date;
  removing `#every` turns that instance into a one-off in Backlog and leaves
  the definition alone. Changing anything else re-saves both the definition
  and today's instance; the server drops and re-creates future instances.
- **New definition**: the client saves today's instance (if due) and the
  definition, then re-reads tasks so the coming days appear under This week.
  The server instantiates a new definition for every day it has already
  opened, and de-duplicates a definition instance on the same date.
- **Errors**: a JSON `{error}` body is shown as is; a non-JSON error (the
  Vite proxy answers 500 HTML when the server is down) or a network failure
  shows "could not reach Parallax". If the first load fails the sprite is
  the only thing on screen and tapping it retries.
- **Long press** stays the plain `longPress()` handler factory from the old
  app rather than a `useLongPress` hook: it holds no React state.
- **Server-side day roll**: the store re-loads everything when the app
  becomes visible on a new date.
- **Part notes** show under the part in the unfolded list and in the
  composer preview (the acceptance asks the preview to show them).
- **Runner text kind**: not specified; text parts use the slide-to-complete.

## Slice 1: Today, backlog, folding, composer, tick, swipes

Look
- [x] Seravek, no fallback flash: `font-display: block`, checked in the simulator and Chrome.
- [x] Dark and light match the frames; `xcrun simctl ui booted appearance light` switched the running app without reload.
- [x] Top bar words and date: simulator screenshot.
- [x] Row: circle tick, title, dim meta, whitespace only: screenshot.
- [x] Group labels small uppercase dim: screenshot.
- [x] Accent + floats bottom right; list has 8rem bottom padding so the last row scrolls clear.
- [x] Wide screen: 42rem column centred in Chrome at 1400px, nothing else differs.
- [x] Nothing red but the delete swipe (and the sprite).

Today
- [x] Groups habits, exercise, personal, garden, programming in order: screenshot; ordering unit-tested.
- [x] One-off dated today shows, overdue shows "since sep 12": screenshot.
- [x] This week folded by default; tap brought "Sam's birthday dinner" forward.
- [x] Backlog folded by default, grouped the same way: screenshot.
- [x] Tick strikes through and dims in place; tick again undoes: Yoga in simulator.
- [x] Completed habit absent the next day; completed one-off absent the next day: placement rules unit-tested against yesterday's seed rows (`Take the bins out`, `Cache the health view refresh` are absent today).
- [x] Unticked habit from yesterday absent, unticked one-off from before shows since when: `Call the pharmacy` shows, yesterday's missed habits do not.
- [x] Chevron only for tasks with parts or a note: screenshot (Yoga none, Physio yes, Get groceries yes).
- [x] Unfold shows note then parts with air, fold again, survives reload: simulator; state persisted in localStorage.
- [x] Ticking every part completes the parent and back: unit-tested, tried in simulator.
- [x] Group label folds with count, unfolds, survives reload: simulator.
- [x] Thumb targets: tick and chevron are 2.75rem hit areas, title takes the rest.

Composer
- [x] + opens a one-line field above the keyboard with the list dimmed; keyboard never covers it: simulator with the real keyboard.
- [x] Title + Enter adds to Backlog and closes: simulator (`buy stamps fri 2pm` typed by AXe).
- [x] Group token and weekly repeat make a definition due today and again next week: `Hangboard /exercise #every 2d` in Chrome, API showed instances 15, 17, 19, 21.
- [x] Weekday, month day, full date, time: unit-tested; `fri 2pm` landed on 2026-09-18 14:00 in the API.
- [x] Shift+Enter or "more" grows into the block editor with the live preview: Chrome.
- [x] Dash line parts with timer and count tokens, indented part note, all in the preview: Chrome.
- [x] `x3` makes numbered copies: preview showed Hang 1, 2, 3.
- [x] `#rest 60s` shows as "rest 1 min" in the preview meta line.
- [x] Tapping a title opens the editor prefilled; saving unchanged left the definition byte-identical (diffed through curl); rename, add and remove parts keep progress: unit-tested.
- [x] Progress round-trips as `= value`: unit-tested.
- [x] Delete row: definition asks "today only / every day"; today only removed today's instance and kept the definition (curl); one-off confirms once.
- [x] Cancel closes without saving.

Swipes
- [x] Backlog row right reveals "today" on accent; past the threshold it moved onto Today with today's date (API).
- [x] Any row left reveals "delete" on red; past the threshold asks to confirm; cancel restores.
- [x] Threshold 96px both ways on every row and card; a short swipe springs back.
- [x] Vertical drift past 28px cancels and springs back.
- [x] Nothing else swipes.

Data
- [x] GET /api/tasks instantiates once: two GETs returned the same count (202).
- [x] Everything fetched once at start; folding and tabs make no request (network panel in Chrome, store has no other reads).
- [x] Every change shows first, reaches the API promptly, survives reload.
- [x] With `_fail` on, the tick showed then reverted and the sprite said "writes are failing on purpose"; tap dismissed; reload unchanged.
- [x] With the server stopped the sprite says "could not reach Parallax".
- [x] A one-off POSTed by curl appeared in Backlog on the next load.

## Slice 2: select mode, play, runner

Select mode
- [x] Holding a tick enters select mode with that row on; a tap ticks instead; the hold cancels after 8px of movement (longPress slop): simulator hold on Yoga.
- [x] Holding a group label selects the whole group: simulator hold on Exercise.
- [x] Rows show handle, square where the tick was, title; group heads show a square in line with the squares; top bar unchanged: simulator screenshot against the SelectFinal frame.
- [x] Square toggles a row; group square toggles all and shows on only when all are on: Chrome.
- [x] Bottom right: small raised × and big accent play, nothing else: screenshot.
- [x] × restores ticks; play opens the runner with rows in list order.
- [x] Selection is dropped on leaving select mode and on closing the runner.

Runner
- [x] Full-screen overlay; heading is the task name for one task, the group name for several; raised × returns to Today with progress kept (Physio showed `1 / 4 parts` after).
- [x] Queue across one line, current accent, others faint, scrolls the current into view (`scrollIntoView`), fades at the right edge (mask).
- [x] Group run: parts column indented, current accent, 6.2rem tall, scrolls, fades at the bottom: Hangboard in the simulator.
- [x] Ring 250px with a 3px raised track; long part names wrap inside (cat-cow with slow breathing).
- [x] Timer counts down, ring empties, tap starts/pauses/resumes, at zero the part is done: Hang 1 in the simulator.
- [x] Count shows number and `of N`, ring fills, tap adds one, hold takes one away, reaching the target marks done: Chrome (JS pointer hold).
- [x] Boolean: slide-to-complete; a drag to 85% completes, less springs back: Chrome drag.
- [x] Rest between parts with the next part's name and skip, auto-advances at zero; no rest means straight on.
- [x] Between tasks the last part's screen stays as it ended until done or next.
- [x] Bottom row previous / done / next never moves (flex: none, content above scrolls in its own box).
- [x] Done marks and advances; next advances without marking; previous goes back one.
- [x] After the last item a screen says done; the only control is the accent tick, which returns to Today.
- [x] Wake lock requested while the runner is open (navigator.wakeLock; not observable in the simulator).
- [x] Progress shows on Today's rows on return.

Judgment calls in this slice
- A single task without parts hides the queue line (it would only repeat the heading).
- Timer progress is kept in the runner and written to the API on pause, finish and close, not every second.
- The runner label for a selection across groups is "Selection".
- Chrome's screenshot frame is 1.05× the CSS pixel grid on this machine, which cost an hour chasing a "broken" skip button that was fine.

## Slice 3: comments

- [x] Rows with comments show the speech mark and count in the meta line; rows without show nothing: simulator and Chrome.
- [x] The seed's unseen comment from `claude` on a Backlog task shows the mark in accent and the task under Programming on Today.
- [x] Tapping the mark unfolds the cards newest first with the date in faint, then the "Add a comment" field; tapping again folds; the mark goes dim once unfolded (comments PUT with `seenAt`).
- [x] Parts and comments never show together: one three-way fold state per task.
- [x] Runner: newest card under the ring with "▾ N more" in faint, or "add a comment" in accent when there are none.
- [x] "more" shows the older cards above (oldest at the top, fading at the edge), the newest just above the "Add a comment" field, scrolled into view; the nav row stays put.
- [x] "Add a comment" opens the full-screen editor: heading Comment, `task · part` under it, the markdown editor, cancel and save (and the raised × the frame shows); saving posted the comment and the new card was visible on return, on Today and in the runner.
- [x] Swiping a card left: same 96px threshold, same red reveal, same confirm sheet, then the card is gone.
- [x] A comment on a habit is keyed by definition id: Morning stretch's two comments show on tomorrow's instance under This week.

Judgment calls in this slice
- Reading unseen comments on a Backlog task also dates the task today, so it stays where the unseen mark pulled it instead of dropping back into Backlog the moment the mark goes dim.
- Today unfolds newest first (TodayComments frame); the runner lists oldest to newest with the newest beside the field (RunnerComments frame). Same CommentList, different order given.
- A card's swipe stops at the card; the row underneath never sees it.

## Slice 4: Journal and Notes

- [x] Journal and Notes are the second and third words; tapping switches; each screen owns its + so it follows the tab: simulator.
- [x] Journal lists journal.md newest first with timestamp and tag in the meta style and the first three content lines; Notes does the same for notebook.md: simulator against the Journal and Notes frames.
- [x] Tag words above the list, "all" first, one per tag in use (by use count), active in text colour, tapping filters: Chrome (therapy showed 2 of 7).
- [x] + opens the editor with heading Entry / Note; save appended a new H2 with the timestamp and a tags line to journal.md (verified in the file) and it appeared at the top.
- [x] Markers hidden off the caret line: `# Sat with it` showed as a bold line while the caret was below it.
- [x] Tapping an entry opens it prefilled (tags as a leading `#tag` line); saving updated that entry only (file still 8 entries, line changed in place).
- [x] An entry written from the Journal task in the runner carries `task: Journal` in its metadata (file checked).
- [x] The Journal task is complete on a day with an entry: the row struck through once an entry existed, and the runner showed it done.

Judgment calls in this slice
- Tags for a new entry: a leading line of `#words` in the text becomes the tag list; otherwise the active filter word is the tag; otherwise none. Editing shows the tags as that leading line so they can be changed in place.
- Writing from a task: the runner shows "write" inside the ring for a boolean task named Journal, opening the Entry editor with the task name; nothing else in the design creates an entry from a task.
- Entry previews strip markdown markers and skip blank lines, so three lines means three lines of text.

## Slice 5: drag

- [x] Pressing a handle and moving lifts the row (raised, shadow, slight tilt) and shows one accent line that follows the finger: simulator screenshot mid-drag, against the MoveDrag frame.
- [x] Releasing drops at the line, the group renumbers `sort`, and the order came back from the API after reload (Physio 0, Yoga 1).
- [x] Dragging clearly right (40px past the start) over a row nests the line under it; releasing made Yoga the first part of Physio (API showed five parts and no Yoga task); dragging back left un-nests before release.
- [x] Pausing 480ms over a folded task unfolds it so the line can go inside: Chrome, pointer events with a wait.
- [x] Dropping into another group changes the group; onto Today gives today's date; into Backlog clears the date (pharmacy went to Backlog/personal with `date: null`): Chrome and API. Unit-tested in `test/move.test.ts`.
- [x] With several rows selected any handle drags them all as "N tasks" and they land together in list order: Chrome (Meditate, Drink water, pharmacy after Read).
- [x] Dragging a part out to the left edge makes it a top-level task after its parent: Chrome (Yoga back out of Physio).
- [x] Only the handle starts a drag (`touch-action: none` on it alone); the rest of the row scrolls: simulator.

Judgment calls in this slice
- The list auto-scrolls while the finger is within 120px of the top or bottom of the visual viewport, ten pixels every 16ms, so a row can travel from Today to Backlog. Verified in the simulator by holding a handle near the toolbar.
- A dragged task becomes one part (or its own parts, if it had any); a part dragged out becomes a boolean/count/timer task in its parent's group with its parent's date.
- Dropping under This week keeps a future date, or gives tomorrow to a row that had none.
- The drop target is whatever row is under the finger; with the finger in the handle column the part under it is found by height, so parts can be targeted without moving right.
- There are no drop targets on group headers: a group with no rows cannot be dropped into; This week and Backlog only exist while they have rows.

## What does not hold

- Wake lock and the theme-color meta cannot be observed in the simulator; the code is there.
- Chrome's extension tab was hidden for part of the drag checks, which stalls animation frames; that is why the auto-scroll runs on an interval rather than requestAnimationFrame.

## Round 2

Driven the same way as before: iPhone simulator through AXe taps, Chrome at
1000 to 1400px, curl and the API. One thing found on the way: `client/data/`
was never committed, because `.gitignore` said `data/`; it is now `/data/`
and the two files are in.

### Judgment calls

- **Fold state** is one FoldsProvider keyed by string (`group:habits`,
  `week`, `task:<id>:parts`, `task:<id>:comments`), remembered in
  localStorage, so a row's thread and parts are independent and the keyboard
  can drive any fold. The old three-way state is gone.
- **Roll**: folding is a CSS grid going from `0fr` to `1fr` over 0.45s; the
  content stays mounted and is `inert` while closed, so a folded Backlog is
  still in the DOM but cannot be tapped or focused. `overflow: clip` rather
  than `hidden`, so no scroll container is created.
- **Kind hint**: `30 min`, `8 ×`, `3 / 8`; text tasks show their value once
  written and nothing before. The model has no amounts or "times", so `500 ml`
  and `2 times` have no source and are not shown.
- **Part count** at the far right is `4`, or `1 / 4` while partly done.
- **Dates**: within six days either way the weekday name, otherwise the full
  month and day; `today` and `yesterday` keep their words. Times are `3pm`
  and `2:30pm` everywhere, including the composer's round-trip.
- **Casing**: everything the app writes is lowercase except group labels and
  the tab names. The editor headings for a comment, an entry and a note are
  `Comment`, `Journal` and `Notebook`, treated as screen names like the tabs.
  The runner heading is the task name, the group name as typed, or
  `selection`.
- **Parts as TaskRows**: a part row is a TaskRow built with `partAsTask`
  (date cleared so it never says since when), keyed `hostId:index`. Its tick
  toggles the part, its title opens the host's editor, its swipe left deletes
  the part after a confirm, its hold enters select mode with the host
  selected, and in select mode its square mirrors and toggles the host. A part
  with a note gets its own chevron.
- **Thread**: authors are `user` and `agent` (the seed writes those; the app
  writes `user`). A card from any other author is drawn as the agent. The
  thread box is 18rem tall at most and opens scrolled to the first unseen
  card, or the bottom; the runner's thread is the same component in the
  runner's own scroll box.
- **Seen marking** happens in an effect when the thread opens, whether by
  tap or by the `c` key, and dates a Backlog task today as before.
- **Regrouping habits**: dropping definition instances into another group
  also writes the definition with the new group (`regrouped` in move.ts, one
  write per definition however many instances moved); the server then
  re-creates future instances there.
- **Colours**: every token is now main's verbatim, including
  `--swipe-warn` and `--swipe-accent` for the two reveals and `--hover` and
  `--tag`, which nothing uses yet. Main's base font size is 17px against this
  build's 16px; left alone, since the canvas sizes are in rem at 16px, but it
  is the likeliest reason the reviewer sees a difference.
- **Keyboard**: bindings, the list and the help sheet are
  `client/interaction/shortcuts.tsx`; Today owns the focus and the actions.
  Focus order is the DOM order of `[data-focus]` elements not inside a closed
  Roll, so it includes group labels, parts and the This week and Backlog
  rows. `t` only acts on one-offs. Escape in the composer's textarea is the
  composer's own; Escape inside CodeMirror does nothing, as asked
  ("ignored while typing in a field").
- **Composer under the keyboard**: the strip Safari keeps for its collapsed
  address pill sits between the visual viewport and the keyboard; the composer
  overlay no longer clips its scrim, so that strip is dimmed like the rest.
- **AXe swipes** do not reach pointer events in this simulator's Safari, on
  this build or on the committed one (checked on a detached worktree of the
  previous commit). Swipes were driven in Chrome with touch pointer events;
  the reveal, the threshold, the confirm and the spring back all hold there.

### Round 2 checklist

Motion and stillness
- [x] Tab switches move nothing sideways: `scrollbar-gutter: stable` on html; Chrome at 1000px with a scrolling Today and a short Notebook, column left edge unchanged.
- [x] Folds roll over 0.45s: simulator screenshot mid-fold of Exercise showed the rows part way.
- [x] Chevrons turn and stay visible on group labels and rows: screenshots open and closed.
- [x] The comment mark, tick and title stay put: getBoundingClientRect sampled for 700ms across a fold in Chrome, one position.
- [x] Nothing else moves: the count on a group label fades instead of appearing.

Rows
- [x] Kind hint after the title in dim: `10 min`, `8 ×`, `20 min` in the simulator.
- [x] Part count left of the chevron, no "N parts" in the meta line: Morning stretch shows `4`.
- [x] Meta order chip, date, time, mark: This week rows show `habits thursday`; Morning stretch shows `7:30am  2`.
- [x] No abbreviated weekday anywhere: `since sunday`, `thursday`, `september 6`; unit tests updated.
- [x] Groups 1.3rem apart, rows 0.15rem: screenshot.
- [x] Hold on the title enters select mode: simulator hold on "Morning stretch".
- [x] Parts are TaskRows: same tick, hint, handle and square in select mode, swipe and confirm in Chrome.
- [x] This week title opens the editor in place; tick sets today's date and completes: simulator (editor), code path `toggled` plus `date: today`.

Under a row
- [x] Thread directly under the meta line, note and parts under it, both open at once: simulator screenshots a5 and a2.
- [x] Swipe moves only the row: Chrome, translateX(-64px) on `.swiped` with `.unfolded` left unchanged.

Comments
- [x] Oldest at the top, user left raised, agent right tinted, author and date in faint: simulator and Chrome runner screenshot.
- [x] "add a comment" pinned under the thread box.
- [x] Opens scrolled to the first unseen or the bottom: `scrollTop` set on mount to the card's offset or `scrollHeight`.

Journal and Notebook
- [x] Notebook everywhere: tab, heading, App key.
- [x] Editor heading Journal or Notebook; the meta line under it is date, tags and task only.
- [x] Bold and italic in accent in the editor and in the preview (`inlineSegments`, unit-tested).
- [x] Fenced blocks mono on raised in the editor (`cm-fenced` line decoration); the preview drops the fence lines.
- [x] New entry opens with no caret; a tap puts one caret; tapping past a line's end lands at its end (CodeMirror's posAtCoords): simulator.
- [x] Type a character, delete it, one caret: simulator, counted accent pixels in two screenshots (one caret, blinking).

Select mode
- [x] Play centred on the +'s line, glyph 36px with rounded corners: negative right margin of half the size difference; screenshot.
- [x] Two habits dragged into Exercise: both moved once, definitions in `exercise`, seven future instances there, no duplicate after reload: Chrome plus /api/definitions and /api/tasks.

Casing
- [x] All app text lowercase but labels and tabs: screenshots of Today, Journal, the editor, the confirm sheet and the help sheet.

Colour
- [x] Tokens verbatim from main in both themes: diffed by eye against main's `:root` blocks. Side by side against a running main was not possible (main's server is not running on this machine); the tokens are identical, so the remaining difference can only be the base font size noted above.

Touch
- [x] Every button at least 40px in both directions at 430px: measured every visible button in Chrome at that width after the padding changes (tabs, titles, marks, filters, runner words). Real taps in the simulator on tab words, filter words, ticks, chevrons, the mark, the +, a title, cancel, and the editor.
- [x] Nothing under the floating button: 8rem bottom padding; the last row scrolls clear.
- [x] Composer and editor above the keyboard: simulator with the real keyboard.

Keyboard
- [x] j/k, l/h, Enter, Space, c, ?, Escape driven in Chrome with real keys and with dispatched events; ring is an outline with no layout change.

### Earlier slices re-checked

- [x] Rows, ticks, group folding and persistence: simulator, reload kept Exercise folded.
- [x] Composer round-trip: `Journal /habits #every 1d` opened from a This week title; times now serialize as `3pm`, grammar tests updated.
- [x] Swipes: Chrome only, see above.
- [x] Select mode and drag: Chrome (bundle drag between groups), simulator (hold, squares, play button).
- [x] Runner: queue, ring, thread with the new cards, add a comment editor: Chrome.
- [x] Journal and Notebook: filters, list, editor: simulator.
- [x] `npm test`: 42 tests green.

### What does not hold

- Swipes could not be driven by real touch in the simulator (tooling), on this build or the previous one.
- The side-by-side colour check against main's running app was not possible; tokens are verbatim.
