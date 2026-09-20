import { useEffect, useState } from "react";

import { tagsFrom } from "@shared/journal.ts";

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
  initialTags,
  onCancel,
  onSave,
}: {
  heading: string;
  subheading: string;
  initial: string;
  initialTags?: string[];
  onCancel: () => void;
  onSave: (write: { text: string; tags: string[] }) => void;
}) {
  const initialTagLine = (initialTags ?? []).join(", ");
  const [text, setText] = useState(initial);
  const [tagLine, setTagLine] = useState(initialTagLine);
  const [leaving, setLeaving] = useState(false);
  const save = () => text.trim() && onSave({ text, tags: tagsFrom(tagLine) });
  const changed = text !== initial || tagLine !== initialTagLine;

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
  }, [text, tagLine, leaving]);

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
        {initialTags !== undefined && (
          <div className="field">
            <input value={tagLine} onChange={(event) => setTagLine(event.target.value)} placeholder="tags" aria-label="tags" />
          </div>
        )}
        <div className="editor-host">
          <Editor value={text} onChange={setText} />
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
    </Overlay>
  );
}
