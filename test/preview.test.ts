import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { wordCount } from "@app/models/journal.ts";
import { MarkdownPreview } from "@shared/ui/MarkdownPreview.tsx";

function shown(text: string): string {
  return renderToStaticMarkup(createElement(MarkdownPreview, { text }));
}

describe("wordCount", () => {
  it("counts words across lines, without the markers", () => {
    expect(wordCount("### tempering\n\ncumin, garlic and **chilli** in ghee")).toBe(7);
    expect(wordCount("")).toBe(0);
    expect(wordCount("one")).toBe(1);
  });
});

describe("the preview of a body", () => {
  it("keeps the bullet on a bullet line and the number on a numbered line", () => {
    expect(shown("- call the pharmacy")).toBe("<div>- call the pharmacy</div>");
    expect(shown("2. second")).toBe("<div>2. second</div>");
  });

  it("keeps the hashes on a heading line", () => {
    expect(shown("### tempering")).toBe("<div>### tempering</div>");
  });

  it("gives bold and italic their weight and style, and code its own element, without the marks", () => {
    expect(shown("sat for **twelve** minutes")).toBe("<div>sat for <strong>twelve</strong> minutes</div>");
    expect(shown("_soft_ and `parallax_reader`")).toBe("<div><em>soft</em> and <code>parallax_reader</code></div>");
  });

  it("shows a link by its words and drops the address", () => {
    expect(shown("read [the docs](https://example.com/x) first")).toBe("<div>read the docs first</div>");
  });

  it("keeps a bare address and drops the angle brackets around one", () => {
    expect(shown("read https://example.com/x first")).toBe("<div>read https://example.com/x first</div>");
    expect(shown("<https://example.com>")).toBe("<div>https://example.com</div>");
  });

  it("drops blank lines and fences so three lines of preview are three lines of writing", () => {
    expect(shown("first\n\n```js\nsecond\n```\n\nthird")).toBe("<div>first</div><div>second</div><div>third</div>");
  });
});
