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
  return (
    <span
      className={onRemove ? "chip removable" : "chip"}
      data-field={field}
      data-guess={guess}
    >
      {sigil}
      {label.toLowerCase()}
      {onRemove && (
        <button
          type="button"
          className="chip-remove"
          aria-label={`Remove ${label}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </span>
  );
}
