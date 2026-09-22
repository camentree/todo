# todo

A task list, a runner, a journal and a notebook. Static files in the browser,
talking to Parallax over HTTP. `dev-api/` stands in for Parallax while you work;
its contract is written down in `dev-api/CLAUDE.md`.

## Running

```
bin/dev            # the dev slice
bin/dev slice2     # another one, on its own ports and its own data
```

`bin/dev` derives the API port and the Vite port from the slice name, installs
anything missing, seeds `data/<slice>` if it is not there yet, and prints the
LAN URL. Open that URL rather than `localhost`: the iOS Simulator and the Chrome
extension both need the LAN address. It refuses to start if either port is
already held, so two slices never share a data directory by accident.

The simulator opens a URL with `xcrun simctl openurl booted <url>` and
screenshots with `xcrun simctl io booted screenshot <file>`.

## Seeding and resetting

```
cd dev-api && npx tsx seed.ts ../data/dev
```

The seed is realistic and relative to today: three weeks of habit history with
some days missed and some counts left short, exercise definitions with subtasks,
an overdue one-off, one due today, three due this week, a backlog across
personal, garden and programming, comments on habits, one unseen comment from an
agent on a backlog task, two weeks of journal entries across four tags, and
eight notes across five tags. It is deterministic, so re-run it any time to
start over.

The stand-in reads the directory once at startup and keeps it in memory, so
restart `bin/dev` after seeding or the app keeps showing the old data. After any
check that changed data, re-seed before the next one so every criterion is
judged against the same starting state.

## Failing writes on purpose

```
curl -X POST http://<lan>:8795/_dev/fail -H 'content-type: application/json' -d '{"writes": true}'
```

Every later write returns 500 until you set it back to false. Use it to check
that the client reverts the change and raises the error sprite. The stand-in has
it; Parallax does not.

## Tests

```
npm test
```

## Deploying

`DEPLOY.md`.
