import type { JournalEntry } from "./model.ts";

const timestampShape = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/;

// Parallax fences entry metadata between --- lines; keep the two readers in step
// so an entry written here round-trips through the real backend unchanged.
const fence = "---";

function readFence({ lines, from }: { lines: string[]; from: number }): { fields: Record<string, string>; next: number } {
  const fields: Record<string, string> = {};
  let index = from;
  while (index < lines.length && (lines[index] ?? "").trim() === "") index += 1;
  if ((lines[index] ?? "").trim() !== fence) return { fields, next: index };
  index += 1;
  while (index < lines.length && (lines[index] ?? "").trim() !== fence) {
    const line = lines[index] ?? "";
    const colon = line.indexOf(":");
    if (colon > 0) {
      const key = line.slice(0, colon).trim();
      const value = line.slice(colon + 1).trim();
      if (key === "tags" && fields.tags) fields.tags = `${fields.tags}, ${value}`;
      else fields[key] = value;
    }
    index += 1;
  }
  index += 1;
  while (index < lines.length && (lines[index] ?? "").trim() === "") index += 1;
  return { fields, next: index };
}

export function parseMarkdown(markdown: string): JournalEntry[] {
  const blocks = markdown.split(/^## /m).slice(1);
  return blocks.map((block) => {
    const lines = block.replace(/\n+$/, "").split("\n");
    const heading = (lines[0] ?? "").trim();
    const { fields, next } = readFence({ lines, from: 1 });
    const at = fields.at ?? heading;
    const tags = tagsFrom(fields.tags);
    const displayTitle = fields.display_title ?? (timestampShape.test(heading) ? "" : heading);
    return {
      sectionTitle: at,
      at,
      body: lines.slice(next).join("\n"),
      metadata: {
        ...(displayTitle ? { displayTitle } : {}),
        ...(tags.length ? { tags } : {}),
        ...(fields.author ? { author: fields.author } : {}),
        ...(fields.deleted_at ? { deletedAt: fields.deleted_at } : {}),
      },
    };
  });
}

export function serializeMarkdown(entries: JournalEntry[]): string {
  return entries
    .map((entry) => {
      const metadata = [
        entry.metadata.displayTitle ? `display_title: ${entry.metadata.displayTitle}` : "",
        entry.metadata.tags?.length ? `tags: ${entry.metadata.tags.join(", ")}` : "",
        entry.metadata.author ? `author: ${entry.metadata.author}` : "",
        entry.metadata.deletedAt ? `deleted_at: ${entry.metadata.deletedAt}` : "",
      ].filter(Boolean);
      const parts = [`## ${entry.at}`];
      if (metadata.length) parts.push(`${fence}\n${metadata.join("\n")}\n${fence}`);
      if (entry.body) parts.push(entry.body);
      return `${parts.join("\n\n")}\n`;
    })
    .join("\n");
}

export function tagsFrom(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
