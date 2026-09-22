import { extendTailwindMerge } from "tailwind-merge";

export const mergeClasses = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": ["text-heading", "text-title", "text-body", "text-meta", "text-label", "text-big"],
      rounded: ["rounded-card"],
      size: ["size-round", "size-round-small", "size-tick", "size-touch", "size-glyph"],
    },
  },
});
