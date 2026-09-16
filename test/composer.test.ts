import { definitionFromParsed, dueToday, taskFromParsed } from "@shared/composer.ts";
import { parseTask, serializeTask } from "@shared/grammar.ts";
import type { Task } from "@shared/model.ts";

const today = "2026-09-15";
const now = "2026-09-15T10:00:00";

function parse(text: string) {
  const parsed = parseTask({ text, today });
  if (!parsed) throw new Error("nothing parsed");
  return parsed;
}

describe("taskFromParsed", () => {
  it("makes an ungrouped backlog one-off by default", () => {
    const task = taskFromParsed({ parsed: parse("Call mum"), existing: null, id: "t1", today, now, definition: null });
    expect(task).toMatchObject({ id: "t1", name: "Call mum", group: "", date: null, time: null, definitionId: null, kind: "boolean", doneAt: null, created: now });
  });

  it("dates a one-off from the text", () => {
    const task = taskFromParsed({ parsed: parse("Dentist /personal fri 3pm"), existing: null, id: "t1", today, now, definition: null });
    expect(task).toMatchObject({ date: "2026-09-18", time: "15:00" });
  });

  it("keeps progress when the text has no value, and takes the value when it does", () => {
    const existing = taskFromParsed({ parsed: parse("Pull-ups #count 5 /exercise today"), existing: null, id: "t1", today, now, definition: null });
    const progressed: Task = { ...existing, current: 2 };
    const edited = taskFromParsed({ parsed: parse("Pull-ups #count 8 /exercise today"), existing: progressed, id: "t1", today, now, definition: null });
    expect(edited).toMatchObject({ id: "t1", target: 8, current: 2, date: today });
    const overridden = taskFromParsed({ parsed: parse("Pull-ups #count 8 /exercise today = 7"), existing: progressed, id: "t1", today, now, definition: null });
    expect(overridden.current).toBe(7);
  });

  it("keeps part progress by name when a part is removed", () => {
    const existing = taskFromParsed({ parsed: parse("Stretch /exercise\n- a #count 5\n- b #count 5\n- c #count 5"), existing: null, id: "t1", today, now, definition: null });
    const progressed: Task = { ...existing, parts: existing.parts.map((part) => ({ ...part, current: 3 })) };
    const edited = taskFromParsed({ parsed: parse("Stretch /exercise\n- b #count 5\n- c #count 5"), existing: progressed, id: "t1", today, now, definition: null });
    expect(edited.parts.map((part) => [part.name, part.current])).toEqual([["b", 3], ["c", 3]]);
    const added = taskFromParsed({ parsed: parse("Stretch /exercise\n- a #count 5\n- b #count 5\n- c #count 5\n- d #count 5"), existing: progressed, id: "t1", today, now, definition: null });
    expect(added.parts.map((part) => part.current)).toEqual([3, 3, 3, 0]);
  });

  it("round-trips through serializeTask without change", () => {
    const first = taskFromParsed({ parsed: parse("Morning stretch /exercise #rest 30s today\n  Keep hips level.\n- neck rolls #timer 30s\n- cat cow #count 10"), existing: null, id: "t1", today, now, definition: null });
    const progressed: Task = { ...first, parts: [{ ...first.parts[0]!, current: 30, doneAt: now }, { ...first.parts[1]!, current: 4 }] };
    const text = serializeTask({ task: progressed, every: null, today });
    const again = taskFromParsed({ parsed: parse(text), existing: progressed, id: "t1", today, now, definition: null });
    expect(again).toEqual(progressed);
  });
});

describe("definitionFromParsed", () => {
  it("creates a definition anchored today with parts and says whether it is due", () => {
    const parsed = parse("Hangboard /exercise #every 2d #rest 60s\n- Hang #timer 30s ×2");
    const definition = definitionFromParsed({ parsed, existing: null, id: "d1", today });
    expect(definition).toMatchObject({ id: "d1", name: "Hangboard", group: "exercise", every: "2d", rest: 60, anchor: today, created: today, ended: null });
    expect(definition.parts.map((part) => part.name)).toEqual(["Hang 1", "Hang 2"]);
    expect(dueToday({ definition, today })).toBe(true);
    const saturdays = definitionFromParsed({ parsed: parse("Long run #timer 1h #every sa"), existing: null, id: "d2", today });
    expect(dueToday({ definition: saturdays, today })).toBe(false);
  });

  it("keeps the anchor of an existing definition", () => {
    const existing = definitionFromParsed({ parsed: parse("Read #every 1d /habits"), existing: null, id: "d1", today: "2026-09-01" });
    const edited = definitionFromParsed({ parsed: parse("Read more #every 2d /habits"), existing, id: "d1", today });
    expect(edited).toMatchObject({ name: "Read more", every: "2d", anchor: "2026-09-01", created: "2026-09-01" });
  });
});
