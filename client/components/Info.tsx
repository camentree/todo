import { useQuery } from "@tanstack/react-query";
import { Sprite } from "./ui/Sprite.tsx";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Title } from "./Title.tsx";
import {
  AttributeChips,
  AttributeText,
  withoutAttribute,
} from "./Attributes.tsx";
import { Comments } from "./Comments.tsx";
import { NewSubtaskRow, SubtaskRow } from "./Subtasks.tsx";
import { Timing } from "./Timing.tsx";
import { api } from "../data/api.ts";
import { usePending } from "../data/pending.ts";
import { renameChanges } from "../tasks/taskLine.ts";
import { useDragDown } from "../hooks/useDragDown.ts";
import { useLockedScroll } from "../hooks/useLockedScroll.ts";
import { useTaskActions } from "../hooks/useTaskActions.ts";
import { useTask } from "../hooks/useTasks.ts";
import { Modal } from "./ui/Modal.tsx";
import { Collapsible } from "./ui/Collapsible.tsx";
import { Chip } from "./ui/Chip.tsx";
import { Field } from "./ui/Field.tsx";
import { Note } from "./ui/Note.tsx";
import { Picker } from "./ui/Picker.tsx";
import { Select } from "./ui/Select.tsx";
import { canonicalName } from "@shared/names.ts";
import { stageLabel, TASK_STAGES } from "@shared/stages.ts";
import type { TaskStage } from "@shared/stages.ts";
import type { CreatedTask, Task } from "@shared/types.ts";

const CLOSE_MILLISECONDS = 850;

type InfoSection =
  | "metadata"
  | "timing"
  | "subtasks"
  | "note"
  | "comments";

function sectionsHoldingSomething(task: CreatedTask): InfoSection[] {
  const sections: InfoSection[] = [];
  if (task.dueDate || task.dueTime || task.schedule) {
    sections.push("timing");
  }
  if ((task.subtasks ?? []).length > 0) {
    sections.push("subtasks");
  }
  if (task.note) {
    sections.push("note");
  }
  if (task.commentCount > 0) {
    sections.push("comments");
  }
  return sections;
}

export function Info({
  taskId,
  onClose,
}: {
  taskId: number;
  onClose: () => void;
}) {
  const actions = useTaskActions();
  const [title, setTitle] = useState("");
  const [newTag, setNewTag] = useState("");
  const [listDraft, setListDraft] = useState<string | null>(null);
  const [editingSubtaskId, setEditingSubtaskId] = useState<
    number | null
  >(null);
  const [expandedSubtasks, setExpandedSubtasks] = useState<
    Set<number>
  >(new Set());
  const [titleFocused, setTitleFocused] = useState(false);
  const [edits, setEdits] = useState<Partial<Task>>({});
  const [closing, setClosing] = useState(false);
  const [openSections, setOpenSections] = useState<InfoSection[]>([]);

  const started = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const drag = useDragDown({
    scroller: bodyRef,
    onRelease: () => closeSlowly(),
  });

  const pending = usePending();
  const { task: confirmed, isError } = useTask(taskId);
  const task = confirmed && {
    ...confirmed,
    ...pending.get(confirmed.id),
    subtasks: confirmed.subtasks,
  };
  const { data: lists = [] } = useQuery({
    queryKey: ["lists"],
    queryFn: api.lists,
  });
  const editedTask = task
    ? {
        ...task,
        ...renameChanges(title || task.title),
        ...edits,
      }
    : undefined;
  const commentsOpen = openSections.includes("comments");
  const hasTiming = Boolean(
    editedTask?.dueDate ||
    editedTask?.dueTime ||
    editedTask?.schedule,
  );

  useEffect(() => {
    if (hasTiming) {
      setOpenSections((open) =>
        open.includes("timing") ? open : [...open, "timing"],
      );
    }
  }, [hasTiming]);

  const { data: knownTags = [] } = useQuery({
    queryKey: ["tags", task?.list],
    queryFn: () => api.tags(task?.list),
    enabled: Boolean(task?.list),
  });

  useEffect(() => {
    if (task && !started.current) {
      started.current = true;
      setTitle(task.title);
      setOpenSections(sectionsHoldingSomething(task));
    }
  }, [task]);

  useLockedScroll();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        blurActive();
        closeSlowly();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function blurActive(): void {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
  }

  function toggleSection(section: InfoSection): void {
    setOpenSections(
      openSections.includes(section)
        ? openSections.filter((open) => open !== section)
        : [...openSections, section],
    );
  }

  function closeSlowly(): void {
    const changes = {
      ...(task && title !== task.title ? renameChanges(title) : {}),
      ...edits,
    };
    if (task && Object.keys(changes).length > 0) {
      actions.rename(task, changes);
    }
    closeWithoutSaving();
  }

  function closeWithoutSaving(): void {
    drag.slideOut();
    setClosing(true);
    setTimeout(onClose, CLOSE_MILLISECONDS);
  }

  if (isError) {
    return <MissingTask onClose={onClose} />;
  }

  if (!task || !editedTask) {
    return null;
  }

  const uncommittedTask = editedTask;
  const subtasks = task.subtasks ?? [];

  const commitTitle = (): void => {
    const changes = renameChanges(title);
    setTitle(changes.title ?? title);
    setEdits({ ...edits, ...changes });
  };

  const subtaskRow = (subtask: CreatedTask): ReactNode => (
    <SubtaskRow
      key={subtask.id}
      subtask={subtask}
      index={subtasks.indexOf(subtask)}
      actions={actions}
      editing={editingSubtaskId === subtask.id}
      onEditingChange={(editing) =>
        setEditingSubtaskId(editing ? subtask.id : null)
      }
      expanded={expandedSubtasks.has(subtask.id)}
      onExpandedChange={(open) =>
        setExpandedSubtasks((current) => {
          const next = new Set(current);
          if (open) {
            next.add(subtask.id);
          } else {
            next.delete(subtask.id);
          }
          return next;
        })
      }
    />
  );

  const chooseList = (choice: string): void => {
    const next = canonicalName(choice);
    if (next && next !== uncommittedTask.list) {
      setEdits({ ...edits, list: next });
    }
    setListDraft(null);
  };

  return (
    <>
      <Modal
        label="Edit task"
        shape="sheet"
        closing={closing}
        dragging={drag.dragging}
        style={{ transform: `translateY(${drag.offset}px)` }}
        onDismiss={closeSlowly}
        onEscape={() => {
          blurActive();
          closeWithoutSaving();
        }}
        onPointerDown={drag.start}
        onPointerMove={drag.move}
        onPointerUp={drag.end}
      >
        <div className="info-handle">
          <div className="info-grabber" />
        </div>

        <button
          type="button"
          className="info-discard"
          aria-label="Close without saving"
          onClick={closeWithoutSaving}
        >
          ×
        </button>

        <button
          type="button"
          className="info-done"
          aria-label="Done"
          onClick={closeSlowly}
        >
          <Sprite name="tick" />
        </button>
        <div className="info-body" ref={bodyRef}>
          <Title
            value={title}
            onChange={setTitle}
            inputRef={titleRef}
            list={uncommittedTask.list ?? ""}
            at="sheet"
            multiline
            onDone={() => titleRef.current?.blur()}
            input={{
              className: "info-title",
              "aria-label": "Title",
              autoCapitalize: "none",
              onFocus: () => setTitleFocused(true),
              onBlur: () => {
                setTitleFocused(false);
                commitTitle();
              },
            }}
          />

          <div className="info-attributes">
            {titleFocused ? (
              <AttributeChips
                task={uncommittedTask}
                onRemove={(attribute) => {
                  const without = withoutAttribute({
                    task: uncommittedTask,
                    draft: title,
                    attribute: attribute,
                  });
                  setTitle(without.draft);
                  setEdits({ ...edits, ...without.changes });
                }}
              />
            ) : (
              <AttributeText task={uncommittedTask} />
            )}
          </div>

          <Section
            label="Metadata"
            count={0}
            open={openSections.includes("metadata")}
            onToggle={() => toggleSection("metadata")}
          >
            <Field label="List">
              <Picker
                value={listDraft ?? uncommittedTask.list ?? ""}
                options={lists}
                label="List"
                onChange={setListDraft}
                onChoose={chooseList}
                onLeave={() =>
                  listDraft === null
                    ? undefined
                    : chooseList(listDraft)
                }
              />
            </Field>

            <Field label="Stage">
              <Select
                value={uncommittedTask.stage ?? ""}
                options={[
                  { value: "", label: "None" },
                  ...TASK_STAGES.map((stage) => ({
                    value: stage as string,
                    label: stageLabel(stage),
                  })),
                ]}
                onChange={(stage) =>
                  setEdits({
                    ...edits,
                    stage: (stage || null) as TaskStage | null,
                  })
                }
              />
            </Field>

            <Field label="Tags">
              <div className="info-tags">
                {uncommittedTask.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    field="tag"
                    onRemove={() =>
                      setEdits({
                        ...edits,
                        tags: uncommittedTask.tags.filter(
                          (existing) => existing !== tag,
                        ),
                      })
                    }
                  />
                ))}
                <Picker
                  value={newTag}
                  options={knownTags.filter(
                    (tag) => !uncommittedTask.tags.includes(tag),
                  )}
                  className="tag-input"
                  placeholder="Add a tag"
                  label="Add a tag"
                  onChange={setNewTag}
                  onChoose={(choice) => {
                    const tag = canonicalName(choice).replace(
                      /^#/,
                      "",
                    );
                    if (tag && !uncommittedTask.tags.includes(tag)) {
                      setEdits({
                        ...edits,
                        tags: [...uncommittedTask.tags, tag],
                      });
                    }
                    setNewTag("");
                  }}
                />
              </div>
            </Field>
          </Section>

          <Section
            label="Timing"
            count={0}
            open={openSections.includes("timing")}
            onToggle={() => toggleSection("timing")}
          >
            <Timing
              schedule={uncommittedTask.schedule}
              dueDate={uncommittedTask.dueDate}
              dueTime={uncommittedTask.dueTime}
              onChange={(changes) =>
                setEdits({ ...edits, ...changes })
              }
            />
          </Section>

          <Section
            label="Subtasks"
            count={subtasks.length}
            open={openSections.includes("subtasks")}
            onToggle={() => toggleSection("subtasks")}
          >
            <div className="info-subtasks">
              {subtasks.map((subtask) => subtaskRow(subtask))}
              <NewSubtaskRow
                parent={task}
                actions={actions}
                index={subtasks.length}
              />
            </div>
          </Section>

          <Section
            label="Notes"
            count={task.note ? 1 : 0}
            open={openSections.includes("note")}
            onToggle={() => toggleSection("note")}
          >
            <Note
              note={task.note ?? ""}
              rows={2}
              placeholder="Anything worth remembering"
              onCommit={(next) =>
                actions.rename(task, { note: next })
              }
            />
          </Section>

          <Section
            label="Comments"
            count={task.commentCount}
            open={commentsOpen}
            onToggle={() => toggleSection("comments")}
          >
            <Comments taskId={taskId} reading={commentsOpen} />
          </Section>
        </div>
      </Modal>
    </>
  );
}

function MissingTask({ onClose }: { onClose: () => void }) {
  useLockedScroll();

  return (
    <Modal label="No such task" shape="sheet" onDismiss={onClose}>
      <div className="info-handle">
        <div className="info-grabber" />
      </div>

      <button
        type="button"
        className="info-discard"
        aria-label="Close"
        onClick={onClose}
      >
        ×
      </button>

      <div className="info-body">
        <p className="empty">That task is not here any more.</p>
      </div>
    </Modal>
  );
}

function Section({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="info-section">
      <Collapsible
        tone="section"
        label={label}
        badge={
          count > 0 && <span className="info-count">{count}</span>
        }
        open={open}
        onToggle={onToggle}
      >
        <div className="info-section-body">{children}</div>
      </Collapsible>
    </div>
  );
}
