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
import { renameChanges } from "../useTaskActions.ts";
import type { Attribute } from "@shared/attributes.ts";
import { isTerminal } from "@shared/states.ts";
import type { Task } from "@shared/types.ts";

const LONG_PRESS_MILLISECONDS = 400;
const SWIPE_FRACTION = 0.4;
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
  showSubtasks = false,
  onShowSubtasksChange,
}: {
  task: Task;
  isEditing: boolean;
  onEditingChange: (editing: boolean) => void;
  onCommit: (changes: Partial<Task>) => void;
  onInfoOpen?: () => void;
  swipeLeft?: SwipeAction;
  swipeRight?: SwipeAction;
  onLongPress?: (pointerX: number, pointerY: number) => void;
  flickingTo?: "left" | "right" | null;
  showAttributes: boolean;
  omitAttributes?: AttributeOmission[];
  inputRef?: RefObject<HTMLInputElement | null>;
  subtasks?: ReactNode;
  showSubtasks?: boolean;
  onShowSubtasksChange?: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState(task.title);
  const [edits, setEdits] = useState<Partial<Task>>({});
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

  const uncommitted: Task = {
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
    onCommit(unsaved ? uncommitted : changes);
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
              list={uncommitted.list ?? ""}
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
                onShowSubtasksChange?.(!showSubtasks);
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
            <Attributes
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
  useEffect(() => {
    if (takeFocus) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [takeFocus, inputRef]);

  return (
    <ParseableTitle
      value={value}
      onChange={onChange}
      inputRef={inputRef}
      list={list}
      at="row"
      onDone={onEnter}
      onCancel={onEscape}
      input={{
        className: "task-title editing",
        "aria-label": "Title",
        enterKeyHint: "done",
        onFocus: (event) => {
          const row = event.currentTarget.closest(".task");
          if (row) {
            easeToTop(row);
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

function dismissKeyboard(): void {
  const focused = document.activeElement;
  if (focused instanceof HTMLElement) {
    focused.blur();
  }
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
