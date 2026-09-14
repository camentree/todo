import { firstLine, preview, renderLine } from "@shared/markdown.ts";

describe("renderLine", () => {
  it("keeps markers visible in a fainter tone", () => {
    expect(renderLine("# Morning")).toEqual([
      { text: "# ", tone: "marker" },
      { text: "Morning", tone: "ink" },
    ]);
    expect(renderLine("- sat for **twelve** minutes")).toEqual([
      { text: "- ", tone: "accent" },
      { text: "sat for ", tone: "body" },
      { text: "**", tone: "marker" },
      { text: "twelve", tone: "ink" },
      { text: "**", tone: "marker" },
      { text: " minutes", tone: "body" },
    ]);
    expect(renderLine("> quiet")).toEqual([
      { text: "> ", tone: "marker" },
      { text: "quiet", tone: "muted" },
    ]);
    expect(renderLine("_soft_ and `code`")).toEqual([
      { text: "_", tone: "marker" },
      { text: "soft", tone: "italic" },
      { text: "_", tone: "marker" },
      { text: " and ", tone: "body" },
      { text: "`", tone: "marker" },
      { text: "code", tone: "ink" },
      { text: "`", tone: "marker" },
    ]);
  });
});

describe("preview and firstLine", () => {
  it("strips markers from the first two non-empty lines", () => {
    expect(preview("# Slept badly\n\n- sat anyway\n- third line")).toBe("Slept badly sat anyway");
    expect(firstLine("\n\n> quiet room")).toBe("quiet room");
  });
});
