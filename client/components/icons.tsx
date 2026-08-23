export function SearchIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
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
    </svg>
  );
}

export function CrossIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5.5 5.5l9 9M14.5 5.5l-9 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SlidersIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
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
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
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
    </svg>
  );
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className="chevron"
      data-open={open}
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 3.5 10.5 8 6 12.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function InfoIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
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
    </svg>
  );
}

export function TickIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4.5 10.5l3.8 3.8L15.5 6.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
