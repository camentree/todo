import type { JournalEntry } from "./model.ts";

export function parseMarkdown(markdown: string): JournalEntry[] {
  const blocks = markdown.split(/^## /m).slice(1);
  return blocks.map((block) => {
    const newline = block.indexOf("\n");
    const heading = (newline === -1 ? block : block.slice(0, newline)).trim();
    const lines = (newline === -1 ? "" : block.slice(newline + 1)).replace(/\n+$/, "");
    const metadata = lines.match(/^<!--\s*([\s\S]*?)\s*-->\n?/);
    const fields: Record<string, string> = {};
    for (const line of (metadata?.[1] ?? "").split("\n")) {
      const colon = line.indexOf(":");
      if (colon === -1) continue;
      const key = line.slice(0, colon).trim();
      if (key) fields[key] = line.slice(colon + 1).trim();
    }
    return {
      id: fields.id ?? heading,
      at: fields.at ?? heading,
      title: heading,
      tags: fields.tags ? fields.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
      task: fields.task || null,
      body: metadata ? lines.slice(metadata[0].length) : lines,
    };
  });
}

export function serializeMarkdown(entries: JournalEntry[]): string {
  return entries
    .map((entry) => {
      const metadata = [`id: ${entry.id}`, `at: ${entry.at}`, `tags: ${entry.tags.join(", ")}`, entry.task ? `task: ${entry.task}` : ""]
        .filter(Boolean)
        .join("\n");
      return `## ${entry.title}\n<!--\n${metadata}\n-->\n${entry.body}\n`;
    })
    .join("\n");
}

export function tagsInUse(entries: JournalEntry[]): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) for (const tag of entry.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => tag);
}

export function entryText(entry: JournalEntry): string {
  const tagLine = entry.tags.map((tag) => "#" + tag).join(" ");
  const lines = entry.tags.length ? [tagLine, `## ${entry.title}`, entry.body] : [`## ${entry.title}`, entry.body];
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
  return { ...entry, tags, title: heading || entry.title, body };
}

function isTagLine(line: string): boolean {
  const words = line.trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every((word) => /^#\S+$/.test(word));
}
