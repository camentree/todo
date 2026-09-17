export function stripMarkers(line: string): string {
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
