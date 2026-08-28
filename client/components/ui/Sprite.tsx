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
  clock: {
    size: 15,
    box: 16,
    draw: (
      <>
        <circle
          cx="8"
          cy="8"
          r="6.3"
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <path
          d="M8 4.4V8l2.5 1.7"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  calendar: {
    size: 15,
    box: 16,
    draw: (
      <>
        <rect
          x="1.7"
          y="3"
          width="12.6"
          height="11.3"
          rx="1.8"
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <path
          d="M1.7 6.6h12.6M5 1.6v2.6M11 1.6v2.6"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </>
    ),
  },
  sun: {
    size: 15,
    box: 16,
    draw: (
      <>
        <circle cx="8" cy="8" r="3.1" fill="currentColor" />
        <path
          d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3.1 3.1l1.1 1.1M11.8 11.8l1.1 1.1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </>
    ),
  },
  sunStruck: {
    size: 15,
    box: 16,
    draw: (
      <>
        <circle cx="8" cy="8" r="3.1" fill="currentColor" />
        <path
          d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3.1 3.1l1.1 1.1M11.8 11.8l1.1 1.1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M2.2 13.8L13.8 2.2"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </>
    ),
  },
  undo: {
    size: 19,
    box: 20,
    draw: (
      <>
        <path
          d="M4.3 7.6h7.1a4.1 4.1 0 0 1 0 8.2H8.2"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M7.7 4.2 4.1 7.6l3.6 3.4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
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
  gear: {
    size: 18,
    box: 20,
    draw: (
      <>
        <path
          d="M10 1.4v2.4M10 16.2v2.4M1.4 10h2.4M16.2 10h2.4M3.9 3.9l1.7 1.7M14.4 14.4l1.7 1.7M16.1 3.9l-1.7 1.7M5.6 14.4l-1.7 1.7"
          stroke="currentColor"
          strokeWidth="2.6"
        />
        <circle
          cx="10"
          cy="10"
          r="5.4"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle
          cx="10"
          cy="10"
          r="2"
          stroke="currentColor"
          strokeWidth="1.5"
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
