import type { Task } from "@app/models/task.ts";
import { grouped, isBacklog, isDone, isOnToday, isRecentlyCompleted, isSkipped, kindHint, skipToggled, subtaskCount, subtaskToggled, toggled, whenHint } from "@app/models/task.ts";

const today = "2026-09-15";
const now = "2026-09-15T10:00:00";

function task(id: string, overrides: Partial<Task>): Task {
  return {
    id,
    parentId: null,
    scheduleId: null,
    dueDate: null,
    dueTime: null,
    title: id,
    group: "personal",
    type: "boolean",
    target: null,
    numericalValue: null,
    stringValue: null,
    restSeconds: null,
    finalizedAt: null,
    isSkipped: false,
    assignee: null,
    note: "",
    sortOrder: 0,
    subtasks: [],
    comments: [],
    createdAt: "2026-09-01T00:00:00+00:00",
    deletedAt: null,
    ...overrides,
  };
}

function subtask(id: string, overrides: Partial<Task>): Task {
  return task(id, { parentId: "host", ...overrides });
}

describe("isDone", () => {
  it("derives done from the tick, the subtasks, the target, the text and the journal", () => {
    expect(isDone({ task: task("a", { finalizedAt: now }), entries: [] })).toBe(true);
    expect(isDone({ task: task("b", { type: "count", target: 5, numericalValue: 5 }), entries: [] })).toBe(true);
    expect(isDone({ task: task("c", { type: "count", target: 5, numericalValue: 2 }), entries: [] })).toBe(false);
    expect(isDone({ task: task("d", { type: "text", stringValue: "yes" }), entries: [] })).toBe(true);
    const subtasks = [subtask("x", { finalizedAt: now }), subtask("y", { type: "timer_seconds", target: 30, numericalValue: 30 })];
    expect(isDone({ task: task("e", { subtasks }), entries: [] })).toBe(true);
    expect(isDone({ task: task("f", { subtasks: [subtasks[0]!, { ...subtasks[1]!, numericalValue: 3 }] }), entries: [] })).toBe(false);
    expect(isDone({ task: task("Journal", { dueDate: today }), entries: [{ sectionTitle: today + "T07:00:00", at: today + "T07:00:00", body: "", metadata: {} }] })).toBe(true);
    expect(isDone({ task: task("Journal", { dueDate: today }), entries: [] })).toBe(false);
  });

  it("treats amount like count", () => {
    expect(isDone({ task: task("a", { type: "amount", target: 500, numericalValue: 500 }), entries: [] })).toBe(true);
    expect(isDone({ task: task("b", { type: "amount", target: 500, numericalValue: 100 }), entries: [] })).toBe(false);
  });
});

describe("toggled", () => {
  it("completes every subtask with the parent and clears them again", () => {
    const parent = task("p", { subtasks: [subtask("x", { type: "count", target: 5, numericalValue: 1 })] });
    const done = toggled({ task: parent, entries: [], now });
    expect(done.finalizedAt).toBe(now);
    expect(done.subtasks[0]).toMatchObject({ finalizedAt: now, numericalValue: 5 });
    const undone = toggled({ task: done, entries: [], now });
    expect(undone.finalizedAt).toBeNull();
    expect(undone.subtasks[0]).toMatchObject({ finalizedAt: null, numericalValue: 0 });
  });

  it("completes the parent when the last subtask is ticked", () => {
    const parent = task("p", { subtasks: [subtask("x", { finalizedAt: now }), subtask("y", {})] });
    const ticked = subtaskToggled({ task: parent, index: 1, now });
    expect(isDone({ task: ticked, entries: [] })).toBe(true);
    const unticked = subtaskToggled({ task: ticked, index: 0, now });
    expect(isDone({ task: unticked, entries: [] })).toBe(false);
  });
});

describe("skipToggled", () => {
  it("marks a task skipped and back, and completing it clears the skip", () => {
    const skipped = skipToggled(task("a", { scheduleId: "s1", dueDate: today }));
    expect(isSkipped(skipped)).toBe(true);
    expect(isDone({ task: skipped, entries: [] })).toBe(false);
    expect(isSkipped(skipToggled(skipped))).toBe(false);
    const completed = toggled({ task: skipped, entries: [], now });
    expect(completed).toMatchObject({ finalizedAt: now, isSkipped: false });
  });
});

describe("subtaskCount", () => {
  it("counts only the subtasks still to do", () => {
    const subtasks = [subtask("x", { finalizedAt: now }), subtask("y", {}), subtask("z", { type: "count", target: 5, numericalValue: 2 })];
    expect(subtaskCount(task("a", { subtasks }))).toBe("2");
    expect(subtaskCount(task("b", { subtasks: subtasks.map((each) => ({ ...each, finalizedAt: now })) }))).toBe("");
    expect(subtaskCount(task("c", {}))).toBe("");
  });
});

describe("placing rows", () => {
  const habitToday = task("h1", { scheduleId: "d", dueDate: today });
  const habitYesterday = task("h2", { scheduleId: "d", dueDate: "2026-09-14" });
  const overdue = task("o1", { dueDate: "2026-09-12" });
  const overdueDone = task("o2", { dueDate: "2026-09-12", finalizedAt: "2026-09-12T10:00:00" });
  const soon = task("o3", { dueDate: "2026-09-18" });
  const later = task("o4", { dueDate: "2026-09-22" });
  const backlog = task("b1", {});
  const backlogDoneToday = task("b2", { finalizedAt: now });
  const backlogDoneYesterday = task("b3", { finalizedAt: "2026-09-14T10:00:00" });
  const commented = task("b4", {
    title: "Refactor",
    comments: [{ id: "c", taskId: "b4", body: "?", author: "claude", writtenAt: now, seenAt: null, createdAt: now }],
  });

  it("puts today's habits, overdue one-offs and unseen-comment tasks on Today", () => {
    const onToday = (each: Task) => isOnToday({ task: each, today, entries: [] });
    expect([habitToday, habitYesterday, overdue, overdueDone, soon, backlog, commented].map(onToday)).toEqual([true, false, true, false, false, false, true]);
  });

  it("puts every future date and every undated one-off in Backlog, until the day after they are done", () => {
    const inBacklog = (each: Task) => isBacklog({ task: each, today, entries: [] });
    expect([backlog, backlogDoneToday, backlogDoneYesterday, commented, habitToday].map(inBacklog)).toEqual([true, true, false, false, false]);
    expect([soon, later, habitYesterday, overdue].map(inBacklog)).toEqual([true, true, false, false]);
    expect(inBacklog(task("h3", { scheduleId: "d" }))).toBe(true);
  });

  it("counts a task as recently completed on the day it was finished, and not the morning after", () => {
    const recently = (finalizedAt: string) => isRecentlyCompleted({ task: task("b5", { finalizedAt }), today, entries: [] });
    expect(recently(now)).toBe(true);
    expect(["2026-09-14T10:00:00", "2026-09-13T10:00:00", "2026-09-01T10:00:00"].map(recently)).toEqual([false, false, false]);
  });

  it("leaves a task that is not done out of the recently completed list", () => {
    expect(isRecentlyCompleted({ task: backlog, today, entries: [] })).toBe(false);
    expect(isRecentlyCompleted({ task: task("b6", { finalizedAt: now, isSkipped: true }), today, entries: [] })).toBe(false);
  });

  it("orders groups habits, exercise, personal, then the rest alphabetically, ungrouped last, rows by sort order then creation", () => {
    const rows = [
      task("z", { group: "programming", sortOrder: 1 }),
      task("t", { group: "" }),
      task("y", { group: "garden" }),
      task("x", { group: "personal", sortOrder: 2 }),
      task("w", { group: "personal", sortOrder: 1 }),
      task("v", { group: "exercise" }),
      task("u", { group: "habits" }),
      task("s", { group: "personal", sortOrder: 1, createdAt: "2026-08-01T00:00:00+00:00" }),
    ];
    expect(grouped(rows).map((each) => [each.group, each.tasks.map((row) => row.id)])).toEqual([
      ["habits", ["u"]],
      ["exercise", ["v"]],
      ["personal", ["s", "w", "x"]],
      ["garden", ["y"]],
      ["programming", ["z"]],
      ["", ["t"]],
    ]);
  });

  it("closes the line with the date and the time, and drops the date when it is today", () => {
    expect(whenHint({ task: { ...soon, dueTime: "17:00" }, today })).toBe("friday, 5:00 pm");
    expect(whenHint({ task: later, today })).toBe("sep 22");
    expect(whenHint({ task: task("t", { dueDate: "2026-09-16", dueTime: "09:00" }), today })).toBe("tomorrow, 9:00 am");
    expect(whenHint({ task: task("t", { dueDate: today, dueTime: "15:00" }), today })).toBe("3:00 pm");
    expect(whenHint({ task: overdue, today })).toBe("saturday");
    expect(whenHint({ task: task("y", { dueDate: "2026-09-14", dueTime: "07:10" }), today })).toBe("yesterday, 7:10 am");
    expect(whenHint({ task: backlog, today })).toBe("");
  });

  it("writes a count target as its number alone", () => {
    expect(kindHint(task("c", { type: "count", target: 8 }))).toBe("8");
    expect(kindHint(task("c", { type: "count", target: 8, numericalValue: 3 }))).toBe("3 / 8");
    expect(kindHint(task("c", { type: "amount", target: 8, numericalValue: 3 }))).toBe("3 / 8");
    expect(kindHint(task("c", { type: "timer_seconds", target: 600 }))).toBe("10 min");
  });
});
