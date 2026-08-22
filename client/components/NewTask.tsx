import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  AttributeChips,
  typedTask,
  withoutAttribute,
} from "./TaskAttributes.tsx";
import { api } from "../api.ts";
import { renameChanges } from "../useTaskActions.ts";

const LAST_LIST_KEY = "todo.lastList";
const MOST_SUGGESTIONS = 5;

function rememberList(list: string): void {
  window.localStorage.setItem(LAST_LIST_KEY, list);
}

function lastUsedList(): string | null {
  return window.localStorage.getItem(LAST_LIST_KEY);
}

export function NewTaskRow({ prefill }: { prefill: string }) {
  const [input, setInput] = useState("");
  const [note, setNote] = useState("");
  const [active, setActive] = useState(false);
  const [caret, setCaret] = useState(0);
  const [suppressed, setSuppressed] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [pendingCaret, setPendingCaret] = useState<number | null>(
    null,
  );
  const titleRef = useRef<HTMLInputElement>(null);
  const closeAfterSave = useRef(false);
  const queryClient = useQueryClient();

  const { data: lists = [] } = useQuery({
    queryKey: ["lists"],
    queryFn: api.lists,
  });

  const typed = useMemo(() => renameChanges(input), [input]);
  const namedList = typed.list ?? null;

  const { data: knownTags = [] } = useQuery({
    queryKey: ["tags", namedList],
    queryFn: () => api.tags(namedList ?? undefined),
    enabled: active,
  });
  const { data: knownWho = [] } = useQuery({
    queryKey: ["who", namedList],
    queryFn: () => api.knownWho(namedList ?? undefined),
    enabled: active,
  });

  const opening = suppressed
    ? null
    : sigilBefore({ input: input, caret: caret });
  const matches = suggestionsFor({
    opening: opening,
    lists: lists,
    knownTags: knownTags,
    knownWho: knownWho,
  });

  const targetList = resolveList({
    named: typed.list,
    lists: lists,
  });

  useEffect(() => {
    if (pendingCaret === null) {
      return;
    }
    titleRef.current?.setSelectionRange(pendingCaret, pendingCaret);
    setPendingCaret(null);
  }, [pendingCaret]);

  const create = useMutation({
    mutationFn: async () => {
      if (!targetList) {
        throw new Error("there is no list to add this to");
      }
      return api.createTask({
        ...typed,
        title: typed.title ?? "",
        list: targetList,
        note: note.trim() || null,
      });
    },
    onSuccess: () => {
      if (targetList) {
        rememberList(targetList);
      }
      queryClient.invalidateQueries();
      setNote("");
      setSuppressed(false);
      if (closeAfterSave.current) {
        closeAfterSave.current = false;
        setInput("");
        titleRef.current?.blur();
        return;
      }
      moveTo(prefill);
    },
  });

  const canSubmit =
    (typed.title ?? "").trim().length > 0 && Boolean(targetList);

  function moveTo(next: string): void {
    setInput(next);
    setCaret(next.length);
    setPendingCaret(next.length);
  }

  function submit(): void {
    if (canSubmit) {
      create.mutate();
    }
  }

  function saveAndClose(): void {
    closeAfterSave.current = true;
    submit();
  }

  function discard(): void {
    setInput("");
    setNote("");
    titleRef.current?.blur();
  }

  function pick(candidate: string): void {
    if (!opening) {
      return;
    }
    const tail = input.slice(caret);
    const head = `${input.slice(0, opening.start)}${opening.sigil}${candidate} `;
    setInput(`${head}${tail}`);
    setCaret(head.length);
    setPendingCaret(head.length);
    setHighlighted(0);
  }

  return (
    <form
      className="task new-task"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      onFocus={() => setActive(true)}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) {
          return;
        }
        setActive(false);
        setSuppressed(false);
        if (
          (typed.title ?? "").trim().length === 0 &&
          note.trim().length === 0
        ) {
          setInput("");
          setNote("");
        }
      }}
    >
      <div className="task-main">
        <span className="task-tick" data-state="to_do" />
        <input
          ref={titleRef}
          className="task-title editing"
          value={input}
          onFocus={() => {
            if (input.length === 0) {
              moveTo(prefill);
            }
          }}
          onChange={(event) => {
            setInput(event.target.value);
            setCaret(event.target.selectionStart ?? 0);
            setSuppressed(false);
            setHighlighted(0);
          }}
          onSelect={(event) =>
            setCaret(event.currentTarget.selectionStart ?? 0)
          }
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              (event.metaKey || event.ctrlKey)
            ) {
              event.preventDefault();
              saveAndClose();
              return;
            }
            if (matches.length > 0) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setHighlighted((highlighted + 1) % matches.length);
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setHighlighted(
                  (highlighted + matches.length - 1) % matches.length,
                );
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                pick(matches[highlighted] ?? "");
                return;
              }
              if (event.key === "Escape") {
                setSuppressed(true);
                return;
              }
            }
            if (event.key === "Escape") {
              discard();
            }
          }}
          placeholder="New task"
          aria-label="New task"
          enterKeyHint="done"
        />
      </div>

      {matches.length > 0 && (
        <div className="capture-suggestions">
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

      <AttributeChips
        task={typedTask({ changes: typed, list: targetList ?? "" })}
        onRemove={(attribute) =>
          moveTo(
            withoutAttribute({
              task: typedTask({
                changes: typed,
                list: targetList ?? "",
              }),
              draft: input,
              attribute: attribute,
            }).draft,
          )
        }
      />

      {(active || note.length > 0) && (
        <textarea
          className="capture-note"
          rows={1}
          value={note}
          placeholder="Notes"
          aria-label="Notes"
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              (event.metaKey || event.ctrlKey)
            ) {
              event.preventDefault();
              saveAndClose();
              return;
            }
            if (event.key === "Tab" && !event.shiftKey) {
              event.preventDefault();
              titleRef.current?.focus();
              return;
            }
            if (event.key === "Escape") {
              discard();
            }
          }}
        />
      )}
    </form>
  );
}

export function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="floating">
      <div className="floating-row">
        <button
          type="button"
          className="bubble primary"
          aria-label="Add a task"
          onClick={onClick}
        >
          <PlusIcon />
        </button>
      </div>
    </div>
  );
}

export function focusLastCaptureRow(): void {
  const rows = document.querySelectorAll<HTMLInputElement>(
    ".new-task .task-title",
  );
  const last = rows[rows.length - 1];
  last?.scrollIntoView({ block: "center", behavior: "smooth" });
  last?.focus({ preventScroll: true });
}

interface Opening {
  sigil: string;
  typed: string;
  start: number;
}

function sigilBefore({
  input,
  caret,
}: {
  input: string;
  caret: number;
}): Opening | null {
  const before = input.slice(0, caret);
  const found = before.match(/(?:^|\s)([#@/])(\S*)$/);
  const sigil = found?.[1];
  const typed = found?.[2];
  if (!sigil || typed === undefined) {
    return null;
  }
  return {
    sigil: sigil,
    typed: typed.toLowerCase(),
    start: before.length - typed.length - 1,
  };
}

function suggestionsFor({
  opening,
  lists,
  knownTags,
  knownWho,
}: {
  opening: Opening | null;
  lists: string[];
  knownTags: string[];
  knownWho: string[];
}): string[] {
  if (!opening) {
    return [];
  }
  const candidates =
    opening.sigil === "/"
      ? lists
      : opening.sigil === "#"
        ? knownTags
        : knownWho;

  return candidates
    .filter(
      (candidate) =>
        candidate.toLowerCase().startsWith(opening.typed) &&
        candidate.toLowerCase() !== opening.typed,
    )
    .slice(0, MOST_SUGGESTIONS);
}

function resolveList({
  named,
  lists,
}: {
  named: string | undefined;
  lists: string[];
}): string | null {
  const remembered = lastUsedList();
  return (
    named ??
    (remembered && lists.includes(remembered) ? remembered : null) ??
    lists[0] ??
    null
  );
}

function PlusIcon() {
  return (
    <svg
      className="plus"
      width="21"
      height="21"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 4v12M4 10h12"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}
