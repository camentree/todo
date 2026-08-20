# Deploying

How code reaches the server and what keeps running there. The launchd
definitions and the Cloudflare tunnel live in the dotfiles repo, under
`machines/mac-intel-server.nix`.

## How a change goes out

Push to main. The `app-deploy` agent on mac-intel-server runs every two minutes
and calls `scripts/deploy` in each of one-offs, parallax and this repository, so
nothing else is needed. A run that finds nothing new exits after the fetch.
Output for all three goes to `/tmp/app-deploy.stdout.log`.

Everything in this repository goes out that way. What does not: the launchd
definitions and the environment the server runs with — the database URL and the
port — which are nix's to own. Those live in dotfiles, and a change there needs
`nix-rebuild mac-intel-server` on the machine.

To collect a push now rather than waiting for the schedule:

```bash
launchctl kickstart -k gui/$UID/org.nixos.app-deploy
```

## The checkout

`scripts/deploy` runs from the primary checkout at
`/Users/camen/Projects/parallax-frontend`, which is also where the server runs
from. It deploys only when that checkout is on main with nothing uncommitted,
and otherwise logs that it skipped.

That means working on the server directly is safe — it pauses deploys rather
than discarding your edits — but a stray change left behind will quietly stop
anything from going out. Work on a branch, and leave main clean.

## When a deploy fails

Nothing rolls back. The script stops at the failing step with the checkout
already on the new revision, and whatever was running keeps running. Recover by
reverting on GitHub; the next run deploys the revert.

Most breakage is caught before anything restarts, because the build gates on
server code as well as client code: `npm run build` runs `tsc --noEmit` across
`client`, `server`, `shared` and `scripts` before vite touches anything.

A commit that builds but crashes on startup gets past all of this — `KeepAlive`
then restarts it in a loop, with the reason in `/tmp/todo.stderr.log`.

## What a deploy actually does

`npm run build` only builds the client; the server is never compiled, and
`npm start` runs `server/main.ts` through tsx. New files in `dist/client` are
served the moment they land, because the running process reads them from disk
per request.

The restart is therefore not about picking up client files. It exists because
the server's own code is read into memory once, at startup.

## launchd agents

`todo` runs `npm start` and is kept alive; it listens on 8790, which the
Cloudflare tunnel serves as `todo.smallworkshop.dev`. Deploys are `app-deploy`,
shared with the other two repositories.

```bash
launchctl kickstart -k gui/$UID/org.nixos.todo          # restart the server
tail -f /tmp/todo.stderr.log                            # server log
tail -f /tmp/app-deploy.stdout.log                      # deploy log, all repos
```

## Database

Postgres runs on the same machine under its own launchd agent, with data in
`~/.postgres`. This app owns the `todo` schema inside the `parallax` database —
the same instance parallax itself uses, which is why the app is pinned to this
machine.

Migrations in `sql/` are applied by `npm run migrate`, which nothing runs
automatically — run it on the machine when a change needs one. Applied filenames
are recorded in `todo.migrations` and skipped on subsequent runs.
