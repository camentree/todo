import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

import { formatWhen } from "@shared/format.ts";
import { firstLine, preview, renderLine } from "@shared/markdown.ts";
import type { JournalEntry } from "@shared/types.ts";
import { defaultNotebook, newId } from "@shared/types.ts";

import { ConfirmDelete } from "../components/ConfirmDelete.tsx";
import { useStore } from "../data/store.tsx";

export interface JournalDraft {
  text: string;
  notebook: string;
  editId: string | null;
  linkTaskId: string | null;
  reading: boolean;
  promptDismissed: boolean;
}

function Rendered({ text, currentLine }: { text: string; currentLine: number | null }) {
  return (
    <>
      {text.split("\n").map((line, index) => (
        <div key={index}>
          {line === ""
            ? "​"
            : renderLine(line).map((segment, position) => (
                <span key={position} className={"tone-" + segment.tone + (segment.tone === "marker" && index !== currentLine ? " hidden-marker" : "")}>
                  {segment.text}
                </span>
              ))}
        </div>
      ))}
    </>
  );
}

function lineOf({ text, offset }: { text: string; offset: number }): number {
  return text.slice(0, offset).split("\n").length - 1;
}

function caretAt({ event, text }: { event: MouseEvent<HTMLDivElement>; text: string }): number {
  const range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
  if (!range) return text.length;
  const root = event.currentTarget;
  let offset = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node === range.startContainer) {
      offset += range.startOffset;
      break;
    }
    offset += (node.textContent ?? "").replace(/​/g, "").length;
    node = walker.nextNode();
  }
  const lineIndex = Array.from(root.children).findIndex((child) => child.contains(range.startContainer));
  return Math.min(text.length, offset + Math.max(0, lineIndex));
}

function NotebookPicker({
  notebooks,
  chosen,
  onPick,
  className,
}: {
  notebooks: string[];
  chosen: string | null;
  onPick: (notebook: string) => void;
  className: string;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const commit = () => {
    const trimmed = name.trim().toLowerCase();
    setNaming(false);
    setName("");
    if (trimmed) onPick(trimmed);
  };
  return (
    <div className={className}>
      {notebooks.map((notebook) => (
        <button key={notebook} className={chosen === notebook ? "active" : ""} onClick={() => onPick(notebook)}>
          {notebook}
        </button>
      ))}
      {naming ? (
        <input
          className="notebook-name"
          autoFocus
          value={name}
          placeholder="notebook"
          autoCapitalize="off"
          onChange={(event) => setName(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") setName("");
          }}
        />
      ) : (
        <button className="faint" onClick={() => setNaming(true)}>
          new
        </button>
      )}
    </div>
  );
}

export function JournalScreen({
  draft,
  onDraft,
  onNotebook,
  canReturn,
  onReturn,
  onClose,
}: {
  draft: JournalDraft | null;
  onDraft: (draft: JournalDraft | null) => void;
  onNotebook: (notebook: string) => void;
  canReturn: boolean;
  onReturn: () => void;
  onClose: () => void;
}) {
  const store = useStore();
  const [filter, setFilter] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pendingCaret, setPendingCaret] = useState<number | null>(null);
  const [currentLine, setCurrentLine] = useState(0);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const now = new Date();
  const notebooks = [...new Set([defaultNotebook, ...store.entries.map((entry) => entry.notebook), ...(draft ? [draft.notebook] : [])])];

  useEffect(() => {
    if (pendingCaret === null || !textarea.current) return;
    textarea.current.focus();
    textarea.current.setSelectionRange(pendingCaret, pendingCaret);
    setCurrentLine(lineOf({ text: textarea.current.value, offset: pendingCaret }));
    setPendingCaret(null);
  }, [pendingCaret]);

  useEffect(() => {
    if (draft && !draft.reading) textarea.current?.focus();
  }, [draft?.editId, draft?.reading]);

  if (!draft) {
    const entries = store.entries.filter((entry) => !filter || entry.notebook === filter).sort((a, b) => b.at.localeCompare(a.at));
    return (
      <div className="screen">
        <div className="screen-title">
          <span>Journal</span>
          {canReturn && (
            <button className="text-button muted" style={{ padding: 0 }} onClick={onReturn}>
              ‹ back
            </button>
          )}
        </div>
        <div className="scroll" style={{ paddingTop: 0 }}>
          <div className="filters">
            <button className={filter === null ? "active" : ""} onClick={() => setFilter(null)}>
              all
            </button>
            {notebooks.map((name) => (
              <button key={name} className={filter === name ? "active" : ""} onClick={() => setFilter(filter === name ? null : name)}>
                {name}
              </button>
            ))}
          </div>
          {entries.map((entry) => {
            const linked = entry.taskId ? store.tasks.find((task) => task.id === entry.taskId) : null;
            return (
              <button
                key={entry.id}
                className="entry-card"
                onClick={() =>
                  onDraft({ text: entry.text, notebook: entry.notebook, editId: entry.id, linkTaskId: entry.taskId, reading: true, promptDismissed: true })
                }
              >
                <div className="comment-when numbers">
                  <span>{formatWhen({ at: new Date(entry.at), now })}</span>
                  <span>{entry.notebook}</span>
                  {linked && <span style={{ textTransform: "lowercase" }}>{linked.name}</span>}
                </div>
                <div className="entry-preview">{preview(entry.text)}</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const linked = draft.linkTaskId ? store.tasks.find((task) => task.id === draft.linkTaskId) : null;
  const prompt = linked ? (linked.type === "text" ? linked.name : "About " + linked.name + " just now.") : "What is one thing you noticed today?";
  const showPrompt = !draft.promptDismissed && !draft.text && !draft.editId;

  const trackCaret = () => {
    if (textarea.current) setCurrentLine(lineOf({ text: textarea.current.value, offset: textarea.current.selectionStart }));
  };

  const save = () => {
    if (!draft.text.trim()) return;
    const entry: JournalEntry = draft.editId
      ? { ...(store.entries.find((each) => each.id === draft.editId) as JournalEntry), text: draft.text, notebook: draft.notebook }
      : { id: newId("e"), at: new Date().toISOString(), notebook: draft.notebook, taskId: draft.linkTaskId, text: draft.text };
    if (draft.editId) store.updateEntry(entry);
    else store.addEntry(entry);
    if (linked && linked.type === "text") store.patchTask({ id: linked.id, patch: { value: firstLine(draft.text), doneManual: null } });
    onNotebook(draft.notebook);
    onClose();
  };

  const remove = () => {
    if (draft.editId) store.removeEntry(draft.editId);
    setConfirming(false);
    onClose();
  };

  return (
    <div className="screen">
      <NotebookPicker className="notebooks" notebooks={notebooks} chosen={draft.notebook} onPick={(notebook) => onDraft({ ...draft, notebook })} />
      <div className="editor-scroll">
        {showPrompt && (
          <div className="prompt">
            <span>{prompt}</span>
            <button aria-label="dismiss prompt" onClick={() => onDraft({ ...draft, promptDismissed: true })}>
              ×
            </button>
          </div>
        )}
        {draft.reading ? (
          <div
            className="rendered read"
            onClick={(event) => {
              setPendingCaret(caretAt({ event, text: draft.text }));
              onDraft({ ...draft, reading: false });
            }}
          >
            <Rendered text={draft.text} currentLine={null} />
          </div>
        ) : (
          <div className="editor">
            <div className="rendered" aria-hidden="true">
              <Rendered text={draft.text} currentLine={currentLine} />
            </div>
            <textarea
              ref={textarea}
              value={draft.text}
              onChange={(event) => {
                onDraft({ ...draft, text: event.target.value });
                setCurrentLine(lineOf({ text: event.target.value, offset: event.target.selectionStart }));
              }}
              onSelect={trackCaret}
              onKeyUp={trackCaret}
              onClick={trackCaret}
              rows={Math.max(8, draft.text.split("\n").length + 2)}
              spellCheck={false}
            />
          </div>
        )}
      </div>
      <div className="editor-bar">
        <div>
          {draft.editId && (
            <button className="text-button destructive" onClick={() => setConfirming(true)}>
              delete
            </button>
          )}
        </div>
        <div className="right">
          <button className="text-button muted" onClick={onClose}>
            cancel
          </button>
          <button className={draft.text.trim() ? "text-button accent last" : "text-button faint last"} onClick={save}>
            save
          </button>
        </div>
      </div>
      {confirming && <ConfirmDelete title="Delete this entry?" sub="This can't be undone." onCancel={() => setConfirming(false)} onDelete={remove} />}
    </div>
  );
}
