import type { ReactNode } from "react";

import { capitalise } from "@shared/format.ts";

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
  children,
}: {
  storageKey: string;
  label: string;
  count: number;
  defaultOpen: boolean;
  select: { on: boolean; onToggle: () => void } | null;
  press: PressHandlers | null;
  children: ReactNode;
}) {
  return (
    <div className="group">
      <Foldable
        storageKey={storageKey}
        defaultOpen={defaultOpen}
        trigger={(fold) => (
          <div className="group-head">
            {select && <span className="handle-space" />}
            {select && <SquareTick on={select.on} onToggle={select.onToggle} />}
            <TextButton active={false} onSelect={fold.toggle} press={press}>
              {!fold.open && fold.chevron}
              {capitalise(label)}
            </TextButton>
            {!fold.open && <span className="group-count">{count}</span>}
          </div>
        )}
      >
        {children}
      </Foldable>
    </div>
  );
}
