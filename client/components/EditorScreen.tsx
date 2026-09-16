import { useEffect, useState } from "react";

import { Editor } from "./Editor.tsx";
import { CrossGlyph } from "./Glyphs.tsx";
import { Overlay } from "./Overlay.tsx";
import { RoundButton } from "./RoundButton.tsx";
import { TextButton } from "./TextButton.tsx";

export function EditorScreen({
  heading,
  subheading,
  markdown,
  initial,
  onCancel,
  onSave,
}: {
  heading: string;
  subheading: string;
  markdown?: boolean;
  initial: string;
  onCancel: () => void;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
  const save = () => text.trim() && onSave(text);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" && !(event.key === "Enter" && event.metaKey)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Enter") save();
      else onCancel();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [text]);

  return (
    <Overlay>
      <div className="page">
        <div className="screen-head">
          <span className="heading">{heading}</span>
          <RoundButton label="close" onSelect={onCancel}>
            <CrossGlyph />
          </RoundButton>
        </div>
        <div className="dateline">{subheading}</div>
        <div className="editor-host">
          {markdown ? (
            <Editor value={text} onChange={setText} />
          ) : (
            <textarea className="editor" autoFocus value={text} onChange={(event) => setText(event.target.value)} />
          )}
        </div>
        <div className="actions">
          <div />
          <div className="actions-right">
            <TextButton active={false} onSelect={onCancel}>
              cancel
            </TextButton>
            <TextButton active={text.trim() !== ""} onSelect={save}>
              save
            </TextButton>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
