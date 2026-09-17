import { relativeDate, shortDate, timeOfDay } from "@shared/format.ts";

const today = "2026-09-15";

describe("relativeDate", () => {
  it("names the day within a week, and writes the short date beyond it", () => {
    expect(relativeDate({ key: "2026-09-14", today })).toBe("yesterday");
    expect(relativeDate({ key: today, today })).toBe("today");
    expect(relativeDate({ key: "2026-09-16", today })).toBe("tomorrow");
    expect(relativeDate({ key: "2026-09-17", today })).toBe("thursday");
    expect(relativeDate({ key: "2026-09-21", today })).toBe("monday");
    expect(relativeDate({ key: "2026-09-22", today })).toBe("sep 22");
    expect(relativeDate({ key: "2026-09-12", today })).toBe("saturday");
    expect(relativeDate({ key: "2026-09-05", today })).toBe("sep 05");
    expect(relativeDate({ key: "2026-10-01", today: "2026-09-30" })).toBe("tomorrow");
    expect(shortDate("2026-10-03")).toBe("oct 03");
  });
});

describe("timeOfDay", () => {
  it("writes the twelve-hour clock in lowercase with no leading zero", () => {
    expect(timeOfDay("21:00")).toBe("9:00 pm");
    expect(timeOfDay("07:30")).toBe("7:30 am");
    expect(timeOfDay("00:05")).toBe("12:05 am");
    expect(timeOfDay("12:00")).toBe("12:00 pm");
    expect(timeOfDay("15:00")).toBe("3:00 pm");
  });
});
