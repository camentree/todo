import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";

import { api } from "../api.ts";
import { dismissFailure, useFailures } from "../failures.ts";
import {
  changeGlobal,
  historyLabel,
  HISTORY_STOPS,
  useGlobalSettings,
} from "../settings.ts";
import type { HistoryMonths } from "../settings.ts";
import { asTitle, formatWhen } from "../format.ts";
import { useSwipe } from "../useSwipe.ts";
import { useTheme } from "../theme.ts";
import type { Theme } from "../settings.ts";
import { canonicalName } from "@shared/names.ts";
import type {
  GroupByField,
  Event as TaskEvent,
  OrderByField,
  ViewPreference,
} from "@shared/types.ts";

const GROUP_OPTIONS: { field: GroupByField; label: string }[] = [
  { field: "none", label: "Nothing" },
  { field: "list", label: "List" },
  { field: "stage", label: "Stage" },
  { field: "tag", label: "Tag" },
  { field: "due_date", label: "Due" },
  { field: "who", label: "Who" },
];

const SORT_OPTIONS: {
  field: OrderByField;
  label: string;
  directional: boolean;
}[] = [
  { field: "manual", label: "Manual", directional: false },
  { field: "relevance", label: "Best match", directional: false },
  { field: "due_date", label: "Due date", directional: true },
  { field: "title", label: "Title", directional: true },
  { field: "created_at", label: "Added", directional: true },
  { field: "resolved_at", label: "Finished", directional: true },
];

export function ScopeMenu({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  const { data: lists = [] } = useQuery({
    queryKey: ["lists"],
    queryFn: api.lists,
  });

  function go(path: string): void {
    navigate(path);
    onClose();
  }

  return (
    <div className="menu under-title">
      <MenuLink
        label="Today"
        here={location.pathname === "/today"}
        onGo={() => go("/today")}
      />
      <MenuLink
        label="To Do"
        here={location.pathname === "/"}
        onGo={() => go("/")}
      />
      <MenuLink
        label="Done"
        here={location.pathname === "/state/complete"}
        onGo={() => go("/state/complete")}
      />
      <MenuLink
        label="Archive"
        here={location.pathname === "/archived/true"}
        onGo={() => go("/archived/true")}
      />

      {lists.length > 0 && (
        <>
          <div className="menu-label">Filters</div>
          {lists.map((list) => (
            <MenuLink
              key={list}
              label={asTitle(list)}
              small
              here={
                canonicalName(
                  decodeURIComponent(location.pathname),
                ) === `/list/${list}`
              }
              onGo={() => go(`/list/${encodeURIComponent(list)}`)}
            />
          ))}
        </>
      )}
    </div>
  );
}

function historyAt(index: number): HistoryMonths {
  const chosen = HISTORY_STOPS[index];
  return chosen === undefined ? 24 : chosen;
}

export function ViewMenu({
  view,
  onViewChange,
  searching,
  finished,
}: {
  view: ViewPreference;
  onViewChange: (changes: Partial<ViewPreference>) => void;
  searching: boolean;
  finished: boolean;
}) {
  const [theme, onThemeChange] = useTheme();
  const { historyMonths } = useGlobalSettings();

  const offered = SORT_OPTIONS.filter((option) => {
    if (option.field === view.orderBy) {
      return true;
    }
    if (option.field === "relevance") {
      return searching;
    }
    if (option.field === "resolved_at") {
      return finished;
    }
    return true;
  });

  const ordering = SORT_OPTIONS.find(
    (option) => option.field === view.orderBy,
  );

  return (
    <div className="menu under-right">
      <label className="menu-field row">
        <span className="menu-label">Group by</span>
        <select
          value={view.groupBy}
          onChange={(event) =>
            onViewChange({
              groupBy: event.target.value as GroupByField,
            })
          }
        >
          {GROUP_OPTIONS.map((option) => (
            <option key={option.field} value={option.field}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="menu-field row">
        <span className="menu-label">Order by</span>
        <select
          value={view.orderBy}
          onChange={(event) =>
            onViewChange({
              orderBy: event.target.value as OrderByField,
            })
          }
        >
          {offered.map((option) => (
            <option key={option.field} value={option.field}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div
        className="collapsible menu-reveal"
        data-open={ordering?.directional ?? false}
      >
        <div>
          <MenuSwitch
            label="Ascending"
            on={view.orderDirection === "asc"}
            onChange={(on) =>
              onViewChange({ orderDirection: on ? "asc" : "desc" })
            }
          />
        </div>
      </div>

      <div
        className="collapsible menu-reveal"
        data-wide-only={true}
        data-open={view.groupBy !== "none"}
      >
        <div>
          <MenuSwitch
            label="Columns"
            on={view.layout === "columns"}
            onChange={(on) =>
              onViewChange({ layout: on ? "columns" : "stacked" })
            }
          />
        </div>
      </div>

      <label className="menu-field">
        <span className="menu-label">
          History{" "}
          <span className="menu-note">
            {historyLabel(historyMonths)}
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={HISTORY_STOPS.length - 1}
          step={1}
          value={HISTORY_STOPS.indexOf(historyMonths)}
          onChange={(event) =>
            changeGlobal({
              historyMonths: historyAt(Number(event.target.value)),
            })
          }
        />
      </label>

      <MenuSwitch
        label="Custom appearance"
        on={theme !== "system"}
        onChange={(on) =>
          onThemeChange(on ? preferredTheme() : "system")
        }
      />

      {theme !== "system" && (
        <MenuSwitch
          label="Dark mode"
          on={theme === "dark"}
          onChange={(on) => onThemeChange(on ? "dark" : "light")}
        />
      )}
    </div>
  );
}

function preferredTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function MenuSwitch({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="menu-field row">
      <span className="menu-label">{label}</span>
      <button
        type="button"
        className="switch"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
      >
        <span className="switch-knob" />
      </button>
    </div>
  );
}

function MenuLink({
  label,
  here,
  small = false,
  onGo,
}: {
  label: string;
  here: boolean;
  small?: boolean;
  onGo: () => void;
}) {
  return (
    <button
      type="button"
      className="menu-link"
      data-small={small}
      onClick={onGo}
    >
      <span>{label}</span>
      {here && (
        <span className="here-dot" aria-label="You are here" />
      )}
    </button>
  );
}

export function ChangesMenu({ onClose }: { onClose: () => void }) {
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
    <div className="menu under-right changes">
      <div className="menu-head">
        <span className="menu-label">Changes</span>
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
    </div>
  );
}

function EventRow({
  event,
  onSeen,
}: {
  event: TaskEvent;
  onSeen: () => void;
}) {
  const swipe = useSwipe({
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
