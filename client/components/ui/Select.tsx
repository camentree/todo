export function Select<Value extends string>({
  value,
  options,
  onChange,
}: {
  value: Value;
  options: { value: Value; label: string }[];
  onChange: (value: Value) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as Value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
