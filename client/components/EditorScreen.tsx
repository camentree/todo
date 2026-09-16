import { useEffect, useState } from "react";

import { Confirm } from "./Confirm.tsx";
import { Editor } from "./Editor.tsx";
import { CrossGlyph } from "./Glyphs.tsx";
import { Overlay } from "./Overlay.tsx";
import { RoundButton } from "./RoundButton.tsx";
import { TextButton } from "./TextButton.tsx";

export function EditorScreen({
  heading,
  subheading,
  initial,
  onCancel,
  onDelete,
  onSave,
}: {
  heading: string;
  subheading: string;
  initial: string;
  onCancel: () => void;
  onDelete?: () => void;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const save = () => text.trim() && onSave(text);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" && !(event.key === "Enter" && event.metaKey)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Enter") save();
      else if (leaving) setLeaving(false);
      else if (text !== initial) setLeaving(true);
      else onCancel();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [text, leaving]);

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
          <Editor value={text} onChange={setText} />
        </div>
        <div className="actions">
          <div className="actions-left">
            {onDelete && (
              <TextButton active={false} warn onSelect={() => setDeleting(true)}>
                delete
              </TextButton>
            )}
          </div>
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
      {leaving && (
        <Confirm
          question="save this entry?"
          choices={[
            { label: "discard", onChoose: onCancel },
            { label: "save", onChoose: save },
          ]}
          onCancel={() => setLeaving(false)}
        />
      )}
      {deleting && onDelete && (
        <Confirm question="delete this entry?" choices={[{ label: "delete", onChoose: onDelete }]} onCancel={() => setDeleting(false)} />
      )}
    </Overlay>
  );
}
