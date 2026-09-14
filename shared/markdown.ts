export type Tone = "marker" | "ink" | "accent" | "body" | "muted" | "italic";

export interface Segment {
  text: string;
  tone: Tone;
}

function inline({ text, tone }: { text: string; tone: Tone }): Segment[] {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/g)
    .filter((piece) => piece !== "")
    .flatMap((piece) => {
      const marker = piece.startsWith("**") ? "**" : piece.startsWith("*") ? "*" : piece.startsWith("_") ? "_" : piece.startsWith("`") ? "`" : null;
      if (!marker || piece.length <= marker.length * 2) return [{ text: piece, tone }];
      const body = piece.slice(marker.length, piece.length - marker.length);
      const bodyTone: Tone = marker === "*" || marker === "_" ? "italic" : "ink";
      return [
        { text: marker, tone: "marker" as Tone },
        { text: body, tone: bodyTone },
        { text: marker, tone: "marker" as Tone },
      ];
    });
}

export function renderLine(line: string): Segment[] {
  const heading = /^(#{1,3}) /.exec(line);
  const listItem = /^([-*] |\d+\. )/.exec(line);
  if (heading) return [{ text: heading[0], tone: "marker" }, ...inline({ text: line.slice(heading[0].length), tone: "ink" })];
  if (listItem) return [{ text: listItem[0], tone: "accent" }, ...inline({ text: line.slice(listItem[0].length), tone: "body" })];
  if (line.startsWith("> ")) return [{ text: "> ", tone: "marker" }, ...inline({ text: line.slice(2), tone: "muted" })];
  return inline({ text: line, tone: "body" });
}

export function stripMarkers(line: string): string {
  return renderLine(line)
    .filter((segment) => segment.tone !== "marker" && segment.tone !== "accent")
    .map((segment) => segment.text)
    .join("");
}

export function preview(text: string): string {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .slice(0, 2)
    .map(stripMarkers)
    .join(" ");
}

export function firstLine(text: string): string {
  return text
    .split("\n")
    .map((line) => stripMarkers(line).trim())
    .find(Boolean) ?? "";
}
