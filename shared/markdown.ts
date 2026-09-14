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
