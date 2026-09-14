import { everyLabel, parseEntry, serializeEntry } from "@shared/grammar.ts";

describe("parseEntry", () => {
  it("reads a parent with timer children, a note, rest, group and schedule", () => {
    const parsed = parseEntry("Hangboard #every 2d /exercise #rest 60s\n\nHalf crimp, 20mm edge.\n\n- Hang #timer 30s\n- Hang #timer 30s\n- Hang #timer 30s");
    expect(parsed).toMatchObject({
      title: "Hangboard",
      group: "exercise",
      every: "2d",
      rest: 60,
      kind: "count",
      type: "numeric",
      target: 3,
      note: "Half crimp, 20mm edge.",
    });
    expect(parsed?.children).toHaveLength(3);
    expect(parsed?.children[0]).toMatchObject({ title: "Hang", kind: "timer", target: 30, unit: "s" });
  });

  it("defaults to a boolean one-off in personal", () => {
    expect(parseEntry("Call mum")).toMatchObject({ title: "Call mum", kind: "bool", type: "boolean", group: "personal", every: null, children: [] });
  });

  it("makes a bare #count open-ended", () => {
    expect(parseEntry("Steps #count")).toMatchObject({ kind: "count", tapIncrement: true, target: 1 });
    expect(parseEntry("Pull-ups #count 5")).toMatchObject({ kind: "count", tapIncrement: false, target: 5 });
  });

  it("reads amounts with units and a day list schedule", () => {
    expect(parseEntry("Water #amount 2000ml #every mo,we,fr")).toMatchObject({ kind: "amount", target: 2000, unit: "ml", every: "mo,we,fr" });
    expect(parseEntry("Run #every 2w mo")).toMatchObject({ every: "2w mo" });
    expect(parseEntry("Read #every")).toMatchObject({ every: "1d" });
  });

  it("reads current state after =", () => {
    expect(parseEntry("Meditate #timer 20m = 12m")).toMatchObject({ current: 720 });
    expect(parseEntry("Read = done")).toMatchObject({ doneManual: true });
    expect(parseEntry("Reflect #text = went well today")).toMatchObject({ value: "went well today" });
  });

  it("attaches indented lines to the sub-task above", () => {
    const parsed = parseEntry("Session /exercise\n- Warm up #timer 5m\n  easy pace\n- Hang #timer 30s");
    expect(parsed?.children[0]?.note).toBe("easy pace");
    expect(parsed?.children[1]?.note).toBe("");
  });

  it("returns null for an empty first line", () => {
    expect(parseEntry("\nsomething")).toBeNull();
  });
});

describe("serializeEntry", () => {
  it("round-trips a definition with children", () => {
    const text = serializeEntry({
      root: { name: "Hangboard", kind: "count", target: 3, unit: "", tapIncrement: false, current: 0, value: "", done: false, note: "Half crimp." },
      children: [
        { name: "Hang", kind: "timer", target: 30, unit: "s", tapIncrement: false, current: 30, value: "", done: true, note: "" },
        { name: "Hang", kind: "timer", target: 30, unit: "s", tapIncrement: false, current: 0, value: "", done: false, note: "" },
      ],
      group: "exercise",
      every: "2d",
      rest: 60,
    });
    expect(text).toBe("Hangboard #every 2d /exercise #rest 1m\n\nHalf crimp.\n\n- Hang #timer 30s = 30s\n- Hang #timer 30s");
    expect(parseEntry(text)).toMatchObject({ title: "Hangboard", every: "2d", rest: 60, note: "Half crimp." });
  });

  it("writes a plain boolean with its state", () => {
    const text = serializeEntry({
      root: { name: "Read", kind: "bool", target: 1, unit: "", tapIncrement: false, current: 0, value: "", done: true, note: "" },
      children: [],
      group: "habits",
      every: "1d",
      rest: 0,
    });
    expect(text).toBe("Read #every 1d /habits = done");
  });
});

describe("everyLabel", () => {
  it("names intervals and day lists", () => {
    expect(everyLabel("1d")).toBe("every day");
    expect(everyLabel("2d")).toBe("every 2 days");
    expect(everyLabel("mo,we,fr")).toBe("every mo, we, fr");
    expect(everyLabel("2w mo")).toBe("every 2 weeks · every mo");
    expect(everyLabel(null)).toBe("");
  });
});
