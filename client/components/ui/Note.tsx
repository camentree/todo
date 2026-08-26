import { useEffect, useRef, useState } from "react";

const INDENT = "  ";

function withIndentation({
  textarea,
  removing,
}: {
  textarea: HTMLTextAreaElement;
  removing: boolean;
}): { text: string; selectionStart: number; selectionEnd: number } {
  const { value, selectionStart, selectionEnd } = textarea;
  const blockStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineBreak = value.indexOf("\n", selectionEnd);
  const blockEnd = lineBreak === -1 ? value.length : lineBreak;
  const shifted = value
    .slice(blockStart, blockEnd)
    .split("\n")
    .map((line) =>
      removing ? line.replace(/^ {1,2}/, "") : INDENT + line,
    )
    .join("\n");
  const moved = shifted.length - (blockEnd - blockStart);
  const wholeLines = selectionStart !== selectionEnd;
  const caret = Math.max(blockStart, selectionStart + moved);
  return {
    text:
      value.slice(0, blockStart) + shifted + value.slice(blockEnd),
    selectionStart: wholeLines ? blockStart : caret,
    selectionEnd: wholeLines ? blockEnd + moved : caret,
  };
}

function scrollingAncestorOf(
  element: HTMLElement,
): HTMLElement | null {
  let ancestor = element.parentElement;
  while (ancestor) {
    const overflow = window.getComputedStyle(ancestor).overflowY;
    if (overflow === "auto" || overflow === "scroll") {
      return ancestor;
    }
    ancestor = ancestor.parentElement;
  }
  return null;
}

export function Note({
  note,
  onCommit,
  className,
  placeholder,
  rows = 1,
}: {
  note: string;
  onCommit: (next: string | null) => void;
  className?: string;
  placeholder?: string;
  rows?: number;
}) {
  const [draft, setDraft] = useState(note);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const reverting = useRef(false);

  useEffect(() => {
    setDraft(note);
  }, [note]);

  useEffect(() => {
    const textarea = noteRef.current;
    if (!textarea) {
      return;
    }
    const scroller = scrollingAncestorOf(textarea);
    const wasScrolledTo = scroller?.scrollTop;
    textarea.style.height = "auto";
    const wanted = `${textarea.scrollHeight}px`;
    textarea.style.height = wanted;
    if (scroller && wasScrolledTo !== undefined) {
      scroller.scrollTop = wasScrolledTo;
    }
  }, [draft]);

  return (
    <textarea
      ref={noteRef}
      className={className}
      rows={rows}
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          reverting.current = true;
          setDraft(note);
          event.currentTarget.blur();
          return;
        }
        if (event.key !== "Tab") {
          return;
        }
        event.preventDefault();
        const textarea = event.currentTarget;
        const indented = withIndentation({
          textarea: textarea,
          removing: event.shiftKey,
        });
        setDraft(indented.text);
        requestAnimationFrame(() =>
          textarea.setSelectionRange(
            indented.selectionStart,
            indented.selectionEnd,
          ),
        );
      }}
      onBlur={() => {
        if (reverting.current) {
          reverting.current = false;
          return;
        }
        if (draft.trim() !== note) {
          onCommit(draft.trim() || null);
        }
      }}
    />
  );
}
