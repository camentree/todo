import { dueToday, everyToken, scheduleFromParsed } from "@app/models/schedule.ts";
import type { Task } from "@app/models/task.ts";
import { taskFromParsed } from "@app/models/task.ts";
import { parseTask, serializeTask } from "@app/models/taskText.ts";

const today = "2026-09-15";
const now = "2026-09-15T10:00:00";

let counter = 0;
function newId(): string {
  counter += 1;
  return "sub" + counter;
}

function parse(text: string) {
  const parsed = parseTask({ text, today });
  if (!parsed) throw new Error("nothing parsed");
  return parsed;
}

describe("taskFromParsed", () => {
  it("makes an ungrouped backlog one-off by default", () => {
    const task = taskFromParsed({ parsed: parse("Call mum"), existing: null, id: "t1", today, now, schedule: null, newId });
    expect(task).toMatchObject({ id: "t1", title: "Call mum", group: "", dueDate: null, dueTime: null, scheduleId: null, type: "boolean", finalizedAt: null, parentId: null });
  });

  it("dates a one-off from the text", () => {
    const task = taskFromParsed({ parsed: parse("Dentist /personal fri 3pm"), existing: null, id: "t1", today, now, schedule: null, newId });
    expect(task).toMatchObject({ dueDate: "2026-09-18", dueTime: "15:00" });
  });

  it("keeps progress when the text has no value, and takes the value when it does", () => {
    const existing = taskFromParsed({ parsed: parse("Pull-ups #count 5 /exercise today"), existing: null, id: "t1", today, now, schedule: null, newId });
    const progressed: Task = { ...existing, numericalValue: 2 };
    const edited = taskFromParsed({ parsed: parse("Pull-ups #count 8 /exercise today"), existing: progressed, id: "t1", today, now, schedule: null, newId });
    expect(edited).toMatchObject({ id: "t1", target: 8, numericalValue: 2, dueDate: today });
    const overridden = taskFromParsed({ parsed: parse("Pull-ups #count 8 /exercise today = 7"), existing: progressed, id: "t1", today, now, schedule: null, newId });
    expect(overridden.numericalValue).toBe(7);
  });

  it("keeps subtask progress and identity by title when a subtask is removed", () => {
    const existing = taskFromParsed({ parsed: parse("Stretch /exercise\n- a #count 5\n- b #count 5\n- c #count 5"), existing: null, id: "t1", today, now, schedule: null, newId });
    const progressed: Task = { ...existing, subtasks: existing.subtasks.map((subtask) => ({ ...subtask, numericalValue: 3 })) };
    const edited = taskFromParsed({ parsed: parse("Stretch /exercise\n- b #count 5\n- c #count 5"), existing: progressed, id: "t1", today, now, schedule: null, newId });
    expect(edited.subtasks.map((subtask) => [subtask.title, subtask.numericalValue])).toEqual([["b", 3], ["c", 3]]);
    expect(edited.subtasks.map((subtask) => subtask.id)).toEqual(progressed.subtasks.slice(1).map((subtask) => subtask.id));
    expect(edited.subtasks.every((subtask) => subtask.parentId === "t1")).toBe(true);
    const added = taskFromParsed({ parsed: parse("Stretch /exercise\n- a #count 5\n- b #count 5\n- c #count 5\n- d #count 5"), existing: progressed, id: "t1", today, now, schedule: null, newId });
    expect(added.subtasks.map((subtask) => subtask.numericalValue)).toEqual([3, 3, 3, 0]);
  });

  it("round-trips through serializeTask without change", () => {
    const first = taskFromParsed({ parsed: parse("Morning stretch /exercise #rest 30s today\n  Keep hips level.\n- neck rolls #timer 30s\n- cat cow #count 10"), existing: null, id: "t1", today, now, schedule: null, newId });
    const progressed: Task = {
      ...first,
      subtasks: [
        { ...first.subtasks[0]!, numericalValue: 30, finalizedAt: now },
        { ...first.subtasks[1]!, numericalValue: 4 },
      ],
    };
    const text = serializeTask({ task: progressed, every: null, today });
    const again = taskFromParsed({ parsed: parse(text), existing: progressed, id: "t1", today, now, schedule: null, newId });
    expect(again).toEqual(progressed);
  });
});

describe("scheduleFromParsed", () => {
  it("creates a schedule starting today with subtasks and says whether it is due", () => {
    const parsed = parse("Hangboard /exercise #every 2d #rest 60s\n- Hang #timer 30s ×2");
    const schedule = scheduleFromParsed({ parsed, existing: null, id: "s1", today, now });
    expect(schedule).toMatchObject({ id: "s1", title: "Hangboard", group: "exercise", frequency: "daily", repeatEvery: 2, restSeconds: 60, startsOn: today, endedOn: null });
    expect(schedule.subtasks.map((subtask) => subtask.title)).toEqual(["Hang 1", "Hang 2"]);
    expect(dueToday({ schedule, today })).toBe(true);
    const saturdays = scheduleFromParsed({ parsed: parse("Long run #timer 1h #every sa"), existing: null, id: "s2", today, now });
    expect(saturdays).toMatchObject({ frequency: "weekly", weekdays: [5], type: "timer_seconds", target: 3600 });
    expect(dueToday({ schedule: saturdays, today })).toBe(false);
  });

  it("keeps the start of an existing schedule and its rule when the token is absent", () => {
    const existing = scheduleFromParsed({ parsed: parse("Read #every 1d /habits"), existing: null, id: "s1", today: "2026-09-01", now });
    const edited = scheduleFromParsed({ parsed: parse("Read more #every 2d /habits"), existing, id: "s1", today, now });
    expect(edited).toMatchObject({ title: "Read more", frequency: "daily", repeatEvery: 2, startsOn: "2026-09-01" });
  });
});

describe("everyToken", () => {
  it("round-trips the composer token through the structured rule", () => {
    for (const token of ["1d", "2d", "mo,we,fr", "2w mo", "1w", "3m"]) {
      const parsed = parse(`Task #every ${token}`);
      const schedule = scheduleFromParsed({ parsed, existing: null, id: "s", today, now });
      expect(everyToken(schedule)).toBe(token);
    }
  });
});
