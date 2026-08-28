import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";

import { api } from "../data/api.ts";
import { formatWhen } from "../tasks/format.ts";
import { usePointerSwipe } from "../hooks/usePointerSwipe.ts";
import { Confirm } from "./ui/Confirm.tsx";
import { Sprite } from "./ui/Sprite.tsx";
import type { Comment } from "@shared/types.ts";

export function Comments({
  taskId,
  reading,
}: {
  taskId: number;
  reading: boolean;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [confirmingDelete, setConfirmingDelete] =
    useState<Comment | null>(null);

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", taskId],
    queryFn: () => api.comments(taskId),
    enabled: reading,
  });

  const refresh = () => queryClient.invalidateQueries();

  const add = useMutation({
    mutationFn: () => api.addComment(taskId, draft),
    onSuccess: () => {
      setDraft("");
      refresh();
    },
  });
  const resurface = useMutation({
    mutationFn: (commentId: number) =>
      api.resurfaceComment(commentId),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (commentId: number) => api.deleteComment(commentId),
    onSuccess: () => {
      setConfirmingDelete(null);
      refresh();
    },
  });

  function send(): void {
    if (draft.trim()) {
      add.mutate();
    }
  }

  return (
    <>
      <div className="comments">
        {comments.map((entry) => (
          <CommentRow
            key={entry.id}
            comment={entry}
            onResurface={() => resurface.mutate(entry.id)}
            onDelete={() => setConfirmingDelete(entry)}
          />
        ))}
        <form
          className="comment-entry"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <textarea
            value={draft}
            rows={2}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (event.metaKey || event.ctrlKey)
              ) {
                event.preventDefault();
                event.stopPropagation();
                send();
              }
            }}
            placeholder="Add a comment"
          />
          <button
            type="submit"
            className="comment-send"
            aria-label="Add"
            disabled={draft.trim().length === 0}
          >
            <Sprite name="send" />
          </button>
        </form>
      </div>

      {confirmingDelete && (
        <Confirm
          question="Delete this comment?"
          detail={confirmingDelete.body}
          onKeep={() => setConfirmingDelete(null)}
          onDestroy={() => remove.mutate(confirmingDelete.id)}
        />
      )}
    </>
  );
}

function CommentRow({
  comment,
  onResurface,
  onDelete,
}: {
  comment: Comment;
  onResurface: () => void;
  onDelete: () => void;
}) {
  const swipe = usePointerSwipe({
    onLeft: onDelete,
    onRight: onResurface,
  });

  return (
    <div className="swipe-track">
      {swipe.swiping && (
        <>
          <div className="swipe-action archive">Delete</div>
          <div className="swipe-action defer">Unseen</div>
        </>
      )}
      <div
        className="comment"
        ref={swipe.ref}
        style={{ transform: `translateX(${swipe.offset}px)` }}
        data-swiping={swipe.swiping}
        onPointerDown={swipe.down}
        onPointerMove={swipe.move}
        onPointerUp={swipe.up}
        onPointerCancel={swipe.up}
      >
        <div className="comment-who">
          {comment.author} · {formatWhen(comment.createdAt)}
        </div>
        <div>{comment.body}</div>
      </div>
    </div>
  );
}
