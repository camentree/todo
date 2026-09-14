import { firstLine, preview, stripMarkers } from "@shared/markdown.ts";

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
