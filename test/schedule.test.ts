import { daysUntilDue, isDue } from "@shared/schedule.ts";
import type { Definition } from "@shared/types.ts";

const definition = (every: string, anchor = "2026-09-01"): Definition => ({
  id: "d",
  name: "x",
  group: "habits",
  kind: "bool",
  target: 1,
  unit: "",
  rest: 0,
  every,
  note: "",
  tapIncrement: false,
  children: [],
  anchor,
});

describe("isDue", () => {
  it("counts day intervals from the anchor", () => {
    expect(isDue({ every: "2d", anchor: "2026-09-01", date: "2026-09-01" })).toBe(true);
    expect(isDue({ every: "2d", anchor: "2026-09-01", date: "2026-09-02" })).toBe(false);
    expect(isDue({ every: "2d", anchor: "2026-09-01", date: "2026-09-03" })).toBe(true);
    expect(isDue({ every: "1d", anchor: "2026-09-01", date: "2026-08-31" })).toBe(false);
  });

  it("matches weekdays", () => {
    expect(isDue({ every: "mo,we,fr", anchor: "2026-09-01", date: "2026-09-14" })).toBe(true);
    expect(isDue({ every: "mo,we,fr", anchor: "2026-09-01", date: "2026-09-13" })).toBe(false);
  });

  it("combines a week interval with a weekday", () => {
    expect(isDue({ every: "2w mo", anchor: "2026-09-07", date: "2026-09-07" })).toBe(true);
    expect(isDue({ every: "2w mo", anchor: "2026-09-07", date: "2026-09-14" })).toBe(false);
    expect(isDue({ every: "2w mo", anchor: "2026-09-07", date: "2026-09-21" })).toBe(true);
  });

  it("repeats weekly and monthly from the anchor", () => {
    expect(isDue({ every: "1w", anchor: "2026-09-05", date: "2026-09-12" })).toBe(true);
    expect(isDue({ every: "1w", anchor: "2026-09-05", date: "2026-09-11" })).toBe(false);
    expect(isDue({ every: "1m", anchor: "2026-09-05", date: "2026-10-05" })).toBe(true);
    expect(isDue({ every: "1m", anchor: "2026-09-05", date: "2026-10-06" })).toBe(false);
  });
});

describe("daysUntilDue", () => {
  it("finds the next occurrence inside the coming six days", () => {
    expect(daysUntilDue({ definition: definition("sa"), date: "2026-09-13" })).toBe(6);
    expect(daysUntilDue({ definition: definition("tu,th"), date: "2026-09-13" })).toBe(2);
    expect(daysUntilDue({ definition: definition("1d"), date: "2026-09-13" })).toBe(1);
  });

  it("returns null when the next occurrence is a week or more away", () => {
    expect(daysUntilDue({ definition: definition("1w", "2026-09-13"), date: "2026-09-13" })).toBeNull();
    expect(daysUntilDue({ definition: definition("1m", "2026-09-13"), date: "2026-09-13" })).toBeNull();
  });
});
