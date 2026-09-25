import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

export const editorTheme: Extension = EditorView.baseTheme({
  "&": { flex: "1" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font)", lineHeight: "1.5" },
  ".cm-content": { padding: "0", caretColor: "transparent", WebkitUserSelect: "text", userSelect: "text" },
  ".cm-line": { padding: "0" },
  ".cm-cursor": { borderLeftColor: "var(--accent)" },
  ".cm-placeholder": { color: "var(--faint)", whiteSpace: "pre-wrap" },
  ".cm-selectionBackground": { background: "var(--chip-bg)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": { background: "var(--chip-bg)" },
  "::selection": { background: "var(--chip-bg)" },
});
