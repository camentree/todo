import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { api } from "../api.ts";
import { todayAsDateString } from "../format.ts";
import type { Density } from "@shared/types.ts";
import {
  dueDateIn,
  dueTimeIn,
  listIn,
  parse,
  recurrenceIn,
  stageIn,
  tagsIn,
  whoIn,
  type ParsedToken,
} from "@shared/parser.ts";

const GUESSED_KINDS = new Set(["dueDate", "dueTime", "recurrence"]);
const LAST_LIST_KEY = "todo.lastList";

function rememberList(list: string): void {
  window.localStorage.setItem(LAST_LIST_KEY, list);
}

function lastUsedList(): string | null {
  return window.localStorage.getItem(LAST_LIST_KEY);
}

export function NewTaskRow({
  list,
  density,
  onClose,
}: {
  list?: string;
  density: Density;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: lists = [] } = useQuery({
    queryKey: ["lists"],
    queryFn: api.lists,
  });

  const parsed = useMemo(
    () =>
      parse({
        input: input,
        today: new Date(),
        dismissed: dismissed,
      }),
    [input, dismissed],
  );

  const targetList = resolveList({
    tokens: parsed.tokens,
    lists: lists,
    list: list,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!targetList) {
        throw new Error("there is no list to add this to");
      }
      const recurrence = recurrenceIn(parsed.tokens);
      const tags = tagsIn(parsed.tokens);
      const who = whoIn(parsed.tokens);
      const dueDate = dueDateIn(parsed.tokens);
      const dueTime = dueTimeIn(parsed.tokens);
      const stage = stageIn(parsed.tokens);

      if (recurrence) {
        return api.createRecurring({
          list: targetList,
          title: parsed.title,
          tags: tags,
          who: who,
          frequency: recurrence.frequency,
          repeatEvery: recurrence.repeatEvery,
          weekdays: recurrence.weekdays,
          dayOfMonth: recurrence.dayOfMonth,
          dueTime: dueTime,
          startsOn: dueDate ?? todayAsDateString(),
        });
      }

      return api.createTask({
        list: targetList,
        title: parsed.title,
        tags: tags,
        who: who ?? null,
        dueDate: dueDate ?? null,
        dueTime: dueTime ?? null,
        stage: stage ?? undefined,
      });
    },
    onSuccess: () => {
      if (targetList) {
        rememberList(targetList);
      }
      setInput("");
      setDismissed([]);
      queryClient.invalidateQueries();
    },
  });

  const canSubmit =
    parsed.title.trim().length > 0 && Boolean(targetList);

  return (
    <div className="tasks" data-density={density}>
      <form
        className="task new-task"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) {
            create.mutate();
          }
        }}
      >
        <div className="task-main">
          <span className="task-tick" data-state="to_do" />
          <input
            className="task-title editing"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onBlur={() => {
              if (input.trim().length === 0) {
                onClose();
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onClose();
              }
            }}
            placeholder="New task"
            aria-label="New task"
            enterKeyHint="done"
            autoFocus
          />
        </div>
        {parsed.tokens.length > 0 && (
          <span className="task-meta">
            {parsed.tokens.map((token) => (
              <button
                type="button"
                key={`${token.kind}-${token.text}`}
                className="capture-chip"
                data-guess={GUESSED_KINDS.has(token.kind)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() =>
                  setDismissed([...dismissed, token.text])
                }
                title="Put this back in the title"
              >
                {describe(token)}
              </button>
            ))}
          </span>
        )}
      </form>
    </div>
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

function describe(token: ParsedToken): string {
  if (token.kind === "recurrence") {
    return token.text;
  }
  if (token.kind === "dueDate" || token.kind === "dueTime") {
    return token.value;
  }
  if (token.kind === "overdue" || token.kind === "noDueDate") {
    return token.text;
  }
  const sigil =
    token.kind === "tag"
      ? "#"
      : token.kind === "who"
        ? "@"
        : token.kind === "list"
          ? "/"
          : "!";
  return `${sigil}${token.value}`;
}

function resolveList({
  tokens,
  lists,
  list,
}: {
  tokens: ParsedToken[];
  lists: string[];
  list: string | undefined;
}): string | null {
  const named = listIn(tokens);
  if (named) {
    const existing = lists.find(
      (candidate) => candidate.toLowerCase() === named.toLowerCase(),
    );
    return existing ?? named;
  }
  const remembered = lastUsedList();
  return (
    list ??
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
