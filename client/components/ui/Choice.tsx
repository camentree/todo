export function Choice<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value;
  options: { value: Value; label: string }[];
  onChange: (value: Value) => void;
}) {
  return (
    <div className="choice" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className="choice-option"
          role="radio"
          aria-checked={option.value === value}
          data-on={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
