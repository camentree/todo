import { formatWhen } from "@shared/format.ts";
import type { Comment } from "@shared/model.ts";

import { useStore } from "../data/store.tsx";
import { Card } from "./Card.tsx";
import { Swipeable } from "./Swipeable.tsx";

export function CommentList({ comments, onAdd, onDelete }: { comments: Comment[]; onAdd: () => void; onDelete: (comment: Comment) => void }) {
  const store = useStore();
  return (
    <div className="comment-list">
      {comments.map((comment) => (
        <Swipeable key={comment.id} onRight={null} onLeft={() => onDelete(comment)}>
          <Card body={comment.body} when={formatWhen({ at: comment.writtenAt, today: store.today })} />
        </Swipeable>
      ))}
      <button className="field" onClick={onAdd}>
        Add a comment
      </button>
    </div>
  );
}
