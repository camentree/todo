import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type {
  ChangeEvent,
  InputHTMLAttributes,
  KeyboardEvent,
  RefObject,
  SyntheticEvent,
} from "react";

import { api } from "../api.ts";
import {
  sigilBefore,
  suggestionStep,
  suggestionsFor,
} from "../suggestions.ts";
import { SEARCHABLE_STATES } from "@shared/states.ts";

type TitleElement = HTMLInputElement | HTMLTextAreaElement;

export function ParseableTitle({
  value,
  onChange,
  inputRef,
  list = "",
  at,
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
  at: "row" | "search" | "sheet";
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

  const opening =
    suppressed || !suggest
      ? null
      : sigilBefore({ input: value, caret: caret });
  const matches = suggestionsFor({
    opening: opening,
    lists: lists,
    knownTags: knownTags,
    knownWho: knownWho,
    stages: stages,
    states: SEARCHABLE_STATES,
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
      if (event.key === "Enter") {
        event.preventDefault();
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

  return (
    <>
      {multiline ? (
        <textarea
          {...input}
          ref={inputRef as RefObject<HTMLTextAreaElement>}
          rows={1}
          value={value}
          onChange={typed}
          onSelect={moved}
          onKeyDown={pressed}
        />
      ) : (
        <input
          {...input}
          ref={inputRef as RefObject<HTMLInputElement>}
          value={value}
          onChange={typed}
          onSelect={moved}
          onKeyDown={pressed}
        />
      )}

      {matches.length > 0 && (
        <div className="suggestions" data-at={at}>
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
    </>
  );
}
