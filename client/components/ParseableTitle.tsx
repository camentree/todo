import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type {
  InputHTMLAttributes,
  KeyboardEvent,
  RefObject,
} from "react";

import { api } from "../api.ts";
import {
  sigilBefore,
  suggestionStep,
  suggestionsFor,
} from "../suggestions.ts";
import { SEARCHABLE_STATES } from "@shared/states.ts";

export function ParseableTitle({
  value,
  onChange,
  inputRef,
  list = "",
  at,
  onDone,
  onCancel,
  input,
}: {
  value: string;
  onChange: (next: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  list?: string;
  at: "row" | "search" | "sheet";
  onDone?: (event: KeyboardEvent<HTMLInputElement>) => void;
  onCancel?: (event: KeyboardEvent<HTMLInputElement>) => void;
  input: InputHTMLAttributes<HTMLInputElement> &
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

  const opening = suppressed
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

  return (
    <>
      <input
        {...input}
        ref={inputRef}
        value={value}
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
          if (matches.length > 0) {
            const step = suggestionStep(event);
            if (step !== 0) {
              event.preventDefault();
              setHighlighted(
                (highlighted + step + matches.length) %
                  matches.length,
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
          if (event.key === "Enter") {
            event.preventDefault();
            onDone?.(event);
            return;
          }
          if (event.key === "Escape") {
            onCancel?.(event);
          }
        }}
      />

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
