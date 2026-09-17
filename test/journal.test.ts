import { entryFrom, entryTags, entryText, entryTitle, parseMarkdown, readableTitle, serializeMarkdown, tagCounts } from "@shared/journal.ts";
import type { JournalEntry } from "@shared/model.ts";

const entries: JournalEntry[] = [
  { sectionTitle: "2026-09-13T08:15:00", at: "2026-09-13T08:15:00", body: "Quiet morning.\n\nCoffee on the step.", metadata: { tag: "personal" } },
  {
    sectionTitle: "2026-09-14T21:40:00",
    at: "2026-09-14T21:40:00",
    body: "Talked about the thing.\n\n### homework\n\n- one\n- two",
    metadata: { displayTitle: "after the session", tag: "therapy, personal" },
  },
];

describe("journal markdown", () => {
  it("heads each entry with its display title, else the section title, and writes the metadata after a blank line", () => {
    expect(serializeMarkdown(entries)).toBe(
      "## 2026-09-13T08:15:00\n\nat: 2026-09-13T08:15:00\ntag: personal\n\nQuiet morning.\n\nCoffee on the step.\n\n## after the session\n\nat: 2026-09-14T21:40:00\ntag: therapy, personal\n\nTalked about the thing.\n\n### homework\n\n- one\n- two\n",
    );
  });

  it("round-trips a timestamp heading, a display-title heading and a body with its own deeper subheadings", () => {
    expect(parseMarkdown(serializeMarkdown(entries))).toEqual(entries);
  });

  it("writes an author only when there is one, and reads it back", () => {
    const entry: JournalEntry = { sectionTitle: "2026-09-01T10:00:00", at: "2026-09-01T10:00:00", body: "plain", metadata: { author: "parallax" } };
    expect(serializeMarkdown([entry])).toBe("## 2026-09-01T10:00:00\n\nat: 2026-09-01T10:00:00\nauthor: parallax\n\nplain\n");
    expect(parseMarkdown(serializeMarkdown([entry]))).toEqual([entry]);
  });

  it("reads a tag line written as a comma list or repeated", () => {
    const written = "## 2026-09-01T10:00:00\n\nat: 2026-09-01T10:00:00\ntag: books\ntag: house, garden\n\nplain\n";
    expect(entryTags(parseMarkdown(written)[0]!)).toEqual(["books", "house", "garden"]);
  });

  it("drops the id and task lines an older file carries", () => {
    const written = "## 2026-09-01T10:00:00\n\nid: abc123\nat: 2026-09-01T10:00:00\ntask: Journal\n\nplain\n";
    expect(parseMarkdown(written)).toEqual([{ sectionTitle: "2026-09-01T10:00:00", at: "2026-09-01T10:00:00", body: "plain", metadata: {} }]);
  });

  it("takes the section title from a bare heading when there is no metadata", () => {
    expect(parseMarkdown("## 2026-09-01T10:00:00\n\nplain\n")).toEqual([
      { sectionTitle: "2026-09-01T10:00:00", at: "2026-09-01T10:00:00", body: "plain", metadata: {} },
    ]);
  });

  it("counts every tag in use, alphabetically", () => {
    expect(tagCounts(entries)).toEqual([
      { tag: "personal", count: 2 },
      { tag: "therapy", count: 1 },
    ]);
  });
});

describe("the title an entry shows", () => {
  it("is the display title when there is one, else the section title", () => {
    expect(entryTitle(entries[0]!)).toBe("2026-09-13T08:15:00");
    expect(entryTitle(entries[1]!)).toBe("after the session");
  });

  it("drops the T and the seconds when a list row reads a timestamp", () => {
    expect(readableTitle(entries[0]!)).toBe("2026-09-13 08:15");
    expect(readableTitle(entries[1]!)).toBe("after the session");
  });
});

describe("editor text", () => {
  it("writes the tag line, the title and the body", () => {
    expect(entryText(entries[1]!)).toBe("#therapy #personal\n\n## after the session\n\nTalked about the thing.\n\n### homework\n\n- one\n- two");
  });

  it("leaves a line to write on when the body is empty", () => {
    expect(entryText({ ...entries[0]!, body: "", metadata: {} })).toBe("## 2026-09-13T08:15:00\n\n");
  });

  it("round-trips through the editor", () => {
    expect(entryFrom({ entry: entries[1]!, text: entryText(entries[1]!) })).toEqual(entries[1]);
    expect(entryFrom({ entry: entries[0]!, text: entryText(entries[0]!) })).toEqual(entries[0]);
  });

  it("writes a display title and leaves the section title alone", () => {
    expect(entryFrom({ entry: entries[0]!, text: "#climbing\n\n## blue v4\n\nHeel hook first.\n" })).toEqual({
      ...entries[0]!,
      body: "Heel hook first.",
      metadata: { displayTitle: "blue v4", tag: "climbing" },
    });
  });

  it("drops the display title when the title is typed back to the section title", () => {
    expect(entryFrom({ entry: entries[1]!, text: "## 2026-09-14T21:40:00\n\nstill here." }).metadata.displayTitle).toBe(undefined);
  });

  it("keeps an author nobody typed", () => {
    const entry: JournalEntry = { ...entries[0]!, metadata: { author: "parallax" } };
    expect(entryFrom({ entry, text: "## blue v4\n\nHeel hook first." }).metadata).toEqual({ displayTitle: "blue v4", author: "parallax" });
  });

  it("keeps the title when the line is gone, and reads deeper headings as body", () => {
    expect(entryFrom({ entry: entries[1]!, text: "### tempering\n\ncumin in ghee" })).toEqual({
      ...entries[1]!,
      body: "### tempering\n\ncumin in ghee",
      metadata: { displayTitle: "after the session" },
    });
  });
});
