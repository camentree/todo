import { useRef } from "react";

export interface HistoryEntry {
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

export function useHistory() {
  const done = useRef<HistoryEntry[]>([]);
  const undone = useRef<HistoryEntry[]>([]);

  return {
    record: (entry: HistoryEntry): void => {
      done.current.push(entry);
      undone.current = [];
    },
    undo: async (): Promise<boolean> => {
      const entry = done.current.pop();
      if (!entry) {
        return false;
      }
      undone.current.push(entry);
      await entry.undo();
      return true;
    },
    redo: async (): Promise<boolean> => {
      const entry = undone.current.pop();
      if (!entry) {
        return false;
      }
      done.current.push(entry);
      await entry.redo();
      return true;
    },
  };
}
