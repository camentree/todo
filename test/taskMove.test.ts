import type { Schedule } from "@app/models/schedule.ts";
import type { Task } from "@app/models/task.ts";
import { changedOnly, placed, regrouped, subtaskAsTask, taskAsSubtasks, withSubtaskAdded, withSubtasksInserted, withoutSubtask } from "@app/models/task.ts";
import { parseTask } from "@app/models/taskSyntax.ts";

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
    deletedAt: null,
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

  it("keeps the group and clears the date when dropped into an ungrouped Backlog", () => {
    const intoBacklog = placed({ rows: [], moving: [task("a", { group: "garden" })], target: { kind: "top", container: "backlog", group: null, index: 0 }, today });
    expect(intoBacklog[0]).toMatchObject({ id: "a", group: "garden", dueDate: null });
    const dated = placed({ rows: [], moving: [task("d", { group: "", dueDate: "2026-09-20" })], target: { kind: "top", container: "backlog", group: null, index: 0 }, today });
    expect(dated[0]).toMatchObject({ id: "d", group: "", dueDate: null });
  });

  it("takes the group it lands in when Backlog is grouped by list", () => {
    const intoGroup = placed({ rows: [], moving: [task("a", { group: "garden", dueDate: today })], target: { kind: "top", container: "backlog", group: "personal", index: 0 }, today });
    expect(intoGroup[0]).toMatchObject({ id: "a", group: "personal", dueDate: null });
  });

  it("keeps each row's group when dropped on an ungrouped Today", () => {
    const onToday = placed({ rows: [], moving: [task("a", { group: "garden" })], target: { kind: "top", container: "today", group: null, index: 0 }, today });
    expect(onToday[0]).toMatchObject({ id: "a", group: "garden", dueDate: today });
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

  it("adds a captured subtask at the end with the host's group and the parsed type", () => {
    const host = task("h", { group: "exercise", subtasks: [task("one", { parentId: "h", group: "exercise" })] });
    const parsed = parseTask({ text: "push ups #count 10", today, subtasks: false });
    const added = withSubtaskAdded({ host, parsed: parsed!, now: "2026-09-15T08:00:00", newId: () => "new" });
    expect(added.subtasks.map((subtask) => subtask.id)).toEqual(["one", "new"]);
    expect(added.subtasks[1]).toMatchObject({ title: "push ups", parentId: "h", group: "exercise", type: "count", target: 10, numericalValue: 0, sortOrder: 1 });
  });
});
