import { useState } from "react";
import type { ReactNode } from "react";

import { ChevronGlyph } from "./Glyphs.tsx";

export function remembered<T>({ key, fallback }: { key: string; fallback: T }): T {
  try {
    const stored = localStorage.getItem("fold:" + key);
    return stored === null ? fallback : (JSON.parse(stored) as T);
  } catch {
    return fallback;
  }
}

export function remember<T>({ key, value }: { key: string; value: T }): void {
  try {
    localStorage.setItem("fold:" + key, JSON.stringify(value));
  } catch {
    return;
  }
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
  const [open, setOpen] = useState(() => remembered({ key: storageKey, fallback: defaultOpen }));
  const toggle = () => {
    setOpen(!open);
    remember({ key: storageKey, value: !open });
  };
  return (
    <>
      {trigger({ open, toggle, chevron: <ChevronGlyph open={open} /> })}
      {open && children}
    </>
  );
}
