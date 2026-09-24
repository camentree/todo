import { Modal } from "@shared/ui/Modal.tsx";

import type { TaskEditing } from "../hooks/useTaskEditor.ts";
import { useTaskEditor } from "../hooks/useTaskEditor.ts";
import { TaskEditorFields } from "./TaskEditor.tsx";

export function TaskEditorPhone({ task, onCommit, onClose, onDelete }: TaskEditing) {
  const editor = useTaskEditor({ task, onCommit, onClose, onDelete });
  return (
    <Modal>
      <div className="composer flex h-full w-full flex-col bg-ground pt-top [overscroll-behavior:contain]">
        <TaskEditorFields editor={editor} />
      </div>
    </Modal>
  );
}
