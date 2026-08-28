import { useEffect } from "react";
import type {
  ChangeEvent,
  InputHTMLAttributes,
  KeyboardEvent,
  RefObject,
} from "react";

type TitleElement = HTMLInputElement | HTMLTextAreaElement;

export function Title({
  value,
  onChange,
  inputRef,
  multiline = false,
  onDone,
  onCancel,
  onTab,
  input,
}: {
  value: string;
  onChange: (next: string) => void;
  inputRef: RefObject<TitleElement | null>;
  multiline?: boolean;
  onDone?: () => void;
  onCancel?: (event: KeyboardEvent<TitleElement>) => void;
  onTab?: (backwards: boolean) => void;
  input: InputHTMLAttributes<TitleElement> &
    Partial<Record<`data-${string}`, boolean>>;
}) {
  useEffect(() => {
    const field = inputRef.current;
    if (!multiline || !field) {
      return;
    }
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [value, multiline, inputRef]);

  function typed(event: ChangeEvent<TitleElement>): void {
    const next = event.target.value;
    if (next.includes("\n")) {
      onChange(next.replace(/\n/g, ""));
      onDone?.();
      return;
    }
    onChange(next);
  }

  function pressed(event: KeyboardEvent<TitleElement>): void {
    if (event.key === "Tab" && onTab) {
      event.preventDefault();
      event.stopPropagation();
      onTab(event.shiftKey);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      onDone?.();
      return;
    }
    if (event.key === "Escape") {
      onCancel?.(event);
    }
  }

  if (multiline) {
    return (
      <textarea
        {...input}
        ref={inputRef as RefObject<HTMLTextAreaElement>}
        rows={1}
        value={value}
        onChange={typed}
        onKeyDown={pressed}
      />
    );
  }

  return (
    <input
      {...input}
      ref={inputRef as RefObject<HTMLInputElement>}
      value={value}
      onChange={typed}
      onKeyDown={pressed}
    />
  );
}
