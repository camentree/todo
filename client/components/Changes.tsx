import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "../data/api.ts";
import { dismissFailure, useFailures } from "../data/failures.ts";
import { formatWhen } from "../tasks/format.ts";
import { usePointerSwipe } from "../hooks/usePointerSwipe.ts";
import { Label } from "./ui/Label.tsx";
import { Menu } from "./ui/Menu.tsx";
import type { Event as TaskEvent } from "@shared/types.ts";

export function Changes({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const failures = useFailures();
  const { data: events = [] } = useQuery({
    queryKey: ["events", "unseen"],
    queryFn: api.unseenEvents,
    refetchInterval: 300_000,
  });

  const markSeen = useMutation({
    mutationFn: api.markEventsSeen,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      onClose();
    },
  });

  const seenOne = useMutation({
    mutationFn: (id: number) => api.markEventSeen(id),
    onMutate: (id: number) => {
      queryClient.setQueryData(
        ["events", "unseen"],
        (cached: TaskEvent[] = []) =>
          cached.filter((event) => event.id !== id),
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  return (
    <Menu anchor="right" onClose={onClose}>
      <div className="menu-head">
        <Label>Changes</Label>
        {events.length > 0 && (
          <button
            type="button"
            className="link"
            onClick={() => markSeen.mutate()}
          >
            Mark all seen
          </button>
        )}
      </div>
      {failures.map((failure) => (
        <button
          type="button"
          key={`failure-${failure.id}`}
          className="event failed"
          onClick={() => dismissFailure(failure.id)}
        >
          <span className="event-summary">
            Could not {failure.doing}
          </span>
          <span className="event-when">{failure.reason}</span>
        </button>
      ))}

      {events.length === 0 && failures.length === 0 ? (
        <p className="menu-empty">Nothing new.</p>
      ) : (
        events.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            onSeen={() => seenOne.mutate(event.id)}
          />
        ))
      )}
    </Menu>
  );
}

function EventRow({
  event,
  onSeen,
}: {
  event: TaskEvent;
  onSeen: () => void;
}) {
  const swipe = usePointerSwipe({
    onRight: onSeen,
  });

  return (
    <div className="event-track">
      {swipe.swiping && <div className="event-action">Seen</div>}
      <div
        className="event"
        ref={swipe.ref}
        style={{ transform: `translateX(${swipe.offset}px)` }}
        data-swiping={swipe.swiping}
        onPointerDown={swipe.down}
        onPointerMove={swipe.move}
        onPointerUp={swipe.up}
        onPointerCancel={swipe.up}
      >
        {event.taskTitle && (
          <div className="event-title">{event.taskTitle}</div>
        )}
        <div>{event.summary}</div>
        <div className="event-when">
          {formatWhen(event.createdAt)} · {event.source}
        </div>
      </div>
    </div>
  );
}
