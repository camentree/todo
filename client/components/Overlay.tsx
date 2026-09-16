import type { ReactNode } from "react";

export function Overlay({ children }: { children: ReactNode }) {
  return <div className="overlay">{children}</div>;
}
