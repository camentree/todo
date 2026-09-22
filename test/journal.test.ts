import { entryFrom, entryTags, entryText, entryTitle, parseMarkdown, readableTitle, serializeMarkdown, tagCounts } from "@app/models/journal.ts";
import type { JournalEntry } from "@app/models/journal.ts";

const entries: JournalEntry[] = [
  { sectionTitle: "2026-09-13T08:15:00", at: "2026-09-13T08:15:00", body: "Quiet morning.\n\nCoffee on the step.", metadata: { tags: ["personal"] } },
  {
    sectionTitle: "2026-09-14T21:40:00",
    at: "2026-09-14T21:40:00",
    body: "Talked about the thing.\n\n### homework\n\n- one\n- two",
    metadata: { displayTitle: "after the session", tags: ["therapy", "personal"] },
  },
];

describe("journal markdown", () => {
  it("heads every entry with its timestamp and fences the display title, tags and author under it", () => {
    expect(serializeMarkdown(entries)).toBe(
      "## 2026-09-13T08:15:00\n\n---\ntags: personal\n---\n\nQuiet morning.\n\nCoffee on the step.\n\n## 2026-09-14T21:40:00\n\n---\ndisplay_title: after the session\ntags: therapy, personal\n---\n\nTalked about the thing.\n\n### homework\n\n- one\n- two\n",
    );
  });

  it("round-trips a plain entry, a display-titled one and a body with its own deeper subheadings", () => {
    expect(parseMarkdown(serializeMarkdown(entries))).toEqual(entries);
  });

  it("writes an author only when there is one, and reads it back", () => {
    const entry: JournalEntry = { sectionTitle: "2026-09-01T10:00:00", at: "2026-09-01T10:00:00", body: "plain", metadata: { author: "parallax" } };
    expect(serializeMarkdown([entry])).toBe("## 2026-09-01T10:00:00\n\n---\nauthor: parallax\n---\n\nplain\n");
    expect(parseMarkdown(serializeMarkdown([entry]))).toEqual([entry]);
  });

  it("leaves out the fence entirely when an entry has no metadata", () => {
    const entry: JournalEntry = { sectionTitle: "2026-09-01T10:00:00", at: "2026-09-01T10:00:00", body: "plain", metadata: {} };
    expect(serializeMarkdown([entry])).toBe("## 2026-09-01T10:00:00\n\nplain\n");
  });

  it("carries a deleted entry in the fence so the file keeps it", () => {
    const entry: JournalEntry = { ...entries[0]!, metadata: { tags: ["personal"], deletedAt: "2026-09-20T10:00:00" } };
    expect(serializeMarkdown([entry])).toBe(
      "## 2026-09-13T08:15:00\n\n---\ntags: personal\ndeleted_at: 2026-09-20T10:00:00\n---\n\nQuiet morning.\n\nCoffee on the step.\n",
    );
    expect(parseMarkdown(serializeMarkdown([entry]))).toEqual([entry]);
  });

  it("keeps an entry deleted when it is written back through the editor", () => {
    const entry: JournalEntry = { ...entries[0]!, metadata: { deletedAt: "2026-09-20T10:00:00" } };
    expect(entryFrom({ entry, text: entryText(entry) }).metadata.deletedAt).toBe("2026-09-20T10:00:00");
  });

  it("reads a tag line written as a comma list or repeated", () => {
    const written = "## 2026-09-01T10:00:00\n\n---\ntags: books\ntags: house, garden\n---\n\nplain\n";
    expect(entryTags(parseMarkdown(written)[0]!)).toEqual(["books", "house", "garden"]);
  });

  it("still reads the display title from the heading an older file carries", () => {
    const written = "## after the session\n\n---\nat: 2026-09-14T21:40:00\n---\n\nplain\n";
    expect(parseMarkdown(written)).toEqual([
      { sectionTitle: "2026-09-14T21:40:00", at: "2026-09-14T21:40:00", body: "plain", metadata: { displayTitle: "after the session" } },
    ]);
  });

  it("drops the id and task lines an older file carries", () => {
    const written = "## 2026-09-01T10:00:00\n\n---\nid: abc123\nat: 2026-09-01T10:00:00\ntask: Journal\n---\n\nplain\n";
    expect(parseMarkdown(written)).toEqual([{ sectionTitle: "2026-09-01T10:00:00", at: "2026-09-01T10:00:00", body: "plain", metadata: {} }]);
  });

  it("takes the section title from a bare heading when there is no fence", () => {
    expect(parseMarkdown("## 2026-09-01T10:00:00\n\nplain\n")).toEqual([
      { sectionTitle: "2026-09-01T10:00:00", at: "2026-09-01T10:00:00", body: "plain", metadata: {} },
    ]);
  });

  it("keeps an unfenced key line as body, the way parallax reads it", () => {
    expect(parseMarkdown("## 2026-09-01T10:00:00\n\nauthor: parallax\n\nplain\n")).toEqual([
      { sectionTitle: "2026-09-01T10:00:00", at: "2026-09-01T10:00:00", body: "author: parallax\n\nplain", metadata: {} },
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
  it("writes the metadata fence under the title, above the body", () => {
    expect(entryText(entries[1]!)).toBe("## after the session\n\n---\ntags: therapy, personal\n---\n\nTalked about the thing.\n\n### homework\n\n- one\n- two");
  });

  it("offers an empty tag line to write on when an entry has no metadata", () => {
    expect(entryText({ ...entries[0]!, body: "", metadata: {} })).toBe("## 2026-09-13T08:15:00\n\n---\ntags:\n---\n\n");
  });

  it("shows the author in the fence alongside the tags", () => {
    const entry: JournalEntry = { ...entries[0]!, metadata: { tags: ["books"], author: "parallax" } };
    expect(entryText(entry)).toBe("## 2026-09-13T08:15:00\n\n---\ntags: books\nauthor: parallax\n---\n\nQuiet morning.\n\nCoffee on the step.");
  });

  it("round-trips through the editor", () => {
    expect(entryFrom({ entry: entries[1]!, text: entryText(entries[1]!) })).toEqual(entries[1]);
    expect(entryFrom({ entry: entries[0]!, text: entryText(entries[0]!) })).toEqual(entries[0]);
  });

  it("reads tags the writer typed into the fence", () => {
    expect(entryTags(entryFrom({ entry: entries[0]!, text: "## 2026-09-13T08:15:00\n\n---\ntags: climbing, books\n---\n\nplain" }))).toEqual(["climbing", "books"]);
  });

  it("drops a tag the writer deleted from the fence", () => {
    expect(entryFrom({ entry: entries[0]!, text: "## 2026-09-13T08:15:00\n\n---\ntags:\n---\n\nplain" }).metadata.tags).toBe(undefined);
  });

  it("keeps a body line that starts with a hash as body", () => {
    expect(entryFrom({ entry: entries[0]!, text: "## 2026-09-13T08:15:00\n\n#1 on the list" }).body).toBe("#1 on the list");
  });

  it("writes a display title and leaves the section title alone", () => {
    expect(entryFrom({ entry: entries[0]!, text: "## blue v4\n\n---\ntags: climbing\n---\n\nHeel hook first.\n" })).toEqual({
      ...entries[0]!,
      body: "Heel hook first.",
      metadata: { displayTitle: "blue v4", tags: ["climbing"] },
    });
  });

  it("drops the display title when the title is typed back to the section title", () => {
    expect(entryFrom({ entry: entries[1]!, text: "## 2026-09-14T21:40:00\n\nstill here." }).metadata.displayTitle).toBe(undefined);
  });

  it("keeps an author nobody typed away", () => {
    const entry: JournalEntry = { ...entries[0]!, metadata: { author: "parallax" } };
    expect(entryFrom({ entry, text: "## blue v4\n\n---\nauthor: parallax\n---\n\nHeel hook first." }).metadata).toEqual({ displayTitle: "blue v4", author: "parallax" });
  });

  it("keeps the title when the line is gone, and reads deeper headings as body", () => {
    expect(entryFrom({ entry: entries[1]!, text: "### tempering\n\ncumin in ghee" })).toEqual({
      ...entries[1]!,
      body: "### tempering\n\ncumin in ghee",
      metadata: { displayTitle: "after the session", tags: ["therapy", "personal"] },
    });
  });
});
