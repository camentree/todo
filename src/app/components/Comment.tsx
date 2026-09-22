import { formatWhen } from "@shared/format.ts";
import { Card } from "@shared/ui/Card.tsx";
import { Swipeable } from "@shared/ui/Swipeable.tsx";

import type { Comment as CommentModel } from "../models/comment.ts";

export function Comment({ comment, onDelete }: { comment: CommentModel; onDelete: () => void }) {
  return (
    <div className={comment.author === "user" ? "bubble user" : "bubble agent"} data-comment={comment.id}>
      <Swipeable right={null} left={{ word: "delete", onSwipe: onDelete }}>
        <Card className={comment.author === "user" ? "user" : "agent"} body={comment.body} when={formatWhen(comment.writtenAt)} />
      </Swipeable>
    </div>
  );
}
