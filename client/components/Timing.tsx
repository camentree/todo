import { Count } from "./ui/Count.tsx";
import { Field } from "./ui/Field.tsx";
import { Choice } from "./ui/Choice.tsx";
import { Toggle } from "./ui/Toggle.tsx";
import { Weekdays } from "./ui/Weekdays.tsx";
import { When } from "./ui/When.tsx";
import { toDateString } from "@shared/recurrence.ts";
import type { Frequency, Schedule, Task } from "@shared/types.ts";

function periodLabels(repeatEvery: number) {
  return [
    {
      value: "daily" as Frequency,
      label: repeatEvery === 1 ? "day" : "days",
    },
    {
      value: "weekly" as Frequency,
      label: repeatEvery === 1 ? "week" : "weeks",
    },
    {
      value: "monthly" as Frequency,
      label: repeatEvery === 1 ? "month" : "months",
    },
  ];
}

export function Timing({
  schedule,
  dueDate,
  dueTime,
  onChange,
}: {
  schedule: Schedule | null;
  dueDate: string | null;
  dueTime: string | null;
  onChange: (changes: Partial<Task>) => void;
}) {
  const repeats = schedule !== null;

  function changeSchedule(changes: Partial<Schedule>): void {
    if (schedule) {
      onChange({ schedule: { ...schedule, ...changes } });
    }
  }

  return (
    <>
      <Field label="Repeats" row>
        <Toggle
          label="Repeats"
          on={repeats}
          onChange={(on) =>
            onChange({
              schedule: on
                ? {
                    frequency: "daily",
                    repeatEvery: 1,
                    weekdays: [],
                    dayOfMonth: null,
                    startsOn: dueDate ?? toDateString(new Date()),
                  }
                : null,
            })
          }
        />
      </Field>

      <div className="collapsible unhurried" data-open={repeats}>
        <div className="repeat-fields">
          {schedule && (
            <>
              <div className="repeat-every">
                <Field label="Every">
                  <Count
                    value={schedule.repeatEvery}
                    least={1}
                    most={52}
                    label="Every"
                    onChange={(repeatEvery) =>
                      changeSchedule({ repeatEvery: repeatEvery })
                    }
                  />
                </Field>
                <Field label="Period">
                  <Choice
                    label="Period"
                    value={schedule.frequency}
                    options={periodLabels(schedule.repeatEvery)}
                    onChange={(frequency) =>
                      changeSchedule({ frequency: frequency })
                    }
                  />
                </Field>
              </div>

              {schedule.frequency === "weekly" && (
                <Field label="On">
                  <Weekdays
                    chosen={schedule.weekdays}
                    onChange={(weekdays) =>
                      changeSchedule({ weekdays: weekdays })
                    }
                  />
                </Field>
              )}
            </>
          )}
        </div>
      </div>

      <Field label={repeats ? "Starts" : "Date"}>
        {schedule ? (
          <When
            kind="date"
            value={schedule.startsOn}
            label="Starts"
            onChange={(startsOn) =>
              changeSchedule({
                startsOn: startsOn || schedule.startsOn,
              })
            }
          />
        ) : (
          <When
            kind="date"
            value={dueDate ?? ""}
            example="31 Aug 2026"
            label="Date"
            onChange={(next) => onChange({ dueDate: next || null })}
            onClear={() => onChange({ dueDate: null })}
          />
        )}
      </Field>

      <Field label="Time">
        <When
          kind="time"
          value={dueTime?.slice(0, 5) ?? ""}
          example="8:00am"
          label="Time"
          onChange={(next) => onChange({ dueTime: next || null })}
          onClear={() => onChange({ dueTime: null })}
        />
      </Field>
    </>
  );
}
