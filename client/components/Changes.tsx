import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useNavigate } from "react-router-dom";

import { api } from "../data/api.ts";
import { dismissFailure, useFailures } from "../data/failures.ts";
import { formatWhen } from "../tasks/format.ts";
import { Label } from "./ui/Label.tsx";
import { Menu } from "./ui/Menu.tsx";
import { Swipeable } from "./ui/Swipeable.tsx";
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

  const markOne = useMutation({
    mutationFn: ({ id, seen }: { id: number; seen: boolean }) =>
      seen ? api.markEventSeen(id) : api.markEventUnseen(id),
    onMutate: ({ id, seen }) => {
      queryClient.setQueryData(
        ["events", "recent"],
        (cached: TaskEvent[] = []) =>
          cached.map((event) =>
            event.id === id
              ? {
                  ...event,
                  seenAt: seen ? new Date().toISOString() : null,
                }
              : event,
          ),
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  return (
    <Menu onClose={onClose}>
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
            onSeen={() =>
              markOne.mutate({
                id: event.id,
                seen: event.seenAt === null,
              })
            }
            onOpen={() => {
              markOne.mutate({ id: event.id, seen: true });
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
  const unread = event.seenAt === null;

  return (
    <Swipeable
      className="event"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      right={[{ name: unread ? "Seen" : "Unseen", action: onSeen }]}
    >
      {event.seenAt === null && <span className="here-dot" />}
      {event.taskTitle && (
        <div className="event-title">{event.taskTitle}</div>
      )}
      <div className="event-summary">{event.summary}</div>
      <div className="event-when">
        {formatWhen(event.createdAt)} · {event.source}
      </div>
    </Swipeable>
  );
}
