import { useState } from "react";

function scrollListIntoView(field: HTMLInputElement): void {
  const scroller = field.closest(".info-body");
  const list = field.parentElement?.querySelector(".suggestions");
  if (!scroller || !list) {
    return;
  }
  const hidden =
    list.getBoundingClientRect().bottom -
    scroller.getBoundingClientRect().bottom;
  if (hidden > 0) {
    scroller.scrollBy({ top: hidden + 16, behavior: "smooth" });
  }
}

export function Picker({
  value,
  options,
  label,
  className,
  placeholder,
  onChange,
  onChoose,
  onLeave,
}: {
  value: string;
  options: string[];
  label: string;
  className?: string;
  placeholder?: string;
  onChange: (next: string) => void;
  onChoose: (choice: string) => void;
  onLeave?: () => void;
}) {
  const [showing, setShowing] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const matches =
    filter === null
      ? options
      : options.filter((option) =>
          option.toLowerCase().includes(filter.trim().toLowerCase()),
        );

  return (
    <div className="picker">
      <input
        className={className}
        value={value}
        placeholder={placeholder}
        aria-label={label}
        enterKeyHint="done"
        autoComplete="off"
        onChange={(event) => {
          onChange(event.target.value);
          setFilter(event.target.value);
          setShowing(true);
        }}
        onFocus={(event) => {
          const field = event.currentTarget;
          setFilter(null);
          setShowing(true);
          requestAnimationFrame(() => scrollListIntoView(field));
        }}
        onBlur={() => {
          setShowing(false);
          onLeave?.();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") {
            return;
          }
          event.preventDefault();
          onChoose(value);
          setShowing(false);
        }}
      />

      {showing && matches.length > 0 && (
        <div className="suggestions">
          {matches.map((option) => (
            <button
              type="button"
              key={option}
              className="suggestion"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChoose(option);
                setShowing(false);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
