import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Chevron } from "./TaskBoard.tsx";
import { api } from "../api.ts";
import { asTitle, formatWhen } from "../format.ts";
import {
  sigilBefore,
  suggestionStep,
  suggestionsFor,
} from "../suggestions.ts";
import { useTheme, type Theme } from "../theme.ts";
import { canonicalName } from "@shared/names.ts";
import type {
  BreakUpField,
  Event as TaskEvent,
  SortDirection,
  SortField,
  ViewPreference,
} from "@shared/types.ts";

const GROUP_OPTIONS: { field: BreakUpField; label: string }[] = [
  { field: "none", label: "Nothing" },
  { field: "list", label: "List" },
  { field: "stage", label: "Stage" },
  { field: "tag", label: "Tag" },
  { field: "due_date", label: "Due" },
  { field: "who", label: "Who" },
];

const SORT_OPTIONS: {
  value: string;
  field: SortField;
  direction: SortDirection;
  label: string;
}[] = [
  {
    value: "manual",
    field: "manual",
    direction: "asc",
    label: "Manual",
  },
  {
    value: "due_date:asc",
    field: "due_date",
    direction: "asc",
    label: "Due date — soonest",
  },
  {
    value: "due_date:desc",
    field: "due_date",
    direction: "desc",
    label: "Due date — latest",
  },
  {
    value: "title:asc",
    field: "title",
    direction: "asc",
    label: "Title — A to Z",
  },
  {
    value: "title:desc",
    field: "title",
    direction: "desc",
    label: "Title — Z to A",
  },
  {
    value: "created_at:desc",
    field: "created_at",
    direction: "desc",
    label: "Added — newest",
  },
  {
    value: "created_at:asc",
    field: "created_at",
    direction: "asc",
    label: "Added — oldest",
  },
  {
    value: "resolved_at:desc",
    field: "resolved_at",
    direction: "desc",
    label: "Finished — newest",
  },
  {
    value: "resolved_at:asc",
    field: "resolved_at",
    direction: "asc",
    label: "Finished — oldest",
  },
];

type OpenMenu = "none" | "scope" | "view" | "bell";

export function TopBar({
  title,
  view,
  onViewChange,
  search,
  onOpenSearch,
}: {
  title: string;
  view?: ViewPreference;
  onViewChange?: (changes: Partial<ViewPreference>) => void;
  search?: {
    text: string;
    onChange: (text: string) => void;
    onClose: () => void;
  };
  onOpenSearch?: () => void;
}) {
  const [menu, setMenu] = useState<OpenMenu>("none");

  const { data: unseen = [] } = useQuery({
    queryKey: ["events", "unseen"],
    queryFn: api.unseenEvents,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (menu === "none") {
      return;
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setMenu("none");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menu]);

  return (
    <>
      <div className="topbar">
        {search ? (
          <SearchField
            text={search.text}
            onChange={search.onChange}
            onClose={search.onClose}
          />
        ) : (
          <>
            <button
              type="button"
              className="topbar-filter"
              onClick={() =>
                setMenu(menu === "scope" ? "none" : "scope")
              }
            >
              <span className="topbar-name">{title}</span>
              <Chevron open={menu === "scope"} />
            </button>

            <div className="topbar-date">
              {format(new Date(), "d MMM")}
            </div>

            <div className="topbar-actions">
              {onOpenSearch && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Search"
                  onClick={onOpenSearch}
                >
                  <SearchIcon />
                </button>
              )}

              {view && onViewChange && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Arrange"
                  data-active={menu === "view"}
                  onClick={() =>
                    setMenu(menu === "view" ? "none" : "view")
                  }
                >
                  <SlidersIcon />
                </button>
              )}

              <button
                type="button"
                className="icon-button"
                aria-label="Notifications"
                data-active={menu === "bell"}
                onClick={() =>
                  setMenu(menu === "bell" ? "none" : "bell")
                }
              >
                <BellIcon />
                {unseen.length > 0 && <span className="dot" />}
              </button>
            </div>
          </>
        )}

        {menu === "scope" && (
          <ScopeMenu onClose={() => setMenu("none")} />
        )}
        {menu === "view" && view && onViewChange && (
          <ViewMenu view={view} onViewChange={onViewChange} />
        )}
        {menu === "bell" && (
          <ChangesMenu onClose={() => setMenu("none")} />
        )}
      </div>

      {menu !== "none" && (
        <div
          className="scrim quiet"
          onClick={() => setMenu("none")}
        />
      )}
    </>
  );
}

function SearchField({
  text,
  onChange,
  onClose,
}: {
  text: string;
  onChange: (text: string) => void;
  onClose: () => void;
}) {
  const [caret, setCaret] = useState(text.length);
  const [highlighted, setHighlighted] = useState(0);
  const [suppressed, setSuppressed] = useState(false);
  const [pendingCaret, setPendingCaret] = useState<number | null>(
    null,
  );
  const fieldRef = useRef<HTMLInputElement>(null);

  const { data: lists = [] } = useQuery({
    queryKey: ["lists"],
    queryFn: api.lists,
  });
  const { data: knownTags = [] } = useQuery({
    queryKey: ["tags", ""],
    queryFn: () => api.tags(),
  });
  const { data: knownWho = [] } = useQuery({
    queryKey: ["who", ""],
    queryFn: () => api.knownWho(),
  });
  const { data: stages = [] } = useQuery({
    queryKey: ["stages"],
    queryFn: api.stages,
  });

  const opening = suppressed
    ? null
    : sigilBefore({ input: text, caret: caret });
  const matches = suggestionsFor({
    opening: opening,
    lists: lists,
    knownTags: knownTags,
    knownWho: knownWho,
    stages: stages,
  });

  useEffect(() => {
    if (pendingCaret === null) {
      return;
    }
    fieldRef.current?.setSelectionRange(pendingCaret, pendingCaret);
    setPendingCaret(null);
  }, [pendingCaret]);

  function pick(candidate: string): void {
    if (!opening) {
      return;
    }
    const head = `${text.slice(0, opening.start)}${opening.sigil}${candidate} `;
    onChange(`${head}${text.slice(caret)}`);
    setCaret(head.length);
    setPendingCaret(head.length);
    setHighlighted(0);
  }

  return (
    <div className="search-field">
      <SearchIcon />
      <input
        ref={fieldRef}
        value={text}
        onChange={(event) => {
          onChange(event.target.value);
          setCaret(event.target.selectionStart ?? 0);
          setSuppressed(false);
          setHighlighted(0);
        }}
        onSelect={(event) =>
          setCaret(event.currentTarget.selectionStart ?? 0)
        }
        onKeyDown={(event) => {
          if (matches.length === 0) {
            if (event.key === "Enter") {
              event.preventDefault();
              fieldRef.current?.blur();
            }
            return;
          }
          const step = suggestionStep(event);
          if (step !== 0) {
            event.preventDefault();
            setHighlighted(
              (highlighted + step + matches.length) % matches.length,
            );
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            pick(matches[highlighted] ?? "");
            return;
          }
          if (event.key === "Escape") {
            event.stopPropagation();
            setSuppressed(true);
          }
        }}
        placeholder="Search"
        aria-label="Search"
        data-search-field
        enterKeyHint="search"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
      />
      <button
        type="button"
        className="icon-button"
        aria-label="Close search"
        onClick={onClose}
      >
        <CrossIcon />
      </button>

      {matches.length > 0 && (
        <div className="search-suggestions">
          {matches.map((candidate, index) => (
            <button
              type="button"
              key={candidate}
              tabIndex={-1}
              className="capture-suggestion"
              data-on={index === highlighted}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(candidate)}
            >
              {opening?.sigil}
              {candidate}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ScopeMenu({ onClose }: { onClose: () => void }) {
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

function ViewMenu({
  view,
  onViewChange,
}: {
  view: ViewPreference;
  onViewChange: (changes: Partial<ViewPreference>) => void;
}) {
  const [theme, onThemeChange] = useTheme();

  const sortValue =
    view.sortBy === "manual"
      ? "manual"
      : `${view.sortBy}:${view.sortDirection}`;

  return (
    <div className="menu under-right">
      <label className="menu-field">
        <span className="menu-label">Group by</span>
        <select
          value={view.breakUpBy}
          onChange={(event) =>
            onViewChange({
              breakUpBy: event.target.value as BreakUpField,
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

      <label className="menu-field">
        <span className="menu-label">Order by</span>
        <select
          value={sortValue}
          onChange={(event) => {
            const chosen = SORT_OPTIONS.find(
              (option) => option.value === event.target.value,
            );
            if (chosen) {
              onViewChange({
                sortBy: chosen.field,
                sortDirection: chosen.direction,
              });
            }
          }}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {view.breakUpBy !== "none" && (
        <MenuSwitch
          label="Columns"
          wideOnly
          on={view.layout === "columns"}
          onChange={(on) =>
            onViewChange({ layout: on ? "columns" : "stacked" })
          }
        />
      )}

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
  wideOnly = false,
  onChange,
}: {
  label: string;
  on: boolean;
  wideOnly?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="menu-field row" data-wide-only={wideOnly}>
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

function ChangesMenu({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: events = [] } = useQuery({
    queryKey: ["events", "unseen"],
    queryFn: api.unseenEvents,
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
      {events.length === 0 ? (
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
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const distance = useRef(0);

  return (
    <div className="event-track">
      {offset > 0 && <div className="event-action">Seen</div>}
      <div
        className="event"
        style={{ transform: `translateX(${offset}px)` }}
        data-swiping={offset !== 0}
        onPointerDown={(pointer) => {
          startX.current = pointer.clientX;
          distance.current = 0;
        }}
        onPointerMove={(pointer) => {
          if (startX.current === null) {
            return;
          }
          distance.current = Math.max(
            0,
            pointer.clientX - startX.current,
          );
          if (
            distance.current > 8 &&
            !pointer.currentTarget.hasPointerCapture(
              pointer.pointerId,
            )
          ) {
            pointer.currentTarget.setPointerCapture(
              pointer.pointerId,
            );
          }
          setOffset(distance.current);
        }}
        onPointerUp={() => {
          const travelled = distance.current;
          startX.current = null;
          distance.current = 0;
          setOffset(0);
          if (travelled >= 72) {
            onSeen();
          }
        }}
      >
        <div>{event.summary}</div>
        <div className="event-when">
          {formatWhen(event.createdAt)} · {event.source}
        </div>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="8.75"
        cy="8.75"
        r="5.25"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="m12.75 12.75 3.75 3.75"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5.5 5.5l9 9M14.5 5.5l-9 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 6h9M15 6h2M3 14h2M8 14h9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle
        cx="13.5"
        cy="6"
        r="1.9"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle
        cx="6.5"
        cy="14"
        r="1.9"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 2.5a4.5 4.5 0 0 0-4.5 4.5v3l-1.5 3h12l-1.5-3v-3A4.5 4.5 0 0 0 10 2.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M8 15.5a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
