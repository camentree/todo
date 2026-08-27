import { useEffect, useRef, useState } from "react";
import { Sprite } from "./ui/Sprite.tsx";
import type { ReactNode, RefObject } from "react";
import { useNavigate } from "react-router-dom";

import { Title } from "./Title.tsx";
import {
  AttributeChips,
  attributesOf,
  withoutAttribute,
} from "./Attributes.tsx";
import { Note } from "./ui/Note.tsx";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts.ts";
import { useKeyboardSwipe } from "../hooks/useKeyboardSwipe.ts";
import { Swipeable } from "./ui/Swipeable.tsx";
import type { SwipeAction } from "./ui/Swipeable.tsx";
import { renameChanges } from "../tasks/taskLine.ts";
import { linkTo } from "../tasks/attributes.ts";
import type { Attribute } from "../tasks/attributes.ts";
import { isTerminal } from "@shared/states.ts";
import type { CreatedTask, Task } from "@shared/types.ts";

export function Row({
  task,
  isEditing,
  isFocused = false,
  onEditingChange,
  onCommit,
  onInfoOpen,
  onFocusNext,
  onAddSubtask,
  onCopy,
  swipeLeft,
  swipeRight,
  onLongPress,
  showAttributes,
  parseAttributes = true,
  hiddenAttributes = [],
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
  onCopy?: () => void;
  swipeLeft?: SwipeAction;
  swipeRight?: SwipeAction;
  onLongPress?: (pointerX: number, pointerY: number) => void;
  showAttributes: boolean;
  parseAttributes?: boolean;
  hiddenAttributes?: Attribute[];
  focusOnMount?: boolean;
  renderSubtask?: (subtask: CreatedTask, index: number) => ReactNode;
  renderNewSubtask?: (parent: Task) => ReactNode;
  expanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
  onTab?: (backwards: boolean) => void;
}) {
  const [draft, setDraft] = useState(task.title);
  const [edits, setEdits] = useState<Partial<Task>>({});
  const [caretAt, setCaretAt] = useState<number | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const openedByPointer = useRef(false);
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

  const { swipingTo } = useKeyboardSwipe({
    left: swipeLeft
      ? {
          key: "a",
          action: () => {
            onFocusNext?.();
            swipeLeft.action();
          },
        }
      : null,
    right:
      swipeRight && task.state !== "archived"
        ? {
            key: "s",
            action: () => {
              onFocusNext?.();
              swipeRight.action();
            },
          }
        : null,
    enabled: isFocused && !isEditing && !isTerminal(task.state),
  });

  const children = task.subtasks ?? [];
  const finished = children.filter((child) =>
    isTerminal(child.state),
  ).length;
  const note = (task.note ?? "").trim();
  const expandable =
    children.length > 0 || note.length > 0 || expanded;

  useKeyboardShortcuts((event) => {
    if (
      event.key === "ArrowRight" &&
      onExpandedChange &&
      expandable
    ) {
      event.preventDefault();
      onExpandedChange(true);
      return;
    }
    if (event.key === "ArrowLeft" && onExpandedChange && expanded) {
      event.preventDefault();
      onExpandedChange(false);
      return;
    }
    if (event.key === "o" && onExpandedChange && expandable) {
      event.preventDefault();
      onExpandedChange(!expanded);
      return;
    }
    if (event.key === "c" && onCopy) {
      event.preventDefault();
      onCopy();
      return;
    }
    if (event.key === "+" && onAddSubtask) {
      event.preventDefault();
      onAddSubtask();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      onInfoOpen?.();
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
      setCaretAt(task.title.length);
      onEditingChange(true);
      return;
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
    titleRef.current?.blur();
    onEditingChange(false);
  }

  return (
    <>
      <Swipeable
        className="task"
        left={swipeLeft}
        right={swipeRight}
        enabled={!isEditing}
        swipingTo={swipingTo}
        onLongPress={onLongPress}
        data-done={isTerminal(task.state)}
        data-editing={isEditing}
        data-unsaved={unsaved}
        onBlur={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) {
            return;
          }
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
              suggest={parseAttributes}
              caretAt={caretAt}
              takeFocus={!unsaved || focusOnMount}
              onEnter={commit}
              onEscape={stopEditing}
              onTab={onTab && moveOn}
            />
          ) : (
            <button
              type="button"
              className="task-title"
              onClick={(event) => {
                setCaretAt(caretIndexAt(event));
                onEditingChange(true);
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
                openedByPointer.current = true;
                onInfoOpen();
              }}
              onClick={() => {
                if (openedByPointer.current) {
                  openedByPointer.current = false;
                  return;
                }
                onInfoOpen();
              }}
            >
              <Sprite name="info" />
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
              <Sprite name="chevron" open={expanded} />
            </button>
          )}
        </div>

        {isEditing
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
              <Attributes task={task} omit={hiddenAttributes} />
            )}
      </Swipeable>

      {expandable && (
        <div className="collapsible" data-open={expanded}>
          <div>
            {note.length > 0 && (
              <Note
                className="task-note"
                note={note}
                onCommit={(next) => onCommit({ note: next })}
              />
            )}
            {(renderSubtask || renderNewSubtask) && (
              <div className="subtasks" data-subtasks={task.id}>
                {children.map((child, index) =>
                  renderSubtask?.(child, index),
                )}
                {renderNewSubtask?.(task)}
              </div>
            )}
          </div>
        </div>
      )}
    </>
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
    const field = inputRef.current;
    if (!field) {
      return;
    }
    field.focus({ preventScroll: true });
    const landAt = caretAt ?? field.value.length;
    field.setSelectionRange(landAt, landAt);
  }, [takeFocus, caretAt, inputRef]);

  return (
    <Title
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
      }}
    />
  );
}

function Attributes({
  task,
  omit,
}: {
  task: Task;
  omit: Attribute[];
}) {
  const navigate = useNavigate();

  const shown = attributesOf(task).filter(
    (item) =>
      item.label.toLowerCase() === "today" ||
      !omit.some(
        (omission) =>
          omission.field === item.field &&
          omission.label.toLowerCase() === item.label.toLowerCase(),
      ),
  );

  if (shown.length === 0) {
    return null;
  }

  return (
    <span className="task-meta">
      {shown.map((attribute) => {
        const to = linkTo(attribute);
        return (
          <button
            type="button"
            key={`${attribute.field}-${attribute.label}`}
            className={attribute.field === "tag" ? "tag" : undefined}
            data-clickable={Boolean(to)}
            onClick={() => {
              if (!to) {
                return;
              }
              navigate(to);
            }}
          >
            {attribute.label.toLowerCase()}
          </button>
        );
      })}
    </span>
  );
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
