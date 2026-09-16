import { parseMarkdown, serializeMarkdown, tagsInUse } from "@shared/journal.ts";
import type { JournalEntry } from "@shared/model.ts";

const entries: JournalEntry[] = [
  { id: "a", at: "2026-09-13T08:15", tags: ["personal"], task: null, body: "Quiet morning.\n\nCoffee on the step." },
  { id: "b", at: "2026-09-14T21:40", tags: ["therapy", "personal"], task: "Journal", body: "Talked about the thing.\n\n- one\n- two" },
];

describe("journal markdown", () => {
  it("serialises entries as H2 blocks with a metadata comment", () => {
    expect(serializeMarkdown(entries)).toBe(
      "## 2026-09-13T08:15\n<!--\nid: a\ntags: personal\n-->\nQuiet morning.\n\nCoffee on the step.\n\n## 2026-09-14T21:40\n<!--\nid: b\ntags: therapy, personal\ntask: Journal\n-->\nTalked about the thing.\n\n- one\n- two\n",
    );
  });

  it("round-trips", () => {
    expect(parseMarkdown(serializeMarkdown(entries))).toEqual(entries);
  });

  it("reads a heading without metadata as its own id", () => {
    expect(parseMarkdown("## 2026-09-01T10:00\nplain\n")).toEqual([{ id: "2026-09-01T10:00", at: "2026-09-01T10:00", tags: [], task: null, body: "plain" }]);
  });

  it("lists tags by use", () => {
    expect(tagsInUse(entries)).toEqual(["personal", "therapy"]);
  });
});
