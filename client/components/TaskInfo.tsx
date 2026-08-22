import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import { Chevron, SendIcon, TickIcon } from "./icons.tsx";
import { ParseableTitle } from "./ParseableTitle.tsx";
import {
  AttributeChips,
  AttributeText,
  asRenamed,
  withoutAttribute,
} from "./TaskAttributes.tsx";
import { TaskRow } from "./TaskRow.tsx";
import { api } from "../api.ts";
import { formatWhen } from "../format.ts";
import { renameChanges } from "../useTaskActions.ts";
import { useLockedScroll } from "../useLockedScroll.ts";
import { canonicalName } from "@shared/names.ts";
import { toDateString } from "@shared/recurrence.ts";
import { stageLabel, TASK_STAGES } from "@shared/stages.ts";
import type { TaskStage } from "@shared/stages.ts";
import type {
  CreatedTask,
  Frequency,
  Schedule,
  Task,
} from "@shared/types.ts";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toggleWeekday(weekdays: number[], index: number): number[] {
  const next = weekdays.includes(index)
    ? weekdays.filter((weekday) => weekday !== index)
    : [...weekdays, index];
  return next.length > 0 ? next.sort() : weekdays;
}

const CLOSE_MILLISECONDS = 850;
const DRAG_TO_CLOSE = 110;
const INDENT = "  ";

type InfoSection =
  "metadata" | "timing" | "subtasks" | "note" | "comments";

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

export function TaskInfo({
  taskId,
  onClose,
}: {
  taskId: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [newTag, setNewTag] = useState("");
  const [titleFocused, setTitleFocused] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const [edits, setEdits] = useState<Partial<Task>>({});
  const [everyDraft, setEveryDraft] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [closing, setClosing] = useState(false);
  const [openSections, setOpenSections] = useState<InfoSection[]>([]);

  const started = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const drag = useDragDown({
    scroller: bodyRef,
    onRelease: () => closeSlowly(),
  });

  const { data: task } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => api.task(taskId),
  });
  const { data: lists = [] } = useQuery({
    queryKey: ["lists"],
    queryFn: api.lists,
  });
  const editedTask = task ? { ...task, ...edits } : undefined;
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

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", taskId],
    queryFn: () => api.comments(taskId),
    enabled: commentsOpen,
  });
  const { data: knownTags = [] } = useQuery({
    queryKey: ["tags", task?.list],
    queryFn: () => api.tags(task?.list),
    enabled: Boolean(task?.list),
  });

  useEffect(() => {
    if (task && !started.current) {
      started.current = true;
      setTitle(task.title);
      setNote(task.note ?? "");
      setOpenSections(sectionsHoldingSomething(task));
    }
  }, [task]);

  useEffect(() => {
    const textarea = noteRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight + 6}px`;
  }, [note]);

  useLockedScroll();

  const refresh = () => queryClient.invalidateQueries();

  const save = useMutation({
    mutationFn: (changes: Partial<Task>) =>
      api.updateTask(taskId, changes),
    onSuccess: refresh,
  });
  const addSubtask = useMutation({
    mutationFn: (title: string) =>
      api.createTask({
        list: task?.list ?? "",
        parentId: taskId,
        title: title,
      }),
    onSuccess: refresh,
  });
  const toggleSubtask = useMutation({
    mutationFn: (subtask: CreatedTask) =>
      api.setState(
        subtask.id,
        subtask.state === "complete" ? "to_do" : "complete",
      ),
    onSuccess: refresh,
  });
  const renameSubtask = useMutation({
    mutationFn: ({
      subtask,
      title,
    }: {
      subtask: CreatedTask;
      title: string;
    }) => api.updateTask(subtask.id, { title: title }),
    onSuccess: refresh,
  });
  const deleteSubtask = useMutation({
    mutationFn: (subtask: CreatedTask) => api.deleteTask(subtask.id),
    onSuccess: refresh,
  });
  const comment = useMutation({
    mutationFn: () => api.addComment(taskId, newComment),
    onSuccess: () => {
      setNewComment("");
      refresh();
    },
  });
  const seeComment = useMutation({
    mutationFn: (commentId: number) => api.markCommentSeen(commentId),
    onSuccess: refresh,
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        const active = document.activeElement;
        if (active instanceof HTMLElement) {
          active.blur();
        }
        closeSlowly();
        return;
      }
      if (event.key !== "Escape") {
        return;
      }
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        active.blur();
      }
      closeWithoutSaving();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function toggleSection(section: InfoSection): void {
    setOpenSections(
      openSections.includes(section)
        ? openSections.filter((open) => open !== section)
        : [...openSections, section],
    );
  }

  function closeSlowly(): void {
    const changes = {
      ...edits,
      ...(task && title !== task.title ? renameChanges(title) : {}),
      ...(task && note !== (task.note ?? "")
        ? { note: note || null }
        : {}),
    };
    if (Object.keys(changes).length > 0) {
      save.mutate(changes);
    }
    closeWithoutSaving();
  }

  function closeWithoutSaving(): void {
    drag.slideOut();
    setClosing(true);
    setTimeout(onClose, CLOSE_MILLISECONDS);
  }

  if (!task || !editedTask) {
    return null;
  }

  const uncommittedTask = editedTask;
  const subtasks = task.subtasks ?? [];
  const schedule = uncommittedTask.schedule;
  const repeats = schedule !== null;

  function changeSchedule(changes: Partial<Schedule>): void {
    if (!schedule) {
      return;
    }
    setEdits({ ...edits, schedule: { ...schedule, ...changes } });
  }

  const commitTitle = (): void => {
    const changes = renameChanges(title);
    setTitle(changes.title ?? title);
    setEdits({ ...edits, ...changes });
  };

  return (
    <>
      <div
        className="scrim"
        data-closing={closing}
        onClick={closeSlowly}
      />
      <div
        className="info"
        data-closing={closing}
        data-dragging={drag.dragging}
        role="dialog"
        aria-label="Edit task"
        style={{ transform: `translateY(${drag.offset}px)` }}
        onPointerDown={drag.start}
        onPointerMove={drag.move}
        onPointerUp={drag.end}
        onPointerCancel={drag.end}
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
          <TickIcon />
        </button>
        <div className="info-body" ref={bodyRef}>
          <ParseableTitle
            value={title}
            onChange={setTitle}
            inputRef={titleRef}
            list={uncommittedTask.list ?? ""}
            at="sheet"
            onDone={(event: ReactKeyboardEvent<HTMLInputElement>) =>
              event.currentTarget.blur()
            }
            input={{
              className: "info-title",
              "aria-label": "Title",
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
                task={asRenamed({
                  task: uncommittedTask,
                  draft: title,
                })}
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
            <label className="info-field">
              <span>List</span>
              <input
                list="known-lists"
                key={uncommittedTask.list}
                defaultValue={uncommittedTask.list ?? ""}
                onBlur={(event) => {
                  const next = canonicalName(event.target.value);
                  if (next && next !== uncommittedTask.list) {
                    setEdits({ ...edits, list: next });
                  }
                }}
              />
              <datalist id="known-lists">
                {lists.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>

            <label className="info-field">
              <span>Stage</span>
              <select
                value={uncommittedTask.stage ?? ""}
                onChange={(event) =>
                  setEdits({
                    ...edits,
                    stage: (event.target.value ||
                      null) as TaskStage | null,
                  })
                }
              >
                <option value="">None</option>
                {TASK_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {stageLabel(stage)}
                  </option>
                ))}
              </select>
            </label>

            <div className="info-field">
              <span>Tags</span>
              <div className="info-tags">
                {uncommittedTask.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="tag-chip"
                    aria-label={`Remove ${tag}`}
                    onClick={() =>
                      setEdits({
                        ...edits,
                        tags: uncommittedTask.tags.filter(
                          (existing) => existing !== tag,
                        ),
                      })
                    }
                  >
                    {tag}
                    <span className="tag-remove">×</span>
                  </button>
                ))}
                <input
                  className="tag-input"
                  list="known-tags"
                  value={newTag}
                  placeholder="Add a tag"
                  aria-label="Add a tag"
                  enterKeyHint="done"
                  onChange={(event) => setNewTag(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") {
                      return;
                    }
                    event.preventDefault();
                    const tag = canonicalName(newTag).replace(
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
                <datalist id="known-tags">
                  {knownTags
                    .filter(
                      (tag) => !uncommittedTask.tags.includes(tag),
                    )
                    .map((tag) => (
                      <option key={tag} value={tag} />
                    ))}
                </datalist>
              </div>
            </div>
          </Section>

          <Section
            label="Timing"
            count={0}
            open={openSections.includes("timing")}
            onToggle={() => toggleSection("timing")}
          >
            <label className="info-check">
              <input
                type="checkbox"
                checked={repeats}
                onChange={(event) =>
                  setEdits({
                    ...edits,
                    schedule: event.target.checked
                      ? {
                          frequency: "daily",
                          repeatEvery: 1,
                          weekdays: [],
                          dayOfMonth: null,
                          startsOn:
                            uncommittedTask.dueDate ??
                            toDateString(new Date()),
                        }
                      : null,
                  })
                }
              />
              <span>Repeats</span>
            </label>

            <div
              className="collapsible unhurried"
              data-open={repeats}
            >
              <div className="info-repeat">
                {schedule && (
                  <>
                    <div className="info-every">
                      <label className="info-field">
                        <span>Every</span>
                        <input
                          type="number"
                          min="1"
                          max="52"
                          inputMode="numeric"
                          value={
                            everyDraft ?? String(schedule.repeatEvery)
                          }
                          onChange={(event) =>
                            setEveryDraft(event.target.value)
                          }
                          onFocus={(event) => event.target.select()}
                          onBlur={() => {
                            const typed = Number.parseInt(
                              everyDraft ?? "",
                              10,
                            );
                            if (typed >= 1) {
                              changeSchedule({
                                repeatEvery: Math.min(52, typed),
                              });
                            }
                            setEveryDraft(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.currentTarget.blur();
                            }
                          }}
                        />
                      </label>
                      <label className="info-field">
                        <span>Period</span>
                        <select
                          value={schedule.frequency}
                          onChange={(event) =>
                            changeSchedule({
                              frequency: event.target
                                .value as Frequency,
                            })
                          }
                        >
                          <option value="daily">
                            {schedule.repeatEvery === 1
                              ? "day"
                              : "days"}
                          </option>
                          <option value="weekly">
                            {schedule.repeatEvery === 1
                              ? "week"
                              : "weeks"}
                          </option>
                          <option value="monthly">
                            {schedule.repeatEvery === 1
                              ? "month"
                              : "months"}
                          </option>
                        </select>
                      </label>
                    </div>

                    {schedule.frequency === "weekly" && (
                      <div className="info-field">
                        <span>On</span>
                        <div className="weekdays">
                          {WEEKDAYS.map((weekday, index) => (
                            <button
                              key={weekday}
                              type="button"
                              className="weekday"
                              data-on={schedule.weekdays.includes(
                                index,
                              )}
                              onClick={() =>
                                changeSchedule({
                                  weekdays: toggleWeekday(
                                    schedule.weekdays,
                                    index,
                                  ),
                                })
                              }
                            >
                              {weekday}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="info-field">
              <span>{repeats ? "Starts" : "Date"}</span>
              <div className="info-input">
                <input
                  type="date"
                  value={
                    repeats && schedule
                      ? schedule.startsOn
                      : (uncommittedTask.dueDate ?? "")
                  }
                  onChange={(event) =>
                    repeats && schedule
                      ? changeSchedule({
                          startsOn:
                            event.target.value || schedule.startsOn,
                        })
                      : setEdits({
                          ...edits,
                          dueDate: event.target.value || null,
                        })
                  }
                />
                {!repeats && uncommittedTask.dueDate && (
                  <button
                    type="button"
                    className="info-clear"
                    aria-label="Clear date"
                    onClick={() =>
                      setEdits({ ...edits, dueDate: null })
                    }
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <div className="info-field">
              <span>Time</span>
              <div className="info-input">
                <input
                  type="time"
                  value={uncommittedTask.dueTime?.slice(0, 5) ?? ""}
                  onChange={(event) =>
                    setEdits({
                      ...edits,
                      dueTime: event.target.value || null,
                    })
                  }
                />
                {uncommittedTask.dueTime && (
                  <button
                    type="button"
                    className="info-clear"
                    aria-label="Clear time"
                    onClick={() =>
                      setEdits({ ...edits, dueTime: null })
                    }
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </Section>

          <Section
            label="Subtasks"
            count={subtasks.length}
            open={openSections.includes("subtasks")}
            onToggle={() => toggleSection("subtasks")}
          >
            <div className="info-subtasks">
              {subtasks.map((subtask) => (
                <SheetSubtask
                  key={subtask.id}
                  subtask={subtask}
                  onCommit={(changes) =>
                    "state" in changes
                      ? toggleSubtask.mutate(subtask)
                      : renameSubtask.mutate({
                          subtask: subtask,
                          title: changes.title ?? subtask.title,
                        })
                  }
                  onDelete={() => deleteSubtask.mutate(subtask)}
                />
              ))}
              <SheetSubtask
                blank={true}
                subtask={{
                  ...(task.subtasks?.[0] ?? task),
                  id: null,
                  parentId: taskId,
                  title: "",
                  note: null,
                  state: "to_do",
                  tags: [],
                  who: null,
                  dueDate: null,
                  dueTime: null,
                  stage: null,
                  schedule: null,
                  subtasks: [],
                }}
                onCommit={(changes) =>
                  addSubtask.mutate(changes.title ?? "")
                }
                onDelete={() => {}}
              />
            </div>
          </Section>

          <Section
            label="Notes"
            count={task.note ? 1 : 0}
            open={openSections.includes("note")}
            onToggle={() => toggleSection("note")}
          >
            <textarea
              ref={noteRef}
              rows={2}
              value={note}
              placeholder="Anything worth remembering"
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Tab") {
                  return;
                }
                event.preventDefault();
                const textarea = event.currentTarget;
                const indented = withIndentation({
                  textarea: textarea,
                  removing: event.shiftKey,
                });
                setNote(indented.text);
                requestAnimationFrame(() =>
                  textarea.setSelectionRange(
                    indented.selectionStart,
                    indented.selectionEnd,
                  ),
                );
              }}
              onBlur={() =>
                note !== (task.note ?? "") &&
                save.mutate({ note: note || null })
              }
            />
          </Section>

          <Section
            label="Comments"
            count={task.commentCount}
            open={commentsOpen}
            onToggle={() => toggleSection("comments")}
          >
            <div className="info-comments">
              {comments.map((entry) => (
                <div className="comment" key={entry.id}>
                  <div className="comment-who">
                    {entry.author} · {formatWhen(entry.createdAt)}
                    {entry.seenAt === null && (
                      <button
                        type="button"
                        className="comment-seen"
                        aria-label="Mark as seen"
                        onClick={() => seeComment.mutate(entry.id)}
                      >
                        <TickIcon />
                      </button>
                    )}
                  </div>
                  <div>{entry.body}</div>
                </div>
              ))}
              <form
                className="comment-entry"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (newComment.trim()) {
                    comment.mutate();
                  }
                }}
              >
                <textarea
                  value={newComment}
                  rows={2}
                  onChange={(event) =>
                    setNewComment(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      (event.metaKey || event.ctrlKey)
                    ) {
                      event.preventDefault();
                      event.stopPropagation();
                      if (newComment.trim()) {
                        comment.mutate();
                      }
                    }
                  }}
                  placeholder="Add a comment"
                />
                <button
                  type="submit"
                  className="comment-send"
                  aria-label="Add"
                  disabled={newComment.trim().length === 0}
                >
                  <SendIcon />
                </button>
              </form>
            </div>
          </Section>
        </div>
      </div>
    </>
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
      <button
        type="button"
        className="info-section-head"
        onClick={onToggle}
      >
        <span>{label}</span>
        {count > 0 && <span className="info-count">{count}</span>}
        <Chevron open={open} />
      </button>
      <div className="collapsible" data-open={open}>
        <div>
          <div className="info-section-body">{children}</div>
        </div>
      </div>
    </div>
  );
}

function fromTheHandle(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(".info-handle") !== null
  );
}

function handlesItsOwnScrolling(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("textarea, .info-comments, .info-subtasks") !==
      null
  );
}

function useDragDown({
  scroller,
  onRelease,
}: {
  scroller: React.RefObject<HTMLDivElement | null>;
  onRelease: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const startY = useRef<number | null>(null);
  const distance = useRef(0);
  const pulling = useRef(false);

  useEffect(() => {
    const node = scroller.current;
    if (!node) {
      return;
    }
    function holdTheScroll(event: TouchEvent): void {
      if (pulling.current) {
        event.preventDefault();
      }
    }
    node.addEventListener("touchmove", holdTheScroll, {
      passive: false,
    });
    return () => node.removeEventListener("touchmove", holdTheScroll);
  }, [scroller]);

  return {
    offset: offset,
    dragging: startY.current !== null,
    slideOut: () => setOffset(window.innerHeight),
    start: (event: React.PointerEvent) => {
      if (handlesItsOwnScrolling(event.target)) {
        startY.current = null;
        return;
      }
      startY.current = event.clientY;
      distance.current = 0;
      pulling.current = fromTheHandle(event.target);
    },
    move: (event: React.PointerEvent) => {
      if (startY.current === null) {
        return;
      }

      if (!pulling.current) {
        const atTop = (scroller.current?.scrollTop ?? 0) <= 0;
        if (!atTop || event.clientY - startY.current <= 4) {
          return;
        }
        pulling.current = true;
        startY.current = event.clientY;
      }

      const travelled = event.clientY - startY.current;
      if (travelled <= 0) {
        distance.current = 0;
        setOffset(0);
        return;
      }
      distance.current = travelled;
      setOffset(travelled);
    },
    end: () => {
      if (startY.current === null) {
        return;
      }
      const travelled = distance.current;
      startY.current = null;
      distance.current = 0;
      pulling.current = false;
      if (travelled >= DRAG_TO_CLOSE) {
        onRelease();
      } else {
        setOffset(0);
      }
    },
  };
}

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

function SheetSubtask({
  subtask,
  onCommit,
  onDelete,
  blank = false,
}: {
  subtask: Task;
  onCommit: (changes: Partial<Task>) => void;
  onDelete: () => void;
  blank?: boolean;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <TaskRow
      task={subtask}
      isEditing={blank || editing}
      onEditingChange={setEditing}
      onCommit={onCommit}
      swipeLeft={
        blank ? undefined : { name: "Delete", action: onDelete }
      }
      showAttributes={false}
    />
  );
}
