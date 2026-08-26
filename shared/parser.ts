import {
  addDays,
  addWeeks,
  format,
  parse as parseDate,
} from "date-fns";

import { canonicalName } from "./names.ts";
import { asStage, type TaskStage } from "./stages.ts";
import { asTaskState, type TaskState } from "./states.ts";
import type { Frequency } from "./types.ts";

export interface RecurrenceValue {
  frequency: Frequency;
  repeatEvery: number;
  weekdays: number[];
  dayOfMonth: number | null;
}

export type ParsedToken =
  | { kind: "tag"; text: string; value: string }
  | { kind: "who"; text: string; value: string }
  | { kind: "list"; text: string; value: string }
  | { kind: "stage"; text: string; value: TaskStage | "" }
  | { kind: "state"; text: string; value: TaskState }
  | { kind: "dueDate"; text: string; value: string }
  | { kind: "dueTime"; text: string; value: string }
  | { kind: "recurrence"; text: string; value: RecurrenceValue }
  | { kind: "overdue"; text: string }
  | { kind: "noDueDate"; text: string }
  | { kind: "phrase"; text: string; value: string };

export interface ParseResult {
  title: string;
  tokens: ParsedToken[];
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

interface Match {
  token: ParsedToken;
  consumed: number;
}

export function parse({
  input,
  today,
  dismissed = [],
  search = false,
}: {
  input: string;
  today: Date;
  dismissed?: string[];
  search?: boolean;
}): ParseResult {
  const words = input.split(/\s+/).filter((word) => word.length > 0);
  const dismissedTexts = new Set(
    dismissed.map((text) => text.toLowerCase()),
  );

  const tokens: ParsedToken[] = [];
  const leftover: string[] = [];
  let index = 0;

  while (index < words.length) {
    const word = wordAt(words, index);
    if (word.startsWith("\\") && word.length > 1) {
      leftover.push(word.slice(1));
      index += 1;
      continue;
    }

    const match = matchAt({
      words: words,
      index: index,
      today: today,
      search: search,
    });
    if (match) {
      if (!dismissedTexts.has(match.token.text.toLowerCase())) {
        tokens.push(match.token);
      } else {
        leftover.push(...words.slice(index, index + match.consumed));
      }
      index += match.consumed;
      continue;
    }
    leftover.push(word);
    index += 1;
  }

  return { title: leftover.join(" "), tokens: tokens };
}

function matchAt({
  words,
  index,
  today,
  search,
}: {
  words: string[];
  index: number;
  today: Date;
  search: boolean;
}): Match | null {
  const matchers = [
    matchSigil,
    matchState,
    ...(search ? [matchQuotedPhrase, matchSearchFlag] : []),
    matchRecurrence,
    matchRelativeDate,
    matchWeekday,
    matchMonthAndDay,
    matchIsoDate,
    matchTime,
  ];

  for (const matcher of matchers) {
    const match = matcher({
      words: words,
      index: index,
      today: today,
    });
    if (match) {
      return match;
    }
  }
  return null;
}

interface MatcherInput {
  words: string[];
  index: number;
  today: Date;
}

function wordAt(words: string[], index: number): string {
  return words[index] ?? "";
}

function bareWordAt(words: string[], index: number): string {
  return wordAt(words, index)
    .toLowerCase()
    .replace(/^[(\[]+/, "")
    .replace(/[)\]!?,.;:]+$/, "");
}

function matchSigil({ words, index }: MatcherInput): Match | null {
  const word = wordAt(words, index);
  const body = word.slice(1);

  if (word.startsWith("#")) {
    return {
      token: { kind: "tag", text: word, value: canonicalName(body) },
      consumed: 1,
    };
  }
  if (word.startsWith("@")) {
    return {
      token: { kind: "who", text: word, value: canonicalName(body) },
      consumed: 1,
    };
  }
  if (word.startsWith("/")) {
    return {
      token: { kind: "list", text: word, value: canonicalName(body) },
      consumed: 1,
    };
  }
  if (word.startsWith("!")) {
    const stage =
      body.length === 0
        ? ""
        : asStage(body.toLowerCase().replace(/[\s-]+/g, "_"));
    if (stage !== null) {
      return {
        token: { kind: "stage", text: word, value: stage },
        consumed: 1,
      };
    }
  }
  return null;
}

function matchQuotedPhrase({
  words,
  index,
}: MatcherInput): Match | null {
  const word = wordAt(words, index);
  if (!word.startsWith('"')) {
    return null;
  }
  for (let end = index; end < words.length; end += 1) {
    if (wordAt(words, end).endsWith('"')) {
      const text = words.slice(index, end + 1).join(" ");
      const value = text.slice(1, -1);
      if (value.length === 0) {
        return null;
      }
      return {
        token: { kind: "phrase", text: text, value: value },
        consumed: end - index + 1,
      };
    }
  }
  return null;
}

function matchSearchFlag({
  words,
  index,
}: MatcherInput): Match | null {
  const word = wordAt(words, index).toLowerCase();
  if (word === "overdue") {
    return {
      token: { kind: "overdue", text: wordAt(words, index) },
      consumed: 1,
    };
  }
  if (
    word === "no" &&
    wordAt(words, index + 1).toLowerCase() === "date"
  ) {
    return {
      token: {
        kind: "noDueDate",
        text: `${wordAt(words, index)} ${wordAt(words, index + 1)}`,
      },
      consumed: 2,
    };
  }
  return null;
}

function matchState({ words, index }: MatcherInput): Match | null {
  const word = wordAt(words, index);
  if (!word.startsWith(":")) {
    return null;
  }
  const state = asTaskState(
    word
      .slice(1)
      .toLowerCase()
      .replace(/[\s-]+/g, "_"),
  );
  if (state === null) {
    return null;
  }
  return {
    token: { kind: "state", text: word, value: state },
    consumed: 1,
  };
}

function matchRecurrence({
  words,
  index,
}: MatcherInput): Match | null {
  const word = bareWordAt(words, index);

  const plain: Record<string, RecurrenceValue> = {
    daily: {
      frequency: "daily",
      repeatEvery: 1,
      weekdays: [],
      dayOfMonth: null,
    },
    everyday: {
      frequency: "daily",
      repeatEvery: 1,
      weekdays: [],
      dayOfMonth: null,
    },
    weekly: {
      frequency: "weekly",
      repeatEvery: 1,
      weekdays: [],
      dayOfMonth: null,
    },
    monthly: {
      frequency: "monthly",
      repeatEvery: 1,
      weekdays: [],
      dayOfMonth: null,
    },
  };
  const direct = plain[word];
  if (direct) {
    return {
      token: {
        kind: "recurrence",
        text: wordAt(words, index),
        value: direct,
      },
      consumed: 1,
    };
  }

  if (word !== "every") {
    return null;
  }

  const second = bareWordAt(words, index + 1);
  const unitAfterCount = bareWordAt(words, index + 2);
  const count = Number.parseInt(second, 10);

  if (!Number.isNaN(count) && count > 0) {
    const frequency = frequencyForUnit(unitAfterCount);
    if (frequency) {
      return {
        token: {
          kind: "recurrence",
          text: words.slice(index, index + 3).join(" "),
          value: {
            frequency: frequency,
            repeatEvery: count,
            weekdays: [],
            dayOfMonth: null,
          },
        },
        consumed: 3,
      };
    }
    return null;
  }

  const singleUnit = frequencyForUnit(second);
  if (singleUnit) {
    return {
      token: {
        kind: "recurrence",
        text: words.slice(index, index + 2).join(" "),
        value: {
          frequency: singleUnit,
          repeatEvery: 1,
          weekdays: [],
          dayOfMonth: null,
        },
      },
      consumed: 2,
    };
  }

  const weekdays: number[] = [];
  let cursor = index + 1;
  while (cursor < words.length) {
    const weekday = WEEKDAYS[bareWordAt(words, cursor)];
    if (weekday === undefined) {
      break;
    }
    weekdays.push(weekday);
    cursor += 1;
  }

  if (weekdays.length === 0) {
    return null;
  }

  return {
    token: {
      kind: "recurrence",
      text: words.slice(index, cursor).join(" "),
      value: {
        frequency: "weekly",
        repeatEvery: 1,
        weekdays: weekdays,
        dayOfMonth: null,
      },
    },
    consumed: cursor - index,
  };
}

function frequencyForUnit(unit: string): Frequency | null {
  if (unit === "day" || unit === "days") return "daily";
  if (unit === "week" || unit === "weeks") return "weekly";
  if (unit === "month" || unit === "months") return "monthly";
  return null;
}

function matchRelativeDate({
  words,
  index,
  today,
}: MatcherInput): Match | null {
  const word = bareWordAt(words, index);

  if (word === "today" || word === "tonight") {
    return dueDateMatch({
      text: wordAt(words, index),
      date: today,
      consumed: 1,
    });
  }
  if (word === "tomorrow") {
    return dueDateMatch({
      text: wordAt(words, index),
      date: addDays(today, 1),
      consumed: 1,
    });
  }

  if (word === "in") {
    const count = Number.parseInt(bareWordAt(words, index + 1), 10);
    const unit = bareWordAt(words, index + 2);
    if (Number.isNaN(count) || count <= 0) {
      return null;
    }
    const text = words.slice(index, index + 3).join(" ");
    if (unit === "day" || unit === "days") {
      return dueDateMatch({
        text: text,
        date: addDays(today, count),
        consumed: 3,
      });
    }
    if (unit === "week" || unit === "weeks") {
      return dueDateMatch({
        text: text,
        date: addWeeks(today, count),
        consumed: 3,
      });
    }
  }

  return null;
}

function matchWeekday({
  words,
  index,
  today,
}: MatcherInput): Match | null {
  const isNext = bareWordAt(words, index) === "next";
  const nameIndex = isNext ? index + 1 : index;
  const weekday = WEEKDAYS[bareWordAt(words, nameIndex)];

  if (weekday === undefined) {
    return null;
  }

  const daysAhead = (weekday - today.getDay() + 7) % 7 || 7;
  const date = addDays(today, isNext ? daysAhead + 7 : daysAhead);

  return dueDateMatch({
    text: words.slice(index, nameIndex + 1).join(" "),
    date: date,
    consumed: nameIndex - index + 1,
  });
}

function matchMonthAndDay({
  words,
  index,
  today,
}: MatcherInput): Match | null {
  const first = bareWordAt(words, index);
  const second = bareWordAt(words, index + 1);

  const monthFirst = MONTHS[first];
  const dayFromSecond = Number.parseInt(second, 10);
  if (
    monthFirst !== undefined &&
    dayFromSecond >= 1 &&
    dayFromSecond <= 31
  ) {
    return dueDateMatch({
      text: words.slice(index, index + 2).join(" "),
      date: nextOccurrenceOf({
        month: monthFirst,
        day: dayFromSecond,
        today: today,
      }),
      consumed: 2,
    });
  }

  const dayFromFirst = Number.parseInt(first, 10);
  const monthSecond = MONTHS[second];
  if (
    monthSecond !== undefined &&
    dayFromFirst >= 1 &&
    dayFromFirst <= 31
  ) {
    return dueDateMatch({
      text: words.slice(index, index + 2).join(" "),
      date: nextOccurrenceOf({
        month: monthSecond,
        day: dayFromFirst,
        today: today,
      }),
      consumed: 2,
    });
  }

  return null;
}

function nextOccurrenceOf({
  month,
  day,
  today,
}: {
  month: number;
  day: number;
  today: Date;
}): Date {
  const thisYear = new Date(today.getFullYear(), month, day);
  if (
    thisYear >=
    new Date(today.getFullYear(), today.getMonth(), today.getDate())
  ) {
    return thisYear;
  }
  return new Date(today.getFullYear() + 1, month, day);
}

function matchIsoDate({ words, index }: MatcherInput): Match | null {
  const word = bareWordAt(words, index);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(word)) {
    return null;
  }
  const date = parseDate(word, "yyyy-MM-dd", new Date());
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return dueDateMatch({
    text: wordAt(words, index),
    date: date,
    consumed: 1,
  });
}

function matchTime({ words, index }: MatcherInput): Match | null {
  const isAt = bareWordAt(words, index) === "at";
  const timeIndex = isAt ? index + 1 : index;
  const word = bareWordAt(words, timeIndex);

  const meridiem = word.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (meridiem) {
    const rawHour = Number.parseInt(meridiem[1] ?? "0", 10);
    const minute = Number.parseInt(meridiem[2] ?? "0", 10);
    if (rawHour < 1 || rawHour > 12 || minute > 59) {
      return null;
    }
    const hour =
      meridiem[3] === "pm"
        ? (rawHour % 12) + 12
        : rawHour === 12
          ? 0
          : rawHour;
    return timeMatch({
      text: words.slice(index, timeIndex + 1).join(" "),
      hour: hour,
      minute: minute,
      consumed: timeIndex - index + 1,
    });
  }

  const twentyFourHour = word.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHour) {
    const hour = Number.parseInt(twentyFourHour[1] ?? "0", 10);
    const minute = Number.parseInt(twentyFourHour[2] ?? "0", 10);
    if (hour > 23 || minute > 59) {
      return null;
    }
    return timeMatch({
      text: words.slice(index, timeIndex + 1).join(" "),
      hour: hour,
      minute: minute,
      consumed: timeIndex - index + 1,
    });
  }

  return null;
}

function dueDateMatch({
  text,
  date,
  consumed,
}: {
  text: string;
  date: Date;
  consumed: number;
}): Match {
  return {
    token: {
      kind: "dueDate",
      text: text,
      value: format(date, "yyyy-MM-dd"),
    },
    consumed: consumed,
  };
}

function timeMatch({
  text,
  hour,
  minute,
  consumed,
}: {
  text: string;
  hour: number;
  minute: number;
  consumed: number;
}): Match {
  const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return {
    token: { kind: "dueTime", text: text, value: value },
    consumed: consumed,
  };
}

export function tagsIn(tokens: ParsedToken[]): string[] {
  return tokens
    .filter((token) => token.kind === "tag")
    .map((token) => token.value);
}

export function whoIn(tokens: ParsedToken[]): string | null {
  return (
    tokens.filter((token) => token.kind === "who").at(-1)?.value ??
    null
  );
}

export function listIn(tokens: ParsedToken[]): string | null {
  return (
    tokens.filter((token) => token.kind === "list").at(-1)?.value ??
    null
  );
}

export function stageIn(
  tokens: ParsedToken[],
): TaskStage | "" | null {
  return (
    tokens.filter((token) => token.kind === "stage").at(-1)?.value ??
    null
  );
}

export function stateIn(
  tokens: ParsedToken[],
): TaskState | null {
  return (
    tokens.filter((token) => token.kind === "state").at(-1)?.value ??
    null
  );
}

export function dueDateIn(tokens: ParsedToken[]): string | null {
  return (
    tokens.filter((token) => token.kind === "dueDate").at(-1)
      ?.value ?? null
  );
}

export function dueTimeIn(tokens: ParsedToken[]): string | null {
  return (
    tokens.filter((token) => token.kind === "dueTime").at(-1)
      ?.value ?? null
  );
}

export function recurrenceIn(
  tokens: ParsedToken[],
): RecurrenceValue | null {
  return (
    tokens.filter((token) => token.kind === "recurrence").at(-1)
      ?.value ?? null
  );
}
