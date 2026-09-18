import type { Schedule, Task } from "@shared/model.ts";
import { changedOnly, placed, regrouped, subtaskAsTask, taskAsSubtasks, withSubtasksInserted, withoutSubtask } from "@shared/move.ts";

const today = "2026-09-15";

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
    ...overrides,
  };
}

describe("placed", () => {
  const rows = [task("a", { sortOrder: 0, dueDate: today }), task("b", { sortOrder: 1, dueDate: today }), task("c", { sortOrder: 2, dueDate: today })];

  it("drops a row at the line and renumbers the group", () => {
    const after = placed({ rows, moving: [rows[2]!], target: { kind: "top", container: "today", group: "personal", index: 0 }, today });
    expect(after.map((each) => [each.id, each.sortOrder])).toEqual([["c", 0], ["a", 1], ["b", 2]]);
  });

  it("gives a Backlog row today's date and the group it lands in when dropped on Today", () => {
    const fromBacklog = task("x", { group: "garden" });
    const onToday = placed({ rows, moving: [fromBacklog], target: { kind: "top", container: "today", group: "personal", index: 1 }, today });
    expect(onToday[1]).toMatchObject({ id: "x", group: "personal", dueDate: today, sortOrder: 1 });
  });

  it("keeps the group and clears the date when dropped into Backlog", () => {
    const intoBacklog = placed({ rows: [], moving: [task("a", { group: "garden" })], target: { kind: "top", container: "backlog", group: "", index: 0 }, today });
    expect(intoBacklog[0]).toMatchObject({ id: "a", group: "garden", dueDate: null });
    const dated = placed({ rows: [], moving: [task("d", { group: "", dueDate: "2026-09-20" })], target: { kind: "top", container: "backlog", group: "", index: 0 }, today });
    expect(dated[0]).toMatchObject({ id: "d", group: "", dueDate: null });
  });

  it("lands a bundle together in order", () => {
    const after = placed({ rows, moving: [rows[0]!, rows[1]!], target: { kind: "top", container: "today", group: "personal", index: 1 }, today });
    expect(after.map((each) => each.id)).toEqual(["c", "a", "b"]);
    expect(changedOnly({ before: rows, after }).map((each) => each.id)).toEqual(["c", "a", "b"]);
  });
});

describe("regrouped", () => {
  it("moves each schedule once and leaves one-offs and same-group schedules alone", () => {
    const schedule: Schedule = {
      id: "s1",
      title: "Yoga",
      group: "exercise",
      type: "timer_seconds",
      target: 1800,
      restSeconds: null,
      subtasks: [],
      dueTime: null,
      frequency: "daily",
      repeatEvery: 1,
      weekdays: null,
      dayOfMonth: null,
      startsOn: today,
      endedOn: null,
      note: "",
      sortOrder: 0,
      createdAt: "2026-09-01T00:00:00+00:00",
    };
    const other = { ...schedule, id: "s2", group: "garden" };
    const moving = [task("a", { scheduleId: "s1", dueDate: today }), task("b", { scheduleId: "s1", dueDate: "2026-09-16" }), task("c", { scheduleId: "s2" }), task("x", {})];
    expect(regrouped({ moving, schedules: [schedule, other], group: "garden" })).toEqual([{ ...schedule, group: "garden" }]);
  });
});

describe("subtasks", () => {
  it("turns a task into a subtask and back", () => {
    const host = task("h", { dueDate: today, group: "exercise", sortOrder: 3, subtasks: [task("one", { parentId: "h", group: "exercise" })] });
    const moving = task("m", { type: "count", target: 5, numericalValue: 2, note: "n" });
    const nested = withSubtasksInserted({ host, subtasks: taskAsSubtasks(moving), index: 0 });
    expect(nested.subtasks.map((subtask) => [subtask.title, subtask.parentId, subtask.sortOrder])).toEqual([["m", "h", 0], ["one", "h", 1]]);
    expect(nested.subtasks[0]).toMatchObject({ id: "m", type: "count", target: 5, numericalValue: 2, note: "n", group: "exercise", dueDate: null });
    const out = subtaskAsTask({ subtask: nested.subtasks[0]!, host: nested });
    expect(out).toMatchObject({ id: "m", title: "m", group: "exercise", dueDate: today, parentId: null, type: "count", target: 5, numericalValue: 2, sortOrder: 3, subtasks: [] });
    expect(withoutSubtask({ host: nested, index: 0 }).subtasks.map((subtask) => [subtask.title, subtask.sortOrder])).toEqual([["one", 0]]);
  });
});
