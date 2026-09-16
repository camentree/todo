import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { formatWhen } from "@shared/format.ts";
import type { Comment } from "@shared/model.ts";

import { Card } from "./Card.tsx";
import { Swipeable } from "./Swipeable.tsx";
import { TextButton } from "./TextButton.tsx";

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
    <div className="field">
      <textarea ref={field} rows={1} placeholder="add a comment" enterKeyHint="send" value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={onKeyDown} />
      <TextButton active={body.trim() !== ""} onSelect={add}>
        add
      </TextButton>
    </div>
  );
}

export function CommentList({ comments, scrollTo, onAdd, onDelete }: { comments: Comment[]; scrollTo: string | null; onAdd: (body: string) => void; onDelete: (comment: Comment) => void }) {
  const thread = useRef<HTMLDivElement>(null);
  const ordered = [...comments].sort((a, b) => a.writtenAt.localeCompare(b.writtenAt));

  useEffect(() => {
    const element = thread.current;
    if (!element) return;
    const target = scrollTo ? element.querySelector<HTMLElement>(`[data-comment="${scrollTo}"]`) : null;
    element.scrollTop = target ? target.offsetTop - element.offsetTop : element.scrollHeight;
  }, [comments.length]);

  return (
    <div className="comment-list">
      <div className="thread" ref={thread}>
        {ordered.map((comment) => (
          <div key={comment.id} className={comment.author === "user" ? "bubble user" : "bubble agent"} data-comment={comment.id}>
            <Swipeable onRight={null} onLeft={() => onDelete(comment)}>
              <Card body={comment.body} author={comment.author} when={formatWhen(comment.writtenAt)} />
            </Swipeable>
          </div>
        ))}
      </div>
      <CommentField onAdd={onAdd} />
    </div>
  );
}
