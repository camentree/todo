# todo

A todo list that is also a work queue a background Claude Code agent reads from
and writes to. Camen's own tasks and the agent's programming queue live in the
same lists on the same screens. It is a web app added to a phone's home screen,
served publicly behind Cloudflare Access, running on the same machine and
Postgres server as Parallax.

The principles below are deliberate and several of them look like bugs if you
have not read them.

## Principles

- **Anything the code branches on is a fixed enum; anything only a human reads
  is derived from the data rather than modelled.** State and stage are enums.
  Tags and who a task belongs to are derived.
- **Nothing is ever deleted.** Completing, archiving and dismissing all leave
  the row where it is.
- **A ticked task stays in place until the next day.** Finishing something must
  not make it vanish out from under the tap that finished it.
- **Red is only ever for something going wrong.** Being late is a date, not an
  alarm, and no task is ever coloured for urgency — tags included. Red belongs
  to the swipe that destroys something and to a write that failed, because
  those are the only places where the app is telling you it broke rather than
  telling you where you are. Everything else is one accent plus neutrals.
- **Rows are separated by whitespace, not by rules or cards.** A busy screen is
  worse than a plain one.
- **Light-first, because the app gets used outdoors.** Contrast has to survive
  bright sun, so the muted text colour is held to a contrast ratio against the
  ground rather than tuned by eye.
- **Density comes out of padding, never out of type size.**
- **The phone is the surface that matters.** A handful of behaviours change on a
  wider screen; none of them alter the phone.

## The agent loop

A scheduled Claude Code routine picks up the oldest waiting task on a list that
carries stages, and a tag on the task names the repository to work in.

State is how it communicates. It moves the task into progress as it starts, into
review once it has pushed a branch and opened a draft pull request, and to
complete when that pull request lands. It never merges and never touches main.
When it needs something it says so in a comment and parks the task; moving the
task back to waiting is the signal to resume. Comments only ever mean it needs
you — there are no status updates.

## Layout

All TypeScript. React with react-router and TanStack Query, Hono on the server,
hand-written SQL over Postgres, no ORM.

The client is one list component that every screen is a preset of, plus the
chrome around it: the top bar, the capture row, the detail sheet. One
stylesheet, no CSS framework.

The server's routes are thin HTTP over an operations module that owns every
database query. The MCP tools the agent calls are the other adapter over that
same module, so every operation is defined once.

Shared code is what both sides import: the parser that pulls a list, tags, a
date and a time out of a single typed line, the recurrence arithmetic, the task
types and the enums.

## Commands

The developer commands are the files in the scripts directory and the package
scripts. Read those for the current list rather than trusting one written down
here.

Two things about them are not obvious from the names. Anything that touches the
database needs its connection string in the environment. And `npm start` is not
a developer command — it runs the server in the foreground and is what the
launchd agent on this machine invokes, so it must stay as it is.

## The database

The app owns its own schema inside Parallax's database, which is why it is
pinned to this machine. Parallax reads that schema through a read-only role.

**The database this machine serves from is live and holds Camen's real tasks.**
Seeding truncates every table, so anything that seeds must point somewhere else.
There is a guard against seeding the live database, but do not rely on it — set
the connection string to a throwaway database deliberately, every time.

Migrations are numbered files, applied by hand and recorded so later runs skip
them. **Nothing applies them automatically** — a merged migration has not run
until someone runs it, and it needs to go out with the deploy that needs it, not
after.

## Tests

The test command typechecks and then runs vitest over the shared, server and
client code. It takes a couple of seconds; run it freely.

Coverage is deliberately narrow. Tests exist where being wrong would be silent
and where a person would not notice for weeks: the capture parser, recurrence
arithmetic, case folding, grouping. Rendering details and layout are not tested,
because looking at the app settles those faster and a test asserting them just
breaks on every change.

**Nothing in this repository drives a browser, and that is deliberate.** It used
to carry a suite of Playwright scripts. They printed their observations rather
than asserting them, so a script could report a completely wrong value and still
be counted as passing, and they cost minutes on every run. Do not add any of it
back.

To see the app, run it and look at it. If a change genuinely needs driving in a
browser to believe it — drag and drop, swipe thresholds, sheet gestures — write
a throwaway script somewhere outside the repository and delete it afterwards.
Playwright is still a devDependency so that stays possible; nothing imports it.

## Deploying

Push to main. A launchd agent polls and deploys from the primary checkout on
this machine, but only when that checkout is on a clean main — so a stray
uncommitted change there quietly stops every deploy.

That checkout is also where the running server lives. Do not pull in it by hand:
the deploy only restarts the server on the path where it moves the ref itself,
so a manual pull leaves the process running the old code with nothing reporting
a problem. Work in a worktree and let the agent do the deploy.

`DEPLOY.md` has the rest, including the log locations and how to recover from a
failed deploy.
