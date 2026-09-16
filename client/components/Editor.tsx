import { useEffect, useRef } from "react";

import { markdown } from "@codemirror/lang-markdown";
import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import type { Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, drawSelection, keymap } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";

const markerNodes = new Set(["EmphasisMark", "CodeMark", "QuoteMark"]);
const toneByNode: Record<string, string> = {
  StrongEmphasis: "cm-strong",
  Emphasis: "cm-em",
  InlineCode: "cm-code",
  ATXHeading1: "cm-heading",
  ATXHeading2: "cm-heading",
  ATXHeading3: "cm-heading",
  Blockquote: "cm-quote",
  ListMark: "cm-bullet",
  HeaderMark: "cm-marker",
};

function decorate(view: EditorView): DecorationSet {
  const { doc, selection } = view.state;
  const caretLine = view.hasFocus ? doc.lineAt(selection.main.head).number : -1;
  const ranges: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        const tone = toneByNode[node.name];
        if (tone) ranges.push(Decoration.mark({ class: tone }).range(node.from, node.to));
        if (node.name === "FencedCode") {
          for (let line = doc.lineAt(node.from); line.from <= node.to; line = doc.line(line.number + 1)) {
            ranges.push(Decoration.line({ class: "cm-fenced" }).range(line.from));
            if (line.number === doc.lines) break;
          }
        }
        if (!markerNodes.has(node.name)) return;
        if (doc.lineAt(node.from).number === caretLine) {
          ranges.push(Decoration.mark({ class: "cm-marker" }).range(node.from, node.to));
          return;
        }
        const trailingSpace = doc.sliceString(node.to, node.to + 1) === " " && node.name !== "EmphasisMark" && node.name !== "CodeMark";
        ranges.push(Decoration.replace({}).range(node.from, trailingSpace ? node.to + 1 : node.to));
      },
    });
  }
  return Decoration.set(ranges, true);
}

const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = decorate(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged) this.decorations = decorate(update.view);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

export function Editor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const latestChange = useRef(onChange);
  latestChange.current = onChange;

  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          markdown(),
          history(),
          drawSelection(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          livePreview,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) latestChange.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    return () => view.destroy();
  }, []);

  return <div className="editor" ref={host} />;
}
