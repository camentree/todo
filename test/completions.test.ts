import { describe, expect, it } from "vitest";

import {
  ghostAfter,
  sigilBefore,
  sigilsLacked,
  suggestionsFor,
  worthOffering,
} from "../client/tasks/completions.ts";

const known = {
  lists: ["personal", "programming"],
  tags: ["parallax", "parallax-frontend", "errand"],
  who: ["claude"],
  stages: ["to_do", "in_progress"],
  states: ["to_do", "complete"] as const,
};

function completionFor(input: string): string {
  const opening = sigilBefore({
    input: input,
    caret: input.length,
  });
  return ghostAfter({
    input: input,
    caret: input.length,
    opening: opening,
    matches: suggestionsFor({ opening: opening, known: known }),
  });
}

describe("the rest of a word shown as ghost text", () => {
  it("completes a tag part way through", () => {
    expect(completionFor("Rewrite the hook #par")).toBe("allax");
  });

  it("completes a list", () => {
    expect(completionFor("Buy milk /per")).toBe("sonal");
  });

  it("offers nothing once the word is whole", () => {
    expect(completionFor("Buy milk #errand")).toBe("");
  });

  it("offers nothing after a space, so a new tag can be made", () => {
    expect(completionFor("Rewrite the hook #par ")).toBe("");
  });

  it("stays quiet where no sigil has been typed", () => {
    expect(completionFor("Rewrite the hook")).toBe("");
  });

  it("stays quiet when the caret is not at the end", () => {
    const input = "Rewrite the hook #par";
    const opening = sigilBefore({ input: input, caret: 4 });
    expect(
      ghostAfter({
        input: input,
        caret: 4,
        opening: opening,
        matches: suggestionsFor({ opening: opening, known: known }),
      }),
    ).toBe("");
  });
});

describe("which sigils are still worth offering", () => {
  it("offers all three on an empty line", () => {
    expect(sigilsLacked("")).toEqual(["#", "@", "/"]);
  });

  it("stops offering the list sigil once a list is named", () => {
    expect(sigilsLacked("Buy milk /personal")).toEqual(["#", "@"]);
  });

  it("stops offering the person sigil once one is named", () => {
    expect(sigilsLacked("Fix it @claude")).toEqual(["#", "/"]);
  });

  it("keeps offering tags, since a task can carry several", () => {
    expect(sigilsLacked("Fix it #errand")).toContain("#");
  });
});

describe("what the strip offers when no word is part way", () => {
  it("offers tags the task does not already carry", () => {
    expect(
      worthOffering({ input: "Buy milk", known: known }),
    ).toEqual([
      "#parallax",
      "#parallax-frontend",
      "#errand",
      "@claude",
    ]);
  });

  it("drops a tag the task already carries", () => {
    expect(
      worthOffering({ input: "Buy milk #errand", known: known }),
    ).not.toContain("#errand");
  });

  it("drops the person once one is named", () => {
    expect(
      worthOffering({ input: "Fix it @claude", known: known }),
    ).not.toContain("@claude");
  });
});
