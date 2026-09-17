import type { ReactNode } from "react";

import type { SyntaxNode } from "@lezer/common";
import { parser } from "@lezer/markdown";

const hiddenMarks = new Set(["EmphasisMark", "CodeMark"]);

function rendered({ text, node }: { text: string; node: SyntaxNode }): ReactNode[] {
  const parts: ReactNode[] = [];
  let at = node.from;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.from > at) parts.push(text.slice(at, child.from));
    at = child.to;
    if (hiddenMarks.has(child.name)) continue;
    const inside = rendered({ text, node: child });
    if (child.name === "StrongEmphasis") parts.push(<strong key={child.from}>{inside}</strong>);
    else if (child.name === "Emphasis") parts.push(<em key={child.from}>{inside}</em>);
    else if (child.name === "InlineCode") parts.push(<code key={child.from}>{inside}</code>);
    else parts.push(...inside);
  }
  if (at < node.to) parts.push(text.slice(at, node.to));
  return parts;
}

export function MarkdownPreview({ text }: { text: string }) {
  const lines = text.split("\n").filter((line) => line.trim() && !line.startsWith("```"));
  return (
    <>
      {lines.map((line, index) => (
        <div key={index}>{rendered({ text: line, node: parser.parse(line).topNode })}</div>
      ))}
    </>
  );
}
