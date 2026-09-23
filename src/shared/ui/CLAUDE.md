# shared/

`shared/` means portable to another app, not shared between components here. A
file here may not name a task, a comment, a journal or a schedule, and may not
import anything from `app/`, or it stops being portable.

`ui/` is leaves: a file there imports no component of ours except a glyph.
`components/` is arrangements of them. An arrangement of parts that only this
app would want is an app component, not a new shared one.

## Using one

- Use the existing component even if it fits imperfectly, and flag the mismatch
  so we can decide whether to change the component.
- Almost fits: extend it in place.
- Never copy a shared component into `app/`.

## Sizes and colours

Sizes and colours come from the tokens in `tokens.css`: `:root` holds the light
palette and dark is the same names redefined, and `@theme inline` points every
Tailwind utility at those same properties, so the utilities flip with the
scheme.

A primitive writes its own look as utilities and takes a `className`, merged
with `mergeClasses` so the caller wins. That is how a parent sets a child's
size or colour; a primitive never takes a variant prop. A named token used in a
utility (`text-title`, `size-round`, `rounded-card`) has to be listed in
`mergeClasses.ts` too, or tailwind-merge reads it as a different property and
drops the wrong one.
