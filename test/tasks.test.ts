import type { Task } from "@shared/model.ts";
import { grouped, isBacklog, isDone, isOnToday, isThisWeek, partToggled, toggled, whenHint } from "@shared/tasks.ts";

const today = "2026-09-15";
const now = "2026-09-15T10:00:00";

function task(id: string, overrides: Partial<Task>): Task {
  return {
    id,
    definitionId: null,
    date: null,
    time: null,
    name: id,
    group: "personal",
    kind: "boolean",
    target: 0,
    timer: 0,
    rest: 0,
    current: 0,
    value: "",
    doneAt: null,
    note: "",
    parts: [],
    sort: 0,
    created: "2026-09-01T00:00:00",
    ...overrides,
  };
}

describe("isDone", () => {
  it("derives done from the tick, the parts, the target, the text and the journal", () => {
    expect(isDone({ task: task("a", { doneAt: now }), entries: [] })).toBe(true);
    expect(isDone({ task: task("b", { kind: "count", target: 5, current: 5 }), entries: [] })).toBe(true);
    expect(isDone({ task: task("c", { kind: "count", target: 5, current: 2 }), entries: [] })).toBe(false);
    expect(isDone({ task: task("d", { kind: "text", value: "yes" }), entries: [] })).toBe(true);
    const parts = [
      { name: "x", kind: "boolean" as const, target: 0, timer: 0, note: "", current: 0, value: "", doneAt: now },
      { name: "y", kind: "timer" as const, target: 0, timer: 30, note: "", current: 30, value: "", doneAt: null },
    ];
    expect(isDone({ task: task("e", { parts }), entries: [] })).toBe(true);
    expect(isDone({ task: task("f", { parts: [parts[0]!, { ...parts[1]!, current: 3 }] }), entries: [] })).toBe(false);
    expect(isDone({ task: task("Journal", { date: today }), entries: [{ id: "j", at: today + "T07:00", tags: [], task: null, body: "" }] })).toBe(true);
    expect(isDone({ task: task("Journal", { date: today }), entries: [] })).toBe(false);
  });
});

describe("toggled", () => {
  it("completes every part with the parent and clears them again", () => {
    const parent = task("p", { parts: [{ name: "x", kind: "count", target: 5, timer: 0, note: "", current: 1, value: "", doneAt: null }] });
    const done = toggled({ task: parent, entries: [], now });
    expect(done.doneAt).toBe(now);
    expect(done.parts[0]).toMatchObject({ doneAt: now, current: 5 });
    const undone = toggled({ task: done, entries: [], now });
    expect(undone.doneAt).toBeNull();
    expect(undone.parts[0]).toMatchObject({ doneAt: null, current: 0 });
  });

  it("completes the parent when the last part is ticked", () => {
    const parent = task("p", {
      parts: [
        { name: "x", kind: "boolean", target: 0, timer: 0, note: "", current: 0, value: "", doneAt: now },
        { name: "y", kind: "boolean", target: 0, timer: 0, note: "", current: 0, value: "", doneAt: null },
      ],
    });
    const ticked = partToggled({ task: parent, index: 1, now });
    expect(isDone({ task: ticked, entries: [] })).toBe(true);
    const unticked = partToggled({ task: ticked, index: 0, now });
    expect(isDone({ task: unticked, entries: [] })).toBe(false);
  });
});

describe("placing rows", () => {
  const habitToday = task("h1", { definitionId: "d", date: today });
  const habitYesterday = task("h2", { definitionId: "d", date: "2026-09-14" });
  const overdue = task("o1", { date: "2026-09-12" });
  const overdueDone = task("o2", { date: "2026-09-12", doneAt: "2026-09-12T10:00:00" });
  const soon = task("o3", { date: "2026-09-18" });
  const later = task("o4", { date: "2026-09-22" });
  const backlog = task("b1", {});
  const backlogDoneToday = task("b2", { doneAt: now });
  const backlogDoneYesterday = task("b3", { doneAt: "2026-09-14T10:00:00" });
  const commented = task("b4", { name: "Refactor" });
  const comments = [{ id: "c", definitionId: null, taskName: "Refactor", body: "?", author: "claude", writtenAt: now, seenAt: null }];

  it("puts today's habits, overdue one-offs and unseen-comment tasks on Today", () => {
    const onToday = (each: Task) => isOnToday({ task: each, today, entries: [], comments });
    expect([habitToday, habitYesterday, overdue, overdueDone, soon, backlog, commented].map(onToday)).toEqual([true, false, true, false, false, false, true]);
  });

  it("puts the coming six days under This week", () => {
    expect([soon, later, habitToday].map((each) => isThisWeek({ task: each, today }))).toEqual([true, false, false]);
  });

  it("keeps undated one-offs in Backlog until the day after they are done", () => {
    const inBacklog = (each: Task) => isBacklog({ task: each, today, entries: [], comments });
    expect([backlog, backlogDoneToday, backlogDoneYesterday, commented, habitToday].map(inBacklog)).toEqual([true, true, false, false, false]);
  });

  it("orders groups habits, exercise, personal, then the rest alphabetically, rows by sort", () => {
    const rows = [
      task("z", { group: "programming", sort: 1 }),
      task("y", { group: "garden" }),
      task("x", { group: "personal", sort: 2 }),
      task("w", { group: "personal", sort: 1 }),
      task("v", { group: "exercise" }),
      task("u", { group: "habits" }),
    ];
    expect(grouped(rows).map((each) => [each.group, each.tasks.map((row) => row.id)])).toEqual([
      ["habits", ["u"]],
      ["exercise", ["v"]],
      ["personal", ["w", "x"]],
      ["garden", ["y"]],
      ["programming", ["z"]],
    ]);
  });

  it("says since when for overdue rows and the day for coming ones", () => {
    expect(whenHint({ task: overdue, today })).toBe("since saturday");
    expect(whenHint({ task: task("y", { date: "2026-09-14" }), today })).toBe("since yesterday");
    expect(whenHint({ task: { ...soon, time: "17:00" }, today })).toBe("friday 5pm");
    expect(whenHint({ task: later, today })).toBe("september 22");
    expect(whenHint({ task: task("t", { date: today, time: "15:00" }), today })).toBe("3pm");
  });
});
