import type { ReactNode } from "react";

import type { PressHandlers } from "../interaction/longPress.ts";
import { Foldable } from "./Foldable.tsx";
import { SquareTick } from "./SquareTick.tsx";
import { TextButton } from "./TextButton.tsx";

export function Group({
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
            <TextButton active={false} onSelect={fold.toggle} press={press}>
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
