import { describe, expect, test } from "vitest";

import { parse, type ParsedToken } from "./parser.ts";

const thursday = new Date(2026, 7, 13);

function tokensOf(
  input: string,
  dismissed: string[] = [],
): ParsedToken[] {
  return parse({
    input: input,
    today: thursday,
    dismissed: dismissed,
  }).tokens;
}

function titleOf(input: string): string {
  return parse({ input: input, today: thursday }).title;
}

function searchTokensOf(input: string): ParsedToken[] {
  return parse({ input: input, today: thursday, search: true })
    .tokens;
}

describe("parse", () => {
  test("pulls sigils out and leaves the title behind", () => {
    const result = parse({
      input:
        "Refactor the auth middleware #parallax @claude /programming",
      today: thursday,
    });

    expect(result.title).toBe("Refactor the auth middleware");
    expect(result.tokens).toEqual([
      { kind: "tag", text: "#parallax", value: "parallax" },
      { kind: "who", text: "@claude", value: "claude" },
      { kind: "list", text: "/programming", value: "programming" },
    ]);
  });

  test("sigils fold case, so /Programming is /programming", () => {
    expect(
      tokensOf(
        "Refactor the auth middleware #Parallax @Claude /Programming",
      ),
    ).toEqual([
      { kind: "tag", text: "#Parallax", value: "parallax" },
      { kind: "who", text: "@Claude", value: "claude" },
      { kind: "list", text: "/Programming", value: "programming" },
    ]);
  });

  test("reads a stage sigil only when it names a real stage", () => {
    expect(tokensOf("Ship it !blocked")).toEqual([
      { kind: "stage", text: "!blocked", value: "blocked" },
    ]);
    expect(tokensOf("Ship it !in-review")).toEqual([
      { kind: "stage", text: "!in-review", value: "in_review" },
    ]);
    expect(titleOf("Ship it !soon")).toBe("Ship it !soon");
  });

  test("reads relative and absolute dates", () => {
    expect(tokensOf("Groceries tomorrow")).toEqual([
      { kind: "dueDate", text: "tomorrow", value: "2026-08-14" },
    ]);
    expect(tokensOf("Groceries in 3 days")).toEqual([
      { kind: "dueDate", text: "in 3 days", value: "2026-08-16" },
    ]);
    expect(tokensOf("Groceries aug 20")).toEqual([
      { kind: "dueDate", text: "aug 20", value: "2026-08-20" },
    ]);
    expect(tokensOf("Groceries 2026-09-01")).toEqual([
      { kind: "dueDate", text: "2026-09-01", value: "2026-09-01" },
    ]);
  });

  test("a weekday means the next one, and next pushes a further week", () => {
    expect(tokensOf("Call mom mon")).toEqual([
      { kind: "dueDate", text: "mon", value: "2026-08-17" },
    ]);
    expect(tokensOf("Call mom next mon")).toEqual([
      { kind: "dueDate", text: "next mon", value: "2026-08-24" },
    ]);
  });

  test("a weekday matching today means a week out, not today", () => {
    expect(tokensOf("Call mom thursday")).toEqual([
      { kind: "dueDate", text: "thursday", value: "2026-08-20" },
    ]);
  });

  test("reads times in both notations", () => {
    expect(tokensOf("Groceries at 3pm")).toEqual([
      { kind: "dueTime", text: "at 3pm", value: "15:00" },
    ]);
    expect(tokensOf("Groceries 3:30pm")).toEqual([
      { kind: "dueTime", text: "3:30pm", value: "15:30" },
    ]);
    expect(tokensOf("Groceries 15:00")).toEqual([
      { kind: "dueTime", text: "15:00", value: "15:00" },
    ]);
    expect(tokensOf("Groceries 12am")).toEqual([
      { kind: "dueTime", text: "12am", value: "00:00" },
    ]);
  });

  test("reads recurrence in its several shapes", () => {
    expect(tokensOf("10 pushups daily")).toEqual([
      {
        kind: "recurrence",
        text: "daily",
        value: {
          frequency: "daily",
          repeatEvery: 1,
          weekdays: [],
          dayOfMonth: null,
        },
      },
    ]);
    expect(tokensOf("Water plants every 5 days")).toEqual([
      {
        kind: "recurrence",
        text: "every 5 days",
        value: {
          frequency: "daily",
          repeatEvery: 5,
          weekdays: [],
          dayOfMonth: null,
        },
      },
    ]);
    expect(tokensOf("Review the roadmap every mon, wed")).toEqual([
      {
        kind: "recurrence",
        text: "every mon, wed",
        value: {
          frequency: "weekly",
          repeatEvery: 1,
          weekdays: [1, 3],
          dayOfMonth: null,
        },
      },
    ]);
  });

  test("a colon names a state, capturing and searching alike", () => {
    expect(tokensOf(":complete")).toEqual([
      { kind: "state", text: ":complete", value: "complete" },
    ]);
    expect(tokensOf(":to-do")).toEqual([
      { kind: "state", text: ":to-do", value: "to_do" },
    ]);
    expect(tokensOf(":archived")).toEqual([
      { kind: "state", text: ":archived", value: "archived" },
    ]);
    expect(searchTokensOf(":skipped")).toEqual([
      { kind: "state", text: ":skipped", value: "skipped" },
    ]);
    expect(titleOf("File the form :complete")).toBe("File the form");
  });

  test("a colon that names nothing stays in the title", () => {
    expect(tokensOf(":nonsense")).toEqual([]);
    expect(titleOf("Note: buy milk")).toBe("Note: buy milk");
    expect(titleOf("Meet at 9:30")).toBe("Meet");
  });

  test("reads the search-only flags and quoted phrases", () => {
    expect(searchTokensOf("overdue")).toEqual([
      { kind: "overdue", text: "overdue" },
    ]);
    expect(searchTokensOf("no date")).toEqual([
      { kind: "noDueDate", text: "no date" },
    ]);
    expect(searchTokensOf('"auth middleware" #parallax')).toEqual([
      {
        kind: "phrase",
        text: '"auth middleware"',
        value: "auth middleware",
      },
      { kind: "tag", text: "#parallax", value: "parallax" },
    ]);
  });

  test("a dismissed token goes back into the title", () => {
    expect(titleOf("Plan the daily standup")).toBe(
      "Plan the standup",
    );

    const undone = parse({
      input: "Plan the daily standup",
      today: thursday,
      dismissed: ["daily"],
    });
    expect(undone.title).toBe("Plan the daily standup");
    expect(undone.tokens).toEqual([]);
  });

  test("dismissing a token puts every word of it back", () => {
    const undone = parse({
      input: "Book flights at 3pm",
      today: thursday,
      dismissed: ["at 3pm"],
    });
    expect(undone.title).toBe("Book flights at 3pm");
    expect(undone.tokens).toEqual([]);
  });

  test("a possessive weekday is not a date", () => {
    expect(titleOf("Read Monday's report")).toBe(
      "Read Monday's report",
    );
  });

  test("trailing punctuation does not hide a date", () => {
    expect(tokensOf("Call mom monday.")).toEqual([
      { kind: "dueDate", text: "monday.", value: "2026-08-17" },
    ]);
  });

  test("every token is returned, so the caller takes the last of a kind", () => {
    expect(tokensOf("Standup daily every mon")).toHaveLength(2);
  });

  test("the search-only tokens stay in the title on capture", () => {
    expect(titleOf("overdue invoice")).toBe("overdue invoice");
    expect(titleOf("Tasks with no date go last")).toBe(
      "Tasks with no date go last",
    );
  });

  test("quoted text stays verbatim on capture", () => {
    expect(titleOf('Reply "hi" to the recruiter')).toBe(
      'Reply "hi" to the recruiter',
    );
    expect(tokensOf('Reply "hi" to the recruiter')).toEqual([]);
    expect(titleOf('The word "today" is a date word')).toBe(
      'The word "today" is a date word',
    );
  });

  test("a backslash escapes the word after it and does not survive", () => {
    expect(titleOf("Buy \\today groceries")).toBe(
      "Buy today groceries",
    );
    expect(tokensOf("Buy \\today groceries")).toEqual([]);
    expect(titleOf("Read up on \\#health")).toBe(
      "Read up on #health",
    );
    expect(titleOf("Ship it \\!blocked")).toBe("Ship it !blocked");
    expect(titleOf("Pay the deposit \\in 3 days")).toBe(
      "Pay the deposit in 3 days",
    );
  });

  test("a backslash on its own is ordinary text", () => {
    expect(titleOf("Escape with \\ in a title")).toBe(
      "Escape with \\ in a title",
    );
    expect(titleOf("Write \\\\today literally")).toBe(
      "Write \\today literally",
    );
  });

  test("punctuation around a date word does not hide it", () => {
    expect(tokensOf("Do it tomorrow!")).toEqual([
      { kind: "dueDate", text: "tomorrow!", value: "2026-08-14" },
    ]);
    expect(tokensOf("Do it today?")).toEqual([
      { kind: "dueDate", text: "today?", value: "2026-08-13" },
    ]);
    expect(tokensOf("Call mom (monday)")).toEqual([
      { kind: "dueDate", text: "(monday)", value: "2026-08-17" },
    ]);
    expect(tokensOf("Groceries (aug 20)")).toEqual([
      { kind: "dueDate", text: "(aug 20)", value: "2026-08-20" },
    ]);
    expect(tokensOf("Groceries in 3 days.")).toEqual([
      { kind: "dueDate", text: "in 3 days.", value: "2026-08-16" },
    ]);
    expect(tokensOf("Groceries 2026-09-01.")).toEqual([
      { kind: "dueDate", text: "2026-09-01.", value: "2026-09-01" },
    ]);
    expect(tokensOf("Groceries at 3pm!")).toEqual([
      { kind: "dueTime", text: "at 3pm!", value: "15:00" },
    ]);
  });

  test("capitalisation does not hide a date or a schedule", () => {
    expect(tokensOf("Call mom Tomorrow")).toEqual([
      { kind: "dueDate", text: "Tomorrow", value: "2026-08-14" },
    ]);
    expect(tokensOf("Call mom TODAY")).toEqual([
      { kind: "dueDate", text: "TODAY", value: "2026-08-13" },
    ]);
    expect(tokensOf("Stretch Every Day")).toHaveLength(1);
  });

  test("everyday means daily", () => {
    expect(tokensOf("10 pushups everyday")).toEqual([
      {
        kind: "recurrence",
        text: "everyday",
        value: {
          frequency: "daily",
          repeatEvery: 1,
          weekdays: [],
          dayOfMonth: null,
        },
      },
    ]);
    expect(tokensOf("10 pushups everyday!")).toHaveLength(1);
  });

  test("a date word inside a longer word is not a date", () => {
    expect(titleOf("Buy milk tomorrow's list")).toBe(
      "Buy milk tomorrow's list",
    );
    expect(titleOf("Read the everydayfeminism piece")).toBe(
      "Read the everydayfeminism piece",
    );
  });

  test("leaves ordinary text entirely alone", () => {
    expect(titleOf("Email the landlord about the boiler")).toBe(
      "Email the landlord about the boiler",
    );
    expect(tokensOf("Email the landlord about the boiler")).toEqual(
      [],
    );
  });
});
