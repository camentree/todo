import { useRef } from "react";

import { Sprite } from "./ui/Sprite.tsx";
import { Title } from "./Title.tsx";

export function Search({
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
      <Sprite name="search" />
      <Title
        value={text}
        onChange={onChange}
        inputRef={fieldRef}
        at="search"
        onDone={() => fieldRef.current?.blur()}
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
        <Sprite name="cross" />
      </button>
    </div>
  );
}
