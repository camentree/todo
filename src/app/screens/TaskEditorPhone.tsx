import { Modal } from "@shared/ui/Modal.tsx";

import type { TaskEditing } from "../hooks/useTaskEditor.ts";
import { useTaskEditor } from "../hooks/useTaskEditor.ts";
import { LeavingConfirm, TaskEditorFields } from "./TaskEditor.tsx";

export function TaskEditorPhone({ task, onCommit, onClose, onDelete }: TaskEditing) {
  const editor = useTaskEditor({ task, onCommit, onClose, onDelete });
  return (
    <>
      <Modal>
        <div className="composer">
          <TaskEditorFields editor={editor} />
        </div>
      </Modal>
      <LeavingConfirm editor={editor} />
    </>
  );
}
