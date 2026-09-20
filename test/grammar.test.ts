import { everyLabel, parseTask, serializeTask, tokenSpans } from "@shared/grammar.ts";
import type { Task } from "@shared/model.ts";

const today = "2026-09-15";

describe("parseTask", () => {
  it("reads a definition with timer and count subtasks, a note, rest and group", () => {
    const parsed = parseTask({ text: "Morning stretch /exercise #every mo,we,fr #rest 30s\n  Keep hips level.\n- neck rolls #timer 30s\n- cat cow #count 10\n  breathe out", today });
    expect(parsed).toMatchObject({ title: "Morning stretch", group: "exercise", every: "mo,we,fr", restSeconds: 30, type: "boolean", note: "Keep hips level.", date: null });
    expect(parsed?.subtasks).toEqual([
      { title: "neck rolls", type: "timer_seconds", target: 30, note: "", current: null, value: null, done: null },
      { title: "cat cow", type: "count", target: 10, note: "breathe out", current: null, value: null, done: null },
    ]);
  });

  it("defaults to a boolean backlog one-off with no group", () => {
    expect(parseTask({ text: "Call mum", today })).toMatchObject({ title: "Call mum", type: "boolean", group: null, every: null, date: null, time: null, subtasks: [] });
  });

  it("reads dates and times", () => {
    expect(parseTask({ text: "Return the books fri", today })?.date).toBe("2026-09-18");
    expect(parseTask({ text: "Return the books tue", today })?.date).toBe("2026-09-22");
    expect(parseTask({ text: "Dentist tomorrow 3pm", today })).toMatchObject({ title: "Dentist", date: "2026-09-16", time: "15:00" });
    expect(parseTask({ text: "Dinner sep 20 7:30pm", today })).toMatchObject({ title: "Dinner", date: "2026-09-20", time: "19:30" });
    expect(parseTask({ text: "Flight 2026-10-02 09:15", today })).toMatchObject({ title: "Flight", date: "2026-10-02", time: "09:15" });
    expect(parseTask({ text: "Party jan 3", today })?.date).toBe("2027-01-03");
  });

  it("repeats a subtask with a multiplier", () => {
    const parsed = parseTask({ text: "Hangboard /exercise #rest 60s\n- Hang #timer 30s ×3", today });
    expect(parsed?.subtasks.map((subtask) => subtask.title)).toEqual(["Hang 1", "Hang 2", "Hang 3"]);
    expect(parsed?.subtasks[2]).toMatchObject({ type: "timer_seconds", target: 30 });
  });

  it("reads a bare #every as daily and #count without a number as one", () => {
    expect(parseTask({ text: "Read #every", today })?.every).toBe("1d");
    expect(parseTask({ text: "Steps #count", today })).toMatchObject({ type: "count", target: 1 });
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

  it("keeps the blank lines inside a note and drops the ones framing it", () => {
    const parsed = parseTask({ text: "Pack\n\n  passport\n\n  and the tickets\n\n- charger\n\n  the short one\n\n", today });
    expect(parsed?.note).toBe("passport\n\nand the tickets");
    expect(parsed?.subtasks[0]).toMatchObject({ title: "charger", note: "the short one" });
  });

  it("reads a dashed line as part of the note when subtasks are off", () => {
    const parsed = parseTask({ text: "cat cow #count 10\n\n  breathe out\n- and again\n", today, subtasks: false });
    expect(parsed).toMatchObject({ title: "cat cow", type: "count", target: 10, note: "breathe out\n- and again", subtasks: [] });
  });

  it("keeps a word that only looks like a token in the title", () => {
    expect(parseTask({ text: "Read #chapter 3 of the manual", today })?.title).toBe("Read #chapter 3 of the manual");
  });
});

describe("tokenSpans", () => {
  function marked(text: string) {
    return tokenSpans({ text, today }).map((span) => [span.kind, text.slice(span.from, span.to)]);
  }

  it("marks every attribute on the task line and nothing else", () => {
    expect(marked("Morning stretch /exercise #every mo,we,fr #rest 30s tomorrow 3pm = done")).toEqual([
      ["attribute", "/exercise"],
      ["attribute", "#every"],
      ["attribute", "mo,we,fr"],
      ["attribute", "#rest"],
      ["attribute", "30s"],
      ["attribute", "tomorrow"],
      ["attribute", "3pm"],
      ["attribute", "="],
      ["attribute", "done"],
    ]);
  });

  it("marks both words of a month and day, an iso date and a 24 hour time", () => {
    expect(marked("Dinner sept 20 19:30")).toEqual([
      ["attribute", "sept"],
      ["attribute", "20"],
      ["attribute", "19:30"],
    ]);
    expect(marked("Flight 2026-10-02 09:15")).toEqual([
      ["attribute", "2026-10-02"],
      ["attribute", "09:15"],
    ]);
  });

  it("marks the dash and the attributes of a subtask, and leaves a note bare", () => {
    expect(marked("Hangboard\n\n  keep the elbows soft\n\n- Hang #timer 30s ×3")).toEqual([
      ["bullet", "-"],
      ["attribute", "#timer"],
      ["attribute", "30s"],
      ["attribute", "×3"],
    ]);
  });

  it("marks nothing in a word that is not a token", () => {
    expect(marked("Read #chapter 3 of the manual")).toEqual([]);
  });
});

function subtaskRow(fields: Partial<Task> & { id: string; title: string }): Task {
  return {
    parentId: "t",
    scheduleId: null,
    dueDate: null,
    dueTime: null,
    group: "exercise",
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
    ...fields,
  };
}

const task: Task = {
  id: "t",
  parentId: null,
  scheduleId: null,
  dueDate: "2026-09-15",
  dueTime: "15:00",
  title: "Morning stretch",
  group: "exercise",
  type: "boolean",
  target: null,
  numericalValue: null,
  stringValue: null,
  restSeconds: 30,
  finalizedAt: null,
  isSkipped: false,
  assignee: null,
  note: "Keep hips level.",
  sortOrder: 0,
  subtasks: [
    subtaskRow({ id: "s1", title: "neck rolls", type: "timer_seconds", target: 30, numericalValue: 30, finalizedAt: "2026-09-15T07:31:00", sortOrder: 0 }),
    subtaskRow({ id: "s2", title: "cat cow", type: "count", target: 10, numericalValue: 4, note: "breathe out", sortOrder: 1 }),
    subtaskRow({ id: "s3", title: "plank", type: "timer_seconds", target: 45, numericalValue: 0, sortOrder: 2 }),
  ],
  comments: [],
  createdAt: "2026-09-01T00:00:00+00:00",
};

describe("serializeTask", () => {
  it("round-trips a task with progress", () => {
    const text = serializeTask({ task, every: null, today });
    expect(text).toBe("Morning stretch /exercise #rest 30s today 15:00\n\n  Keep hips level.\n\n- neck rolls #timer 30s = done\n- cat cow #count 10 = 4\n  breathe out\n- plank #timer 45s");
    const parsed = parseTask({ text, today });
    expect(parsed).toMatchObject({ title: "Morning stretch", group: "exercise", restSeconds: 30, date: today, time: "15:00", note: "Keep hips level." });
    expect(parsed?.subtasks.map((subtask) => [subtask.done, subtask.current])).toEqual([[true, null], [null, 4], [null, null]]);
  });

  it("separates the sections with a blank line and round-trips a note of several paragraphs", () => {
    expect(serializeTask({ task: { ...task, note: "", dueTime: null, dueDate: null, restSeconds: null }, every: null, today })).toBe(
      "Morning stretch /exercise\n\n- neck rolls #timer 30s = done\n- cat cow #count 10 = 4\n  breathe out\n- plank #timer 45s",
    );
    const text = serializeTask({ task: { ...task, subtasks: [], note: "Keep hips level.\n\nStop if it pinches." }, every: null, today });
    expect(text).toBe("Morning stretch /exercise #rest 30s today 15:00\n\n  Keep hips level.\n\n  Stop if it pinches.");
    expect(parseTask({ text, today })?.note).toBe("Keep hips level.\n\nStop if it pinches.");
  });

  it("leaves the group off a subtask, which only ever carries its host's", () => {
    expect(serializeTask({ task: subtaskRow({ id: "s2", title: "cat cow", type: "count", target: 10, numericalValue: 4 }), every: null, today })).toBe("cat cow #count 10 = 4");
  });

  it("writes a schedule instance without a date and a plain done one-off with its state", () => {
    expect(serializeTask({ task: { ...task, subtasks: [], note: "", dueTime: null, finalizedAt: "2026-09-15T08:00:00", scheduleId: "s" }, every: "1d", today })).toBe("Morning stretch /exercise #every 1d #rest 30s = done");
    expect(serializeTask({ task: { ...task, subtasks: [], note: "", dueTime: null, dueDate: "2026-09-16", type: "count", target: 8, numericalValue: 3, restSeconds: null }, every: null, today })).toBe("Morning stretch /exercise #count 8 tomorrow = 3");
    expect(serializeTask({ task: { ...task, subtasks: [], note: "", dueTime: null, dueDate: null, type: "timer_seconds", target: 600, restSeconds: null }, every: null, today })).toBe("Morning stretch /exercise #timer 10m");
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
