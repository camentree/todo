import { formatWhen } from "@shared/format.ts";
import { Card } from "@shared/ui/Card.tsx";
import { Swipeable } from "@shared/ui/Swipeable.tsx";

import type { Comment as CommentModel } from "../models/comment.ts";

export function Comment({ comment, onDelete }: { comment: CommentModel; onDelete: () => void }) {
  return (
    <div className={"max-w-[74%] flex-none " + (comment.author === "user" ? "ml-[0.6rem] self-start" : "mr-[0.6rem] self-end")} data-comment={comment.id}>
      <Swipeable right={null} left={{ word: "delete", onSwipe: onDelete }}>
        <Card className={comment.author === "user" ? "rounded-bl-[0.2rem] bg-chip" : "rounded-br-[0.2rem]"} body={comment.body} when={formatWhen(comment.writtenAt)} />
      </Swipeable>
    </div>
  );
}
