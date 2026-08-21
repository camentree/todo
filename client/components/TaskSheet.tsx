import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Chevron } from "./TaskBoard.tsx";
import { api, type RecurringTaskDetail } from "../api.ts";
import { formatWhen } from "../format.ts";
import { useLockedScroll } from "../useLockedScroll.ts";
import { stageLabel, TASK_STAGES } from "@shared/stages.ts";
import type { TaskStage } from "@shared/stages.ts";
import type { Frequency, Task } from "@shared/types.ts";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toggleWeekday(weekdays: number[], index: number): number[] {
  const next = weekdays.includes(index)
    ? weekdays.filter((weekday) => weekday !== index)
    : [...weekdays, index];
  return next.length > 0 ? next.sort() : weekdays;
}

const CLOSE_MILLISECONDS = 850;
const DRAG_TO_CLOSE = 110;

export function TaskSheet({
  taskId,
  onClose,
}: {
  taskId: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [newTag, setNewTag] = useState("");
  const [everyDraft, setEveryDraft] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [closing, setClosing] = useState(false);
  const [pendingRepeats, setPendingRepeats] = useState<
    boolean | null
  >(null);
  const [openSection, setOpenSection] = useState<
    "none" | "subtasks" | "note" | "comments"
  >("none");

  const bodyRef = useRef<HTMLDivElement>(null);
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
  const { data: schedule } = useQuery({
    queryKey: ["recurring", task?.recurringTaskId],
    queryFn: () => api.recurringTask(task?.recurringTaskId ?? 0),
    enabled: Boolean(task?.recurringTaskId),
  });
  const { data: comments = [] } = useQuery({
    queryKey: ["comments", taskId],
    queryFn: () => api.comments(taskId),
    enabled: openSection === "comments",
  });
  const { data: knownTags = [] } = useQuery({
    queryKey: ["tags", task?.list],
    queryFn: () => api.tags(task?.list),
    enabled: Boolean(task?.list),
  });

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNote(task.note ?? "");
    }
  }, [task]);

  const savedRepeats = Boolean(schedule && !schedule.paused);

  useEffect(() => {
    if (pendingRepeats === savedRepeats) {
      setPendingRepeats(null);
    }
  }, [pendingRepeats, savedRepeats]);

  const unseenComments = task?.unseenCommentCount ?? 0;

  useEffect(() => {
    if (openSection === "comments" && unseenComments > 0) {
      api
        .markCommentsSeen(taskId)
        .then(() => queryClient.invalidateQueries());
    }
  }, [openSection, unseenComments, taskId, queryClient]);

  useLockedScroll();

  const refresh = () => queryClient.invalidateQueries();

  const save = useMutation({
    mutationFn: (changes: Record<string, unknown>) =>
      api.updateTask(taskId, changes),
    onSuccess: refresh,
  });
  const addSubtask = useMutation({
    mutationFn: () =>
      api.createTask({
        list: task?.list ?? "",
        parentId: taskId,
        title: newSubtask,
      }),
    onSuccess: () => {
      setNewSubtask("");
      refresh();
    },
  });
  const toggleSubtask = useMutation({
    mutationFn: (subtask: Task) =>
      api.setState(
        subtask.id,
        subtask.state === "complete" ? "to_do" : "complete",
      ),
    onSuccess: refresh,
  });
  const comment = useMutation({
    mutationFn: () => api.addComment(taskId, newComment),
    onSuccess: () => {
      setNewComment("");
      refresh();
    },
  });
  const startRepeating = useMutation({
    mutationFn: async (): Promise<void> => {
      if (task?.recurringTaskId) {
        await api.pauseRecurring(task.recurringTaskId, false);
        return;
      }
      await api.repeatTask(taskId, "daily");
    },
    onSuccess: refresh,
  });
  const configureSchedule = useMutation({
    mutationFn: (changes: {
      frequency?: Frequency;
      repeatEvery?: number;
      weekdays?: number[];
      startsOn?: string;
      dueTime?: string | null;
    }) => api.configureRecurring(task?.recurringTaskId ?? 0, changes),
    onMutate: (changes) => {
      queryClient.setQueryData(
        ["recurring", task?.recurringTaskId],
        (cached: RecurringTaskDetail | undefined) =>
          cached ? { ...cached, ...changes } : cached,
      );
    },
    onSuccess: refresh,
  });
  const stopRepeating = useMutation({
    mutationFn: () =>
      api.pauseRecurring(task?.recurringTaskId ?? 0, true),
    onSuccess: refresh,
  });
  const setStage = useMutation({
    mutationFn: (stage: TaskStage | null) =>
      api.updateTask(taskId, { stage: stage }),
    onSuccess: refresh,
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Enter" && event.metaKey) {
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
      if (
        active instanceof HTMLElement &&
        active.closest("input, textarea")
      ) {
        active.blur();
        return;
      }
      closeSlowly();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function closeSlowly(): void {
    drag.slideOut();
    if (task && title !== task.title) {
      save.mutate({ title: title });
    }
    if (task && note !== (task.note ?? "")) {
      save.mutate({ note: note || null });
    }
    setClosing(true);
    setTimeout(onClose, CLOSE_MILLISECONDS);
  }

  if (!task) {
    return null;
  }

  const subtasks = task.subtasks ?? [];
  const repeats = pendingRepeats ?? savedRepeats;

  return (
    <>
      <div
        className="scrim"
        data-closing={closing}
        onClick={closeSlowly}
      />
      <div
        className="sheet"
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
        <div className="sheet-handle">
          <div className="sheet-grabber" />
        </div>

        <button
          type="button"
          className="sheet-close"
          aria-label="Close"
          onClick={closeSlowly}
        >
          <CloseIcon />
        </button>
        <div className="sheet-body" ref={bodyRef}>
          <input
            className="sheet-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() =>
              title !== task.title && save.mutate({ title: title })
            }
            aria-label="Title"
          />

          <label className="sheet-field">
            <span>List</span>
            <input
              list="known-lists"
              defaultValue={task.list}
              onBlur={(event) => {
                const next = event.target.value.trim();
                if (next && next !== task.list) {
                  save.mutate({ list: next });
                }
              }}
            />
            <datalist id="known-lists">
              {lists.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>

          <label className="sheet-field">
            <span>Stage</span>
            <select
              value={task.stage ?? ""}
              onChange={(event) =>
                setStage.mutate(
                  (event.target.value || null) as TaskStage | null,
                )
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

          <div className="sheet-field">
            <span>Tags</span>
            <div className="sheet-tags">
              {task.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="tag-chip"
                  aria-label={`Remove ${tag}`}
                  onClick={() =>
                    save.mutate({
                      tags: task.tags.filter(
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
                  const tag = newTag
                    .trim()
                    .replace(/^#/, "")
                    .toLowerCase();
                  if (tag && !task.tags.includes(tag)) {
                    save.mutate({ tags: [...task.tags, tag] });
                  }
                  setNewTag("");
                }}
              />
              <datalist id="known-tags">
                {knownTags
                  .filter((tag) => !task.tags.includes(tag))
                  .map((tag) => (
                    <option key={tag} value={tag} />
                  ))}
              </datalist>
            </div>
          </div>

          <label className="sheet-check">
            <input
              type="checkbox"
              checked={repeats}
              onChange={(event) => {
                setPendingRepeats(event.target.checked);
                if (event.target.checked) {
                  startRepeating.mutate();
                } else {
                  stopRepeating.mutate();
                }
              }}
            />
            <span>Repeats</span>
          </label>

          <div
            className="collapsible unhurried"
            data-open={repeats && Boolean(schedule)}
          >
            <div className="sheet-repeat">
              {schedule && (
                <>
                  <div className="sheet-every">
                    <label className="sheet-field">
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
                            configureSchedule.mutate({
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
                    <label className="sheet-field">
                      <span>Period</span>
                      <select
                        value={schedule.frequency}
                        onChange={(event) =>
                          configureSchedule.mutate({
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
                    <div className="sheet-field">
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
                              configureSchedule.mutate({
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

          <label className="sheet-field">
            <span>{repeats ? "Starts" : "Date"}</span>
            <input
              type="date"
              value={
                repeats && schedule
                  ? schedule.startsOn
                  : (task.dueDate ?? "")
              }
              onChange={(event) =>
                repeats && schedule
                  ? configureSchedule.mutate({
                      startsOn:
                        event.target.value || schedule.startsOn,
                    })
                  : save.mutate({
                      dueDate: event.target.value || null,
                    })
              }
            />
          </label>

          <label className="sheet-field">
            <span>Time</span>
            <input
              type="time"
              value={task.dueTime?.slice(0, 5) ?? ""}
              onChange={(event) =>
                repeats && schedule
                  ? configureSchedule.mutate({
                      dueTime: event.target.value || null,
                    })
                  : save.mutate({
                      dueTime: event.target.value || null,
                    })
              }
            />
          </label>

          <Section
            label="Subtasks"
            count={subtasks.length}
            open={openSection === "subtasks"}
            onToggle={() =>
              setOpenSection(
                openSection === "subtasks" ? "none" : "subtasks",
              )
            }
          >
            <div className="sheet-subtasks">
              {subtasks.map((subtask) => (
                <button
                  type="button"
                  key={subtask.id}
                  className="sheet-subtask"
                  data-done={subtask.state === "complete"}
                  onClick={() => toggleSubtask.mutate(subtask)}
                >
                  <span className="subtask-tick" />
                  <span>{subtask.title}</span>
                </button>
              ))}
              <form
                className="sheet-subtask"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (newSubtask.trim()) {
                    addSubtask.mutate();
                  }
                }}
              >
                <span className="subtask-tick" />
                <input
                  className="subtask-title"
                  value={newSubtask}
                  onChange={(event) =>
                    setNewSubtask(event.target.value)
                  }
                  placeholder="Add subtask"
                  aria-label="Add subtask"
                  enterKeyHint="done"
                />
              </form>
            </div>
          </Section>

          <Section
            label="Notes"
            count={task.note ? 1 : 0}
            open={openSection === "note"}
            onToggle={() =>
              setOpenSection(openSection === "note" ? "none" : "note")
            }
          >
            <textarea
              rows={4}
              value={note}
              placeholder="Anything worth remembering"
              onChange={(event) => setNote(event.target.value)}
              onBlur={() =>
                note !== (task.note ?? "") &&
                save.mutate({ note: note || null })
              }
            />
          </Section>

          <Section
            label="Comments"
            count={task.commentCount}
            open={openSection === "comments"}
            onToggle={() =>
              setOpenSection(
                openSection === "comments" ? "none" : "comments",
              )
            }
          >
            <div className="sheet-comments">
              {comments.map((entry) => (
                <div className="comment" key={entry.id}>
                  <div className="comment-who">
                    {entry.author} · {formatWhen(entry.createdAt)}
                  </div>
                  <div>{entry.body}</div>
                </div>
              ))}
              <form
                className="sheet-add"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (newComment.trim()) {
                    comment.mutate();
                  }
                }}
              >
                <input
                  value={newComment}
                  onChange={(event) =>
                    setNewComment(event.target.value)
                  }
                  placeholder="Add a comment"
                />
                <button
                  type="submit"
                  className="sheet-plus"
                  aria-label="Add"
                >
                  +
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
    <div className="sheet-section">
      <button
        type="button"
        className="sheet-section-head"
        onClick={onToggle}
      >
        <span>{label}</span>
        {count > 0 && <span className="sheet-count">{count}</span>}
        <Chevron open={open} />
      </button>
      <div className="collapsible" data-open={open}>
        <div>
          <div className="sheet-section-body">{children}</div>
        </div>
      </div>
    </div>
  );
}

function fromTheHandle(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(".sheet-handle") !== null
  );
}

function handlesItsOwnScrolling(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("textarea, .sheet-comments, .subtasks") !== null
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

function CloseIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 5l10 10M15 5L5 15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
