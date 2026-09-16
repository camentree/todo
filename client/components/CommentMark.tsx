import { SpeechGlyph } from "./Glyphs.tsx";

export function CommentMark({ count, unseen, onSelect }: { count: number; unseen: boolean; onSelect: () => void }) {
  return (
    <button className={unseen ? "comment-mark unseen" : "comment-mark"} aria-label="comments" onClick={onSelect}>
      <SpeechGlyph />
      {count}
    </button>
  );
}
