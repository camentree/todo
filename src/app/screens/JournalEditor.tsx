import { useEffect, useState } from "react";

import { Confirm } from "@shared/components/Confirm.tsx";
import { CrossGlyph } from "@shared/ui/Glyphs.tsx";
import { MarkdownEditor } from "@shared/ui/MarkdownEditor.tsx";
import { Modal } from "@shared/ui/Modal.tsx";
import { RoundButton } from "@shared/ui/RoundButton.tsx";
import { TextButton } from "@shared/ui/TextButton.tsx";

export function JournalEditor({
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
  const [leaving, setLeaving] = useState(false);
  const save = () => text.trim() && onSave(text);
  const changed = text !== initial;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" && !(event.key === "Enter" && event.metaKey)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Enter") save();
      else if (leaving) setLeaving(false);
      else if (changed) setLeaving(true);
      else onCancel();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [text, leaving]);

  return (
    <Modal>
      <div className="page">
        <div className="screen-head">
          <span className="heading">{heading}</span>
          <RoundButton label="close" onSelect={onCancel}>
            <CrossGlyph />
          </RoundButton>
        </div>
        <div className="dateline">{subheading}</div>
        <div className="editor-host">
          <MarkdownEditor value={text} onChange={setText} />
        </div>
        <div className="actions">
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
    </Modal>
  );
}
