import type { JournalEntry } from "./model.ts";

const timestampShape = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/;

export function parseMarkdown(markdown: string): JournalEntry[] {
  const blocks = markdown.split(/^## /m).slice(1);
  return blocks.map((block) => {
    const lines = block.replace(/\n+$/, "").split("\n");
    const heading = (lines[0] ?? "").trim();
    const fields: Record<string, string> = {};
    let index = 1;
    while (index < lines.length && (lines[index] ?? "").trim() === "") index += 1;
    while (/^[a-z_]+: /.test(lines[index] ?? "")) {
      const line = lines[index] ?? "";
      const colon = line.indexOf(":");
      const key = line.slice(0, colon);
      const value = line.slice(colon + 1).trim();
      if (key === "tag" && fields.tag) fields.tag = `${fields.tag}, ${value}`;
      else fields[key] = value;
      index += 1;
    }
    while (index < lines.length && (lines[index] ?? "").trim() === "") index += 1;
    const at = fields.at ?? heading;
    const tags = tagsFrom(fields.tag);
    return {
      sectionTitle: at,
      at,
      body: lines.slice(index).join("\n"),
      metadata: {
        ...(timestampShape.test(heading) ? {} : { displayTitle: heading }),
        ...(tags.length ? { tag: tags } : {}),
        ...(fields.author ? { author: fields.author } : {}),
      },
    };
  });
}

export function serializeMarkdown(entries: JournalEntry[]): string {
  return entries
    .map((entry) => {
      const metadata = [`at: ${entry.at}`, entry.metadata.tag?.length ? `tag: ${entry.metadata.tag.join(", ")}` : "", entry.metadata.author ? `author: ${entry.metadata.author}` : ""]
        .filter(Boolean)
        .join("\n");
      return `## ${entryTitle(entry)}\n\n${metadata}\n\n${entry.body}\n`;
    })
    .join("\n");
}

export function entryTags(entry: JournalEntry): string[] {
  return entry.metadata.tag ?? [];
}

export function tagCounts(entries: JournalEntry[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const entry of entries) for (const tag of entryTags(entry)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([tag, count]) => ({ tag, count }));
}

export function entryTitle(entry: JournalEntry): string {
  return entry.metadata.displayTitle ?? entry.sectionTitle;
}

export function readableTitle(entry: JournalEntry): string {
  return entry.metadata.displayTitle ?? entry.sectionTitle.replace("T", " ").slice(0, 16);
}

export function entryText(entry: JournalEntry): string {
  const tags = entryTags(entry);
  const tagLine = tags.map((tag) => "#" + tag).join(" ");
  const lines = tags.length ? [`## ${entryTitle(entry)}`, tagLine, entry.body] : [`## ${entryTitle(entry)}`, entry.body];
  return lines.join("\n\n");
}

export function entryFrom({ entry, text }: { entry: JournalEntry; text: string }): JournalEntry {
  const lines = text.split("\n");
  const tags: string[] = [];
  let index = 0;
  const titled = (lines[index] ?? "").startsWith("## ");
  const heading = titled ? (lines[index] ?? "").slice(3).trim() : "";
  if (titled) index += 1;
  while (index < lines.length && (lines[index] ?? "").trim() === "") index += 1;
  while (isTagLine(lines[index] ?? "")) {
    for (const word of (lines[index] ?? "").trim().split(/\s+/)) tags.push(word.slice(1).toLowerCase());
    index += 1;
  }
  const body = lines.slice(index).join("\n").replace(/^\n+/, "").replace(/\n+$/, "");
  const displayTitle = titled ? (heading === entry.sectionTitle ? "" : heading) : (entry.metadata.displayTitle ?? "");
  return {
    ...entry,
    body,
    metadata: {
      ...(displayTitle ? { displayTitle } : {}),
      ...(tags.length ? { tag: tags } : {}),
      ...(entry.metadata.author ? { author: entry.metadata.author } : {}),
    },
  };
}

export function tagsFrom(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function isTagLine(line: string): boolean {
  const words = line.trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every((word) => /^#\S+$/.test(word));
}
