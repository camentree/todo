import { describe, expect, test } from "vitest";

import { asChanges } from "../client/tasks/attributes.ts";
import type { Attribute } from "../client/tasks/attributes.ts";

function attribute(overrides: Partial<Attribute>): Attribute {
  return {
    field: "list",
    value: "programming",
    label: "programming",
    ...overrides,
  };
}

describe("turning group attributes into task changes", () => {
  test("a list becomes the list to write", () => {
    expect(asChanges([attribute({ value: "habits" })])).toEqual({
      list: "habits",
    });
  });

  test("several tags gather into one list", () => {
    expect(
      asChanges([
        attribute({ field: "tag", value: "parallax" }),
        attribute({ field: "tag", value: "urgent" }),
      ]).tags,
    ).toEqual(["parallax", "urgent"]);
  });

  test("the same tag spelled two ways is written once", () => {
    expect(
      asChanges([
        attribute({ field: "tag", value: "Parallax" }),
        attribute({ field: "tag", value: "parallax" }),
      ]).tags,
    ).toEqual(["Parallax"]);
  });

  test("a group with no tag clears the tags", () => {
    expect(
      asChanges([attribute({ field: "tag", value: null })]),
    ).toEqual({ tags: [] });
  });

  test("tags are left alone when no tag is conferred", () => {
    expect(
      asChanges([attribute({ value: "habits" })]).tags,
    ).toBeUndefined();
  });

  test("an empty who clears rather than being skipped", () => {
    expect(
      asChanges([attribute({ field: "who", value: null })]),
    ).toEqual({ who: null });
  });

  test("a stage arrives as a stage rather than a string", () => {
    expect(
      asChanges([
        attribute({ field: "stage", value: "in_progress" }),
      ]),
    ).toEqual({ stage: "in_progress" });
  });

  test("a stage that is not one of ours becomes nothing", () => {
    expect(
      asChanges([attribute({ field: "stage", value: "invented" })]),
    ).toEqual({ stage: null });
  });

  test("a due date and time both carry through", () => {
    expect(
      asChanges([
        attribute({ field: "due_date", value: "2026-08-26" }),
        attribute({ field: "due_time", value: "08:00" }),
      ]),
    ).toEqual({ dueDate: "2026-08-26", dueTime: "08:00" });
  });

  test("nothing conferred writes nothing", () => {
    expect(asChanges([])).toEqual({});
  });
});
