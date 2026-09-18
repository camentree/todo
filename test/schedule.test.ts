import { isDue, nextDue } from "@shared/schedule.ts";
import type { Rule } from "@shared/schedule.ts";

function rule(overrides: Partial<Rule>): Rule {
  return { frequency: "daily", repeatEvery: 1, weekdays: null, dayOfMonth: null, startsOn: "2026-09-01", endedOn: null, ...overrides };
}

describe("isDue", () => {
  it("counts day intervals from the start", () => {
    expect(isDue({ schedule: rule({ repeatEvery: 2 }), date: "2026-09-01" })).toBe(true);
    expect(isDue({ schedule: rule({ repeatEvery: 2 }), date: "2026-09-02" })).toBe(false);
    expect(isDue({ schedule: rule({ repeatEvery: 2 }), date: "2026-09-03" })).toBe(true);
    expect(isDue({ schedule: rule({}), date: "2026-08-31" })).toBe(false);
  });

  it("matches weekdays with monday as zero", () => {
    const weekly = rule({ frequency: "weekly", weekdays: [0, 2, 4] });
    expect(isDue({ schedule: weekly, date: "2026-09-14" })).toBe(true);
    expect(isDue({ schedule: weekly, date: "2026-09-13" })).toBe(false);
    expect(isDue({ schedule: weekly, date: "2026-09-16" })).toBe(true);
  });

  it("combines a week interval with a weekday", () => {
    const fortnightly = rule({ frequency: "weekly", repeatEvery: 2, weekdays: [0], startsOn: "2026-09-07" });
    expect(isDue({ schedule: fortnightly, date: "2026-09-07" })).toBe(true);
    expect(isDue({ schedule: fortnightly, date: "2026-09-14" })).toBe(false);
    expect(isDue({ schedule: fortnightly, date: "2026-09-21" })).toBe(true);
  });

  it("repeats weekly on the start weekday and monthly on the start day", () => {
    const weekly = rule({ frequency: "weekly", startsOn: "2026-09-05" });
    expect(isDue({ schedule: weekly, date: "2026-09-12" })).toBe(true);
    expect(isDue({ schedule: weekly, date: "2026-09-11" })).toBe(false);
    const monthly = rule({ frequency: "monthly", startsOn: "2026-09-05" });
    expect(isDue({ schedule: monthly, date: "2026-10-05" })).toBe(true);
    expect(isDue({ schedule: monthly, date: "2026-10-06" })).toBe(false);
  });

  it("stops on and after the end date", () => {
    const ended = rule({ endedOn: "2026-09-03" });
    expect(isDue({ schedule: ended, date: "2026-09-02" })).toBe(true);
    expect(isDue({ schedule: ended, date: "2026-09-03" })).toBe(false);
    expect(isDue({ schedule: ended, date: "2026-09-04" })).toBe(false);
  });
});

describe("nextDue", () => {
  it("finds the next occurrence after a date", () => {
    expect(nextDue({ schedule: rule({ frequency: "weekly", weekdays: [5] }), after: "2026-09-13" })).toBe("2026-09-19");
    expect(nextDue({ schedule: rule({ frequency: "weekly", weekdays: [1, 3] }), after: "2026-09-13" })).toBe("2026-09-15");
    expect(nextDue({ schedule: rule({}), after: "2026-09-13" })).toBe("2026-09-14");
    expect(nextDue({ schedule: rule({ frequency: "weekly", startsOn: "2026-09-13" }), after: "2026-09-13" })).toBe("2026-09-20");
    expect(nextDue({ schedule: rule({ frequency: "monthly", startsOn: "2026-09-13" }), after: "2026-09-13" })).toBe("2026-10-13");
  });
});
