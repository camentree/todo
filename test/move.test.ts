import type { Definition, Task } from "@shared/model.ts";
import { changedOnly, partAsTask, placed, regrouped, taskAsParts, withPartsInserted, withoutPart } from "@shared/move.ts";

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

  it("gives a Backlog row today's date and the group it lands in when dropped on Today", () => {
    const fromBacklog = task("x", { group: "garden" });
    const onToday = placed({ rows, moving: [fromBacklog], target: { kind: "top", container: "today", group: "personal", index: 1 }, today });
    expect(onToday[1]).toMatchObject({ id: "x", group: "personal", date: today, sort: 1 });
  });

  it("keeps the group and clears the date when dropped into Backlog", () => {
    const intoBacklog = placed({ rows: [], moving: [task("a", { group: "garden" })], target: { kind: "top", container: "backlog", group: "", index: 0 }, today });
    expect(intoBacklog[0]).toMatchObject({ id: "a", group: "garden", date: null });
    const dated = placed({ rows: [], moving: [task("d", { group: "", date: "2026-09-20" })], target: { kind: "top", container: "backlog", group: "", index: 0 }, today });
    expect(dated[0]).toMatchObject({ id: "d", group: "", date: null });
  });

  it("lands a bundle together in order", () => {
    const after = placed({ rows, moving: [rows[0]!, rows[1]!], target: { kind: "top", container: "today", group: "personal", index: 1 }, today });
    expect(after.map((each) => each.id)).toEqual(["c", "a", "b"]);
    expect(changedOnly({ before: rows, after }).map((each) => each.id)).toEqual(["c", "a", "b"]);
  });
});

describe("regrouped", () => {
  it("moves each definition once and leaves one-offs and same-group definitions alone", () => {
    const definition: Definition = { id: "d1", name: "Yoga", group: "exercise", kind: "timer", target: 0, timer: 1800, rest: 0, time: null, every: "1d", anchor: today, parts: [], note: "", sort: 0, created: today, ended: null };
    const other = { ...definition, id: "d2", group: "garden" };
    const moving = [task("a", { definitionId: "d1", date: today }), task("b", { definitionId: "d1", date: "2026-09-16" }), task("c", { definitionId: "d2" }), task("x", {})];
    expect(regrouped({ moving, definitions: [definition, other], group: "garden" })).toEqual([{ ...definition, group: "garden" }]);
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
