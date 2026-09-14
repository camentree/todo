import { derive, metaText, toggled } from "@shared/tasks.ts";
import type { Task } from "@shared/types.ts";

const task = (id: string, overrides: Partial<Task>): Task => ({
  id,
  name: id,
  type: "boolean",
  kind: "bool",
  target: 1,
  current: 0,
  unit: "",
  rest: 0,
  parent: null,
  group: "habits",
  note: "",
  value: "",
  doneManual: null,
  tapIncrement: false,
  definitionId: null,
  auto: null,
  ...overrides,
});

const date = "2026-09-13";

describe("derive", () => {
  it("derives done for each kind", () => {
    const derived = derive({
      tasks: [
        task("timer", { type: "numeric", kind: "timer", target: 30, current: 30 }),
        task("count", { type: "numeric", kind: "count", target: 5, current: 2 }),
        task("text", { type: "text", kind: "text", value: "yes" }),
        task("bool", {}),
        task("manual", { doneManual: true }),
        task("journal", { auto: "journal" }),
      ],
      entries: [{ id: "e", at: date + "T07:42:00.000Z", notebook: "daily", taskId: null, text: "hi" }],
      date,
    });
    expect(derived.map((each) => each.done)).toEqual([true, false, true, false, true, true]);
  });

  it("gives a parent its children's progress", () => {
    const derived = derive({
      tasks: [
        task("parent", { type: "numeric", kind: "count", target: 3 }),
        task("a", { parent: "parent", type: "numeric", kind: "timer", target: 30, current: 30 }),
        task("b", { parent: "parent", type: "numeric", kind: "timer", target: 30 }),
      ],
      entries: [],
      date,
    });
    expect(derived[0]).toMatchObject({ current: 1, target: 2, done: false });
  });
});

describe("toggled", () => {
  it("fills a numeric to target and resets it back", () => {
    const derived = derive({ tasks: [task("count", { type: "numeric", kind: "count", target: 5, current: 2 })], entries: [], date });
    const filled = derive({ tasks: toggled({ tasks: derived, task: derived[0]! }), entries: [], date });
    expect(filled[0]).toMatchObject({ current: 5, done: true });
    const reset = derive({ tasks: toggled({ tasks: filled, task: filled[0]! }), entries: [], date });
    expect(reset[0]).toMatchObject({ current: 0, done: false, doneManual: null });
  });

  it("toggles every part of a parent", () => {
    const derived = derive({
      tasks: [
        task("parent", { type: "numeric", kind: "count", target: 2 }),
        task("a", { parent: "parent", type: "numeric", kind: "timer", target: 30 }),
        task("b", { parent: "parent" }),
      ],
      entries: [],
      date,
    });
    const filled = derive({ tasks: toggled({ tasks: derived, task: derived[0]! }), entries: [], date });
    expect(filled.map((each) => each.done)).toEqual([true, true, true]);
    expect(filled[1]?.current).toBe(30);
    const reset = derive({ tasks: toggled({ tasks: filled, task: filled[0]! }), entries: [], date });
    expect(reset.map((each) => each.done)).toEqual([false, false, false]);
    expect(reset[1]?.current).toBe(0);
  });
});

describe("metaText", () => {
  it("shows target, partial progress and answers", () => {
    const derived = derive({
      tasks: [
        task("timer", { type: "numeric", kind: "timer", target: 1200 }),
        task("partial", { type: "numeric", kind: "timer", target: 1200, current: 180 }),
        task("water", { type: "numeric", kind: "amount", target: 2000, current: 1200, unit: "ml" }),
        task("open", { type: "numeric", kind: "count", target: 1, tapIncrement: true, current: 4 }),
        task("text", { type: "text", kind: "text", value: "slept well" }),
      ],
      entries: [],
      date,
    });
    expect(derived.map(metaText)).toEqual(["20 min", "3 min / 20 min", "1200 / 2000 ml", "4", "slept well"]);
  });
});
