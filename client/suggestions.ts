import type { KeyboardEvent } from "react";

const MOST_SUGGESTIONS = 5;

export interface Opening {
  sigil: string;
  typed: string;
  start: number;
}

export function sigilBefore({
  input,
  caret,
}: {
  input: string;
  caret: number;
}): Opening | null {
  const before = input.slice(0, caret);
  const found = before.match(/(?:^|\s)([#@/!])(\S*)$/);
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

export function suggestionsFor({
  opening,
  lists,
  knownTags,
  knownWho,
  stages,
}: {
  opening: Opening | null;
  lists: string[];
  knownTags: string[];
  knownWho: string[];
  stages: string[];
}): string[] {
  if (!opening) {
    return [];
  }
  const candidates =
    opening.sigil === "/"
      ? lists
      : opening.sigil === "#"
        ? knownTags
        : opening.sigil === "!"
          ? stages
          : knownWho;

  return candidates
    .filter(
      (candidate) =>
        candidate.toLowerCase().startsWith(opening.typed) &&
        candidate.toLowerCase() !== opening.typed,
    )
    .slice(0, MOST_SUGGESTIONS);
}

export function suggestionStep(
  event: KeyboardEvent<HTMLInputElement>,
): number {
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
  if (event.key === "Tab") {
    return event.shiftKey ? -1 : 1;
  }
  return 0;
}
