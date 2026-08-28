import type { AttributeField } from "@shared/attributes.ts";

export function Chip({
  label,
  sigil = "",
  field,
  guess = false,
  onRemove,
}: {
  label: string;
  sigil?: string;
  field?: AttributeField;
  guess?: boolean;
  onRemove?: () => void;
}) {
  const shown = `${sigil}${label.toLowerCase()}`;

  if (!onRemove) {
    return (
      <span
        className="chip"
        data-field={field}
        data-guess={guess}
        data-plain={sigil === ""}
      >
        {shown}
      </span>
    );
  }

  return (
    <button
      type="button"
      className="chip removable"
      data-field={field}
      data-guess={guess}
      data-plain={sigil === ""}
      aria-label={`Remove ${label}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onRemove}
    >
      {shown}
      <span className="chip-remove" aria-hidden="true">
        ×
      </span>
    </button>
  );
}
