export function When({
  kind,
  value,
  example,
  label,
  onChange,
  onClear,
}: {
  kind: "date" | "time";
  value: string;
  example?: string;
  label: string;
  onChange: (next: string) => void;
  onClear?: () => void;
}) {
  const empty = value === "";

  return (
    <div className="when-field" data-empty={empty}>
      <input
        type={kind}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {empty && example && (
        <span className="when-example">{example}</span>
      )}
      {!empty && onClear && (
        <button
          type="button"
          className="when-clear"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={onClear}
        >
          ×
        </button>
      )}
    </div>
  );
}
