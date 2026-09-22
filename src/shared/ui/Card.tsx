import type { ReactNode } from "react";

import { twMerge } from "tailwind-merge";

export function Card({ className, title, body, when }: { className?: string; title?: ReactNode; body: string; when: string }) {
  return (
    <div className={twMerge("card flex flex-col gap-[0.2rem] rounded-card bg-raised px-4 py-[0.8rem]", className)}>
      {title}
      <span className="text-body leading-[1.4] whitespace-pre-wrap">{body}</span>
      <span className="text-meta text-faint">{when}</span>
    </div>
  );
}
