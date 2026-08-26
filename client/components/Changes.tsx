import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useNavigate } from "react-router-dom";

import { api } from "../data/api.ts";
import { dismissFailure, useFailures } from "../data/failures.ts";
import { formatWhen } from "../tasks/format.ts";
import { usePointerSwipe } from "../hooks/usePointerSwipe.ts";
import { Label } from "./ui/Label.tsx";
import { Menu } from "./ui/Menu.tsx";
import type { Event as TaskEvent } from "@shared/types.ts";

export function Changes({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const failures = useFailures();
  const { data: events = [] } = useQuery({
    queryKey: ["events", "recent"],
    queryFn: api.recentEvents,
    refetchInterval: 300_000,
  });
  const unseen = events.filter((event) => event.seenAt === null);

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
        ["events", "recent"],
        (cached: TaskEvent[] = []) =>
          cached.map((event) =>
            event.id === id
              ? { ...event, seenAt: new Date().toISOString() }
              : event,
          ),
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  return (
    <Menu anchor="right" onClose={onClose}>
      <div className="menu-head">
        <Label>Changes</Label>
        {unseen.length > 0 && (
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
            onOpen={() => {
              seenOne.mutate(event.id);
              if (event.taskId !== null) {
                onClose();
                navigate(`/${event.taskId}`);
              }
            }}
          />
        ))
      )}
    </Menu>
  );
}

function EventRow({
  event,
  onSeen,
  onOpen,
}: {
  event: TaskEvent;
  onSeen: () => void;
  onOpen: () => void;
}) {
  const swipe = usePointerSwipe({
    onRight: onSeen,
  });

  return (
    <div className="event-track">
      {swipe.swiping && <div className="event-action">Seen</div>}
      <div
        className="event"
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!swipe.swiping) {
            onOpen();
          }
        }}
        ref={swipe.ref}
        style={{ transform: `translateX(${swipe.offset}px)` }}
        data-swiping={swipe.swiping}
        onPointerDown={swipe.down}
        onPointerMove={swipe.move}
        onPointerUp={swipe.up}
        onPointerCancel={swipe.up}
      >
        {event.seenAt === null && <span className="here-dot" />}
        {event.taskTitle && (
          <div className="event-title">{event.taskTitle}</div>
        )}
        <div className="event-summary">{event.summary}</div>
        <div className="event-when">
          {formatWhen(event.createdAt)} · {event.source}
        </div>
      </div>
    </div>
  );
}
