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
      at: heading,
      tags: fields.tags ? fields.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
      task: fields.task || null,
      body: metadata ? lines.slice(metadata[0].length) : lines,
    };
  });
}

export function serializeMarkdown(entries: JournalEntry[]): string {
  return entries
    .map((entry) => {
      const metadata = [`id: ${entry.id}`, `tags: ${entry.tags.join(", ")}`, entry.task ? `task: ${entry.task}` : ""]
        .filter(Boolean)
        .join("\n");
      return `## ${entry.at}\n<!--\n${metadata}\n-->\n${entry.body}\n`;
    })
    .join("\n");
}

export function tagsInUse(entries: JournalEntry[]): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) for (const tag of entry.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => tag);
}
