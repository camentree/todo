import { firstLine, inlineSegments, preview, stripMarkers } from "@shared/markdown.ts";

describe("inlineSegments", () => {
  it("splits a line into toned pieces without the markers", () => {
    expect(inlineSegments("- sat for **twelve** minutes, _softly_")).toEqual([
      { text: "sat for ", tone: "plain" },
      { text: "twelve", tone: "strong" },
      { text: " minutes, ", tone: "plain" },
      { text: "softly", tone: "em" },
    ]);
    expect(inlineSegments("`code` only")).toEqual([
      { text: "code", tone: "code" },
      { text: " only", tone: "plain" },
    ]);
  });
});

describe("stripMarkers", () => {
  it("removes line and inline markers", () => {
    expect(stripMarkers("# Morning")).toBe("Morning");
    expect(stripMarkers("- sat for **twelve** minutes")).toBe("sat for twelve minutes");
    expect(stripMarkers("> _soft_ and `code`")).toBe("soft and code");
    expect(stripMarkers("2. second")).toBe("second");
  });
});

describe("preview and firstLine", () => {
  it("strips markers from the first two non-empty lines", () => {
    expect(preview("# Slept badly\n\n- sat **anyway**\n- third line")).toBe("Slept badly sat anyway");
    expect(firstLine("\n\n> quiet room")).toBe("quiet room");
  });
});
