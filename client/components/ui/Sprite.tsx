import type { ReactNode } from "react";

interface Drawing {
  size: number;
  box: number;
  className?: string;
  draw: ReactNode;
}

const SPRITES = {
  search: {
    size: 17,
    box: 20,
    draw: (
      <>
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
      </>
    ),
  },
  plus: {
    size: 21,
    box: 20,
    draw: (
      <path
        d="M10 4v12M4 10h12"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    ),
  },
  cross: {
    size: 15,
    box: 20,
    draw: (
      <path
        d="M5.5 5.5l9 9M14.5 5.5l-9 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    ),
  },
  sliders: {
    size: 17,
    box: 20,
    draw: (
      <>
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
      </>
    ),
  },
  bell: {
    size: 17,
    box: 20,
    draw: (
      <>
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
      </>
    ),
  },
  chevron: {
    size: 13,
    box: 16,
    className: "chevron",
    draw: (
      <path
        d="M6 3.5 10.5 8 6 12.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  info: {
    size: 19,
    box: 20,
    draw: (
      <>
        <circle
          cx="10"
          cy="10"
          r="7.4"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M10 9v4.4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="10" cy="6.4" r="0.95" fill="currentColor" />
      </>
    ),
  },
  tick: {
    size: 17,
    box: 20,
    draw: (
      <path
        d="M4.5 10.5l3.8 3.8L15.5 6.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  send: {
    size: 16,
    box: 20,
    draw: (
      <path
        d="M10 15.5V4.5M5.5 9L10 4.5L14.5 9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
} satisfies Record<string, Drawing>;

export type SpriteName = keyof typeof SPRITES;

export function Sprite({
  name,
  open,
}: {
  name: SpriteName;
  open?: boolean;
}) {
  const drawing: Drawing = SPRITES[name];
  return (
    <svg
      className={drawing.className}
      data-open={open}
      width={drawing.size}
      height={drawing.size}
      viewBox={`0 0 ${drawing.box} ${drawing.box}`}
      fill="none"
      aria-hidden="true"
    >
      {drawing.draw}
    </svg>
  );
}
