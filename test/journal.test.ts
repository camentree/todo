import { entryFrom, entryText, entryTitle, parseMarkdown, sectionTitleFrom, serializeMarkdown, tagCounts } from "@shared/journal.ts";
import type { JournalEntry } from "@shared/model.ts";

const entries: JournalEntry[] = [
  { id: "a", at: "2026-09-13T08:15:00", sectionTitle: "2026-09-13 08:15:00", displayTitle: null, tags: ["personal"], task: null, body: "Quiet morning.\n\nCoffee on the step." },
  {
    id: "b",
    at: "2026-09-14T21:40:00",
    sectionTitle: "2026-09-14 21:40:00",
    displayTitle: "after the session",
    tags: ["therapy", "personal"],
    task: "Journal",
    body: "Talked about the thing.\n\n- one\n- two",
  },
];

describe("journal markdown", () => {
  it("writes plain key lines under a section title, display_title only when there is one", () => {
    expect(serializeMarkdown(entries)).toBe(
      "## 2026-09-13 08:15:00\nid: a\nat: 2026-09-13T08:15:00\ntag: personal\n\nQuiet morning.\n\nCoffee on the step.\n\n## 2026-09-14 21:40:00\nid: b\nat: 2026-09-14T21:40:00\ntag: therapy, personal\ndisplay_title: after the session\ntask: Journal\n\nTalked about the thing.\n\n- one\n- two\n",
    );
  });

  it("round-trips", () => {
    expect(parseMarkdown(serializeMarkdown(entries))).toEqual(entries);
  });

  it("reads a tag line written as a comma list or repeated", () => {
    const written = "## 2026-09-01 10:00:00\nid: c\nat: 2026-09-01T10:00:00\ntag: books\ntag: house, garden\n\nplain\n";
    expect(parseMarkdown(written)[0]?.tags).toEqual(["books", "house", "garden"]);
  });

  it("reads a section title with the time left off", () => {
    expect(parseMarkdown("## 2026-09-01\nid: d\nat: 2026-09-01\n\nplain\n")[0]).toEqual({
      id: "d",
      at: "2026-09-01",
      sectionTitle: "2026-09-01",
      displayTitle: null,
      tags: [],
      task: null,
      body: "plain",
    });
  });

  it("reads a heading without metadata as its own id, timestamp and title", () => {
    expect(parseMarkdown("## 2026-09-01 10:00:00\nplain\n")).toEqual([
      { id: "2026-09-01 10:00:00", at: "2026-09-01 10:00:00", sectionTitle: "2026-09-01 10:00:00", displayTitle: null, tags: [], task: null, body: "plain" },
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
  it("is display_title when there is one, else the section title", () => {
    expect(entryTitle(entries[0]!)).toBe("2026-09-13 08:15:00");
    expect(entryTitle(entries[1]!)).toBe("after the session");
  });

  it("makes a section title out of a timestamp", () => {
    expect(sectionTitleFrom("2026-09-13T08:15:00")).toBe("2026-09-13 08:15:00");
  });
});

describe("editor text", () => {
  it("writes the tag line, the title and the body", () => {
    expect(entryText(entries[1]!)).toBe("#therapy #personal\n\n## after the session\n\nTalked about the thing.\n\n- one\n- two");
  });

  it("leaves a line to write on when the body is empty", () => {
    expect(entryText({ ...entries[0]!, tags: [], body: "" })).toBe("## 2026-09-13 08:15:00\n\n");
  });

  it("round-trips through the editor", () => {
    expect(entryFrom({ entry: entries[1]!, text: entryText(entries[1]!) })).toEqual(entries[1]);
    expect(entryFrom({ entry: entries[0]!, text: entryText(entries[0]!) })).toEqual(entries[0]);
  });

  it("writes display_title and leaves the section title alone", () => {
    expect(entryFrom({ entry: entries[0]!, text: "#climbing\n\n## blue v4\n\nHeel hook first.\n" })).toEqual({
      ...entries[0]!,
      displayTitle: "blue v4",
      tags: ["climbing"],
      body: "Heel hook first.",
    });
  });

  it("drops display_title when the title is typed back to the section title", () => {
    expect(entryFrom({ entry: entries[1]!, text: "## 2026-09-14 21:40:00\n\nstill here." }).displayTitle).toBe(null);
  });

  it("keeps the title when the line is gone, and reads deeper headings as body", () => {
    expect(entryFrom({ entry: entries[1]!, text: "### tempering\n\ncumin in ghee" })).toEqual({
      ...entries[1]!,
      tags: [],
      body: "### tempering\n\ncumin in ghee",
    });
  });
});
