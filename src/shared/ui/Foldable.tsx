import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

import { ChevronGlyph } from "./Glyphs.tsx";

export interface Folds {
  isOpen: (fold: { key: string; fallback: boolean }) => boolean;
  set: (fold: { key: string; open: boolean }) => void;
}

const FoldsContext = createContext<Folds | null>(null);

function rememberedFolds(): Record<string, boolean> {
  const folds: Record<string, boolean> = {};
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const name = localStorage.key(index) ?? "";
      if (name.startsWith("fold:")) folds[name.slice(5)] = localStorage.getItem(name) === "true";
    }
  } catch {
    return folds;
  }
  return folds;
}

export function FoldsProvider({ children }: { children: ReactNode }) {
  const [folds, setFolds] = useState(rememberedFolds);
  const value: Folds = {
    isOpen: ({ key, fallback }) => folds[key] ?? fallback,
    set: ({ key, open }) => {
      setFolds((current) => ({ ...current, [key]: open }));
      try {
        localStorage.setItem("fold:" + key, String(open));
      } catch {
        return;
      }
    },
  };
  return <FoldsContext.Provider value={value}>{children}</FoldsContext.Provider>;
}

export function useFolds(): Folds {
  const folds = useContext(FoldsContext);
  if (!folds) throw new Error("useFolds outside FoldsProvider");
  return folds;
}

export function Roll({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={"roll grid transition-[grid-template-rows] duration-[450ms] ease-[ease] " + (open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")} inert={!open}>
      <div className="min-h-0 overflow-y-clip">{children}</div>
    </div>
  );
}

export interface Fold {
  open: boolean;
  toggle: () => void;
  chevron: ReactNode;
}

export function Foldable({
  storageKey,
  defaultOpen,
  trigger,
  children,
}: {
  storageKey: string;
  defaultOpen: boolean;
  trigger: (fold: Fold) => ReactNode;
  children: ReactNode;
}) {
  const folds = useFolds();
  const open = folds.isOpen({ key: storageKey, fallback: defaultOpen });
  const toggle = () => folds.set({ key: storageKey, open: !open });
  return (
    <>
      {trigger({ open, toggle, chevron: <ChevronGlyph open={open} /> })}
      <Roll open={open}>{children}</Roll>
    </>
  );
}
