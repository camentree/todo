# Restructure: direct API requests, a design system, Tailwind

Three landings, in order. Each one leaves the app working and looking the same,
except where a change is called out and signed off.

The app stops being served by a Node process that proxies to Parallax, and
starts being static files that call Parallax directly. The stand-in API moves
out of the repo's source tree. What is left is split by whether it could be
carried into another app: `shared/` if it could, `app/` if it names a task, a
schedule, a comment or a journal. Then the stylesheet becomes Tailwind, a
component at a time.

## Phase 0 — Parallax sends CORS headers

Separate repo (`camentree/parallax`), lands first. Additive: nothing uses it
until Phase 1, so it can sit in production on its own.

`flask-cors` in `build()`, allowing `https://todo.smallworkshop.dev` and the LAN
dev origin, methods `GET POST PUT DELETE OPTIONS`, header `content-type`,
`Access-Control-Max-Age` 600.

### Acceptance Criteria

- `curl -X OPTIONS https://parallax.smallworkshop.dev/api/tasks/x -H 'Origin: https://todo.smallworkshop.dev' -H 'Access-Control-Request-Method: PUT' -i` returns 204 with `Access-Control-Allow-Origin`, `-Methods` and `-Headers`
- The same request with an unknown `Origin` does not return an allow header
- Every existing Parallax test passes unchanged

## Phase 1 — dev-api out, direct requests, `server/` deleted

### dev-api

- `dev-api/` at the repo root: `main.ts` (was `server/standin.ts`), `store.ts`,
  and its own `model.ts` and `journal.ts` carrying `parseMarkdown`,
  `serializeMarkdown` and `isDue`
- Its own `package.json` and `tsconfig.json`; keeps Hono
- Imports nothing from `src/`
- `POST /api/_fail` becomes `POST /_dev/fail`, out of the contract namespace
- `hono/cors` allowing the dev origins
- `dev-api/CLAUDE.md`: this tracks Parallax's HTTP server, linking
  `src/parallax/servers/http.py` and `src/parallax/features/{tasks,journal,notebook}.py`
  on `camentree/parallax` main; carries the wire model and endpoint semantics
  from DEV.md lines 1–80; marks `/_dev/fail` as not part of the contract

### Client

- `VITE_API_URL` prefixes every request in `api.ts`
- In dev it is the LAN address (`http://192.168.0.168:8795/api/`), not
  localhost, or the simulator cannot reach it
- `server.proxy` deleted from `vite.config.ts`

### Deployment (dotfiles, needs `nix-rebuild`)

- nginx server block serving `~/Projects/todo/dist/client` with
  `try_files $uri /index.html`
- Cutover: nginx on 8791 first, repoint cloudflared, verify, then delete the
  `org.nixos.todo` launchd agent. Avoids a window where neither serves
- `server/` deleted; `hono` and `@hono/node-server` leave the root
  `package.json`; `scripts/deploy` stops calling `launchctl kickstart`

### Housekeeping

- `bin/dev [slice]`: derives the API and Vite ports from the slice name, seeds
  a missing data directory, refuses to start if a port is held, handles the
  `npm install` and `node_modules/.vite` traps, prints the LAN URL
- `DEV.md` deleted. The contract goes to `dev-api/CLAUDE.md`; re-seeding
  between checks goes to `README.md`

### Acceptance Criteria

- `https://todo.smallworkshop.dev` loads the task list and `launchctl list | grep todo` shows no app process
- Ticking a task on the phone survives a reload
- With `/_dev/fail` on, a tick shows, reverts, and the error sprite carries the message
- Writes go to `https://parallax.smallworkshop.dev/api/...`, each preceded by an `OPTIONS`
- `bin/dev slice2` and `bin/dev slice3` run at once without touching each other's data
- `rg -n hono package.json` finds nothing
- `dev-api/` contains no import from `src/`
- Every existing test passes unchanged

## Phase 2 — restructure

```
src/
  shared/
    ui/            CircleTick SquareTick Handle RoundButton TextButton Card
                   Foldable Glyphs Swipeable MarkdownEditor Modal
                   tokens.css  seravek-*.woff2
    components/    TopBar  ShortcutsSheet
    hooks/         useLongPress  useIsPhone  useSwipe  useShortcuts
    format.ts
  app/
    models/        task.ts  schedule.ts  comment.ts  journal.ts
    components/    TaskRow  TaskGroup  Comment  Comments  Journals
    screens/       Tasks  Runner  TaskEditor  TaskEditorPhone  JournalEditor
    hooks/         (empty until something domain-aware needs one)
    data/          api.ts  store.tsx
    shortcuts.ts
dev-api/
test/
```

- `api.ts` gets one function per route — `listTasks`, `putTask`,
  `deleteComment`, `listJournals` — each owning its path and converting the
  wire shape into a model. `store.tsx` stops building URLs
- `markdown.ts` deleted: `stripMarkers` has no callers, `wordCount` moves into
  `Journals`
- `grammar.ts` dissolved: `everyLabel` to `schedule.ts`, the
  parse/serialize/token-span half into `TaskEditor`
- `composer.ts` into `TaskEditor`, `move.ts` into `Tasks`, `runner.ts` into
  `Runner` — each has exactly one caller today
- `Card` gains a title slot; `Comment` wraps it
- `Swipeable` splits into `useSwipe` and the standard reveals; `Swipeable` stays
  what callers use, so one threshold and one set of reveal colours hold by
  construction
- `shortcuts.tsx` splits three ways: hook to `shared/hooks`, sheet to
  `shared/components`, table of bindings to `app/shortcuts.ts`
- `useSheet` renamed `useIsPhone`
- `TaskEditorPhone` extracted: full viewport, no top bar, chosen by
  `useIsPhone`. `Overlay` unchanged this phase
- `COMPONENTS.md` deleted; its two rule paragraphs go to `shared/ui/CLAUDE.md`

### `shared/ui/CLAUDE.md`

- Use the existing component even if it fits imperfectly, and flag the mismatch
  so we can decide whether to change the component
- Almost fits: extend it in place
- An arrangement of parts is an app component, not a new shared one
- Never copy a shared component into `app/`
- `ui/` is leaves: a file there imports no other component of ours.
  `components/` is arrangements of them
- Nothing in `shared/` may import from `app/`, or it stops being portable

### Acceptance Criteria

- Tasks list, group folding, drag and drop with nesting, swipe both directions,
  the runner, both journals, and the composer round-tripping a task to text and
  back all behave as they did before
- `rg "task|comment|journal" src/shared` finds nothing
- No file in `src/shared` imports from `src/app`
- Every existing test passes unchanged

## Phase 2.5 — `Overlay` becomes `<dialog>`

Own landing: it can only be judged on the phone.

Native `showModal()` gives scroll locking, an inert background, focus trapping
and Escape. Delete the body freezing, the saved `scrollY` and the
`visualViewport` height fitting — `interactive-widget=resizes-content` is
already in the viewport meta and is meant to do that job. Test on the phone and
keep back only what iOS still needs.

### Acceptance Criteria

- Opening the runner or the journal editor on the phone does not scroll the list behind it
- Closing returns the list to the position it was at
- The keyboard does not push the editor off screen
- Escape closes on desktop

## Phase 3 — Tailwind, a component at a time

- **3a, spike.** `tailwindcss` + `@tailwindcss/vite`. Port `:root` into
  `@theme`. Convert one primitive. Verify the dark scheme still flips by
  redefining the same custom properties inside the existing
  `prefers-color-scheme` media query. If that does not hold, stop and
  reconsider before converting anything else
- **3b** `shared/ui` primitives, deleting each one's rules from `styles.css` as
  it lands
- **3c** `shared/components`, then `app/components`, then the screens
- **3d** CodeMirror rules move to `EditorView.theme()`, scoped to the editor
  instead of global
- **3e** `styles.css` ends as `@font-face`, `@theme`, and the structural
  `:has()` rules

Conventions: `className` passthrough with `tailwind-merge`, so a parent still
decides a child's size and no primitive takes a variant prop. Fixed values
become utilities; live values (`translateX(${offset}px)`, `strokeDashoffset`)
stay inline styles.

### Acceptance Criteria

- Each converted screen matches its pre-conversion screenshot in both schemes,
  or the change was raised and signed off
- `styles.css` holds only `@font-face`, `@theme`, and structural `:has()` rules
- No component takes a prop whose only effect is to pick a style
- Every existing test passes unchanged

## Decisions

- Direct requests with CORS, not the proxy. `parallax.smallworkshop.dev` is
  already published through cloudflared and the API has no auth, so there is no
  credential the proxy was protecting and nothing to hide in it.
- Preflight is the cost. Any request carrying `content-type: application/json`
  preflights cross-origin, so the verbs are irrelevant to it — POST would
  preflight too. `Access-Control-Max-Age` keeps it to one per URL per ten
  minutes.
- nginx serves the static files. It is already on that machine serving
  `projects.smallworkshop.dev` the same way, so the app ships with no server of
  its own and no Node process in production.
- The dev-api duplicates the wire model rather than importing it. A double that
  shares types with its client cannot catch contract drift.
- Models are what `api.ts` deserializes into, one per resource with its own
  routes: task, schedule, comment, journal. A notebook entry and a journal entry
  are the same shape, so `Journal` is the model and journals and notebooks are
  the two collections.
- `shared/` means portable to another app, not shared between components here.
  Measured that way most of the old `shared/` was not: `move.ts`, `composer.ts`
  and `runner.ts` each had exactly one caller.
- Portable hooks live in `shared/hooks`, not `app/hooks`. `Swipeable` and
  `ShortcutsSheet` are in `shared/` and use them, and `shared/` importing from
  `app/` would break the direction that makes it portable.
- Tailwind keeps the parent-sizes-the-child convention through `className`
  passthrough rather than variant props.
- The odd token values (`--round: 3.53rem`, `--big: 4.56rem`,
  `--heading: 1.74rem`) carry into `@theme` exactly. Tailwind does not round
  them, so nothing needs redesigning to fit a scale. Where a redesign is
  genuinely easier than a port, raise it as its own question.

## Out of scope

- Changing Parallax's routes or wire model. Phase 0 adds headers, nothing else.
- Making `Comments` generic over its item type. One app, one caller; that is
  inventing a requirement.
- A router library. `interaction/route.ts` already handles history, and the
  screens already have URLs.
- Divergence between app models and the wire shape beyond what conversion in
  `api.ts` needs. Worth doing later, in one place, once the boundary exists.
