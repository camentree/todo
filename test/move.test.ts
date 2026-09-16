import type { Task } from "@shared/model.ts";
import { changedOnly, dateFor, partAsTask, placed, taskAsParts, withPartsInserted, withoutPart } from "@shared/move.ts";

const today = "2026-09-15";

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

describe("placed", () => {
  const rows = [task("a", { sort: 0, date: today }), task("b", { sort: 1, date: today }), task("c", { sort: 2, date: today })];

  it("drops a row at the line and renumbers the group", () => {
    const after = placed({ rows, moving: [rows[2]!], target: { kind: "top", container: "today", group: "personal", index: 0 }, today });
    expect(after.map((each) => [each.id, each.sort])).toEqual([["c", 0], ["a", 1], ["b", 2]]);
  });

  it("gives a Backlog row today's date when dropped on Today, and no date when dropped into Backlog", () => {
    const fromBacklog = task("x", { group: "garden" });
    const onToday = placed({ rows, moving: [fromBacklog], target: { kind: "top", container: "today", group: "personal", index: 1 }, today });
    expect(onToday[1]).toMatchObject({ id: "x", group: "personal", date: today, sort: 1 });
    const intoBacklog = placed({ rows: [], moving: [rows[0]!], target: { kind: "top", container: "backlog", group: "garden", index: 0 }, today });
    expect(intoBacklog[0]).toMatchObject({ id: "a", group: "garden", date: null });
    expect(dateFor({ container: "week", date: null, today })).toBe("2026-09-16");
    expect(dateFor({ container: "week", date: "2026-09-18", today })).toBe("2026-09-18");
  });

  it("lands a bundle together in order", () => {
    const after = placed({ rows, moving: [rows[0]!, rows[1]!], target: { kind: "top", container: "today", group: "personal", index: 1 }, today });
    expect(after.map((each) => each.id)).toEqual(["c", "a", "b"]);
    expect(changedOnly({ before: rows, after }).map((each) => each.id)).toEqual(["c", "a", "b"]);
  });
});

describe("parts", () => {
  it("turns a task into a part and back", () => {
    const host = task("h", { date: today, group: "exercise", sort: 3, parts: [{ name: "one", kind: "boolean", target: 0, timer: 0, note: "", current: 0, value: "", doneAt: null }] });
    const moving = task("m", { kind: "count", target: 5, current: 2, note: "n" });
    const nested = withPartsInserted({ host, parts: taskAsParts(moving), index: 0 });
    expect(nested.parts.map((part) => part.name)).toEqual(["m", "one"]);
    expect(nested.parts[0]).toMatchObject({ kind: "count", target: 5, current: 2, note: "n" });
    const out = partAsTask({ part: nested.parts[0]!, host: nested, id: "t", created: "2026-09-15T10:00:00" });
    expect(out).toMatchObject({ id: "t", name: "m", group: "exercise", date: today, kind: "count", target: 5, current: 2, parts: [] });
    expect(withoutPart({ host: nested, index: 0 }).parts.map((part) => part.name)).toEqual(["one"]);
  });
});
