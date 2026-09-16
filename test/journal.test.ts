import { autoTitle, entryFrom, entryText, parseMarkdown, serializeMarkdown, tagCounts } from "@shared/journal.ts";
import type { JournalEntry } from "@shared/model.ts";

const entries: JournalEntry[] = [
  { id: "a", at: "2026-09-13T08:15", title: "2026-09-13 - 08:15", tags: ["personal"], task: null, body: "Quiet morning.\n\nCoffee on the step." },
  { id: "b", at: "2026-09-14T21:40", title: "after the session", tags: ["therapy", "personal"], task: "Journal", body: "Talked about the thing.\n\n- one\n- two" },
];

describe("journal markdown", () => {
  it("serialises entries as H2 blocks titled by the section, with a metadata comment", () => {
    expect(serializeMarkdown(entries)).toBe(
      "## 2026-09-13 - 08:15\n<!--\nid: a\nat: 2026-09-13T08:15\ntags: personal\n-->\nQuiet morning.\n\nCoffee on the step.\n\n## after the session\n<!--\nid: b\nat: 2026-09-14T21:40\ntags: therapy, personal\ntask: Journal\n-->\nTalked about the thing.\n\n- one\n- two\n",
    );
  });

  it("round-trips", () => {
    expect(parseMarkdown(serializeMarkdown(entries))).toEqual(entries);
  });

  it("reads a heading without metadata as its own id, timestamp and title", () => {
    expect(parseMarkdown("## 2026-09-01T10:00\nplain\n")).toEqual([
      { id: "2026-09-01T10:00", at: "2026-09-01T10:00", title: "2026-09-01T10:00", tags: [], task: null, body: "plain" },
    ]);
  });

  it("counts every tag in use, alphabetically", () => {
    expect(tagCounts(entries)).toEqual([
      { tag: "personal", count: 2 },
      { tag: "therapy", count: 1 },
    ]);
  });
});

describe("autoTitle", () => {
  it("is the timestamp in 24-hour time, and matches an untouched title", () => {
    expect(autoTitle("2026-09-13T08:15")).toBe("2026-09-13 - 08:15");
    expect(entries[0]!.title).toBe(autoTitle(entries[0]!.at));
    expect(entries[1]!.title).not.toBe(autoTitle(entries[1]!.at));
  });
});

describe("editor text", () => {
  it("writes the tag line, the title and the body", () => {
    expect(entryText(entries[1]!)).toBe("#therapy #personal\n\n## after the session\n\nTalked about the thing.\n\n- one\n- two");
  });

  it("leaves a line to write on when the body is empty", () => {
    expect(entryText({ ...entries[0]!, tags: [], body: "" })).toBe("## 2026-09-13 - 08:15\n\n");
  });

  it("round-trips through the editor", () => {
    expect(entryFrom({ entry: entries[1]!, text: entryText(entries[1]!) })).toEqual(entries[1]);
  });

  it("renames the section and rewrites the tags, keeping the timestamp and the task", () => {
    expect(entryFrom({ entry: entries[1]!, text: "#climbing\n\n## blue v4\n\nHeel hook first.\n" })).toEqual({
      id: "b",
      at: "2026-09-14T21:40",
      title: "blue v4",
      tags: ["climbing"],
      task: "Journal",
      body: "Heel hook first.",
    });
  });

  it("keeps the title when the line is gone, and reads deeper headings as body", () => {
    expect(entryFrom({ entry: entries[0]!, text: "### tempering\n\ncumin in ghee" })).toEqual({
      ...entries[0]!,
      tags: [],
      body: "### tempering\n\ncumin in ghee",
    });
  });
});
