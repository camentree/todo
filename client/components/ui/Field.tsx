import type { ReactNode } from "react";

import { Label } from "./Label.tsx";

export function Field({
  label,
  row = false,
  children,
}: {
  label: ReactNode;
  row?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="field" data-row={row}>
      <Label>{label}</Label>
      {children}
    </label>
  );
}
