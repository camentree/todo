import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Timing } from "./Timing.tsx";
import { Chip } from "./ui/Chip.tsx";
import { Choice } from "./ui/Choice.tsx";
import { Field } from "./ui/Field.tsx";
import { Picker } from "./ui/Picker.tsx";
import { api } from "../data/api.ts";
import { canonicalName } from "@shared/names.ts";
import { stageLabel, TASK_STAGES } from "@shared/stages.ts";
import type { TaskStage } from "@shared/stages.ts";
import type { Task } from "@shared/types.ts";

const STAGE_OPTIONS = [
  { value: "", label: "None" },
  ...TASK_STAGES.map((stage) => ({
    value: stage as string,
    label: stageLabel(stage),
  })),
];

export function TaskDetails({
  task,
  onChange,
}: {
  task: Task;
  onChange: (changes: Partial<Task>) => void;
}) {
  const [listDraft, setListDraft] = useState<string | null>(null);
  const [newTag, setNewTag] = useState("");

  const { data: lists = [] } = useQuery({
    queryKey: ["lists"],
    queryFn: api.lists,
  });
  const { data: knownTags = [] } = useQuery({
    queryKey: ["tags", task.list],
    queryFn: () => api.tags(task.list ?? undefined),
    enabled: Boolean(task.list),
  });

  function chooseList(choice: string): void {
    const next = canonicalName(choice);
    if (next && next !== task.list) {
      onChange({ list: next });
    }
    setListDraft(null);
  }

  return (
    <>
      <Field label="List">
        <Picker
          value={listDraft ?? task.list ?? ""}
          options={lists}
          label="List"
          onChange={setListDraft}
          onChoose={chooseList}
          onLeave={() =>
            listDraft === null ? undefined : chooseList(listDraft)
          }
        />
      </Field>

      <Field label="Stage">
        <Choice
          label="Stage"
          value={task.stage ?? ""}
          options={STAGE_OPTIONS}
          onChange={(stage) =>
            onChange({ stage: (stage || null) as TaskStage | null })
          }
        />
      </Field>

      <Field label="Tags">
        <div className="sheet-tags">
          {task.tags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              sigil="#"
              field="tag"
              onRemove={() =>
                onChange({
                  tags: task.tags.filter(
                    (existing) => existing !== tag,
                  ),
                })
              }
            />
          ))}
          <Picker
            value={newTag}
            options={knownTags.filter(
              (tag) => !task.tags.includes(tag),
            )}
            className="tag-input"
            placeholder="Add a tag"
            label="Add a tag"
            onChange={setNewTag}
            onChoose={(choice) => {
              const tag = canonicalName(choice).replace(/^#/, "");
              if (tag && !task.tags.includes(tag)) {
                onChange({ tags: [...task.tags, tag] });
              }
              setNewTag("");
            }}
          />
        </div>
      </Field>

      <Timing
        schedule={task.schedule}
        dueDate={task.dueDate}
        dueTime={task.dueTime}
        onChange={onChange}
      />
    </>
  );
}
