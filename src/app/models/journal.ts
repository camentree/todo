export interface JournalMetadata {
  displayTitle?: string;
  tags?: string[];
  author?: string;
  deletedAt?: string;
}

export interface JournalEntry {
  sectionTitle: string;
  at: string;
  body: string;
  metadata: JournalMetadata;
}

const timestampShape = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/;

// Parallax fences entry metadata between --- lines; keep the two readers in step
// so an entry written here round-trips through the real backend unchanged.
const fence = "---";

function readFence({ lines, from }: { lines: string[]; from: number }): { fields: Record<string, string>; fenced: boolean; next: number } {
  const fields: Record<string, string> = {};
  let index = from;
  while (index < lines.length && (lines[index] ?? "").trim() === "") index += 1;
  if ((lines[index] ?? "").trim() !== fence) return { fields, fenced: false, next: index };
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
  return { fields, fenced: true, next: index };
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

export function entryTags(entry: JournalEntry): string[] {
  return entry.metadata.tags ?? [];
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
  const tags = entry.metadata.tags ?? [];
  const metadata = [`tags: ${tags.join(", ")}`.trimEnd(), entry.metadata.author ? `author: ${entry.metadata.author}` : ""].filter(Boolean);
  return [`## ${entryTitle(entry)}`, `${fence}\n${metadata.join("\n")}\n${fence}`, entry.body].join("\n\n");
}

export function entryFrom({ entry, text }: { entry: JournalEntry; text: string }): JournalEntry {
  const lines = text.split("\n");
  const titled = (lines[0] ?? "").startsWith("## ");
  const heading = titled ? (lines[0] ?? "").slice(3).trim() : "";
  const { fields, fenced, next } = readFence({ lines, from: titled ? 1 : 0 });
  const body = lines.slice(next).join("\n").replace(/^\n+/, "").replace(/\n+$/, "");
  const displayTitle = titled ? (heading === entry.sectionTitle ? "" : heading) : (entry.metadata.displayTitle ?? "");
  const tags = fenced ? tagsFrom(fields.tags) : (entry.metadata.tags ?? []);
  const author = fenced ? fields.author : entry.metadata.author;
  return {
    ...entry,
    body,
    metadata: {
      ...(displayTitle ? { displayTitle } : {}),
      ...(tags.length ? { tags } : {}),
      ...(author ? { author } : {}),
      ...(entry.metadata.deletedAt ? { deletedAt: entry.metadata.deletedAt } : {}),
    },
  };
}

export function tagsFrom(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}


function stripMarkers(line: string): string {
  return line
    .replace(/^#+ |^[-*] |^\d+\. |^> /, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

export function wordCount(text: string): number {
  return text
    .split("\n")
    .map(stripMarkers)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}
