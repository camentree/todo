import type { ReactNode } from "react";

export function Meta({ children }: { children: ReactNode }) {
  return <div className="meta">{children}</div>;
}
