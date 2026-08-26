const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function Weekdays({
  chosen,
  onChange,
}: {
  chosen: number[];
  onChange: (next: number[]) => void;
}) {
  function toggle(index: number): void {
    const next = chosen.includes(index)
      ? chosen.filter((weekday) => weekday !== index)
      : [...chosen, index];
    onChange(next.length > 0 ? next.sort() : chosen);
  }

  return (
    <div className="weekdays">
      {WEEKDAYS.map((weekday, index) => (
        <button
          key={weekday}
          type="button"
          className="weekday"
          data-on={chosen.includes(index)}
          onClick={() => toggle(index)}
        >
          {weekday}
        </button>
      ))}
    </div>
  );
}
