import { advance, afterFinish, buildQueue, goBack, startRunner } from "@shared/runner.ts";
import { derive } from "@shared/tasks.ts";
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
  group: "exercise",
  note: "",
  value: "",
  doneManual: null,
  tapIncrement: false,
  definitionId: null,
  auto: null,
  ...overrides,
});

const tasks = derive({
  tasks: [
    task("hang", { type: "numeric", kind: "count", target: 3, rest: 60 }),
    task("h1", { parent: "hang", type: "numeric", kind: "timer", target: 30, rest: 60, current: 30 }),
    task("h2", { parent: "hang", type: "numeric", kind: "timer", target: 30, rest: 60 }),
    task("h3", { parent: "hang", type: "numeric", kind: "timer", target: 30, rest: 60 }),
    task("pull", { type: "numeric", kind: "count", target: 5 }),
  ],
  entries: [],
  date: "2026-09-13",
});
const find = (id: string) => tasks.find((each) => each.id === id)!;
const tops = tasks.filter((each) => !each.parent);

describe("buildQueue", () => {
  it("expands parents into their parts", () => {
    expect(buildQueue({ tasks, ids: ["hang", "pull"] })).toEqual(["h1", "h2", "h3", "pull"]);
  });
});

describe("startRunner", () => {
  it("starts a task at its first unfinished part", () => {
    const state = startRunner({ tasks, tapped: find("hang"), scope: "task", groupTops: tops, label: "Hangboard" });
    expect(state).toMatchObject({ queue: ["h1", "h2", "h3"], index: 1, phase: "task" });
  });

  it("starts on the tapped part", () => {
    const state = startRunner({ tasks, tapped: find("h3"), scope: "task", groupTops: tops, label: "Hangboard" });
    expect(state?.index).toBe(2);
  });

  it("opens the group done screen when everything is done", () => {
    const done = derive({ tasks: tasks.map((each) => ({ ...each, doneManual: true })), entries: [], date: "2026-09-13" });
    const state = startRunner({ tasks: done, tapped: done[0]!, scope: "group", groupTops: done.filter((each) => !each.parent), label: "Exercise" });
    expect(state).toMatchObject({ phase: "end", index: 4 });
  });
});

describe("afterFinish", () => {
  const base = startRunner({ tasks, tapped: find("hang"), scope: "group", groupTops: tops, label: "Exercise" })!;

  it("rests between sibling parts", () => {
    expect(afterFinish({ state: { ...base, index: 1 }, tasks, finished: find("h2") })).toMatchObject({ phase: "rest", rest: 60, running: true });
  });

  it("shows the task summary after the last part", () => {
    expect(afterFinish({ state: { ...base, index: 2 }, tasks, finished: find("h3") })).toMatchObject({ phase: "taskEnd", endTask: "hang" });
  });

  it("stays on a finished top-level task", () => {
    expect(afterFinish({ state: { ...base, index: 3 }, tasks, finished: find("pull") })).toMatchObject({ phase: "task", index: 3, running: false });
  });
});

describe("advance and goBack", () => {
  const base = startRunner({ tasks, tapped: find("hang"), scope: "group", groupTops: tops, label: "Exercise" })!;

  it("auto-starts the next timer after a rest", () => {
    expect(advance({ state: { ...base, index: 1, phase: "rest" }, tasks, fromRest: true, autoStartTimers: true })).toMatchObject({ index: 2, phase: "task", running: true });
    expect(advance({ state: { ...base, index: 1, phase: "rest" }, tasks, fromRest: true, autoStartTimers: false })).toMatchObject({ running: false });
  });

  it("ends a group and exits a single task", () => {
    expect(advance({ state: { ...base, index: 3 }, tasks, fromRest: false, autoStartTimers: true })).toMatchObject({ phase: "end", index: 4 });
    expect(advance({ state: { ...base, scope: "task", queue: ["pull"], index: 0 }, tasks, fromRest: false, autoStartTimers: true })).toBeNull();
  });

  it("goes back from rest to the same part and from the end to the last part", () => {
    expect(goBack({ ...base, index: 1, phase: "rest" })).toMatchObject({ index: 1, phase: "task" });
    expect(goBack({ ...base, index: 4, phase: "end" })).toMatchObject({ index: 3, phase: "task" });
    expect(goBack({ ...base, index: 0 })).toMatchObject({ index: 0 });
  });
});
