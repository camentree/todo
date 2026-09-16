import { isDue, nextDue } from "@shared/schedule.ts";

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

describe("nextDue", () => {
  it("finds the next occurrence after a date", () => {
    expect(nextDue({ every: "sa", anchor: "2026-09-01", after: "2026-09-13" })).toBe("2026-09-19");
    expect(nextDue({ every: "tu,th", anchor: "2026-09-01", after: "2026-09-13" })).toBe("2026-09-15");
    expect(nextDue({ every: "1d", anchor: "2026-09-01", after: "2026-09-13" })).toBe("2026-09-14");
    expect(nextDue({ every: "1w", anchor: "2026-09-13", after: "2026-09-13" })).toBe("2026-09-20");
    expect(nextDue({ every: "1m", anchor: "2026-09-13", after: "2026-09-13" })).toBe("2026-10-13");
  });
});
