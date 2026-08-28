import { describe, expect, test } from "vitest";

import { searchTasks } from "@shared/search.ts";
import type { CreatedTask } from "@shared/types.ts";

const thursday = new Date(2026, 7, 13);

function task(
  fields: Partial<CreatedTask> & { title: string },
): CreatedTask {
  return {
    id: 1,
    list: "home",
    parentId: null,
    recurringTaskId: null,
    note: null,
    state: "to_do",
    stage: null,
    tags: [],
    who: null,
    dueDate: null,
    dueTime: null,
    sortOrder: 0,
    finishedAt: null,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    schedule: null,
    commentCount: 0,
    ...fields,
  };
}

function titlesFor(input: string, tasks: CreatedTask[]): string[] {
  return searchTasks({
    tasks: tasks,
    input: input,
    today: thursday,
  }).map((found) => found.title);
}

describe("searchTasks", () => {
  test("finds nothing until something is typed", () => {
    expect(
      titlesFor("   ", [task({ title: "Book flights" })]),
    ).toEqual([]);
  });

  test("matches the title and the note, nothing else", () => {
    const tasks = [
      task({ id: 1, title: "Book flights" }),
      task({ id: 2, title: "Call the vet", note: "about flights" }),
      task({ id: 3, title: "Pay rent", list: "flights" }),
      task({ id: 4, title: "Pack", tags: ["flights"] }),
      task({ id: 5, title: "Ask", who: "flights" }),
      task({ id: 6, title: "Water the plants" }),
    ];

    expect(titlesFor("flights", tasks)).toEqual([
      "Book flights",
      "Call the vet",
    ]);
  });

  test("the title outranks the note", () => {
    const tasks = [
      task({ id: 1, title: "Water the plants", note: "flight" }),
      task({ id: 2, title: "Book a flight" }),
    ];

    expect(titlesFor("flight", tasks)).toEqual([
      "Book a flight",
      "Water the plants",
    ]);
  });

  test("a scattering of letters is not a match", () => {
    const tasks = [
      task({ id: 1, title: "Call the pharmacy about the refill" }),
      task({ id: 2, title: "Plan the trip to Portland" }),
    ];

    expect(titlesFor("pro", tasks)).toEqual([]);
  });

  test("tolerates dropped letters in a title", () => {
    const tasks = [
      task({ id: 1, title: "Refactor the auth middleware" }),
      task({ id: 2, title: "Water the plants" }),
    ];

    expect(titlesFor("refctor", tasks)).toEqual([
      "Refactor the auth middleware",
    ]);
    expect(titlesFor("ah", tasks)).toEqual([]);
  });

  test("every term has to match", () => {
    const tasks = [
      task({ id: 1, title: "Book flights to Lisbon" }),
      task({ id: 2, title: "Book a table" }),
    ];

    expect(titlesFor("book lisbon", tasks)).toEqual([
      "Book flights to Lisbon",
    ]);
  });

  test("a quoted phrase matches exactly", () => {
    const tasks = [
      task({ id: 1, title: "Book flights to Lisbon" }),
      task({ id: 2, title: "Flights book" }),
    ];

    expect(titlesFor('"flights to"', tasks)).toEqual([
      "Book flights to Lisbon",
    ]);
  });

  test("sigils filter by their attribute", () => {
    const tasks = [
      task({ id: 1, title: "Ship it", tags: ["parallax"] }),
      task({ id: 2, title: "Ship it", who: "claude" }),
      task({ id: 3, title: "Ship it", list: "programming" }),
      task({ id: 4, title: "Ship it", stage: "in_review" }),
    ];

    expect(titlesFor("#parallax", tasks)).toHaveLength(1);
    expect(titlesFor("@claude", tasks)).toHaveLength(1);
    expect(titlesFor("/programming", tasks)).toHaveLength(1);
    expect(titlesFor("!in-review", tasks)).toHaveLength(1);
  });

  test("a half-typed sigil narrows instead of matching nothing", () => {
    const tasks = [
      task({ id: 1, title: "Ship it", tags: ["parallax"] }),
      task({ id: 2, title: "Read up", tags: ["reading"] }),
      task({ id: 3, title: "Review it", stage: "in_review" }),
    ];

    expect(titlesFor("#par", tasks)).toEqual(["Ship it"]);
    expect(titlesFor("!rev", tasks)).toEqual(["Review it"]);
  });

  test("a sigil and a word narrow together", () => {
    const tasks = [
      task({ id: 1, title: "Ship it", tags: ["parallax"] }),
      task({ id: 2, title: "Rest", tags: ["parallax"] }),
    ];

    expect(titlesFor("#parallax ship", tasks)).toEqual(["Ship it"]);
  });

  test("overdue and no date read the due date", () => {
    const tasks = [
      task({ id: 1, title: "Late", dueDate: "2026-08-12" }),
      task({ id: 2, title: "Today", dueDate: "2026-08-13" }),
      task({ id: 3, title: "Someday" }),
    ];

    expect(titlesFor("overdue", tasks)).toEqual(["Late"]);
    expect(titlesFor("no date", tasks)).toEqual(["Someday"]);
  });

  test("a colon reads where the task stands", () => {
    const tasks = [
      task({ id: 1, title: "Ship it" }),
      task({ id: 2, title: "Book a table", state: "complete" }),
      task({ id: 3, title: "Call the vet", state: "skipped" }),
      task({ id: 4, title: "Old thing", state: "archived" }),
    ];

    expect(titlesFor(":to-do", tasks)).toEqual(["Ship it"]);
    expect(titlesFor(":complete", tasks)).toEqual(["Book a table"]);
    expect(titlesFor(":skipped", tasks)).toEqual(["Call the vet"]);
    expect(titlesFor(":archived", tasks)).toEqual(["Old thing"]);
  });

  test("a partly typed state still narrows", () => {
    const tasks = [
      task({ id: 1, title: "Ship it" }),
      task({ id: 2, title: "Book a table", state: "complete" }),
    ];

    expect(titlesFor(":comp", tasks)).toEqual(["Book a table"]);
  });

  test("a minus drops a state", () => {
    const tasks = [
      task({ id: 1, title: "Ship it" }),
      task({ id: 2, title: "Book a table", state: "complete" }),
      task({ id: 3, title: "Old thing", state: "archived" }),
    ];

    expect(titlesFor("-:complete -:archived", tasks)).toEqual([
      "Ship it",
    ]);
  });

  test("a colon mid-word is not a state", () => {
    const tasks = [
      task({ id: 1, title: "Note: buy milk" }),
      task({ id: 2, title: "Book a table", state: "complete" }),
    ];

    expect(titlesFor("note:", tasks)).toEqual(["Note: buy milk"]);
  });

  test("the same sigil twice widens instead of narrowing", () => {
    const tasks = [
      task({ id: 1, title: "Ship it", tags: ["parallax"] }),
      task({ id: 2, title: "Read up", tags: ["reading"] }),
      task({ id: 3, title: "Water the plants", tags: ["home"] }),
    ];

    expect(titlesFor("#parallax #reading", tasks)).toEqual([
      "Ship it",
      "Read up",
    ]);
  });

  test("different sigils still narrow together", () => {
    const tasks = [
      task({
        id: 1,
        title: "Ship it",
        tags: ["parallax"],
        who: "me",
      }),
      task({
        id: 2,
        title: "Rest",
        tags: ["parallax"],
        who: "claude",
      }),
    ];

    expect(titlesFor("#parallax @claude", tasks)).toEqual(["Rest"]);
  });

  test("a minus drops what the sigil would have found", () => {
    const tasks = [
      task({ id: 1, title: "Ship it", tags: ["parallax"] }),
      task({ id: 2, title: "Read up", tags: ["reading"] }),
    ];

    expect(titlesFor("-#parallax", tasks)).toEqual(["Read up"]);
    expect(titlesFor("-@claude", tasks)).toEqual([
      "Ship it",
      "Read up",
    ]);
  });

  test("a minus drops a word as well as a sigil", () => {
    const tasks = [
      task({ id: 1, title: "Book flights to Lisbon" }),
      task({ id: 2, title: "Book a table" }),
    ];

    expect(titlesFor("book -lisbon", tasks)).toEqual([
      "Book a table",
    ]);
  });

  test("a minus narrows what a sigil widened", () => {
    const tasks = [
      task({ id: 1, title: "Ship it", tags: ["parallax"] }),
      task({ id: 2, title: "Read up", tags: ["reading"] }),
      task({ id: 3, title: "Water the plants", tags: ["home"] }),
    ];

    expect(titlesFor("#parallax #reading -up", tasks)).toEqual([
      "Ship it",
    ]);
  });

  test("a minus drops a quoted phrase", () => {
    const tasks = [
      task({ id: 1, title: "Book flights to Lisbon" }),
      task({ id: 2, title: "Book a table" }),
    ];

    expect(titlesFor('book -"flights to"', tasks)).toEqual([
      "Book a table",
    ]);
  });

  test("a minus drops the date flags too", () => {
    const tasks = [
      task({ id: 1, title: "Late", dueDate: "2026-08-12" }),
      task({ id: 2, title: "Someday" }),
    ];

    expect(titlesFor("-overdue", tasks)).toEqual(["Someday"]);
    expect(titlesFor("-no date", tasks)).toEqual(["Late"]);
  });

  test("date words are searched for, not turned into filters", () => {
    const tasks = [
      task({
        id: 1,
        title: "Tomorrow never knows",
        dueDate: "2026-09-01",
      }),
      task({ id: 2, title: "Groceries", dueDate: "2026-08-14" }),
    ];

    expect(titlesFor("tomorrow", tasks)).toEqual([
      "Tomorrow never knows",
    ]);
  });

  test("a date written out filters by it, so a date chip can search", () => {
    const tasks = [
      task({
        id: 1,
        title: "Tomorrow never knows",
        dueDate: "2026-09-01",
      }),
      task({ id: 2, title: "Groceries", dueDate: "2026-08-14" }),
    ];

    expect(titlesFor("2026-08-14", tasks)).toEqual(["Groceries"]);
  });

  test("a time written out filters by it", () => {
    const tasks = [
      task({ id: 1, title: "Standup", dueTime: "09:30" }),
      task({ id: 2, title: "Groceries", dueTime: "15:00" }),
    ];

    expect(titlesFor("15:00", tasks)).toEqual(["Groceries"]);
  });
});
