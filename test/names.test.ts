import { describe, expect, test } from "vitest";

import { canonicalName } from "@shared/names.ts";

describe("canonicalName", () => {
  test("folds case, so two spellings are one name", () => {
    expect(canonicalName("Programming")).toBe(
      canonicalName("programming"),
    );
    expect(canonicalName("PT")).toBe("pt");
  });

  test("drops surrounding whitespace", () => {
    expect(canonicalName("  side projects ")).toBe("side projects");
  });

  test("leaves an already canonical name alone", () => {
    expect(canonicalName("habits")).toBe("habits");
  });
});
