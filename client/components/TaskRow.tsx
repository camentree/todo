import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { useNavigate } from "react-router-dom";

import {
  AttributeChips,
  attributesOf,
  withoutAttribute,
} from "./TaskAttributes.tsx";
import { api } from "../api.ts";
import { renameChanges } from "../useTaskActions.ts";
import type { Attribute } from "@shared/attributes.ts";
import { isTerminal } from "@shared/states.ts";
import type { Task } from "@shared/types.ts";

const LONG_PRESS_MILLISECONDS = 400;
const SWIPE_FRACTION = 0.4;
const MOST_SUGGESTIONS = 5;
const SCROLL_BREATHING_ROOM = 96;
const SCROLL_MILLISECONDS = 900;

export type RowTask = Omit<Task, "id"> & { id: number | null };

export interface MetaOmission {
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
  onEditingChange,
  onCommit,
  onInfoOpen,
  swipeLeft,
  swipeRight,
  onLongPress,
  flickingTo = null,
  showAttributes,
  omitAttributes = [],
  inputRef,
  subtasks,
}: {
  task: RowTask;
  isEditing: boolean;
  onEditingChange: (editing: boolean) => void;
  onCommit: (changes: Partial<Task>) => void;
  onInfoOpen?: () => void;
  swipeLeft?: SwipeAction;
  swipeRight?: SwipeAction;
  onLongPress?: (pointerX: number, pointerY: number) => void;
  flickingTo?: "left" | "right" | null;
  showAttributes: boolean;
  omitAttributes?: MetaOmission[];
  inputRef?: RefObject<HTMLInputElement | null>;
  subtasks?: ReactNode;
}) {
  const [draft, setDraft] = useState(task.title);
  const [edits, setEdits] = useState<Partial<Task>>({});
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const ownRef = useRef<HTMLInputElement>(null);
  const titleRef = inputRef ?? ownRef;
  const unsaved = task.id === null;

  useEffect(() => {
    if (isEditing) {
      setDraft(task.title);
      setEdits({});
    }
  }, [isEditing, task.title]);

  const uncommitted: RowTask = {
    ...task,
    ...renameChanges(draft),
    ...edits,
  };

  const gesture = useRowGesture({
    onLeft: swipeLeft?.action,
    onRight: swipeRight?.action,
    onLongPress: onLongPress,
    enabled: !isTerminal(task.state),
  });

  const children = task.subtasks ?? [];
  const finished = children.filter((child) =>
    isTerminal(child.state),
  ).length;

  const flickTravel =
    flickingTo === "left"
      ? -SWIPE_FRACTION * 100
      : SWIPE_FRACTION * 100;
  const shift =
    flickingTo === null ? `${gesture.offset}px` : `${flickTravel}%`;

  function commit(): void {
    const changes = { ...renameChanges(draft), ...edits };
    if ((changes.title ?? "").trim().length === 0) {
      stopEditing();
      return;
    }
    onCommit(changes);
    if (unsaved) {
      setDraft("");
      setEdits({});
      return;
    }
    onEditingChange(false);
  }

  function stopEditing(): void {
    setDraft(unsaved ? "" : task.title);
    setEdits({});
    onEditingChange(false);
  }

  return (
    <div className="swipe-track">
      {(gesture.swiping || flickingTo !== null) && (
        <>
          <div className="swipe-action archive">
            {swipeLeft?.name}
          </div>
          <div className="swipe-action defer">{swipeRight?.name}</div>
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
                state: isTerminal(task.state) ? "to_do" : "complete",
              });
            }}
          />

          {isEditing ? (
            <TitleField
              value={draft}
              onChange={setDraft}
              list={uncommitted.list}
              inputRef={titleRef}
              takeFocus={!unsaved}
              onEnter={commit}
              onEscape={stopEditing}
            />
          ) : (
            <button
              type="button"
              className="task-title"
              onClick={() => {
                if (!gesture.travelled()) {
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

          {task.lastCommentFromOthers && (
            <span
              className="comment-dot"
              aria-label="Waiting on you"
            />
          )}

          {children.length > 0 && (
            <button
              type="button"
              className="subtask-toggle"
              aria-label="Show subtasks"
              onClick={(event) => {
                event.stopPropagation();
                setShowSubtasks(!showSubtasks);
              }}
            >
              <span className="subtask-count">
                {finished}/{children.length}
              </span>
              <Chevron open={showSubtasks} />
            </button>
          )}
        </div>

        {isEditing && hasFocus ? (
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
        ) : (
          showAttributes && (
            <Meta
              task={task}
              omit={omitAttributes}
              travelled={gesture.travelled}
            />
          )
        )}
      </div>

      {subtasks && children.length > 0 && (
        <div className="collapsible" data-open={showSubtasks}>
          <div>
            <div className="subtasks">{subtasks}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function TitleField({
  value,
  onChange,
  list,
  inputRef,
  takeFocus,
  onEnter,
  onEscape,
}: {
  value: string;
  onChange: (next: string) => void;
  list: string;
  inputRef: RefObject<HTMLInputElement | null>;
  takeFocus: boolean;
  onEnter: () => void;
  onEscape: () => void;
}) {
  const [caret, setCaret] = useState(value.length);
  const [highlighted, setHighlighted] = useState(0);
  const [suppressed, setSuppressed] = useState(false);
  const [pendingCaret, setPendingCaret] = useState<number | null>(
    null,
  );

  const { data: lists = [] } = useQuery({
    queryKey: ["lists"],
    queryFn: api.lists,
  });
  const { data: knownTags = [] } = useQuery({
    queryKey: ["tags", list],
    queryFn: () => api.tags(list || undefined),
  });
  const { data: knownWho = [] } = useQuery({
    queryKey: ["who", list],
    queryFn: () => api.knownWho(list || undefined),
  });
  const { data: stages = [] } = useQuery({
    queryKey: ["stages"],
    queryFn: api.stages,
  });

  const opening = suppressed
    ? null
    : sigilBefore({ input: value, caret: caret });
  const matches = suggestionsFor({
    opening: opening,
    lists: lists,
    knownTags: knownTags,
    knownWho: knownWho,
    stages: stages,
  });

  useEffect(() => {
    if (pendingCaret === null) {
      return;
    }
    inputRef.current?.setSelectionRange(pendingCaret, pendingCaret);
    setPendingCaret(null);
  }, [pendingCaret, inputRef]);

  useEffect(() => {
    if (takeFocus) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [takeFocus, inputRef]);

  function pick(candidate: string): void {
    if (!opening) {
      return;
    }
    const head = `${value.slice(0, opening.start)}${opening.sigil}${candidate} `;
    onChange(`${head}${value.slice(caret)}`);
    setCaret(head.length);
    setPendingCaret(head.length);
    setHighlighted(0);
  }

  return (
    <>
      <input
        ref={inputRef}
        className="task-title editing"
        value={value}
        aria-label="Title"
        enterKeyHint="done"
        onFocus={(event) => {
          const row = event.currentTarget.closest(".task");
          if (row) {
            easeToTop(row);
          }
        }}
        onChange={(event) => {
          onChange(event.target.value);
          setCaret(event.target.selectionStart ?? 0);
          setSuppressed(false);
          setHighlighted(0);
        }}
        onSelect={(event) =>
          setCaret(event.currentTarget.selectionStart ?? 0)
        }
        onKeyDown={(event) => {
          if (matches.length > 0) {
            const step = suggestionStep(event);
            if (step !== 0) {
              event.preventDefault();
              setHighlighted(
                (highlighted + step + matches.length) %
                  matches.length,
              );
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              pick(matches[highlighted] ?? "");
              return;
            }
            if (event.key === "Escape") {
              setSuppressed(true);
              return;
            }
          }
          if (event.key === "Enter") {
            event.preventDefault();
            onEnter();
            return;
          }
          if (event.key === "Escape") {
            onEscape();
          }
        }}
      />

      {matches.length > 0 && (
        <div className="capture-suggestions">
          {matches.map((candidate, index) => (
            <button
              type="button"
              key={candidate}
              tabIndex={-1}
              className="capture-suggestion"
              data-on={index === highlighted}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(candidate)}
            >
              {opening?.sigil}
              {candidate}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function Meta({
  task,
  omit,
  travelled,
}: {
  task: RowTask;
  omit: MetaOmission[];
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

function InfoIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="10"
        cy="10"
        r="7.4"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M10 9v4.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="10" cy="6.4" r="0.95" fill="currentColor" />
    </svg>
  );
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className="chevron"
      data-open={open}
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 3.5 10.5 8 6 12.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

function dismissKeyboard(): void {
  const focused = document.activeElement;
  if (focused instanceof HTMLElement) {
    focused.blur();
  }
}

function suggestionStep(
  event: KeyboardEvent<HTMLInputElement>,
): number {
  if (event.ctrlKey) {
    if (event.key === "n") {
      return 1;
    }
    if (event.key === "p") {
      return -1;
    }
    return 0;
  }
  if (event.key === "ArrowDown") {
    return 1;
  }
  if (event.key === "ArrowUp") {
    return -1;
  }
  if (event.key === "Tab") {
    return event.shiftKey ? -1 : 1;
  }
  return 0;
}

interface Opening {
  sigil: string;
  typed: string;
  start: number;
}

function sigilBefore({
  input,
  caret,
}: {
  input: string;
  caret: number;
}): Opening | null {
  const before = input.slice(0, caret);
  const found = before.match(/(?:^|\s)([#@/!])(\S*)$/);
  const sigil = found?.[1];
  const typed = found?.[2];
  if (!sigil || typed === undefined) {
    return null;
  }
  return {
    sigil: sigil,
    typed: typed.toLowerCase(),
    start: before.length - typed.length - 1,
  };
}

function suggestionsFor({
  opening,
  lists,
  knownTags,
  knownWho,
  stages,
}: {
  opening: Opening | null;
  lists: string[];
  knownTags: string[];
  knownWho: string[];
  stages: string[];
}): string[] {
  if (!opening) {
    return [];
  }
  const candidates =
    opening.sigil === "/"
      ? lists
      : opening.sigil === "#"
        ? knownTags
        : opening.sigil === "!"
          ? stages
          : knownWho;

  return candidates
    .filter(
      (candidate) =>
        candidate.toLowerCase().startsWith(opening.typed) &&
        candidate.toLowerCase() !== opening.typed,
    )
    .slice(0, MOST_SUGGESTIONS);
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
  const [offset, setOffset] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const sideways = useRef(0);
  const furthest = useRef(0);
  const holding = useRef(false);
  const active = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const element = useRef<HTMLDivElement>(null);
  const stopWatching = useRef<(() => void) | null>(null);
  const endLatest = useRef<() => void>(() => {});

  useEffect(() => {
    const node = element.current;
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
    return () => {
      stopWatching.current?.();
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  useEffect(() => {
    endLatest.current = endGesture;
  });

  function stopTimer(): void {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function watchForRelease(
    pointerId: number,
    finish: () => void,
  ): void {
    stopWatching.current?.();

    function onPointerRelease(event: PointerEvent): void {
      if (event.pointerId === pointerId) {
        finish();
      }
    }
    function onWindowBlur(): void {
      finish();
    }

    window.addEventListener("pointerup", onPointerRelease);
    window.addEventListener("pointercancel", onPointerRelease);
    window.addEventListener("blur", onWindowBlur);
    stopWatching.current = () => {
      window.removeEventListener("pointerup", onPointerRelease);
      window.removeEventListener("pointercancel", onPointerRelease);
      window.removeEventListener("blur", onWindowBlur);
      stopWatching.current = null;
    };
  }

  function endGesture(): void {
    if (!active.current) {
      return;
    }
    active.current = false;
    stopWatching.current?.();
    stopTimer();

    if (holding.current) {
      holding.current = false;
      start.current = null;
      setOffset(0);
      return;
    }
    if (!start.current) {
      return;
    }
    const dx = sideways.current;
    const threshold =
      (element.current?.offsetWidth ?? 0) * SWIPE_FRACTION;
    start.current = null;
    sideways.current = 0;
    setOffset(0);
    if (dx <= -threshold) {
      onLeft?.();
    } else if (dx >= threshold) {
      onRight?.();
    }
  }

  const swipeable = Boolean(onLeft || onRight);

  return {
    ref: element,
    offset: offset,
    swiping: offset !== 0,
    travelled: () => furthest.current > 8,
    down: (event: React.PointerEvent) => {
      if (!enabled || (!swipeable && !onLongPress)) {
        return;
      }
      active.current = true;
      watchForRelease(event.pointerId, () => endLatest.current());
      start.current = { x: event.clientX, y: event.clientY };
      sideways.current = 0;
      furthest.current = 0;
      holding.current = false;
      if (!onLongPress) {
        return;
      }
      const pointerX = event.clientX;
      const pointerY = event.clientY;
      timer.current = setTimeout(() => {
        holding.current = true;
        onLongPress(pointerX, pointerY);
      }, LONG_PRESS_MILLISECONDS);
    },
    move: (event: React.PointerEvent) => {
      if (!start.current) {
        return;
      }
      const dx = event.clientX - start.current.x;
      const dy = event.clientY - start.current.y;
      furthest.current = Math.max(
        furthest.current,
        Math.abs(dx),
        Math.abs(dy),
      );

      if (holding.current) {
        return;
      }

      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        stopTimer();
        start.current = null;
        setOffset(0);
        return;
      }

      if (!swipeable) {
        return;
      }

      if (Math.abs(dx) > 6) {
        stopTimer();
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      }
      sideways.current = dx;
      setOffset(dx);
    },
    up: () => endGesture(),
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
