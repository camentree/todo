import { useState } from "react";

import { Confirm } from "@shared/components/Confirm.tsx";
import { formatDuration } from "@shared/format.ts";
import { Modal } from "@shared/ui/Modal.tsx";
import { TextButton } from "@shared/ui/TextButton.tsx";

import { TaskRow } from "../components/TaskRow.tsx";
import type { TaskEditing, TaskEditorState } from "../hooks/useTaskEditor.ts";
import { useTaskEditor } from "../hooks/useTaskEditor.ts";

export function TaskEditorFields({ editor }: { editor: TaskEditorState }) {
  const { task, parsed, preview } = editor;
  return (
    <>
      <div className="preview">
        {preview && parsed ? (
          <TaskRow
            task={preview}
            chips={[preview.parentId === null ? preview.group : "", parsed.restSeconds ? "rest " + formatDuration(parsed.restSeconds) : ""].filter(Boolean)}
            every={parsed.every}
            select={null}
            onHold={null}
            focused={null}
            saved={null}
            onTick={() => null}
            onTitle={() => null}
            onTitleSubtask={null}
            todaySwipe={null}
            onDelete={null}
            onDeleteSubtask={null}
            onAddComment={() => null}
            onDeleteComment={() => null}
            fixedOpen
            unfoldSubtasks={false}
          />
        ) : (
          <div className="dateline">type a task below to see it here</div>
        )}
      </div>
      <div className="composer-field">
        <div className="editor" ref={editor.host} />
        <div className="actions">
          <div className="actions-left">
            {task && (
              <TextButton className="min-h-touch px-1 py-[0.7rem] text-body font-medium text-warn hover:text-warn-hover" onSelect={editor.onDelete}>
                delete
              </TextButton>
            )}
          </div>
          <div className="actions-right">
            <TextButton className="min-h-touch px-1 py-[0.7rem] text-body font-medium text-dim hover:text-text" onSelect={editor.close}>
              cancel
            </TextButton>
            <TextButton
              className={"min-h-touch px-1 py-[0.7rem] text-body font-medium " + (parsed !== null ? "text-accent hover:text-accent-hover" : "text-dim hover:text-text")}
              onSelect={editor.commit}
            >
              {task ? "save" : "add"}
            </TextButton>
          </div>
        </div>
      </div>
    </>
  );
}

export function LeavingConfirm({ editor }: { editor: TaskEditorState }) {
  if (!editor.leaving) return null;
  return (
    <Confirm
      question="save this task?"
      choices={[
        { label: "discard", onChoose: editor.close },
        { label: "save", onChoose: editor.commit },
      ]}
      onCancel={editor.stayHere}
    />
  );
}

export function TaskEditor({ task, onCommit, onClose, onDelete }: TaskEditing) {
  const [closing, setClosing] = useState(false);
  const editor = useTaskEditor({ task, onCommit, onClose: () => setClosing(true), onDelete });
  return (
    <>
      <Modal>
        <div className="scrim" onClick={editor.close} />
        <div className={closing ? "composer closing" : "composer"} onTransitionEnd={(event) => closing && event.target === event.currentTarget && onClose()}>
          <TaskEditorFields editor={editor} />
        </div>
      </Modal>
      <LeavingConfirm editor={editor} />
    </>
  );
}
