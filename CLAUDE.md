# todo

A todo list that is also a work queue a background Claude Code agent reads from
and writes to. Camen's own tasks and the agent's programming queue live in the
same lists on the same screens. It is a web app added to a phone's home screen,
served publicly behind Cloudflare Access, running on the same machine and
Postgres server as Parallax.

Two documents describe it. `design.md` is the original intent, including the
reasoning behind decisions that look arbitrary. `features.md` is the behaviour
as built, and **where the two disagree, `features.md` is right**. Read the
sections that touch what you are changing before changing it — several rules
here are deliberate and look like bugs if you have not read them, notably that
nothing is ever coloured red, that a ticked task stays in place until the next
day, and that nothing is ever deleted.

## Layout

All TypeScript. React 19 with react-router and TanStack Query, Hono on the
server, hand-written SQL over Postgres, no ORM.

- `client/` — the app. `components/TaskBoard.tsx` is the one list component
  every screen is a preset of; `components/TaskSheet.tsx` is the detail sheet,
  `components/NewTask.tsx` the capture row, `components/Chrome.tsx` the top bar.
  `screens/Tasks.tsx` chooses the preset. One stylesheet, `styles.css`.
- `server/` — `routes.ts` is thin HTTP over `operations/`, which owns every
  database query.
- `shared/` — code both sides import: the capture parser, recurrence maths, task
  types, the stage and state enums.
- `sql/` — numbered migrations.
- `scripts/` — the commands below.

## Commands

`DATABASE_URL` must be set for anything that touches the database.

| | |
|---|---|
| `scripts/start` | build and serve the app in the background on `PORT`, default 8791 |
| `scripts/stop` | stop it |
| `scripts/test` | typecheck, then run the vitest suite |
| `npm run dev` | the watch loop: API server plus vite with hot reload |
| `npm run seed` | reset the database to known fixture data |
| `npm run migrate` | apply any unapplied migrations in `sql/` |
| `npm run shoot` | write screenshots of the app to `SHOT_DIR` |

`npm start` is not a developer command. It runs the server in the foreground and
is what the launchd agent on this machine invokes, so it must stay as it is.

## The database

**`postgres://localhost/parallax` is the live database and it holds Camen's real
tasks.** `scripts/seed-database.ts` begins by truncating every table, so
anything that seeds must point somewhere else. It refuses to run against
`parallax`, but do not rely on that — set `DATABASE_URL` to a throwaway database
deliberately, every time.

The app owns the `todo` schema inside that database, which is also Parallax's,
which is why the app is pinned to this machine.

Migrations are files in `sql/`, numbered, and recorded in `todo.migrations` so
they are skipped on later runs. The deploy applies them, after the build and
before the restart, so a migration goes out with the code that needs it. If one
fails the deploy rolls the code back — but not the schema, since anything
earlier in the same run has already applied.

## Tests

`scripts/test` typechecks and runs vitest over `shared/`, `server/` and
`client/`. It takes a couple of seconds; run it freely.

Coverage is deliberately narrow. Tests exist where being wrong would be silent
and where a person would not notice for weeks: the capture parser, recurrence
arithmetic, case folding, grouping. Rendering details and layout are not tested,
because a screenshot settles those faster and a test asserting them just breaks
on every change.

This repository used to carry twenty-one Playwright scripts that drove the real
app in a browser. They were removed. They took four minutes, and because they
printed their observations rather than asserting them, a script could report a
completely wrong value and still be counted as passing. Do not reintroduce that
shape. If a change genuinely needs driving in a browser to believe it — drag and
drop, swipe thresholds, sheet gestures — write a throwaway script outside the
repository, or add one that makes real assertions and earns its runtime.

`npm run shoot` is the tool for seeing what the app looks like. Screenshots at
390x844 match the phone, which is the primary surface.

## Deploying

Push to main. A launchd agent polls every two minutes and deploys from the
primary checkout at `~/Projects/todo`, but only when that checkout is on a clean
main — so a stray uncommitted change there quietly stops every deploy.

That checkout is also where the running server lives. Do not pull in it by hand:
the deploy only restarts the server on the path where it moves the ref itself,
so a manual pull leaves the process running the old code with nothing reporting
a problem. Work in a worktree and let the agent do the deploy.

`DEPLOY.md` has the rest, including the log locations and how to recover from a
failed deploy.
