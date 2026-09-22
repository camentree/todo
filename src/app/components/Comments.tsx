import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { TextButton } from "@shared/ui/TextButton.tsx";

import type { Comment as CommentModel } from "../models/comment.ts";
import { Comment } from "./Comment.tsx";

function CommentField({ onAdd }: { onAdd: (body: string) => void }) {
  const [body, setBody] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [body]);

  const add = () => {
    if (body.trim() === "") return;
    onAdd(body.trim());
    setBody("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      setBody("");
      field.current?.blur();
      return;
    }
    if (event.key !== "Enter" || event.shiftKey) return;
    if (!event.metaKey && !window.matchMedia("(hover: hover)").matches) return;
    event.preventDefault();
    add();
  };

  return (
    <div className="field flex items-end gap-2 rounded-card bg-raised px-4 py-[0.7rem]">
      <textarea
        className="min-w-0 flex-1 overflow-hidden text-body leading-[1.45] text-text [caret-color:var(--accent)] placeholder:text-faint"
        ref={field}
        rows={1}
        placeholder="add a comment"
        enterKeyHint="send"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <TextButton
        className={"mx-[-0.2rem] my-[-0.7rem] flex-none px-[0.3rem] py-[0.85rem] text-meta text-accent transition-opacity duration-[450ms] ease-[ease] " + (body.trim() === "" ? "pointer-events-none opacity-0" : "opacity-100 hover:text-accent-hover")}
        onSelect={add}
      >
        add
      </TextButton>
    </div>
  );
}

export function Comments({
  comments,
  scrollTo,
  onAdd,
  onDelete,
}: {
  comments: CommentModel[];
  scrollTo: string | null;
  onAdd: (body: string) => void;
  onDelete: (comment: CommentModel) => void;
}) {
  const thread = useRef<HTMLDivElement>(null);
  const ordered = [...comments].sort((a, b) => a.writtenAt.localeCompare(b.writtenAt));

  useEffect(() => {
    const element = thread.current;
    if (!element) return;
    const target = scrollTo ? element.querySelector<HTMLElement>(`[data-comment="${scrollTo}"]`) : null;
    element.scrollTop = target ? target.offsetTop - element.offsetTop : element.scrollHeight;
  }, [comments.length]);

  return (
    <div className="comment-list ml-[calc(var(--indent)*-1)] flex w-[calc(100%+var(--indent))] flex-col items-center gap-2 px-1 pt-[0.3rem] pb-2">
      <div className="thread flex max-h-[18rem] flex-col gap-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" ref={thread}>
        {ordered.map((comment) => (
          <Comment key={comment.id} comment={comment} onDelete={() => onDelete(comment)} />
        ))}
      </div>
      <CommentField onAdd={onAdd} />
    </div>
  );
}
