import type { ReactNode } from "react";

export function Card({ className, title, body, when }: { className?: string; title?: ReactNode; body: string; when: string }) {
  return (
    <div className={className ? "card " + className : "card"}>
      {title}
      <span className="card-body">{body}</span>
      <span className="card-when">{when}</span>
    </div>
  );
}
