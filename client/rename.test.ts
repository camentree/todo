import { describe, expect, test } from "vitest";

import { renameChanges } from "./useTaskActions.ts";
import { parse, type ParsedToken } from "@shared/parser.ts";

function guessesIn(input: string): ParsedToken[] {
  return parse({ input: input, today: new Date() }).tokens.filter(
    (token) =>
      token.kind === "dueDate" ||
      token.kind === "dueTime" ||
      token.kind === "recurrence",
  );
}

describe("renameChanges", () => {
  test("takes sigils out of the title and applies them", () => {
    expect(
      renameChanges({
        existingTags: [],
        input: "Call the pharmacy #errand @camen /home !blocked",
      }),
    ).toEqual({
      title: "Call the pharmacy",
      tags: ["errand"],
      who: "camen",
      list: "home",
      stage: "blocked",
    });
  });

  test("adds tags to the ones already there", () => {
    expect(
      renameChanges({
        existingTags: ["health", "errand"],
        input: "Call the pharmacy #urgent",
      }).tags,
    ).toEqual(["health", "errand", "urgent"]);
  });

  test("leaves fields alone when the title mentions none", () => {
    expect(
      renameChanges({
        existingTags: ["health"],
        input: "Call the chemist",
      }),
    ).toEqual({ title: "Call the chemist" });
  });

  test("leaves date words in the title and the date unset", () => {
    expect(
      renameChanges({
        existingTags: [],
        input: "Book flights 2026-08-22 at 3pm weekly",
      }),
    ).toEqual({ title: "Book flights 2026-08-22 at 3pm weekly" });
  });

  test("accepting a date guess sets it and takes the words out", () => {
    const guesses = guessesIn("Book flights 2026-08-22");

    expect(
      renameChanges({
        existingTags: [],
        input: "Book flights 2026-08-22",
        accepting: guesses,
      }),
    ).toEqual({ title: "Book flights", dueDate: "2026-08-22" });
  });

  test("accepting one guess leaves the others in the title", () => {
    const input = "Book flights 2026-08-22 at 3pm";
    const date = guessesIn(input).filter(
      (token) => token.kind === "dueDate",
    );

    expect(
      renameChanges({
        existingTags: [],
        input: input,
        accepting: date,
      }),
    ).toEqual({
      title: "Book flights at 3pm",
      dueDate: "2026-08-22",
    });
  });

  test("applies sigils alongside an accepted date", () => {
    const input = "Book flights #travel 2026-08-22";

    expect(
      renameChanges({
        existingTags: [],
        input: input,
        accepting: guessesIn(input),
      }),
    ).toEqual({
      title: "Book flights",
      tags: ["travel"],
      dueDate: "2026-08-22",
    });
  });
});
