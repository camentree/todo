import { listIn, parse, tagsIn, whoIn } from "@shared/parser.ts";

const MOST_SUGGESTIONS = 5;
const MOST_OFFERED = 3;

export const SIGILS = ["#", "@", "/"] as const;

export type Sigil = (typeof SIGILS)[number];

export interface Opening {
  sigil: string;
  typed: string;
  start: number;
}

export interface KnownNames {
  lists: string[];
  tags: string[];
  who: string[];
  stages: string[];
  states: readonly string[];
}

export function sigilBefore({
  input,
  caret,
}: {
  input: string;
  caret: number;
}): Opening | null {
  const before = input.slice(0, caret);
  const found = before.match(/(?:^|\s)([#@/!:])(\S*)$/);
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
  known,
}: {
  opening: Opening | null;
  known: KnownNames;
}): string[] {
  if (!opening) {
    return [];
  }
  const candidates = {
    "/": known.lists,
    "#": known.tags,
    "@": known.who,
    "!": known.stages,
    ":": known.states,
  }[opening.sigil];

  return (candidates ?? [])
    .filter(
      (candidate) =>
        candidate.toLowerCase().startsWith(opening.typed) &&
        candidate.toLowerCase() !== opening.typed,
    )
    .slice(0, MOST_SUGGESTIONS);
}

export function ghostAfter({
  input,
  caret,
  opening,
  matches,
}: {
  input: string;
  caret: number;
  opening: Opening | null;
  matches: string[];
}): string {
  const best = matches[0];
  if (!opening || !best || caret !== input.length) {
    return "";
  }
  return best.slice(opening.typed.length);
}

export function sigilsLacked(input: string): Sigil[] {
  const { tokens } = parse({ input: input, today: new Date() });
  const lacked: Sigil[] = ["#"];
  if (whoIn(tokens) === null) {
    lacked.push("@");
  }
  if (!listIn(tokens)) {
    lacked.push("/");
  }
  return lacked;
}

export function worthOffering({
  input,
  known,
}: {
  input: string;
  known: KnownNames;
}): string[] {
  const { tokens } = parse({ input: input, today: new Date() });
  const carried = tagsIn(tokens).map((tag) => tag.toLowerCase());
  const tags = known.tags
    .filter((tag) => !carried.includes(tag.toLowerCase()))
    .slice(0, MOST_OFFERED)
    .map((tag) => `#${tag}`);
  const person =
    whoIn(tokens) === null && known.who[0]
      ? [`@${known.who[0]}`]
      : [];
  return [...tags, ...person];
}
