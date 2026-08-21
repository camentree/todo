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
  every screen is a preset of, and `screens/` picks the preset. Everything else
  under `components/` is a piece of chrome around it. One stylesheet,
  `styles.css`.
- `server/` — `routes.ts` is thin HTTP over `operations/`, which owns every
  database query.
- `shared/` — code both sides import: the capture parser, recurrence maths, task
  types, the stage and state enums.
- `sql/` — numbered migrations.
- `scripts/` — the commands below.

## Commands

The developer commands are the files in `scripts/` and the `npm run` entries in
`package.json`. Read those for the current list rather than trusting one written
down here.

Two things about them are not obvious from the names. Anything that touches the
database needs `DATABASE_URL` set. And `npm start` is not a developer command —
it runs the server in the foreground and is what the launchd agent on this
machine invokes, so it must stay as it is.

## The database

**`postgres://localhost/parallax` is the live database and it holds Camen's real
tasks.** `scripts/seed-database.ts` begins by truncating every table, so
anything that seeds must point somewhere else. It refuses to run against
`parallax`, but do not rely on that — set `DATABASE_URL` to a throwaway database
deliberately, every time.

The app owns the `todo` schema inside that database, which is also Parallax's,
which is why the app is pinned to this machine.

Migrations are files in `sql/`, numbered, applied by hand with `npm run migrate`
and recorded in `todo.migrations` so they are skipped on later runs. **Nothing
applies them automatically** — a merged migration has not run until someone runs
it, and it needs to go out with the deploy that needs it, not after.

## Tests

`scripts/test` typechecks and runs vitest over `shared/`, `server/` and
`client/`. It takes a couple of seconds; run it freely.

Coverage is deliberately narrow. Tests exist where being wrong would be silent
and where a person would not notice for weeks: the capture parser, recurrence
arithmetic, case folding, grouping. Rendering details and layout are not tested,
because looking at the app settles those faster and a test asserting them just
breaks on every change.

**Nothing in this repository drives a browser, and that is deliberate.** It used
to carry twenty-one Playwright scripts plus a screenshot script. They took four
minutes, and because they printed their observations rather than asserting them,
a script could report a completely wrong value and still be counted as passing.
Do not add any of it back.

To see the app, run it and look at it. If a change genuinely needs driving in a
browser to believe it — drag and drop, swipe thresholds, sheet gestures — write
a throwaway script somewhere outside the repository and delete it afterwards.
Playwright is still a devDependency so that stays possible; nothing imports it.
390x844 is the phone, which is the surface that matters.

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
