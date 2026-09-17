# Components

Primitives are their own files and are used in more than one place. Shared
composites are their own files and appear on more than one screen. Local
composites live in the file of the screen or composite that uses them. Sizes
and colours come from the tokens in the stylesheet; a parent's stylesheet
sets a primitive's size, the primitive never takes a variant prop.

## Tokens

One stylesheet. `:root` holds the light palette, dark is the same names
redefined. Colour: ground, raised, text, dim, faint, accent, hairline,
chip-bg (the user card tint), warn. Type: Seravek 400/500/700 from the three woff2
files in `client/public`; heading, section, title, body, meta, label,
big number. Sizes: tick, round button (small, normal), ring, gutter, row
padding, card radius. Values are the ones on the canvas frames.

## Primitives

- **CircleTick**: the completion circle; empty or done; a small size for parts.
- **SquareTick**: the select box; on or off; the same slot as CircleTick.
- **Handle**: the three-line drag grip.
- **Foldable**: owns the chevron (closed › open ⌄) and the open state. Used by
  Group, and so by the Today and Backlog sections. The same file holds
  FoldsProvider, which
  remembers every fold by key so keyboard shortcuts can drive them, and Roll,
  the grid that rolls content open and closed slowly; TaskRow's thread and
  parts use Roll directly.
- **Meta**: the dim line under a title on the phone; holds the date, time and group.
- **Mark**: count plus a glyph; dim, or accent when active; dead when its
  `onSelect` is null. The comment mark and the parts mark are both one of
  these, and the comment mark carries the unseen dot as a child.
- **RoundButton**: circle with a glyph; accent or raised; sizes small and
  normal. Used for +, done, previous, next, ×, play.
- **TextButton**: text, `active`, `onSelect`. The words in the top bar, the
  items in both runner queues, the filter words, the group labels, and every
  plain action (done, cancel, save, more, delete, add). The parent sets
  size and colour.
- **Card**: block with a body and a faint author and date; raised for the
  user, tinted accent for the agent. The only card in the app.
- **Swipeable**: wraps a row or a Card; right reveals today on accent, left
  reveals delete on red; one threshold everywhere; vertical drift cancels.
- **Editor**: CodeMirror markdown with markers hidden off the caret line.
- **Overlay**: full-screen surface over Tasks that holds the screen behind it
  still while it is up and returns it to where it was. Runner, Composer and
  EditorScreen sit in one.
- **Glyphs**: every icon in one file: plus, tick, chevron, play, arrows, ×,
  speech mark, parts, grip. Nothing draws its own.

## Shared composites

- **TopBar**: three TextButtons and the date line.
- **TaskRow**: Swipeable around (CircleTick or Handle + SquareTick, the
  title, the target hint and the date and time on one line, then the
  fixed-width cluster of the two Marks and the chevron, then Meta), then the
  CommentList and then the note and parts, each in its own Roll. The row
  itself takes the click that opens the editor, so everything in it but its
  own buttons opens the editor. A part is a TaskRow of its own, built from
  the part with its host's callbacks; the note line lives in this file.
- **Group**: label as TextButton with the count right after it, Foldable,
  rows; a SquareTick in select mode. The Today and Backlog sections are
  Groups, sized and stripped of their chevron by the screen's stylesheet.
- **CommentList**: the thread, oldest at the top and newest at the bottom,
  user on the left and agent on the right, in a scroll box that opens at the
  first unseen card or the bottom, plus CommentField pinned under it.
  CommentField, a raised textarea that grows with the text and fades an
  accent `add` in beside it, lives here. Same component on Tasks and in the
  runner.
- **EditorScreen**: heading, dim line, Editor, delete on the left, cancel and
  save on the right. Used for a journal entry and a note.
- **Entries**: the Journal and Notebook screen, given its source file. Filters
  (a row of TextButtons) and EntryRow live in this file.

## Local composites

- **Tasks**: Composer (a CodeMirror field that grows and colours the token
  spans `shared/grammar.ts` hands it; preview is TaskRows),
  SelectBar (small × and big play), the drag (Handle plus the accent DropLine
  that follows the finger).
- **Runner**: QueueHorizontal and QueueVertical (TextButtons, current in
  accent, scrolling the current one into view, fading at the edge), Ring
  (track plus arc plus centred children; fills for counts, empties for
  timers), the nav row.

- **ErrorSprite**: red, with delete and the unseen dot; shows the
  message of a failed write, dismisses on tap. Lives with the store.

## Store

One in-memory store loaded once at start: definitions, tasks, comments, both
journals. Every screen reads from it. A write applies to memory, then sends
the request; a failed request restores the previous memory and raises the
ErrorSprite. Nothing else talks to the API.

## Hooks

- **useLongPress**: one duration, one slop. Hold a tick, hold a group label,
  pause over a folded task while dragging.
- **useShortcuts**: the desktop key bindings, in `interaction/shortcuts.tsx`
  with the list they come from and the ShortcutsSheet that shows it. Tasks
  owns the focus ring and what each action does.

## Custom

Behaviour no library provides, to be written and driven on a phone:
Swipeable; the drag with DropLine and nesting; Ring's arc and tap and hold;
the two queues keeping the current item in view; Composer's grammar, its
round-trip and its growth on newline; useLongPress; Foldable's persistence.
Everything else is styling over plain elements.
