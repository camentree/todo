export function PlusGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M8 2v12M2 8h12" />
    </svg>
  );
}

export function TickGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5l3.5 3.5L13 5" />
    </svg>
  );
}

export function ChevronGlyph({ open }: { open: boolean }) {
  return (
    <svg className={open ? "chevron open" : "chevron"} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

export function PlayGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
      <path d="M5.6 6c0-1 1.1-1.6 2-1.1l10 5.9c.9.5.9 1.8 0 2.3l-10 5.9c-.9.5-2-.1-2-1.1z" />
    </svg>
  );
}

export function ArrowGlyph({ direction }: { direction: "previous" | "next" }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === "previous" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

export function CrossGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function SpeechGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />
    </svg>
  );
}

export function RepeatGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 8a5 5 0 0 1-8.6 3.5M3 8a5 5 0 0 1 8.6-3.5" />
      <path d="M11.6 1.8v2.7H8.9M4.4 14.2v-2.7h2.7" />
    </svg>
  );
}

export function SubtasksGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2.5 3.5h11M6 8h7.5M6 12.5h7.5" />
    </svg>
  );
}

export function GripGlyph() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
      <circle cx="2.5" cy="3" r="1.5" />
      <circle cx="7.5" cy="3" r="1.5" />
      <circle cx="2.5" cy="8" r="1.5" />
      <circle cx="7.5" cy="8" r="1.5" />
      <circle cx="2.5" cy="13" r="1.5" />
      <circle cx="7.5" cy="13" r="1.5" />
    </svg>
  );
}
