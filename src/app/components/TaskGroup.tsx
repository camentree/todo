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
    <div className="group flex flex-col">
      <Foldable
        storageKey={storageKey}
        defaultOpen={defaultOpen}
        trigger={(fold) => (
          <div
            className={
              "group-head flex items-center gap-[0.4rem] rounded-lg pt-[0.35rem] pr-1 pb-[0.1rem] pl-1 text-dim transition-[background] duration-[450ms] ease-[ease] wide:-mx-[0.65rem] wide:px-[0.9rem]" +
              (focused ? " focused" : "")
            }
            data-focus={"group:" + storageKey}
          >
            {select && <SquareTick on={select.on} onToggle={select.onToggle} />}
            <button
              className="mx-[-0.5rem] flex h-11 w-8 flex-none items-center justify-center text-faint hover:text-dim [&_svg]:size-glyph wide:[&_svg]:size-[0.875rem]"
              aria-label={fold.open ? "fold" : "unfold"}
              onClick={fold.toggle}
            >
              {fold.chevron}
            </button>
            <TextButton className="min-h-touch py-[0.6rem] text-label font-semibold tracking-[0.06em] text-dim uppercase" onSelect={fold.toggle} press={press}>
              {label}
            </TextButton>
            <span className={"text-meta tracking-normal text-dim transition-opacity duration-[450ms] ease-[ease] " + (fold.open ? "opacity-0" : "opacity-100")}>{count}</span>
          </div>
        )}
      >
        {children}
      </Foldable>
    </div>
  );
}
