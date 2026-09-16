export type Tone = "plain" | "strong" | "em" | "code";

export function inlineSegments(line: string): { text: string; tone: Tone }[] {
  const bare = line.replace(/^#+ |^[-*] |^\d+\. |^> /, "");
  return bare
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/)
    .filter(Boolean)
    .map((piece) => {
      if (piece.startsWith("**")) return { text: piece.slice(2, -2), tone: "strong" };
      if (piece.startsWith("`")) return { text: piece.slice(1, -1), tone: "code" };
      if (piece.startsWith("*") || piece.startsWith("_")) return { text: piece.slice(1, -1), tone: "em" };
      return { text: piece, tone: "plain" };
    });
}

export function stripMarkers(line: string): string {
  return line
    .replace(/^#+ |^[-*] |^\d+\. |^> /, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
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
