import { everyLabel, parseTask, serializeTask } from "@shared/grammar.ts";
import type { Task } from "@shared/model.ts";

const today = "2026-09-15";

describe("parseTask", () => {
  it("reads a definition with timer and count parts, a note, rest and group", () => {
    const parsed = parseTask({ text: "Morning stretch /exercise #every mo,we,fr #rest 30s\n  Keep hips level.\n- neck rolls #timer 30s\n- cat cow #count 10\n  breathe out", today });
    expect(parsed).toMatchObject({ name: "Morning stretch", group: "exercise", every: "mo,we,fr", rest: 30, kind: "boolean", note: "Keep hips level.", date: null });
    expect(parsed?.parts).toEqual([
      { name: "neck rolls", kind: "timer", target: 0, timer: 30, note: "", current: null, value: null, done: null },
      { name: "cat cow", kind: "count", target: 10, timer: 0, note: "breathe out", current: null, value: null, done: null },
    ]);
  });

  it("defaults to a boolean backlog one-off with no group", () => {
    expect(parseTask({ text: "Call mum", today })).toMatchObject({ name: "Call mum", kind: "boolean", group: null, every: null, date: null, time: null, parts: [] });
  });

  it("reads dates and times", () => {
    expect(parseTask({ text: "Return the books fri", today })?.date).toBe("2026-09-18");
    expect(parseTask({ text: "Return the books tue", today })?.date).toBe("2026-09-22");
    expect(parseTask({ text: "Dentist tomorrow 3pm", today })).toMatchObject({ name: "Dentist", date: "2026-09-16", time: "15:00" });
    expect(parseTask({ text: "Dinner sep 20 7:30pm", today })).toMatchObject({ name: "Dinner", date: "2026-09-20", time: "19:30" });
    expect(parseTask({ text: "Flight 2026-10-02 09:15", today })).toMatchObject({ name: "Flight", date: "2026-10-02", time: "09:15" });
    expect(parseTask({ text: "Party jan 3", today })?.date).toBe("2027-01-03");
  });

  it("repeats a part with a multiplier", () => {
    const parsed = parseTask({ text: "Hangboard /exercise #rest 60s\n- Hang #timer 30s ×3", today });
    expect(parsed?.parts.map((part) => part.name)).toEqual(["Hang 1", "Hang 2", "Hang 3"]);
    expect(parsed?.parts[2]).toMatchObject({ kind: "timer", timer: 30 });
  });

  it("reads a bare #every as daily and #count without a number as one", () => {
    expect(parseTask({ text: "Read #every", today })?.every).toBe("1d");
    expect(parseTask({ text: "Steps #count", today })).toMatchObject({ kind: "count", target: 1 });
  });

  it("reads current state after =", () => {
    expect(parseTask({ text: "Meditate #timer 10m = 4m", today })?.current).toBe(240);
    expect(parseTask({ text: "Read = done", today })?.done).toBe(true);
    expect(parseTask({ text: "Reflect #text = went well today", today })?.value).toBe("went well today");
    expect(parseTask({ text: "Water #count 8 = 3", today })?.current).toBe(3);
  });

  it("returns null for an empty first line", () => {
    expect(parseTask({ text: "\nsomething", today })).toBeNull();
    expect(parseTask({ text: "/exercise", today })).toBeNull();
  });
});

const task: Task = {
  id: "t",
  definitionId: null,
  date: "2026-09-15",
  time: "15:00",
  name: "Morning stretch",
  group: "exercise",
  kind: "boolean",
  target: 0,
  timer: 0,
  rest: 30,
  current: 0,
  value: "",
  doneAt: null,
  note: "Keep hips level.",
  parts: [
    { name: "neck rolls", kind: "timer", target: 0, timer: 30, note: "", current: 30, value: "", doneAt: "2026-09-15T07:31:00" },
    { name: "cat cow", kind: "count", target: 10, timer: 0, note: "breathe out", current: 4, value: "", doneAt: null },
    { name: "plank", kind: "timer", target: 0, timer: 45, note: "", current: 0, value: "", doneAt: null },
  ],
  sort: 0,
  created: "2026-09-15T07:00:00",
};

describe("serializeTask", () => {
  it("round-trips a task with progress", () => {
    const text = serializeTask({ task, every: null, today });
    expect(text).toBe("Morning stretch /exercise #rest 30s today 3pm\n  Keep hips level.\n- neck rolls #timer 30s = done\n- cat cow #count 10 = 4\n  breathe out\n- plank #timer 45s");
    const parsed = parseTask({ text, today });
    expect(parsed).toMatchObject({ name: "Morning stretch", group: "exercise", rest: 30, date: today, time: "15:00", note: "Keep hips level." });
    expect(parsed?.parts.map((part) => [part.done, part.current])).toEqual([[true, null], [null, 4], [null, null]]);
  });

  it("writes a definition instance without a date and a plain done one-off with its state", () => {
    expect(serializeTask({ task: { ...task, parts: [], note: "", time: null, doneAt: "2026-09-15T08:00:00", definitionId: "d" }, every: "1d", today })).toBe("Morning stretch /exercise #every 1d #rest 30s = done");
    expect(serializeTask({ task: { ...task, parts: [], note: "", rest: 0, time: null, date: "2026-09-16", kind: "count", target: 8, current: 3 }, every: null, today })).toBe("Morning stretch /exercise #count 8 tomorrow = 3");
    expect(serializeTask({ task: { ...task, parts: [], note: "", rest: 0, time: null, date: null, kind: "timer", timer: 600 }, every: null, today })).toBe("Morning stretch /exercise #timer 10m");
  });
});

describe("everyLabel", () => {
  it("names intervals and day lists", () => {
    expect(everyLabel("1d")).toBe("every day");
    expect(everyLabel("2d")).toBe("every 2 days");
    expect(everyLabel("mo,we,fr")).toBe("mo, we, fr");
    expect(everyLabel(null)).toBe("");
  });
});
