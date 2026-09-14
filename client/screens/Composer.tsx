import { useEffect, useRef, useState } from "react";

import { commitEntry } from "@shared/composer.ts";
import { formatDuration } from "@shared/format.ts";
import { everyLabel, parseEntry } from "@shared/grammar.ts";
import type { ParsedTask } from "@shared/grammar.ts";
import { leafDone, metaText } from "@shared/tasks.ts";
import type { DerivedTask } from "@shared/types.ts";

import { ConfirmDelete } from "../components/ConfirmDelete.tsx";
import { TaskRow } from "../components/TaskRow.tsx";
import { useStore } from "../data/store.tsx";

export interface ComposerState {
  text: string;
  editTaskId: string | null;
  editDefinitionId: string | null;
}

function previewTask({ parsed, index }: { parsed: ParsedTask; index: number }): DerivedTask {
  const task = {
    id: "preview-" + index,
    name: parsed.title,
    type: parsed.type,
    kind: parsed.kind,
    target: parsed.target,
    current: parsed.current ?? 0,
    unit: parsed.unit,
    rest: parsed.rest,
    parent: index === 0 ? null : "preview-0",
    group: "",
    note: parsed.note,
    value: parsed.value ?? "",
    doneManual: parsed.doneManual,
    tapIncrement: parsed.tapIncrement,
    definitionId: null,
    auto: null,
  };
  return { ...task, done: leafDone({ task, entries: [], date: "" }) };
}

export function Composer({ state, onChange, onClose }: { state: ComposerState; onChange: (state: ComposerState) => void; onClose: () => void }) {
  const store = useStore();
  const [confirming, setConfirming] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const editing = state.editTaskId !== null || state.editDefinitionId !== null;
  const parsed = state.text.trim() ? parseEntry(state.text) : null;
  const rows = parsed ? [previewTask({ parsed, index: 0 }), ...parsed.children.map((child, index) => previewTask({ parsed: child, index: index + 1 }))] : [];
  const meta = parsed
    ? [parsed.every ? everyLabel(parsed.every) : "today only", parsed.group, parsed.rest ? "rest " + formatDuration(parsed.rest) : ""].filter(Boolean).join(" · ")
    : "Type a task above to see it here.";

  useEffect(() => {
    textarea.current?.focus();
  }, []);

  const save = () => {
    const result = commitEntry({
      text: state.text,
      tasks: store.tasks,
      definitions: store.definitions,
      editTaskId: state.editTaskId,
      editDefinitionId: state.editDefinitionId,
      date: store.date,
    });
    if (!result) return;
    store.setTasks(() => result.tasks);
    if (result.definitions !== store.definitions) store.setDefinitions(result.definitions);
    onClose();
  };

  const remove = () => {
    const id = state.editTaskId;
    store.setTasks((tasks) => tasks.filter((task) => task.id !== id && task.parent !== id));
    if (state.editDefinitionId) store.setDefinitions(store.definitions.filter((definition) => definition.id !== state.editDefinitionId));
    setConfirming(false);
    onClose();
  };

  return (
    <div className="screen">
      <div className="compose-meta">{meta}</div>
      <div className="compose-preview">
        {rows.map((task, index) => (
          <div key={task.id}>
            {index === 1 && parsed?.note && <div className="note" style={{ paddingBottom: 8 }}>{parsed.note}</div>}
            <TaskRow
              id={task.id}
              name={task.name}
              meta={metaText(task)}
              done={task.done}
              child={index > 0}
              arranging={false}
              dragging={false}
              press={null}
              onOpen={() => textarea.current?.focus()}
              onToggle={() => textarea.current?.focus()}
              onDragStart={null}
            />
          </div>
        ))}
        {rows.length === 1 && parsed?.note && <div className="note" style={{ paddingTop: 8 }}>{parsed.note}</div>}
      </div>
      <div className="entry">
        <textarea
          ref={textarea}
          value={state.text}
          onChange={(event) => onChange({ ...state, text: event.target.value })}
          onBlur={() => {
            if (!state.text.trim() && !editing) onClose();
          }}
          rows={Math.min(12, Math.max(5, state.text.split("\n").length + 1))}
          placeholder={"Hangboard #every 2d /exercise #rest 60s\n\n- Hang #timer 30s"}
          spellCheck={false}
          autoCapitalize="off"
        />
        <div className="entry-actions">
          <div>
            {editing && (
              <button className="text-button destructive" onClick={() => setConfirming(true)}>
                delete
              </button>
            )}
          </div>
          <div className="right">
            <button className="text-button muted" onClick={onClose}>
              cancel
            </button>
            <button className={state.text.trim() ? "text-button accent last" : "text-button faint last"} onClick={save}>
              {editing ? "save" : "add"}
            </button>
          </div>
        </div>
      </div>
      {confirming && (
        <ConfirmDelete
          title="Delete this task?"
          sub={state.editDefinitionId ? "Removes it from today and every future day." : "Removes it from today."}
          onCancel={() => setConfirming(false)}
          onDelete={remove}
        />
      )}
    </div>
  );
}
