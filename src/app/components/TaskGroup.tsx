import type { ReactNode } from "react";

import type { PressHandlers } from "@shared/longPress.ts";
import { Foldable } from "@shared/ui/Foldable.tsx";
import { SquareTick } from "@shared/ui/SquareTick.tsx";
import { TextButton } from "@shared/ui/TextButton.tsx";

export function TaskGroup({
  storageKey,
  label,
  count,
  defaultOpen,
  select,
  press,
  focused,
  children,
}: {
  storageKey: string;
  label: string;
  count: number;
  defaultOpen: boolean;
  select: { on: boolean; onToggle: () => void } | null;
  press: PressHandlers | null;
  focused: boolean;
  children: ReactNode;
}) {
  return (
    <div className="group">
      <Foldable
        storageKey={storageKey}
        defaultOpen={defaultOpen}
        trigger={(fold) => (
          <div className={focused ? "group-head focused" : "group-head"} data-focus={"group:" + storageKey}>
            {select && <SquareTick on={select.on} onToggle={select.onToggle} />}
            <button className="fold" aria-label={fold.open ? "fold" : "unfold"} onClick={fold.toggle}>
              {fold.chevron}
            </button>
            <TextButton className="min-h-touch py-[0.6rem] text-label font-semibold tracking-[0.06em] text-dim uppercase" onSelect={fold.toggle} press={press}>
              {label}
            </TextButton>
            <span className={fold.open ? "group-count" : "group-count shown"}>{count}</span>
          </div>
        )}
      >
        {children}
      </Foldable>
    </div>
  );
}
