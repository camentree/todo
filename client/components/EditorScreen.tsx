import { useState } from "react";

import { Editor } from "./Editor.tsx";
import { Overlay } from "./Overlay.tsx";
import { TextButton } from "./TextButton.tsx";

export function EditorScreen({
  heading,
  subheading,
  initial,
  onCancel,
  onSave,
}: {
  heading: string;
  subheading: string;
  initial: string;
  onCancel: () => void;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
  return (
    <Overlay>
      <div className="page">
        <div className="screen-head">
          <span className="heading">{heading}</span>
        </div>
        <div className="dateline">{subheading}</div>
        <div className="editor-host">
          <Editor value={text} onChange={setText} autoFocus />
        </div>
        <div className="actions">
          <div />
          <div className="actions-right">
            <TextButton active={false} onSelect={onCancel}>
              cancel
            </TextButton>
            <TextButton active={text.trim() !== ""} onSelect={() => text.trim() && onSave(text)}>
              save
            </TextButton>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
