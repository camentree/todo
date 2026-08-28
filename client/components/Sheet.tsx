import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { api } from "../data/api.ts";

import { AttributeChips, withoutAttribute } from "./Attributes.tsx";
import { Comments } from "./Comments.tsx";
import { FloatingButton } from "./FloatingButton.tsx";
import {
  BLANK_TASK,
  NewSubtaskRow,
  SubtaskRow,
} from "./Subtasks.tsx";
import { Timing } from "./Timing.tsx";
import { Title } from "./Title.tsx";
import { Choice } from "./ui/Choice.tsx";
import { Modal } from "./ui/Modal.tsx";
import { Note } from "./ui/Note.tsx";
import { usePending } from "../data/pending.ts";
import { hasStarted } from "../data/started.ts";
import { useDragDown } from "../hooks/useDragDown.ts";
import { useTaskActions } from "../hooks/useTaskActions.ts";
import { useTask } from "../hooks/useTasks.ts";
import { renameChanges } from "../tasks/taskLine.ts";
import { isTerminal } from "@shared/states.ts";
import type { CreatedTask, Task } from "@shared/types.ts";

const CLOSE_MILLISECONDS = 850;

export type SheetTab = "subtasks" | "notes" | "comments" | "timing";

export function Sheet({
  taskId,
  seed,
  openOn = "subtasks",
  onClose,
}: {
  taskId: number | null;
  seed: Partial<Task>;
  openOn?: SheetTab;
  onClose: () => void;
}) {
  const actions = useTaskActions();
  const pending = usePending();
  const [madeId, setMadeId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [edits, setEdits] = useState<Partial<Task>>({});
  const [tab, setTab] = useState<SheetTab>(openOn);
  const [editingSubtaskId, setEditingSubtaskId] = useState<
    number | null
  >(null);
  const [closing, setClosing] = useState(false);
  const [settled] = useState(() => !hasStarted());

  const started = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const drag = useDragDown({
    scroller: bodyRef,
    onRelease: () => saveAndClose(),
  });

  const { task: confirmed, isError } = useTask(taskId ?? madeId);
  const held = confirmed && {
    ...confirmed,
    ...pending.get(confirmed.id),
    subtasks: confirmed.subtasks,
  };
  const base: Task = held ?? { ...BLANK_TASK, ...seed };
  const shown: Task = {
    ...base,
    ...renameChanges(title || base.title),
    ...edits,
  };
  const subtasks = shown.subtasks ?? [];

  useQuery({
    queryKey: ["comments", held?.id],
    queryFn: () => api.comments(held?.id ?? 0),
    enabled: held !== undefined,
  });

  useEffect(() => {
    if (held && !started.current) {
      started.current = true;
      setTitle(held.title);
    }
  }, [held]);

  async function ensureCreated(): Promise<CreatedTask | null> {
    if (held) {
      return held;
    }
    const changes = {
      ...seed,
      ...renameChanges(title),
      ...edits,
    };
    if ((changes.title ?? "").trim().length === 0) {
      return null;
    }
    const made = await actions.create(changes);
    setMadeId(made.id);
    return made;
  }

  function slideAway(): void {
    drag.slideOut();
    setClosing(true);
    setTimeout(onClose, CLOSE_MILLISECONDS);
  }

  function saveAndClose(): void {
    blurActive();
    if (held) {
      const changes = {
        ...(title !== held.title ? renameChanges(title) : {}),
        ...edits,
      };
      if (Object.keys(changes).length > 0) {
        actions.rename(held, changes);
      }
    } else {
      void ensureCreated();
    }
    slideAway();
  }

  function discardAndClose(): void {
    blurActive();
    if (madeId !== null && held) {
      actions.remove(held);
    }
    slideAway();
  }

  const subtaskActions = {
    ...actions,
    create: async (changes: Partial<Task>) => {
      const parent = await ensureCreated();
      return actions.create({
        ...changes,
        parentId: parent?.id ?? null,
        list: parent?.list ?? shown.list,
      });
    },
  };

  if (isError) {
    return <MissingTask onClose={onClose} />;
  }

  return (
    <Modal
      label={taskId === null ? "New task" : "Edit task"}
      shape="sheet"
      closing={closing}
      settled={settled}
      dragging={drag.dragging}
      style={{ transform: `translateY(${drag.offset}px)` }}
      onDismiss={saveAndClose}
      onEscape={discardAndClose}
      onPointerDown={drag.start}
      onPointerMove={drag.move}
      onPointerUp={drag.end}
    >
      <div className="sheet-handle">
        <div className="sheet-grabber" />
      </div>

      <div className="sheet-body" ref={bodyRef}>
        <Title
          value={title}
          onChange={setTitle}
          inputRef={titleRef}
          list={shown.list ?? ""}
          multiline
          onDone={() => titleRef.current?.blur()}
          input={{
            className: "sheet-title",
            "aria-label": "Title",
            placeholder: "New task",
            autoCapitalize: "sentences",
            autoFocus: taskId === null,
          }}
        />

        <div className="chipline">
          <AttributeChips
            task={shown}
            onRemove={(attribute) => {
              const without = withoutAttribute({
                task: shown,
                draft: title,
                attribute: attribute,
              });
              setTitle(without.draft);
              setEdits({ ...edits, ...without.changes });
            }}
          />
        </div>

        <Choice
          label="What to show"
          value={tab}
          options={[
            {
              value: "subtasks",
              label: "Subtasks",
              count: finishedOf(subtasks),
            },
            {
              value: "notes",
              label: "Notes",
              count: shown.note?.trim() ? "1" : "",
            },
            {
              value: "comments",
              label: "Comments",
              count: shown.commentCount
                ? String(shown.commentCount)
                : "",
            },
            { value: "timing", label: "Timing" },
          ]}
          onChange={setTab}
        />

        <div className="sheet-pane">
          {tab === "subtasks" && (
            <>
              {subtasks.map((subtask) => (
                <SubtaskRow
                  key={subtask.id}
                  subtask={subtask}
                  index={subtasks.indexOf(subtask)}
                  actions={actions}
                  editing={editingSubtaskId === subtask.id}
                  onEditingChange={(editing) =>
                    setEditingSubtaskId(editing ? subtask.id : null)
                  }
                />
              ))}
              <NewSubtaskRow
                parent={shown}
                actions={subtaskActions}
                index={subtasks.length}
              />
            </>
          )}

          {tab === "notes" && (
            <Note
              note={shown.note ?? ""}
              rows={2}
              placeholder="Anything worth remembering"
              onCommit={(next) =>
                held
                  ? actions.rename(held, { note: next })
                  : setEdits({ ...edits, note: next })
              }
            />
          )}

          {tab === "comments" && held && (
            <Comments taskId={held.id} />
          )}

          {tab === "timing" && (
            <Timing
              schedule={shown.schedule}
              dueDate={shown.dueDate}
              dueTime={shown.dueTime}
              onChange={(changes) =>
                setEdits({ ...edits, ...changes })
              }
            />
          )}
        </div>
      </div>

      <FloatingButton
        icon="cross"
        label="Discard"
        onClick={discardAndClose}
      />
    </Modal>
  );
}

function finishedOf(subtasks: CreatedTask[]): string {
  if (subtasks.length === 0) {
    return "";
  }
  const done = subtasks.filter((subtask) =>
    isTerminal(subtask.state),
  ).length;
  return `${done}/${subtasks.length}`;
}

function blurActive(): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.blur();
  }
}

function MissingTask({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="No such task" shape="sheet" onDismiss={onClose}>
      <div className="sheet-handle">
        <div className="sheet-grabber" />
      </div>
      <div className="sheet-body">
        <p className="empty">That task is not here any more.</p>
      </div>
    </Modal>
  );
}
