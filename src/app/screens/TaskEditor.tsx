import { useState } from "react";

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
      <div className="preview min-h-0 flex-[1_1_0] overflow-y-auto px-gutter pt-[0.6rem] pb-2 [--row-padding:0.2rem_0.25rem] [--tick:1.25rem] [--title:var(--body)] [overscroll-behavior:contain] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&_.subtasks]:p-0 [&_.task]:pointer-events-none desktop:pt-[1.4rem]">
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
          <div className="pb-[0.2rem] text-meta text-dim">type a task below to see it here</div>
        )}
      </div>
      <div className="composer-field flex-none rounded-t-2xl bg-raised px-gutter pt-[1.6rem] pb-bottom pointer-coarse:focus-within:pb-[0.6rem]">
        <div className="flex flex-1 flex-col text-title leading-[1.5]" ref={editor.host} />
        <div className="mt-[0.2rem] flex items-center justify-end">
          <div className="mr-auto flex gap-[1.2rem]">
            {task && (
              <TextButton className="min-h-touch px-1 py-[0.7rem] text-body font-medium text-warn hover:text-warn-hover" onSelect={editor.onDelete}>
                delete
              </TextButton>
            )}
          </div>
          <div className="flex gap-[1.2rem]">
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

export function TaskEditor({ task, onCommit, onClose, onDelete }: TaskEditing) {
  const [closing, setClosing] = useState(false);
  const editor = useTaskEditor({ task, onCommit, onClose: () => setClosing(true), onDelete });
  return (
    <Modal>
      <div className="scrim" onClick={editor.close} />
      <div className={closing ? "composer flex h-full w-full flex-col bg-ground pt-top [overscroll-behavior:contain] closing" : "composer flex h-full w-full flex-col bg-ground pt-top [overscroll-behavior:contain]"} onTransitionEnd={(event) => closing && event.target === event.currentTarget && onClose()}>
        <TaskEditorFields editor={editor} />
      </div>
    </Modal>
  );
}
