import { TextButton } from "@shared/ui/TextButton.tsx";

import type { Arrangement } from "../models/task.ts";
import { groupings, sortings } from "../models/task.ts";

function Choices<Option extends string>({ label, options, chosen, onChoose }: { label: string; options: Option[]; chosen: Option; onChoose: (option: Option) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-[1.2rem] px-1">
      <span className="min-w-[4.5rem] text-meta text-dim">{label}</span>
      {options.map((option) => (
        <TextButton
          key={option}
          className={"min-h-touch py-[0.7rem] text-body font-medium " + (option === chosen ? "text-accent" : "text-dim hover:text-text")}
          onSelect={() => onChoose(option)}
        >
          {option}
        </TextButton>
      ))}
    </div>
  );
}

export function ArrangementSheet({ arrangement, onArrange, onClose }: { arrangement: Arrangement; onArrange: (arrangement: Arrangement) => void; onClose: () => void }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="fixed inset-x-0 bottom-0 z-[21] mx-auto flex max-w-column flex-col gap-0 rounded-t-2xl bg-raised px-gutter pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(event) => event.stopPropagation()}>
        <Choices label="group by" options={groupings} chosen={arrangement.grouping} onChoose={(grouping) => onArrange({ ...arrangement, grouping })} />
        <Choices label="sort by" options={sortings} chosen={arrangement.sorting} onChoose={(sorting) => onArrange({ ...arrangement, sorting })} />
      </div>
    </div>
  );
}
