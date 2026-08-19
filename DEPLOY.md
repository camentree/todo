# Deploying

How code reaches the server and what keeps running there. The launchd
definitions and the Cloudflare tunnel live in the dotfiles repo, under
`machines/mac-intel-server.nix`.

## How a change goes out

Push to main. The `todo-deploy` agent on mac-intel-server fetches `origin/main`
every two minutes, and on a new revision rebuilds and restarts the server. A
run that finds nothing new exits after the fetch. Output goes to
`/tmp/todo-deploy.stdout.log`.

Deploys run against their own clone at `/Users/camen/Deploy/parallax-frontend`,
not against a working checkout, so a deploy can never collide with uncommitted
work and `git reset --hard` is safe. The repository is public, so the clone
needs no credentials.

Everything in this repository goes out that way. What does not: the launchd
definitions and the environment the server runs with — the database URL and the
port — which are nix's to own. Those live in dotfiles, which self-deploys the
same way, so a change there is also just a push.

To collect a push now rather than waiting for the schedule:

```bash
launchctl kickstart -k gui/$UID/org.nixos.todo-deploy
```

## When a deploy fails

`scripts/deploy` resets back to the previously deployed revision if the install
or the build fails, so a broken commit leaves the last good one serving rather
than a half-updated tree. It sends an ntfy notification on the `parallax` topic
saying which revision would not build.

A failure that gets past the build — the server starts and then crashes — is not
caught here. `KeepAlive` will restart it in a loop and `/tmp/todo.stderr.log`
will say why.

## Scripts

```bash
./scripts/serve      # what the todo agent runs: installs and builds if missing, migrates, starts
./scripts/deploy     # fetch origin/main and redeploy, if there is anything new
```

`npm ci` runs only when `package-lock.json` changed between the deployed
revision and the new one, so most deploys are a fetch, a build and a restart.

## launchd agents

`todo` runs the server and is kept alive; it listens on 8790, which the
Cloudflare tunnel serves as `todo.smallworkshop.dev`. Its `KeepAlive` is
conditioned on `scripts/serve` existing, so before the first deploy has cloned
the repository the agent stays down instead of thrashing.

```bash
launchctl kickstart -k gui/$UID/org.nixos.todo          # restart the server
tail -f /tmp/todo.stderr.log                            # server log
tail -f /tmp/todo-deploy.stdout.log                     # deploy log
```

## Database

Postgres runs on the same machine under its own launchd agent, with data in
`~/.postgres`. This app owns the `todo` schema inside the `parallax` database —
the same instance parallax itself uses, which is why the app is pinned to this
machine.

Migrations in `sql/` are applied by `npm run migrate`, which `scripts/serve`
runs on every start. Applied filenames are recorded in `todo.migrations` and
skipped on subsequent runs. They are forward-only; a bad migration is not
something the deploy rollback can undo.
