export function Check({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 6.5l2.5 2.5 4.5-5" />
    </svg>
  );
}

export function Chevron({ open, size = 8 }: { open: boolean; size?: number }) {
  return (
    <svg
      className={open ? "chevron open" : "chevron"}
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 1.5l3.5 3.5L3 8.5" />
    </svg>
  );
}

export function Play() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M4 2.8c0-.6.65-.95 1.15-.65l4.4 2.9c.5.33.5 1.07 0 1.4l-4.4 2.9C4.65 9.65 4 9.3 4 8.7z" />
    </svg>
  );
}

export function Plus() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M6 2v8M2 6h8" />
    </svg>
  );
}

export function Cross({ opacity }: { opacity: number }) {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ opacity }}>
      <path d="M3 3l6 6M9 3l-6 6" />
    </svg>
  );
}

export function Box({ done }: { done: boolean }) {
  return <span className="box">{done && <Check />}</span>;
}
