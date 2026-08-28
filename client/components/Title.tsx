import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type {
  ChangeEvent,
  FocusEvent,
  InputHTMLAttributes,
  KeyboardEvent,
  RefObject,
  SyntheticEvent,
} from "react";

import { Strip } from "./Strip.tsx";
import { api } from "../data/api.ts";
import { useCanHover } from "../hooks/useCanHover.ts";
import {
  ghostAfter,
  sigilBefore,
  sigilsLacked,
  suggestionsFor,
  worthOffering,
} from "../tasks/completions.ts";
import { TASK_STATES } from "@shared/states.ts";

function suggestionStep(event: KeyboardEvent<HTMLElement>): number {
  if (event.ctrlKey) {
    if (event.key === "n") {
      return 1;
    }
    if (event.key === "p") {
      return -1;
    }
    return 0;
  }
  if (event.key === "ArrowDown") {
    return 1;
  }
  if (event.key === "ArrowUp") {
    return -1;
  }
  return 0;
}

type TitleElement = HTMLInputElement | HTMLTextAreaElement;

export function Title({
  value,
  onChange,
  inputRef,
  list = "",
  suggest = true,
  multiline = false,
  onDone,
  onCancel,
  onTab,
  input,
}: {
  value: string;
  onChange: (next: string) => void;
  inputRef: RefObject<TitleElement | null>;
  list?: string;
  suggest?: boolean;
  multiline?: boolean;
  onDone?: () => void;
  onCancel?: (event: KeyboardEvent<TitleElement>) => void;
  onTab?: (backwards: boolean) => void;
  input: InputHTMLAttributes<TitleElement> &
    Partial<Record<`data-${string}`, boolean>>;
}) {
  const [caret, setCaret] = useState(value.length);
  const [highlighted, setHighlighted] = useState(0);
  const [suppressed, setSuppressed] = useState(false);
  const [pendingCaret, setPendingCaret] = useState<number | null>(
    null,
  );
  const [focused, setFocused] = useState(false);
  const canHover = useCanHover();

  const { data: lists = [] } = useQuery({
    queryKey: ["lists"],
    queryFn: api.lists,
  });
  const { data: knownTags = [] } = useQuery({
    queryKey: ["tags", list],
    queryFn: () => api.tags(list || undefined),
  });
  const { data: knownWho = [] } = useQuery({
    queryKey: ["who", list],
    queryFn: () => api.knownWho(list || undefined),
  });
  const { data: stages = [] } = useQuery({
    queryKey: ["stages"],
    queryFn: api.stages,
  });

  const known = {
    lists: lists,
    tags: knownTags,
    who: knownWho,
    stages: stages,
    states: TASK_STATES,
  };
  const opening =
    suppressed || !suggest
      ? null
      : sigilBefore({ input: value, caret: caret });
  const matches = suggestionsFor({ opening: opening, known: known });
  const ghost = ghostAfter({
    input: value,
    caret: caret,
    opening: opening,
    matches: highlighted === 0 ? matches : [],
  });

  useEffect(() => {
    const field = inputRef.current;
    if (!multiline || !field) {
      return;
    }
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [value, multiline, inputRef]);

  useEffect(() => {
    if (pendingCaret === null) {
      return;
    }
    inputRef.current?.setSelectionRange(pendingCaret, pendingCaret);
    setPendingCaret(null);
  }, [pendingCaret, inputRef]);

  function pick(candidate: string): void {
    if (!opening) {
      return;
    }
    const head = `${value.slice(0, opening.start)}${opening.sigil}${candidate} `;
    onChange(`${head}${value.slice(caret)}`);
    setCaret(head.length);
    setPendingCaret(head.length);
    setHighlighted(0);
  }

  function insert(text: string): void {
    const spaced = value.length === 0 || value.endsWith(" ");
    const next = `${value}${spaced ? "" : " "}${text}`;
    onChange(next);
    setCaret(next.length);
    setPendingCaret(next.length);
    setSuppressed(false);
    inputRef.current?.focus();
  }

  function typed(event: ChangeEvent<TitleElement>): void {
    const next = event.target.value;
    if (next.includes("\n")) {
      onChange(next.replace(/\n/g, ""));
      if (matches.length > 0) {
        pick(matches[highlighted] ?? "");
        return;
      }
      onDone?.();
      return;
    }
    onChange(next);
    setCaret(event.target.selectionStart ?? 0);
    setSuppressed(false);
    setHighlighted(0);
  }

  function moved(event: SyntheticEvent<TitleElement>): void {
    setCaret(event.currentTarget.selectionStart ?? 0);
  }

  function pressed(event: KeyboardEvent<TitleElement>): void {
    if (matches.length > 0) {
      const step = suggestionStep(event);
      if (step !== 0) {
        event.preventDefault();
        setHighlighted(
          (highlighted + step + matches.length) % matches.length,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        pick(matches[highlighted] ?? "");
        return;
      }
      if (event.key === "Escape") {
        event.stopPropagation();
        setSuppressed(true);
        return;
      }
    }
    if (event.key === "Tab" && onTab) {
      event.preventDefault();
      event.stopPropagation();
      onTab(event.shiftKey);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      onDone?.();
      return;
    }
    if (event.key === "Escape") {
      onCancel?.(event);
    }
  }

  const watched = {
    ...input,
    onFocus: (event: FocusEvent<TitleElement>) => {
      setFocused(true);
      input.onFocus?.(event);
    },
    onBlur: (event: FocusEvent<TitleElement>) => {
      setFocused(false);
      input.onBlur?.(event);
    },
  };

  const field = multiline ? (
    <textarea
      {...watched}
      ref={inputRef as RefObject<HTMLTextAreaElement>}
      rows={1}
      value={value}
      onChange={typed}
      onSelect={moved}
      onKeyDown={pressed}
    />
  ) : (
    <input
      {...watched}
      ref={inputRef as RefObject<HTMLInputElement>}
      value={value}
      onChange={typed}
      onSelect={moved}
      onKeyDown={pressed}
    />
  );

  return (
    <>
      <span className="ghosted">
        {ghost && (
          <span className={input.className} aria-hidden="true">
            <span className="ghost-typed">{value}</span>
            {ghost}
          </span>
        )}
        {field}

        {canHover && matches.length > 0 && (
          <div className="suggestions">
            {matches.map((candidate, index) => (
              <button
                type="button"
                key={candidate}
                tabIndex={-1}
                className="suggestion"
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
      </span>

      {suggest && multiline && !canHover && focused && (
        <Strip
          sigils={sigilsLacked(value)}
          offers={
            matches.length > 0
              ? matches
                  .slice(ghost ? 1 : 0)
                  .map(
                    (candidate) =>
                      `${opening?.sigil ?? ""}${candidate}`,
                  )
              : worthOffering({ input: value, known: known })
          }
          onInsert={insert}
        />
      )}
    </>
  );
}
