import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  AttributeChips,
  typedTask,
  withoutAttribute,
} from "./TaskAttributes.tsx";
import { api } from "../api.ts";
import { renameChanges } from "../useTaskActions.ts";
import type { Density } from "@shared/types.ts";

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
  const queryClient = useQueryClient();

  const { data: lists = [] } = useQuery({
    queryKey: ["lists"],
    queryFn: api.lists,
  });

  const typed = useMemo(() => renameChanges(input), [input]);
  const targetList = resolveList({
    named: typed.list,
    lists: lists,
    list: list,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!targetList) {
        throw new Error("there is no list to add this to");
      }
      return api.createTask({
        ...typed,
        title: typed.title ?? "",
        list: targetList,
      });
    },
    onSuccess: () => {
      if (targetList) {
        rememberList(targetList);
      }
      setInput("");
      queryClient.invalidateQueries();
    },
  });

  const canSubmit =
    (typed.title ?? "").trim().length > 0 && Boolean(targetList);

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
        <AttributeChips
          task={typedTask({
            changes: typed,
            list: targetList ?? "",
          })}
          onRemove={(attribute) =>
            setInput(
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

function resolveList({
  named,
  lists,
  list,
}: {
  named: string | undefined;
  lists: string[];
  list: string | undefined;
}): string | null {
  const remembered = lastUsedList();
  return (
    named ??
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
