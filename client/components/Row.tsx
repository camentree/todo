import { useEffect, useRef, useState } from "react";
import { Sprite } from "./ui/Sprite.tsx";
import type { ReactNode, RefObject } from "react";

import { Title } from "./Title.tsx";
import {
  AttributeChips,
  attributesOf,
  withoutAttribute,
} from "./Attributes.tsx";
import { Note } from "./ui/Note.tsx";
import { useCanHover } from "../hooks/useCanHover.ts";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts.ts";
import { useKeyboardSwipe } from "../hooks/useKeyboardSwipe.ts";
import { Swipeable } from "./ui/Swipeable.tsx";
import type { SwipeAction } from "./ui/Swipeable.tsx";
import { renameChanges } from "../tasks/taskLine.ts";
import { searchFor } from "../tasks/attributes.ts";
import { trace } from "../data/trace.ts";
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
  onSearch,
  onFocusNext,
  onAddSubtask,
  onCopy,
  swipeLeft,
  swipeRight,
  onLongPress,
  showAttributes,
  parseAttributes = true,
  hiddenAttributes = [],
  placeholder,
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
  onSearch?: (term: string) => void;
  onFocusNext?: () => void;
  onAddSubtask?: () => void;
  onCopy?: () => void;
  swipeLeft?: SwipeAction;
  swipeRight?: SwipeAction[];
  onLongPress?: (pointerX: number, pointerY: number) => void;
  showAttributes: boolean;
  parseAttributes?: boolean;
  hiddenAttributes?: Attribute[];
  placeholder?: string;
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
  const canHover = useCanHover();
  const renamesInPlace = canHover || !onInfoOpen;

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

  const fullSwipe = swipeRight?.at(-1);

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
      fullSwipe && task.state !== "archived"
        ? {
            key: "s",
            action: () => {
              onFocusNext?.();
              fullSwipe.action();
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
              placeholder={placeholder}
              caretAt={caretAt}
              takeFocus={!unsaved}
              onEnter={commit}
              onEscape={stopEditing}
              onTab={onTab && moveOn}
            />
          ) : (
            <button
              type="button"
              className="task-title"
              onClick={(event) => {
                if (!renamesInPlace) {
                  onInfoOpen?.();
                  return;
                }
                setCaretAt(caretIndexAt(event));
                onEditingChange(true);
              }}
            >
              {task.title}
            </button>
          )}

          {onInfoOpen && canHover && (
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
              <Attributes
                task={task}
                omit={hiddenAttributes}
                onSearch={onSearch}
              />
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
  placeholder,
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
  placeholder?: string;
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
      suggest={suggest}
      multiline
      onDone={onEnter}
      onCancel={onEscape}
      onTab={onTab}
      input={{
        className: "task-title editing",
        "aria-label": "Title",
        placeholder: placeholder,
        enterKeyHint: "done",
        autoCapitalize: "sentences",
      }}
    />
  );
}

function Attributes({
  task,
  omit,
  onSearch,
}: {
  task: Task;
  omit: Attribute[];
  onSearch?: (term: string) => void;
}) {
  const shown = attributesOf(task).filter(
    (item) =>
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
        const term = onSearch && searchFor(attribute);
        return (
          <button
            type="button"
            key={`${attribute.field}-${attribute.label}`}
            className={attribute.field === "tag" ? "tag" : undefined}
            data-clickable={Boolean(term)}
            onPointerDown={() =>
              trace("attribute pointer down", {
                label: attribute.label,
              })
            }
            onTouchEnd={() =>
              trace("attribute touch end", {
                label: attribute.label,
              })
            }
            onClick={() => {
              trace("attribute clicked", {
                label: attribute.label,
                term: term ?? "nothing to search",
                hasHandler: Boolean(onSearch),
              });
              if (term) {
                onSearch?.(term);
              }
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
