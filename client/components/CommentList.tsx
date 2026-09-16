import { useEffect, useRef } from "react";

import { formatWhen } from "@shared/format.ts";
import type { Comment } from "@shared/model.ts";

import { Card } from "./Card.tsx";
import { Swipeable } from "./Swipeable.tsx";

export function CommentList({ comments, scrollTo, onAdd, onDelete }: { comments: Comment[]; scrollTo: string | null; onAdd: () => void; onDelete: (comment: Comment) => void }) {
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
      <button className="field" onClick={onAdd}>
        add a comment
      </button>
    </div>
  );
}
