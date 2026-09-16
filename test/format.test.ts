import { comingDate, shortDate, timeOfDay } from "@shared/format.ts";

const today = "2026-09-15";

describe("comingDate", () => {
  it("says tomorrow for the day after today, and the short date otherwise", () => {
    expect(comingDate({ key: "2026-09-16", today })).toBe("tomorrow");
    expect(comingDate({ key: "2026-09-17", today })).toBe("sept 17");
    expect(comingDate({ key: today, today })).toBe(shortDate(today));
    expect(comingDate({ key: "2026-10-01", today: "2026-09-30" })).toBe("tomorrow");
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
