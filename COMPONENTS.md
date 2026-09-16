# Components

Primitives are their own files and are used in more than one place. Shared
composites are their own files and appear on more than one screen. Local
composites live in the file of the screen or composite that uses them. Sizes
and colours come from the tokens in the stylesheet; a parent's stylesheet
sets a primitive's size, the primitive never takes a variant prop.

## Tokens

One stylesheet. `:root` holds the light palette, dark is the same names
redefined. Colour: ground, raised, text, dim, faint, accent, hairline,
chip-bg, chip-text, warn. Type: Seravek 400/500/700 from the three woff2
files in `client/public`; heading, title, body, meta, label, chip, big
number. Sizes: tick, round button (small, normal, big), ring, gutter, row
padding, card radius. Values are the ones on the canvas frames.

## Primitives

- **CircleTick**: the completion circle; empty or done; a small size for parts.
- **SquareTick**: the select box; on or off; the same slot as CircleTick.
- **Handle**: the three-line drag grip.
- **Foldable**: owns the chevron (closed › open ⌄), the open state, and
  remembering it per key. Used by Group, This week, Backlog, a task's note and
  parts, and the comments unfold.
- **Chip**: mono attribute pill.
- **Meta**: the dim line under a title; holds the kind hint, date or time,
  CommentMark, Chips.
- **CommentMark**: speech glyph plus count; dim, or accent when unseen.
- **RoundButton**: circle with a glyph; accent or raised; sizes small, normal,
  big. Used for +, done, previous, next, ×, play.
- **TextButton**: text, `active`, `onSelect`. The words in the top bar, the
  items in both runner queues, the filter words, the group labels, and every
  plain action (done, cancel, save, more, add a comment). The parent sets
  size and colour.
- **Card**: raised block with a body and a faint date. The only card in the app.
- **Swipeable**: wraps a row or a Card; right reveals today on accent, left
  reveals delete on red; one threshold everywhere; vertical drift cancels.
- **Editor**: CodeMirror markdown with markers hidden off the caret line.
- **Overlay**: full-screen surface over Today that returns to where you were.
  Runner, Composer and EditorScreen sit in one.
- **Glyphs**: every icon in one file: plus, tick, chevron, play, arrows, ×,
  speech mark, grip. Nothing draws its own.

## Shared composites

- **TopBar**: three TextButtons and the date line.
- **TaskRow**: CircleTick or (Handle + SquareTick), title, Foldable chevron,
  Meta. Unfolds the note, the parts, or the CommentList. PartRow (small tick,
  name) and the note line live in this file.
- **Group**: label as TextButton plus count, Foldable, rows; a SquareTick in
  select mode. This week and Backlog are Groups.
- **CommentList**: Cards newest first plus the Field that opens EditorScreen.
  The Field (an outlined placeholder that only opens the editor) lives here.
  Same component on Today and in the runner.
- **EditorScreen**: heading, dim line, Editor, cancel and save. Used for a
  comment, a journal entry, and a note.
- **Entries**: the Journal and Notes screen, given its source file. Filters
  (a row of TextButtons) and EntryRow live in this file.

## Local composites

- **Today**: Composer (one-line field that grows; preview is TaskRows),
  SelectBar (small × and big play), the drag (Handle plus the accent DropLine
  that follows the finger).
- **Runner**: QueueHorizontal and QueueVertical (TextButtons, current in
  accent, scrolling the current one into view, fading at the edge), Ring
  (track plus arc plus centred children; fills for counts, empties for
  timers), the nav row.

## Hooks

- **useLongPress**: one duration, one slop. Hold a tick, hold a group label,
  pause over a folded task while dragging.

## Custom

Behaviour no library provides, to be written and driven on a phone:
Swipeable; the drag with DropLine and nesting; Ring's arc and tap and hold;
the two queues keeping the current item in view; Composer's grammar, its
round-trip and its growth on newline; useLongPress; Foldable's persistence.
Everything else is styling over plain elements.
