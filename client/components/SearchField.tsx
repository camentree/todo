import { useRef } from "react";

import { CrossIcon, SearchIcon } from "./icons.tsx";
import { ParseableTitle } from "./ParseableTitle.tsx";

export function SearchField({
  text,
  onChange,
  onClose,
}: {
  text: string;
  onChange: (text: string) => void;
  onClose: () => void;
}) {
  const fieldRef = useRef<HTMLInputElement>(null);

  return (
    <div className="search-field">
      <SearchIcon />
      <ParseableTitle
        value={text}
        onChange={onChange}
        inputRef={fieldRef}
        at="search"
        onDone={(event) => {
          event.stopPropagation();
          fieldRef.current?.blur();
        }}
        onCancel={(event) => {
          event.stopPropagation();
          fieldRef.current?.blur();
        }}
        input={{
          placeholder: "Search",
          "aria-label": "Search",
          enterKeyHint: "search",
          autoComplete: "off",
          autoCapitalize: "none",
          autoCorrect: "off",
          spellCheck: false,
          autoFocus: true,
          "data-search-field": true,
        }}
      />
      <button
        type="button"
        className="icon-button"
        aria-label="Close search"
        onClick={onClose}
      >
        <CrossIcon />
      </button>
    </div>
  );
}
