import { describe, expect, test } from "vitest";

import {
  describeSchedule,
  dueDatesBetween,
  type Schedule,
} from "./recurrence.ts";

function schedule(overrides: Partial<Schedule>): Schedule {
  return {
    frequency: "daily",
    repeatEvery: 1,
    weekdays: [],
    dayOfMonth: null,
    startsOn: "2026-08-10",
    ...overrides,
  };
}

describe("dueDatesBetween", () => {
  test("a daily schedule yields every day in the window", () => {
    expect(
      dueDatesBetween({
        schedule: schedule({}),
        from: "2026-08-10",
        through: "2026-08-13",
      }),
    ).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
    ]);
  });

  test("an interval counts from the start date, not the window", () => {
    expect(
      dueDatesBetween({
        schedule: schedule({ repeatEvery: 3 }),
        from: "2026-08-11",
        through: "2026-08-20",
      }),
    ).toEqual(["2026-08-13", "2026-08-16", "2026-08-19"]);
  });

  test("a weekly schedule yields only its chosen weekdays", () => {
    expect(
      dueDatesBetween({
        schedule: schedule({ frequency: "weekly", weekdays: [1, 3] }),
        from: "2026-08-10",
        through: "2026-08-23",
      }),
    ).toEqual([
      "2026-08-10",
      "2026-08-12",
      "2026-08-17",
      "2026-08-19",
    ]);
  });

  test("a fortnightly schedule skips the intervening week", () => {
    expect(
      dueDatesBetween({
        schedule: schedule({
          frequency: "weekly",
          weekdays: [1],
          repeatEvery: 2,
        }),
        from: "2026-08-10",
        through: "2026-09-08",
      }),
    ).toEqual(["2026-08-10", "2026-08-24", "2026-09-07"]);
  });

  test("a monthly schedule lands on its day each month", () => {
    expect(
      dueDatesBetween({
        schedule: schedule({
          frequency: "monthly",
          dayOfMonth: 15,
          startsOn: "2026-08-15",
        }),
        from: "2026-08-01",
        through: "2026-10-31",
      }),
    ).toEqual(["2026-08-15", "2026-09-15", "2026-10-15"]);
  });

  test("a monthly day past the end of a short month falls to its last day", () => {
    expect(
      dueDatesBetween({
        schedule: schedule({
          frequency: "monthly",
          dayOfMonth: 31,
          startsOn: "2026-01-31",
        }),
        from: "2026-02-01",
        through: "2026-02-28",
      }),
    ).toEqual(["2026-02-28"]);
  });

  test("nothing is generated before the schedule starts", () => {
    expect(
      dueDatesBetween({
        schedule: schedule({ startsOn: "2026-08-20" }),
        from: "2026-08-10",
        through: "2026-08-15",
      }),
    ).toEqual([]);
  });
});

describe("describeSchedule", () => {
  test("says what the schedule does in words", () => {
    expect(describeSchedule(schedule({}))).toBe("daily");
    expect(describeSchedule(schedule({ repeatEvery: 5 }))).toBe(
      "every 5 days",
    );
    expect(
      describeSchedule(
        schedule({ frequency: "weekly", weekdays: [1, 3] }),
      ),
    ).toBe("every Monday, Wednesday");
    expect(
      describeSchedule(
        schedule({
          frequency: "monthly",
          dayOfMonth: 1,
          startsOn: "2026-08-01",
        }),
      ),
    ).toBe("monthly on the 1st");
  });
});
