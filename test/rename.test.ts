import { describe, expect, test } from "vitest";

import { renameChanges } from "../client/taskLine.ts";

describe("renameChanges", () => {
  test("takes sigils out of the title and applies them", () => {
    expect(
      renameChanges(
        "Call the pharmacy #errand @camen /home !blocked",
      ),
    ).toEqual({
      title: "Call the pharmacy",
      tags: ["errand"],
      who: "camen",
      list: "home",
      stage: "blocked",
    });
  });

  test("a state sigil sets the state", () => {
    expect(renameChanges("File the form :complete")).toEqual({
      title: "File the form",
      state: "complete",
    });
  });

  test("archived is not a state, so it sets the timestamp", () => {
    const changes = renameChanges("Old thing :archived");

    expect(changes.title).toBe("Old thing");
    expect(changes.state).toBeUndefined();
    expect(typeof changes.archivedAt).toBe("string");
  });

  test("tags replace the ones already there", () => {
    expect(renameChanges("Call the pharmacy #urgent").tags).toEqual([
      "urgent",
    ]);
  });

  test("leaves fields alone when the title mentions none", () => {
    expect(renameChanges("Call the chemist")).toEqual({
      title: "Call the chemist",
    });
  });

  test("a bare sigil clears the attribute", () => {
    expect(renameChanges("Call the chemist # @ !")).toEqual({
      title: "Call the chemist",
      tags: [],
      who: null,
      stage: null,
    });
  });

  test("dates and times apply like every other attribute", () => {
    expect(renameChanges("Book flights 2026-08-22 at 3pm")).toEqual({
      title: "Book flights",
      dueDate: "2026-08-22",
      dueTime: "15:00",
    });
  });

  test("a backslash keeps a date word as words", () => {
    expect(renameChanges("Book flights \\tomorrow")).toEqual({
      title: "Book flights tomorrow",
    });
  });
});
