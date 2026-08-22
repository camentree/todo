import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { useNavigate } from "react-router-dom";

import { Chevron, InfoIcon } from "./icons.tsx";
import { ParseableTitle } from "./ParseableTitle.tsx";
import {
  AttributeChips,
  attributesOf,
  withoutAttribute,
} from "./TaskAttributes.tsx";
import { useShortcuts } from "../useShortcuts.ts";
import { SWIPE_FRACTION, useSwipe } from "../useSwipe.ts";
import { renameChanges } from "../useTaskActions.ts";
import type { Attribute } from "@shared/attributes.ts";
import { isTerminal } from "@shared/states.ts";
import type { CreatedTask, Task } from "@shared/types.ts";

const FLICK_MILLISECONDS = 500;
const LONG_PRESS_MILLISECONDS = 400;
const SCROLL_BREATHING_ROOM = 96;
const SCROLL_MILLISECONDS = 900;

export interface AttributeOmission {
  field: Attribute;
  label: string;
}

export interface SwipeAction {
  name: string;
  action: () => void;
}

export function TaskRow({
  task,
  isEditing,
  isFocused = false,
  onEditingChange,
  onCommit,
  onInfoOpen,
  onFocusNext,
  onAddSubtask,
  swipeLeft,
  swipeRight,
  onLongPress,
  showAttributes,
  parseAttributes = true,
  omitAttributes = [],
  focusOnMount = false,
  renderSubtask,
  renderNewSubtask,
  expanded = false,
  onExpandedChange,
  onTab,
}: {
  task: Task;
  isEditing: boolean;
  isFocused?: boolean;
  onEditingChange: (editing: boolean) => void;
  onCommit: (changes: Partial<Task>) => void;
  onInfoOpen?: () => void;
  onFocusNext?: () => void;
  onAddSubtask?: () => void;
  swipeLeft?: SwipeAction;
  swipeRight?: SwipeAction;
  onLongPress?: (pointerX: number, pointerY: number) => void;
  showAttributes: boolean;
  parseAttributes?: boolean;
  omitAttributes?: AttributeOmission[];
  focusOnMount?: boolean;
  renderSubtask?: (subtask: CreatedTask) => ReactNode;
  renderNewSubtask?: (parent: Task) => ReactNode;
  expanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
  onTab?: (backwards: boolean) => void;
}) {
  const [draft, setDraft] = useState(task.title);
  const [edits, setEdits] = useState<Partial<Task>>({});
  const [hasFocus, setHasFocus] = useState(false);
  const [caretAt, setCaretAt] = useState<number | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const unsaved = task.id === null;

  useEffect(() => {
    if (isEditing) {
      setDraft(task.title);
      setEdits({});
      return;
    }
    setCaretAt(null);
  }, [isEditing, task.title]);

  const titleChanges = parseAttributes
    ? renameChanges(draft)
    : { title: draft.trim() };

  const uncommitted: Task = {
    ...task,
    ...titleChanges,
    ...edits,
  };

  const gesture = useRowGesture({
    onLeft: swipeLeft?.action,
    onRight: swipeRight?.action,
    onLongPress: onLongPress,
    enabled: !isTerminal(task.state) && !isEditing,
  });
  const { flickingTo, flickAway } = useFlickAway({
    swipeLeft: swipeLeft?.action,
    swipeRight: swipeRight?.action,
  });

  const children = task.subtasks ?? [];
  const finished = children.filter((child) =>
    isTerminal(child.state),
  ).length;
  const note = (task.note ?? "").trim();
  const expandable =
    children.length > 0 || note.length > 0 || expanded;

  const flickTravel =
    flickingTo === "left"
      ? -SWIPE_FRACTION * 100
      : SWIPE_FRACTION * 100;
  const shift =
    flickingTo === null ? `${gesture.offset}px` : `${flickTravel}%`;

  useShortcuts((event) => {
    if (event.key === "Tab" && onTab) {
      event.preventDefault();
      onTab(event.shiftKey);
      return;
    }
    if (event.key === "+" && onAddSubtask) {
      event.preventDefault();
      onAddSubtask();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      onEditingChange(true);
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      onCommit({
        state: isTerminal(task.state) ? "to_do" : "complete",
      });
      return;
    }
    if (event.key === "i") {
      event.preventDefault();
      onInfoOpen?.();
      return;
    }
    if (isTerminal(task.state)) {
      return;
    }
    if (event.key === "a" && swipeLeft) {
      onFocusNext?.();
      flickAway("left");
    }
    if (event.key === "h" && swipeRight && task.archivedAt === null) {
      onFocusNext?.();
      flickAway("right");
    }
  }, isFocused && !isEditing);

  function commit(movingOn = false): void {
    const changes = { ...titleChanges, ...edits };
    if ((changes.title ?? "").trim().length === 0) {
      stopEditing();
      return;
    }
    onCommit(unsaved ? uncommitted : changes);
    if (unsaved) {
      setDraft("");
      setEdits({});
      return;
    }
    if (!movingOn) {
      onEditingChange(false);
    }
  }

  function moveOn(backwards: boolean): void {
    commit(true);
    onTab?.(backwards);
  }

  function stopEditing(): void {
    setDraft(unsaved ? "" : task.title);
    setEdits({});
    onEditingChange(false);
  }

  return (
    <div className="swipe-track">
      <div className="swipe-band">
        {(gesture.swiping || flickingTo !== null) && (
          <>
            <div className="swipe-action archive">
              {swipeLeft?.name}
            </div>
            <div className="swipe-action defer">
              {swipeRight?.name}
            </div>
          </>
        )}

        <div
          className="task"
          ref={gesture.ref}
          data-done={isTerminal(task.state)}
          data-editing={isEditing}
          data-unsaved={unsaved}
          data-swiping={gesture.swiping}
          style={{ transform: `translateX(${shift})` }}
          onPointerDown={gesture.down}
          onPointerMove={gesture.move}
          onPointerUp={gesture.up}
          onPointerCancel={gesture.up}
          onFocus={() => setHasFocus(true)}
          onBlur={(event) => {
            if (event.currentTarget.contains(event.relatedTarget)) {
              return;
            }
            setHasFocus(false);
            if (unsaved) {
              if (draft.trim().length === 0) {
                onEditingChange(false);
              }
              return;
            }
            commit();
          }}
        >
          <div className="task-main">
            <button
              type="button"
              className="task-tick"
              data-state={task.state}
              aria-label={`Mark ${task.title} done`}
              onClick={(event) => {
                event.stopPropagation();
                if (unsaved) {
                  return;
                }
                onCommit({
                  state: isTerminal(task.state)
                    ? "to_do"
                    : "complete",
                });
              }}
            />

            {isEditing ? (
              <TitleField
                value={draft}
                onChange={setDraft}
                list={uncommitted.list ?? ""}
                inputRef={titleRef}
                suggest={parseAttributes}
                caretAt={caretAt}
                takeFocus={!unsaved || focusOnMount}
                onEnter={onTab ? () => moveOn(false) : commit}
                onEscape={stopEditing}
                onTab={onTab && moveOn}
              />
            ) : (
              <button
                type="button"
                className="task-title"
                onClick={(event) => {
                  if (!gesture.travelled()) {
                    setCaretAt(caretIndexAt(event));
                    onEditingChange(true);
                  }
                }}
              >
                {task.title}
              </button>
            )}

            {onInfoOpen && (
              <button
                type="button"
                className="task-info"
                aria-label="Task details"
                onPointerDown={(event) => {
                  event.preventDefault();
                  dismissKeyboard();
                  onInfoOpen();
                }}
                onClick={onInfoOpen}
              >
                <InfoIcon />
              </button>
            )}

            {expandable && !isEditing && (
              <button
                type="button"
                className="subtask-toggle"
                aria-label="Expand"
                onClick={(event) => {
                  event.stopPropagation();
                  onExpandedChange?.(!expanded);
                }}
              >
                {children.length > 0 && (
                  <span className="subtask-count">
                    {finished}/{children.length}
                  </span>
                )}
                <Chevron open={expanded} />
              </button>
            )}
          </div>

          {isEditing && hasFocus
            ? parseAttributes && (
                <AttributeChips
                  task={uncommitted}
                  onRemove={(attribute) => {
                    const without = withoutAttribute({
                      task: uncommitted,
                      draft: draft,
                      attribute: attribute,
                    });
                    setDraft(without.draft);
                    setEdits({ ...edits, ...without.changes });
                  }}
                />
              )
            : showAttributes && (
                <Attributes
                  task={task}
                  omit={omitAttributes}
                  travelled={gesture.travelled}
                />
              )}
        </div>
      </div>

      {expandable && (
        <div className="collapsible" data-open={expanded}>
          <div>
            {note.length > 0 && (
              <Note
                note={note}
                onCommit={(next) => onCommit({ note: next })}
              />
            )}
            {(renderSubtask || renderNewSubtask) && (
              <div className="subtasks">
                {children.map((child) => renderSubtask?.(child))}
                {renderNewSubtask?.(task)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Note({
  note,
  onCommit,
}: {
  note: string;
  onCommit: (next: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  const [caretAt, setCaretAt] = useState<number | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) {
      return;
    }
    noteRef.current?.focus({ preventScroll: true });
    if (caretAt !== null) {
      noteRef.current?.setSelectionRange(caretAt, caretAt);
    }
  }, [editing, caretAt]);

  useEffect(() => {
    const textarea = noteRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [draft, editing]);

  if (!editing) {
    return (
      <button
        type="button"
        className="task-note"
        onClick={(event) => {
          setDraft(note);
          setCaretAt(caretIndexAt(event));
          setEditing(true);
        }}
      >
        {note}
      </button>
    );
  }

  return (
    <textarea
      ref={noteRef}
      className="task-note editing"
      rows={1}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setDraft(note);
          setEditing(false);
        }
      }}
      onBlur={() => {
        setEditing(false);
        if (draft.trim() !== note) {
          onCommit(draft.trim() || null);
        }
      }}
    />
  );
}

function TitleField({
  value,
  onChange,
  list,
  inputRef,
  suggest,
  caretAt,
  takeFocus,
  onEnter,
  onEscape,
  onTab,
}: {
  value: string;
  onChange: (next: string) => void;
  list: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  suggest: boolean;
  caretAt: number | null;
  takeFocus: boolean;
  onEnter: () => void;
  onEscape: () => void;
  onTab?: (backwards: boolean) => void;
}) {
  useEffect(() => {
    if (!takeFocus) {
      return;
    }
    inputRef.current?.focus({ preventScroll: true });
    if (caretAt !== null) {
      inputRef.current?.setSelectionRange(caretAt, caretAt);
    }
  }, [takeFocus, caretAt, inputRef]);

  return (
    <ParseableTitle
      value={value}
      onChange={onChange}
      inputRef={inputRef}
      list={list}
      at="row"
      suggest={suggest}
      multiline
      onDone={onEnter}
      onCancel={onEscape}
      onTab={onTab}
      input={{
        className: "task-title editing",
        "aria-label": "Title",
        enterKeyHint: "done",
        autoCapitalize: "none",
        onFocus: (event) => {
          const row = event.currentTarget.closest(".task");
          const owner = row
            ?.closest(".subtasks")
            ?.closest(".swipe-track")
            ?.querySelector(".task");
          const anchor = owner ?? row;
          if (anchor) {
            easeToTop(anchor);
          }
        },
      }}
    />
  );
}

function Attributes({
  task,
  omit,
  travelled,
}: {
  task: Task;
  omit: AttributeOmission[];
  travelled: () => boolean;
}) {
  const navigate = useNavigate();

  const shown = attributesOf(task).filter(
    (item) =>
      item.text.toLowerCase() === "today" ||
      !omit.some(
        (omission) =>
          omission.field === item.field &&
          omission.label.toLowerCase() === item.text.toLowerCase(),
      ),
  );

  if (shown.length === 0) {
    return null;
  }

  return (
    <span className="task-meta">
      {shown.map(({ field, text, to }) => (
        <button
          type="button"
          key={`${field}-${text}`}
          className={field === "tag" ? "tag" : undefined}
          data-clickable={Boolean(to)}
          onClick={() => {
            if (travelled() || !to) {
              return;
            }
            navigate(to);
          }}
        >
          {text.toLowerCase()}
        </button>
      ))}
    </span>
  );
}

function easeToTop(row: Element): void {
  const from = window.scrollY;
  const to = Math.max(
    0,
    from + row.getBoundingClientRect().top - SCROLL_BREATHING_ROOM,
  );
  const started = performance.now();

  function step(now: number): void {
    const through = Math.min(
      (now - started) / SCROLL_MILLISECONDS,
      1,
    );
    const eased = 1 - Math.pow(1 - through, 3);
    window.scrollTo({
      top: from + (to - from) * eased,
      behavior: "instant",
    });
    if (through < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

function caretIndexAt(event: React.MouseEvent): number | null {
  const position = document.caretPositionFromPoint?.(
    event.clientX,
    event.clientY,
  );
  if (!position || position.offsetNode.nodeType !== Node.TEXT_NODE) {
    return null;
  }
  return position.offset;
}

function dismissKeyboard(): void {
  const focused = document.activeElement;
  if (focused instanceof HTMLElement) {
    focused.blur();
  }
}

function useFlickAway({
  swipeLeft,
  swipeRight,
}: {
  swipeLeft?: () => void;
  swipeRight?: () => void;
}): {
  flickingTo: "left" | "right" | null;
  flickAway: (direction: "left" | "right") => void;
} {
  const [flickingTo, setFlickingTo] = useState<
    "left" | "right" | null
  >(null);
  const pending = useRef<{
    timer: ReturnType<typeof setTimeout>;
    act: () => void;
  } | null>(null);

  function settle(): void {
    const current = pending.current;
    if (!current) {
      return;
    }
    clearTimeout(current.timer);
    pending.current = null;
    setFlickingTo(null);
    current.act();
  }

  useEffect(() => settle, []);

  function flickAway(direction: "left" | "right"): void {
    const act = direction === "left" ? swipeLeft : swipeRight;
    if (!act) {
      return;
    }
    settle();
    setFlickingTo(direction);
    pending.current = {
      timer: setTimeout(settle, FLICK_MILLISECONDS),
      act: act,
    };
  }

  return { flickingTo: flickingTo, flickAway: flickAway };
}

function useRowGesture({
  onLeft,
  onRight,
  onLongPress,
  enabled,
}: {
  onLeft?: () => void;
  onRight?: () => void;
  onLongPress?: (pointerX: number, pointerY: number) => void;
  enabled: boolean;
}) {
  const swipe = useSwipe({
    onLeft: onLeft,
    onRight: onRight,
    enabled: enabled,
  });
  const holding = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopWatching = useRef<(() => void) | null>(null);

  useEffect(() => {
    const node = swipe.ref.current;
    if (!node) {
      return;
    }
    function holdTheScroll(event: TouchEvent): void {
      if (holding.current) {
        event.preventDefault();
      }
    }
    node.addEventListener("touchmove", holdTheScroll, {
      passive: false,
    });
    return () => node.removeEventListener("touchmove", holdTheScroll);
  }, []);

  useEffect(() => {
    return () => stopTimer();
  }, []);

  function stopTimer(): void {
    stopWatching.current?.();
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function watchForRelease(pointerId: number): void {
    function onRelease(event: PointerEvent): void {
      if (event.pointerId === pointerId) {
        stopTimer();
      }
    }
    window.addEventListener("pointerup", onRelease);
    window.addEventListener("pointercancel", onRelease);
    stopWatching.current = () => {
      window.removeEventListener("pointerup", onRelease);
      window.removeEventListener("pointercancel", onRelease);
      stopWatching.current = null;
    };
  }

  return {
    ref: swipe.ref,
    offset: swipe.offset,
    swiping: swipe.swiping,
    travelled: swipe.travelled,
    down: (event: React.PointerEvent) => {
      holding.current = false;
      swipe.down(event);
      if (!enabled || !onLongPress) {
        return;
      }
      const pointerX = event.clientX;
      const pointerY = event.clientY;
      watchForRelease(event.pointerId);
      timer.current = setTimeout(() => {
        holding.current = true;
        onLongPress(pointerX, pointerY);
      }, LONG_PRESS_MILLISECONDS);
    },
    move: (event: React.PointerEvent) => {
      if (holding.current) {
        return;
      }
      swipe.move(event);
      if (swipe.travelled()) {
        stopTimer();
      }
    },
    up: () => {
      stopTimer();
      if (holding.current) {
        holding.current = false;
        swipe.cancel();
        return;
      }
      swipe.up();
    },
  };
}

export function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="floating">
      <div className="floating-row">
        <button
          type="button"
          className="bubble primary"
          aria-label="Add a task"
          onClick={onClick}
        >
          <svg
            className="plus"
            width="21"
            height="21"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M10 4v12M4 10h12"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
