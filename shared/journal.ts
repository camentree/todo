import type { JournalEntry } from "./model.ts";

export function parseMarkdown(markdown: string): JournalEntry[] {
  const blocks = markdown.split(/^## /m).slice(1);
  return blocks.map((block) => {
    const lines = block.replace(/\n+$/, "").split("\n");
    const sectionTitle = (lines[0] ?? "").trim();
    const fields: Record<string, string> = {};
    const tags: string[] = [];
    let index = 1;
    while (/^[a-z_]+: /.test(lines[index] ?? "")) {
      const line = lines[index] ?? "";
      const colon = line.indexOf(":");
      const key = line.slice(0, colon);
      const value = line.slice(colon + 1).trim();
      if (key === "tag") for (const tag of value.split(",")) tags.push(tag.trim());
      else fields[key] = value;
      index += 1;
    }
    while (index < lines.length && (lines[index] ?? "").trim() === "") index += 1;
    return {
      id: fields.id ?? sectionTitle,
      at: fields.at ?? sectionTitle,
      sectionTitle,
      displayTitle: fields.display_title || null,
      tags: tags.filter(Boolean),
      task: fields.task || null,
      body: lines.slice(index).join("\n"),
    };
  });
}

export function serializeMarkdown(entries: JournalEntry[]): string {
  return entries
    .map((entry) => {
      const metadata = [
        `id: ${entry.id}`,
        `at: ${entry.at}`,
        entry.tags.length ? `tag: ${entry.tags.join(", ")}` : "",
        entry.displayTitle ? `display_title: ${entry.displayTitle}` : "",
        entry.task ? `task: ${entry.task}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      return `## ${entry.sectionTitle}\n${metadata}\n\n${entry.body}\n`;
    })
    .join("\n");
}

export function tagCounts(entries: JournalEntry[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const entry of entries) for (const tag of entry.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([tag, count]) => ({ tag, count }));
}

export function sectionTitleFrom(at: string): string {
  return at.replace("T", " ");
}

export function entryTitle(entry: JournalEntry): string {
  return entry.displayTitle ?? entry.sectionTitle;
}

export function entryText(entry: JournalEntry): string {
  const tagLine = entry.tags.map((tag) => "#" + tag).join(" ");
  const lines = entry.tags.length ? [tagLine, `## ${entryTitle(entry)}`, entry.body] : [`## ${entryTitle(entry)}`, entry.body];
  return lines.join("\n\n");
}

export function entryFrom({ entry, text }: { entry: JournalEntry; text: string }): JournalEntry {
  const lines = text.split("\n");
  const tags: string[] = [];
  let index = 0;
  while (isTagLine(lines[index] ?? "")) {
    for (const word of (lines[index] ?? "").trim().split(/\s+/)) tags.push(word.slice(1).toLowerCase());
    index += 1;
  }
  while (index < lines.length && (lines[index] ?? "").trim() === "") index += 1;
  const titled = (lines[index] ?? "").startsWith("## ");
  const heading = titled ? (lines[index] ?? "").slice(3).trim() : "";
  if (titled) index += 1;
  const body = lines.slice(index).join("\n").replace(/^\n+/, "").replace(/\n+$/, "");
  const displayTitle = titled ? (heading === "" || heading === entry.sectionTitle ? null : heading) : entry.displayTitle;
  return { ...entry, tags, displayTitle, body };
}

function isTagLine(line: string): boolean {
  const words = line.trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every((word) => /^#\S+$/.test(word));
}
