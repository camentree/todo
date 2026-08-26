import { useState } from "react";

export function Count({
  value,
  least,
  most,
  label,
  onChange,
}: {
  value: number;
  least: number;
  most: number;
  label: string;
  onChange: (next: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      type="number"
      min={least}
      max={most}
      inputMode="numeric"
      aria-label={label}
      value={draft ?? String(value)}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.target.select()}
      onBlur={() => {
        const typed = Number.parseInt(draft ?? "", 10);
        if (typed >= least) {
          onChange(Math.min(most, typed));
        }
        setDraft(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}
